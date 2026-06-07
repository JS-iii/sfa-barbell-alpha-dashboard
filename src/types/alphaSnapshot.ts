/**
 * AlphaSnapshot Contract Schema v5.1
 *
 * This is the runtime-validated contract between data producers
 * and the SFA Barbell Alpha Dashboard.
 *
 * Any snapshot that does not pass runtime validation against this
 * schema will trigger the fail-closed blocking UI.
 */

export interface AlphaSnapshotProvenance {
  schemaVersion: string;       // e.g. "5.1.0"
  generatedAt: string;         // ISO-8601 UTC timestamp
  source: string;              // e.g. "sfa-barbell-alpha-v5"
  dataHash?: string;           // Optional SHA-256 of payload
  generatorCommit?: string;    // Git commit of generator
}

export interface ProviderStatus {
  name: string;                // e.g. "yahoo_finance", "federal_reserve"
  status: "active" | "stale" | "degraded" | "unavailable";
  lastUpdated: string;         // ISO-8601 UTC
  latencyMs?: number;
  error?: string;
}

export interface AssetScore {
  symbol: string;              // e.g. "GLD", "TLT", "BTC"
  name: string;
  regime: "flight_to_safety" | "risk_on" | "inflation_hedge" | "barbell_core" | "uncategorized";
  score: number;               // -100 to +100
  confidence: number;          // 0.0 to 1.0
  classification: "long_bias" | "short_bias" | "neutral" | "watch";
  providerContributions: Record<string, number>; // provider -> weight
}

export interface RegimeSummary {
  currentRegime: string;
  priorRegime: string;
  regimeDate: string;          // ISO-8601 UTC
  transitionConfidence: number; // 0.0 to 1.0
  description: string;
}

export interface CompositeSignal {
  signal: "constructive" | "cautious" | "defensive" | "unclear";
  confidence: number;          // 0.0 to 1.0
  contributingFactors: string[];
  blockingIssues?: string[];   // Reasons why composite can't be trusted
}

export interface AlphaSnapshot {
  provenance: AlphaSnapshotProvenance;
  providers: ProviderStatus[];
  assets: AssetScore[];
  regime: RegimeSummary;
  composite: CompositeSignal;
  metadata?: {
    staleThresholdHours?: number;
    note?: string;
  };
}

// ── Validation Rules (runtime-enforced) ───────────────────────────

export const VALIDATION_RULES = {
  REQUIRED_PROVENANCE_FIELDS: [
    "schemaVersion",
    "generatedAt",
    "source",
  ] as const,

  REQUIRED_PROVIDER_FIELDS: [
    "name",
    "status",
    "lastUpdated",
  ] as const,

  REQUIRED_ASSET_FIELDS: [
    "symbol",
    "name",
    "regime",
    "score",
    "confidence",
    "classification",
  ] as const,

  REQUIRED_REGIME_FIELDS: [
    "currentRegime",
    "priorRegime",
    "regimeDate",
    "transitionConfidence",
    "description",
  ] as const,

  REQUIRED_COMPOSITE_FIELDS: [
    "signal",
    "confidence",
    "contributingFactors",
  ] as const,

  VALID_PROVIDER_STATUSES: ["active", "stale", "degraded", "unavailable"] as const,
  VALID_REGIMES: ["flight_to_safety", "risk_on", "inflation_hedge", "barbell_core", "uncategorized"] as const,
  VALID_CLASSIFICATIONS: ["long_bias", "short_bias", "neutral", "watch"] as const,
  VALID_SIGNALS: ["constructive", "cautious", "defensive", "unclear"] as const,

  SCORE_MIN: -100,
  SCORE_MAX: 100,
  CONFIDENCE_MIN: 0,
  CONFIDENCE_MAX: 1,

  STALE_THRESHOLD_HOURS: 24,
} as const;

// ── Validation Result Types ──────────────────────────────────────

export interface ValidationError {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  stale: boolean;
  staleProviders: string[];
}
