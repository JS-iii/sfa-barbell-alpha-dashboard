/**
 * Open Brain Observation Bridge Transformer v7A (DRY-RUN ONLY)
 *
 * Transforms a validated AlphaSnapshot into an OpenBrainObservationDraft.
 *
 * NO network writes. NO credentials. NO execution authority.
 *
 * Pipeline:
 *   validated AlphaSnapshot → OpenBrainObservationDraft → local JSONL log
 */

import type { AlphaSnapshot } from "@/types/alphaSnapshot";
import type {
  OpenBrainObservationDraft,
  BridgeValidationResult,
  DryRunLogEntry,
} from "./types";

/**
 * Transform a validated AlphaSnapshot into an observation draft.
 *
 * This function NEVER writes to any network service.
 * It only transforms data in memory.
 */
export function transformToObservationDraft(
  snapshot: AlphaSnapshot
): OpenBrainObservationDraft {
  return {
    schemaVersion: "open-brain-observation-draft-v7a",
    draftedAt: new Date().toISOString(),

    // Provenance preserved exactly from source snapshot
    sourceSnapshot: {
      schemaVersion: snapshot.provenance.schemaVersion,
      generatedAt: snapshot.provenance.generatedAt,
      source: snapshot.provenance.source,
      dataHash: snapshot.provenance.dataHash,
      generatorCommit: snapshot.provenance.generatorCommit,
    },

    // Provider status preserved exactly
    providerStatus: snapshot.providers.map((p) => ({
      name: p.name,
      status: p.status,
      lastUpdated: p.lastUpdated,
      latencyMs: p.latencyMs,
      error: p.error,
    })),

    // Asset observations with confidence preserved (not inflated)
    assetObservations: snapshot.assets.map((a) => ({
      symbol: a.symbol,
      name: a.name,
      regime: a.regime,
      score: a.score,
      confidence: a.confidence,
      classification: a.classification,
      providerContributions: a.providerContributions,
    })),

    // Regime observation
    regimeObservation: {
      currentRegime: snapshot.regime.currentRegime,
      priorRegime: snapshot.regime.priorRegime,
      transitionConfidence: snapshot.regime.transitionConfidence,
      description: snapshot.regime.description,
    },

    // Composite signal observation
    compositeObservation: {
      signal: snapshot.composite.signal,
      confidence: snapshot.composite.confidence,
      contributingFactors: snapshot.composite.contributingFactors,
      blockingIssues: snapshot.composite.blockingIssues,
    },

    // Safety declarations (hardcoded, never conditional)
    safety: {
      notExecutionAuthority: true,
      containsTradeOrders: false,
      containsWalletReferences: false,
      containsExecutionInstructions: false,
      containsCredentials: false,
    },

    // Governance metadata
    governance: {
      requiresHumanReview: true,
      isGovernedState: false,
      dataMode: snapshot.data_mode || "unknown",
      networkWriteStatus: "dry-run-local-only",
    },
  };
}

/**
 * Validate an observation draft before logging.
 *
 * Checks:
 * 1. All required fields present
 * 2. Safety flags are correct (notExecutionAuthority = true, etc.)
 * 3. No execution authority claimed
 * 4. Provenance preserved from source
 * 5. Confidence not inflated (matches source)
 */
export function validateObservationDraft(
  draft: OpenBrainObservationDraft,
  sourceSnapshot: AlphaSnapshot
): BridgeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Schema version check
  if (draft.schemaVersion !== "open-brain-observation-draft-v7a") {
    errors.push(
      `Invalid schema version: ${draft.schemaVersion}, expected open-brain-observation-draft-v7a`
    );
  }

  // 2. Safety flags (hardcoded checks)
  if (draft.safety.notExecutionAuthority !== true) {
    errors.push("CRITICAL: notExecutionAuthority is not true");
  }
  if (draft.safety.containsTradeOrders !== false) {
    errors.push("CRITICAL: containsTradeOrders is not false");
  }
  if (draft.safety.containsWalletReferences !== false) {
    errors.push("CRITICAL: containsWalletReferences is not false");
  }
  if (draft.safety.containsExecutionInstructions !== false) {
    errors.push("CRITICAL: containsExecutionInstructions is not false");
  }
  if (draft.safety.containsCredentials !== false) {
    errors.push("CRITICAL: containsCredentials is not false");
  }

  // 3. Execution check
  const executionCheckPassed =
    draft.safety.notExecutionAuthority === true &&
    draft.safety.containsTradeOrders === false &&
    draft.safety.containsExecutionInstructions === false;

  // 4. Provenance preserved
  const provenancePreserved =
    draft.sourceSnapshot.schemaVersion === sourceSnapshot.provenance.schemaVersion &&
    draft.sourceSnapshot.generatedAt === sourceSnapshot.provenance.generatedAt &&
    draft.sourceSnapshot.source === sourceSnapshot.provenance.source;

  if (!provenancePreserved) {
    errors.push("Source snapshot provenance was not preserved exactly");
  }

  // 5. Confidence not inflated
  let confidenceOk = true;
  for (let i = 0; i < draft.assetObservations.length; i++) {
    const obs = draft.assetObservations[i];
    const src = sourceSnapshot.assets[i];
    if (src && obs.confidence > src.confidence + 0.01) {
      confidenceOk = false;
      errors.push(
        `assetObservations[${i}].confidence inflated: ${obs.confidence} > ${src.confidence}`
      );
    }
  }
  if (
    draft.compositeObservation.confidence >
    sourceSnapshot.composite.confidence + 0.01
  ) {
    confidenceOk = false;
    errors.push(
      `compositeObservation.confidence inflated: ${draft.compositeObservation.confidence} > ${sourceSnapshot.composite.confidence}`
    );
  }

  // 6. Governance checks
  if (draft.governance.isGovernedState !== false) {
    errors.push("Draft claims to be governed state (must be false in v7A)");
  }
  if (draft.governance.requiresHumanReview !== true) {
    errors.push("Draft does not require human review");
  }
  if (draft.governance.networkWriteStatus !== "dry-run-local-only") {
    errors.push(
      `networkWriteStatus is "${draft.governance.networkWriteStatus}", expected "dry-run-local-only"`
    );
  }

  // 7. Content scan for forbidden patterns
  const draftJson = JSON.stringify(draft);
  const forbiddenPatterns = [
    /execute_trade/i,
    /place_order/i,
    /send_transaction/i,
    /private_key/i,
    /api_key\s*[:=]/i,
    /supabase/i,
    /service_role/i,
    /openbrain.*write/i,
    /wallet.*seed/i,
  ];
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(draftJson)) {
      errors.push(
        `Forbidden pattern detected in draft: ${pattern.toString()}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    safetyCheckPassed:
      draft.safety.notExecutionAuthority === true &&
      draft.safety.containsTradeOrders === false &&
      draft.safety.containsWalletReferences === false &&
      draft.safety.containsExecutionInstructions === false &&
      draft.safety.containsCredentials === false,
    executionCheckPassed,
    provenancePreserved,
    confidenceCheckPassed: confidenceOk,
  };
}

/**
 * Create a dry-run log entry (no network write).
 */
export function createDryRunLogEntry(
  draft: OpenBrainObservationDraft,
  validation: BridgeValidationResult
): DryRunLogEntry {
  return {
    timestamp: new Date().toISOString(),
    draftSchemaVersion: draft.schemaVersion,
    validationResult: validation.valid ? "valid" : "invalid",
    safetyFlagsCorrect: validation.safetyCheckPassed,
    wouldWriteTo: "open-brain-observations-v7b",
    actuallyWrittenTo: "local-jsonl-dry-run-log-only",
    networkWriteBlocked: true,
  };
}
