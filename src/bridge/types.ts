/**
 * Open Brain Observation Bridge Contract v7A (DRY-RUN ONLY)
 *
 * This module defines the observation draft types that would be sent
 * to Open Brain in v7B+. In v7A, they are only generated, validated,
 * and logged locally as JSONL. NO network writes.
 *
 * Strict boundaries:
 * - No Open Brain credentials
 * - No Supabase service role key
 * - No network write
 * - not_execution_authority: true (always)
 * - No trade orders, no wallet refs, no execution instructions
 */

// ── Observation Draft ───────────────────────────────────────────

export interface OpenBrainObservationDraft {
  /** Contract version */
  schemaVersion: "open-brain-observation-draft-v7a";

  /** When this draft was created */
  draftedAt: string; // ISO-8601 UTC

  /** Source snapshot provenance (preserved exactly) */
  sourceSnapshot: {
    schemaVersion: string;
    generatedAt: string;
    source: string;
    dataHash?: string;
    generatorCommit?: string;
  };

  /** Provider status at observation time (preserved) */
  providerStatus: Array<{
    name: string;
    status: string;
    lastUpdated: string;
    latencyMs?: number;
    error?: string;
  }>;

  /** Asset observations (confidence preserved, not inflated) */
  assetObservations: Array<{
    symbol: string;
    name: string;
    regime: string;
    score: number;
    confidence: number;
    classification: string;
    providerContributions: Record<string, number>;
  }>;

  /** Regime observation */
  regimeObservation: {
    currentRegime: string;
    priorRegime: string;
    transitionConfidence: number;
    description: string;
  };

  /** Composite signal observation */
  compositeObservation: {
    signal: string;
    confidence: number;
    contributingFactors: string[];
    blockingIssues?: string[];
  };

  /** Safety declarations */
  safety: {
    /** Always true: this observation does not authorize execution */
    notExecutionAuthority: true;
    /** Always false: no trade orders included */
    containsTradeOrders: false;
    /** Always false: no wallet references */
    containsWalletReferences: false;
    /** Always false: no execution instructions */
    containsExecutionInstructions: false;
    /** Always false: no Open Brain credentials in payload */
    containsCredentials: false;
  };

  /** Governance metadata */
  governance: {
    /** This draft requires human review before promotion to governed state */
    requiresHumanReview: true;
    /** This draft is not yet governed state */
    isGovernedState: false;
    /** Data mode from source snapshot */
    dataMode: string;
    /** v7A = dry-run only */
    networkWriteStatus: "dry-run-local-only";
  };
}

// ── Validation Result ───────────────────────────────────────────

export interface BridgeValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** Safety check: all safety flags correct */
  safetyCheckPassed: boolean;
  /** Execution check: no execution authority claimed */
  executionCheckPassed: boolean;
  /** Provenance preserved */
  provenancePreserved: boolean;
  /** Confidence not inflated */
  confidenceCheckPassed: boolean;
}

// ── Dry-Run Log Entry ──────────────────────────────────────────

export interface DryRunLogEntry {
  timestamp: string;
  draftSchemaVersion: string;
  validationResult: "valid" | "invalid";
  safetyFlagsCorrect: boolean;
  wouldWriteTo: "open-brain-observations-v7b";
  actuallyWrittenTo: "local-jsonl-dry-run-log-only";
  networkWriteBlocked: true;
}
