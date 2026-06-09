/**
 * Credential Preflight Checker v7B.0
 *
 * Checks that credentials are NOT present in the environment.
 * In v7B.0, credentials MUST be absent.
 *
 * A future v7B phase may stage credentials, but this phase confirms
 * they do not exist.
 */

/** Environment variable names that would indicate credentials */
const CREDENTIAL_ENV_VARS = [
  "OPENBRAIN_API_KEY",
  "OPENBRAIN_ENDPOINT_URL",
  "OPENBRAIN_PROJECT_ID",
  "SUPABASE_URL",
  "SUPABASE_KEY",
  "SUPABASE_SERVICE_KEY",
];

export interface CredentialPreflightResult {
  /** Whether any credential env vars are set */
  credentialsPresent: boolean;

  /** List of credential env vars that are set (empty in v7B.0) */
  detectedVars: string[];

  /** Whether the preflight passes (no credentials = pass) */
  passed: boolean;

  /** Human-readable status */
  status: "clean" | "credential_detected" | "error";
}

/**
 * Run the credential preflight check.
 *
 * Scans for credential environment variables. In v7B.0,
 * all should be absent. Returns "clean" if none are found.
 */
export function runCredentialPreflight(): CredentialPreflightResult {
  const detected: string[] = [];

  for (const varName of CREDENTIAL_ENV_VARS) {
    if (process.env[varName] && process.env[varName].trim() !== "") {
      detected.push(varName);
    }
  }

  if (detected.length > 0) {
    return {
      credentialsPresent: true,
      detectedVars: detected,
      passed: false,
      status: "credential_detected",
    };
  }

  return {
    credentialsPresent: false,
    detectedVars: [],
    passed: true,
    status: "clean",
  };
}

/**
 * Check if any credentials are present.
 *
 * v7B.0: Should always return false.
 */
export function areCredentialsPresent(): boolean {
  return runCredentialPreflight().credentialsPresent;
}

/**
 * Get the list of credential env var names that are checked.
 */
export function getCheckedCredentialVars(): string[] {
  return [...CREDENTIAL_ENV_VARS];
}
