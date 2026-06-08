/**
 * Review Packet Generator v7A.2
 *
 * Transforms a validated OpenBrainObservationDraft into a human-reviewable
 * ReviewPacket. Unsafe drafts are rejected — no packet is created.
 *
 * NO network writes. NO governed state. NO execution authority.
 */

import type { OpenBrainObservationDraft } from "../types";
import type {
  ReviewPacket,
  ReviewSummary,
  RiskFlag,
  DecisionSection,
  HumanDecision,
  ForbiddenDecision,
  FORBIDDEN_DECISIONS,
} from "./types";

const ALLOWED_DECISIONS: HumanDecision[] = [
  "accept_for_future_observation_write",
  "reject",
  "needs_revision",
  "defer",
];

/**
 * Generate a ReviewPacket from a validated OpenBrainObservationDraft.
 *
 * Returns null if the draft fails safety checks (no packet created for unsafe drafts).
 */
export function generateReviewPacket(
  draft: OpenBrainObservationDraft
): { packet: ReviewPacket; errors: string[] } | null {
  const errors: string[] = [];

  // ── Pre-check: draft must pass safety boundaries ───────────────

  if (draft.safety.notExecutionAuthority !== true) {
    errors.push("CRITICAL: Draft claims execution authority — no packet created");
  }
  if (draft.safety.containsTradeOrders !== false) {
    errors.push("CRITICAL: Draft contains trade orders — no packet created");
  }
  if (draft.safety.containsExecutionInstructions !== false) {
    errors.push("CRITICAL: Draft contains execution instructions — no packet created");
  }
  if (draft.safety.containsWalletReferences !== false) {
    errors.push("CRITICAL: Draft contains wallet references — no packet created");
  }
  if (draft.safety.containsCredentials !== false) {
    errors.push("CRITICAL: Draft contains credentials — no packet created");
  }
  if (draft.governance.isGovernedState !== false) {
    errors.push("CRITICAL: Draft claims governed state — no packet created");
  }
  if (draft.governance.requiresHumanReview !== true) {
    errors.push("CRITICAL: Draft does not require human review — no packet created");
  }
  if (draft.governance.networkWriteStatus !== "dry-run-local-only") {
    errors.push(
      `CRITICAL: Draft networkWriteStatus is "${draft.governance.networkWriteStatus}" — no packet created`
    );
  }

  // If any critical errors, refuse to create packet (fail-closed)
  if (errors.length > 0) {
    return null;
  }

  // ── Build summary ──────────────────────────────────────────────

  const summary: ReviewSummary = {
    title: `Observation Review: ${draft.regimeObservation.currentRegime} regime | ${draft.compositeObservation.signal} signal`,
    signal: draft.compositeObservation.signal,
    confidence: draft.compositeObservation.confidence,
    regime: draft.regimeObservation.currentRegime,
    assetCount: draft.assetObservations.length,
    activeProviders: draft.providerStatus.filter(
      (p) => p.status === "active" || p.status === "degraded"
    ).length,
    degradedProviders: draft.providerStatus.filter((p) => p.status === "degraded").length,
    isMockData: draft.governance.dataMode === "mock",
    keyFindings: buildKeyFindings(draft),
  };

  // ── Build risk flags ───────────────────────────────────────────

  const riskFlags: RiskFlag[] = buildRiskFlags(draft);

  // ── Build decision section ─────────────────────────────────────

  const decision: DecisionSection = {
    recordedInLedger: false,
    allowedDecisions: [...ALLOWED_DECISIONS],
    blockedDecisions: [...FORBIDDEN_DECISIONS] as ForbiddenDecision[],
    // Human fills these:
    humanDecision: undefined,
    reviewerNotes: undefined,
    decidedAt: undefined,
  };

  // ── Assemble packet ────────────────────────────────────────────

  const packet: ReviewPacket = {
    schemaVersion: "open-brain-review-packet-v7a2",
    generatedAt: new Date().toISOString(),

    sourceDraft: {
      schemaVersion: draft.schemaVersion,
      draftedAt: draft.draftedAt,
      snapshotGeneratedAt: draft.sourceSnapshot.generatedAt,
      snapshotSource: draft.sourceSnapshot.source,
    },

    summary,
    riskFlags,
    decision,

    safety: {
      notExecutionAuthority: true,
      isGovernedState: false,
      networkWriteStatus: "dry-run-local-only",
      humanReviewRequired: true,
    },

    audit: {
      packetGeneratedBy: "v7a2-review-packet-generator",
      bridgeVersion: "v7a2",
      reviewPhase: "pre-write-human-review",
    },
  };

  return { packet, errors };
}

// ── Internal helpers ────────────────────────────────────────────

function buildKeyFindings(draft: OpenBrainObservationDraft): string[] {
  const findings: string[] = [];

  findings.push(
    `Composite signal: ${draft.compositeObservation.signal} (confidence: ${Math.round(draft.compositeObservation.confidence * 100)}%)`
  );

  findings.push(`Regime: ${draft.regimeObservation.currentRegime}`);

  if (draft.regimeObservation.transitionConfidence > 0.5) {
    findings.push(
      `Regime transition detected: ${draft.regimeObservation.priorRegime} → ${draft.regimeObservation.currentRegime} (${Math.round(draft.regimeObservation.transitionConfidence * 100)}% confidence)`
    );
  }

  const defensiveAssets = draft.assetObservations.filter(
    (a) => a.classification === "flight_to_safety"
  );
  const riskAssets = draft.assetObservations.filter(
    (a) => a.classification === "risk_on"
  );
  findings.push(
    `Barbell allocation: ${defensiveAssets.length} defensive, ${riskAssets.length} risk-on`
  );

  const degraded = draft.providerStatus.filter((p) => p.status === "degraded");
  if (degraded.length > 0) {
    findings.push(
      `Provider degradation: ${degraded.map((p) => p.name).join(", ")} — confidence reduced`
    );
  }

  const unavailable = draft.providerStatus.filter((p) => p.status === "unavailable");
  if (unavailable.length > 0) {
    findings.push(
      `Unavailable providers: ${unavailable.map((p) => p.name).join(", ")}`
    );
  }

  if (draft.governance.dataMode === "mock") {
    findings.push("DATA SOURCE: Mock baseline — not live market data");
  }

  if (draft.compositeObservation.blockingIssues && draft.compositeObservation.blockingIssues.length > 0) {
    findings.push(`Blocking issues: ${draft.compositeObservation.blockingIssues.length}`);
  }

  return findings;
}

function buildRiskFlags(draft: OpenBrainObservationDraft): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // Mock data flag
  if (draft.governance.dataMode === "mock") {
    flags.push({
      severity: "warning",
      category: "data_source",
      description: "Snapshot is mock data. Observations should not be promoted to governed state without live data verification.",
      blocksAcceptance: false,
    });
  }

  // Low confidence
  if (draft.compositeObservation.confidence < 0.5) {
    flags.push({
      severity: "warning",
      category: "confidence",
      description: `Low composite confidence (${Math.round(draft.compositeObservation.confidence * 100)}%). Review provider status before acceptance.`,
      blocksAcceptance: false,
    });
  }

  // Critical confidence
  if (draft.compositeObservation.confidence < 0.3) {
    flags.push({
      severity: "critical",
      category: "confidence",
      description: `Critical confidence level (${Math.round(draft.compositeObservation.confidence * 100)}%). Acceptance for future write is NOT recommended.`,
      blocksAcceptance: true,
    });
  }

  // Provider degradation
  const degradedCount = draft.providerStatus.filter((p) => p.status === "degraded").length;
  if (degradedCount > 0) {
    flags.push({
      severity: degradedCount >= 2 ? "critical" : "warning",
      category: "provider_degradation",
      description: `${degradedCount} provider(s) degraded. Data quality may be insufficient for observation write.`,
      blocksAcceptance: degradedCount >= 2,
    });
  }

  // Defensive signal
  if (draft.compositeObservation.signal === "defensive") {
    flags.push({
      severity: "info",
      category: "signal",
      description: "Defensive signal indicates flight-to-safety regime. This is informational, not a recommendation.",
      blocksAcceptance: false,
    });
  }

  // Not execution authority reminder
  flags.push({
    severity: "info",
    category: "governance",
    description: "This packet is for observation review only. It does not and cannot authorize execution, trades, or governed state promotion.",
    blocksAcceptance: false,
  });

  return flags;
}
