/**
 * AlphaSnapshot Runtime Validator
 *
 * Fail-closed validation: any error = invalid snapshot.
 * Warnings do not block but are displayed.
 */

import type {
  ValidationResult,
  ValidationError,
} from "@/types/alphaSnapshot";

import { VALIDATION_RULES } from "@/types/alphaSnapshot";

export function validateSnapshot(snapshot: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const staleProviders: string[] = [];

  // ── 1. Top-level structure ──────────────────────────────────────

  if (!snapshot || typeof snapshot !== "object") {
    errors.push({ path: "", message: "Snapshot is not an object", severity: "error" });
    return { valid: false, errors, warnings, stale: false, staleProviders };
  }

  const s = snapshot as Record<string, unknown>;

  // ── 2. Provenance validation ────────────────────────────────────

  if (!s.provenance || typeof s.provenance !== "object") {
    errors.push({ path: "provenance", message: "Missing provenance object", severity: "error" });
  } else {
    const prov = s.provenance as Record<string, unknown>;
    for (const field of VALIDATION_RULES.REQUIRED_PROVENANCE_FIELDS) {
      if (!prov[field] || typeof prov[field] !== "string") {
        errors.push({
          path: `provenance.${field}`,
          message: `Missing or invalid provenance.${field}`,
          severity: "error",
        });
      }
    }

    // Check schema version format
    if (typeof prov.schemaVersion === "string") {
      const versionRegex = /^\d+\.\d+\.?\d*$/;
      if (!versionRegex.test(prov.schemaVersion)) {
        warnings.push({
          path: "provenance.schemaVersion",
          message: `Schema version "${prov.schemaVersion}" does not match expected format (x.y.z)`,
          severity: "warning",
        });
      }
    }

    // Check timestamp is parseable
    if (typeof prov.generatedAt === "string") {
      const generatedDate = new Date(prov.generatedAt);
      if (isNaN(generatedDate.getTime())) {
        errors.push({
          path: "provenance.generatedAt",
          message: "generatedAt is not a valid ISO-8601 timestamp",
          severity: "error",
        });
      }
    }
  }

  // ── 3. Providers validation ─────────────────────────────────────

  if (!Array.isArray(s.providers)) {
    errors.push({ path: "providers", message: "providers must be an array", severity: "error" });
  } else if (s.providers.length === 0) {
    warnings.push({ path: "providers", message: "No providers listed", severity: "warning" });
  } else {
    for (let i = 0; i < s.providers.length; i++) {
      const p = s.providers[i] as Record<string, unknown>;
      for (const field of VALIDATION_RULES.REQUIRED_PROVIDER_FIELDS) {
        if (!p[field] || typeof p[field] !== "string") {
          errors.push({
            path: `providers[${i}].${field}`,
            message: `Missing or invalid providers[${i}].${field}`,
            severity: "error",
          });
        }
      }

      // Validate status enum
      if (
        typeof p.status === "string" &&
        !VALIDATION_RULES.VALID_PROVIDER_STATUSES.includes(p.status as typeof VALIDATION_RULES.VALID_PROVIDER_STATUSES[number])
      ) {
        errors.push({
          path: `providers[${i}].status`,
          message: `Invalid provider status: "${p.status}"`,
          severity: "error",
        });
      }

      // Check staleness
      if (typeof p.lastUpdated === "string") {
        const lastUpdated = new Date(p.lastUpdated);
        const hoursAgo = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
        const threshold =
          (s.metadata && typeof (s.metadata as Record<string, unknown>).staleThresholdHours === "number")
            ? (s.metadata as Record<string, unknown>).staleThresholdHours as number
            : VALIDATION_RULES.STALE_THRESHOLD_HOURS;

        if (hoursAgo > threshold) {
          staleProviders.push(typeof p.name === "string" ? p.name : `provider[${i}]`);
        }
      }
    }
  }

  // ── 4. Assets validation ────────────────────────────────────────

  if (!Array.isArray(s.assets)) {
    errors.push({ path: "assets", message: "assets must be an array", severity: "error" });
  } else if (s.assets.length === 0) {
    warnings.push({ path: "assets", message: "No assets listed", severity: "warning" });
  } else {
    for (let i = 0; i < s.assets.length; i++) {
      const a = s.assets[i] as Record<string, unknown>;
      for (const field of VALIDATION_RULES.REQUIRED_ASSET_FIELDS) {
        if (a[field] === undefined || a[field] === null) {
          errors.push({
            path: `assets[${i}].${field}`,
            message: `Missing assets[${i}].${field}`,
            severity: "error",
          });
        }
      }

      // Validate regime enum
      if (
        typeof a.regime === "string" &&
        !VALIDATION_RULES.VALID_REGIMES.includes(a.regime as typeof VALIDATION_RULES.VALID_REGIMES[number])
      ) {
        errors.push({
          path: `assets[${i}].regime`,
          message: `Invalid regime: "${a.regime}"`,
          severity: "error",
        });
      }

      // Validate classification enum
      if (
        typeof a.classification === "string" &&
        !VALIDATION_RULES.VALID_CLASSIFICATIONS.includes(a.classification as typeof VALIDATION_RULES.VALID_CLASSIFICATIONS[number])
      ) {
        errors.push({
          path: `assets[${i}].classification`,
          message: `Invalid classification: "${a.classification}"`,
          severity: "error",
        });
      }

      // Validate score range
      if (typeof a.score === "number") {
        if (a.score < VALIDATION_RULES.SCORE_MIN || a.score > VALIDATION_RULES.SCORE_MAX) {
          errors.push({
            path: `assets[${i}].score`,
            message: `Score ${a.score} out of range [${VALIDATION_RULES.SCORE_MIN}, ${VALIDATION_RULES.SCORE_MAX}]`,
            severity: "error",
          });
        }
      }

      // Validate confidence range
      if (typeof a.confidence === "number") {
        if (a.confidence < VALIDATION_RULES.CONFIDENCE_MIN || a.confidence > VALIDATION_RULES.CONFIDENCE_MAX) {
          errors.push({
            path: `assets[${i}].confidence`,
            message: `Confidence ${a.confidence} out of range [0, 1]`,
            severity: "error",
          });
        }
      }
    }
  }

  // ── 5. Regime validation ────────────────────────────────────────

  if (!s.regime || typeof s.regime !== "object") {
    errors.push({ path: "regime", message: "Missing regime object", severity: "error" });
  } else {
    const r = s.regime as Record<string, unknown>;
    for (const field of VALIDATION_RULES.REQUIRED_REGIME_FIELDS) {
      if (r[field] === undefined || r[field] === null) {
        errors.push({
          path: `regime.${field}`,
          message: `Missing regime.${field}`,
          severity: "error",
        });
      }
    }

    if (typeof r.transitionConfidence === "number") {
      if (r.transitionConfidence < 0 || r.transitionConfidence > 1) {
        errors.push({
          path: "regime.transitionConfidence",
          message: `transitionConfidence ${r.transitionConfidence} out of range [0, 1]`,
          severity: "error",
        });
      }
    }
  }

  // ── 6. Composite validation ─────────────────────────────────────

  if (!s.composite || typeof s.composite !== "object") {
    errors.push({ path: "composite", message: "Missing composite object", severity: "error" });
  } else {
    const c = s.composite as Record<string, unknown>;
    for (const field of VALIDATION_RULES.REQUIRED_COMPOSITE_FIELDS) {
      if (c[field] === undefined || c[field] === null) {
        errors.push({
          path: `composite.${field}`,
          message: `Missing composite.${field}`,
          severity: "error",
        });
      }
    }

    if (
      typeof c.signal === "string" &&
      !VALIDATION_RULES.VALID_SIGNALS.includes(c.signal as typeof VALIDATION_RULES.VALID_SIGNALS[number])
    ) {
      errors.push({
        path: "composite.signal",
        message: `Invalid composite signal: "${c.signal}"`,
        severity: "error",
      });
    }

    if (typeof c.confidence === "number") {
      if (c.confidence < 0 || c.confidence > 1) {
        errors.push({
          path: "composite.confidence",
          message: `composite.confidence ${c.confidence} out of range [0, 1]`,
          severity: "error",
        });
      }
    }
  }

  // ── 7. Snapshot staleness ───────────────────────────────────────

  let snapshotStale = false;
  const isMock = s.data_mode === "mock";
  const provenance = s.provenance as Record<string, unknown> | undefined;

  if (isMock) {
    // Mock data is validated as a baseline, not live market intelligence.
    // Staleness warnings are suppressed for mock mode, but a disclosure
    // note is added so the UI can show "validated mock — not live data."
    // (handled by the dashboard UI reading data_mode)
  } else if (provenance && typeof provenance.generatedAt === "string") {
    const generated = new Date(provenance.generatedAt);
    const hoursAgo = (Date.now() - generated.getTime()) / (1000 * 60 * 60);
    if (hoursAgo > VALIDATION_RULES.STALE_THRESHOLD_HOURS) {
      snapshotStale = true;
      warnings.push({
        path: "provenance.generatedAt",
        message: `Snapshot is ${Math.round(hoursAgo)}h old (threshold: ${VALIDATION_RULES.STALE_THRESHOLD_HOURS}h)`,
        severity: "warning",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stale: snapshotStale || staleProviders.length > 0,
    staleProviders,
  };
}
