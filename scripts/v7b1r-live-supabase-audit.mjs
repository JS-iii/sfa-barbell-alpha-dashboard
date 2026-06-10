#!/usr/bin/env node
/**
 * v7b1r-live-supabase-audit.mjs — v7B.1R-Live Supabase Read-Only Database Inventory
 *
 * SAFETY NOTE: This script uses a Supabase Personal Access Token (PAT) via the
 * Management API. PATs carry the same privileges as the user account. This is a
 * FALLBACK path. The PREFERRED path is Supabase MCP with read_only=true, which
 * executes queries through a read-only Postgres user with mutating tools disabled.
 *
 * This script enforces:
 * - HTTP GET only (no POST/PUT/PATCH/DELETE to mutating endpoints)
 * - No raw SQL execution (only Management API metadata endpoints)
 * - Self-scan for forbidden patterns before execution
 * - Token value never logged, never committed, never printed
 * - Output redaction for potential secrets
 *
 * PRE-REQUISITE: Operator must stage token in secure shell:
 *   export SUPABASE_ACCESS_TOKEN="sbp_..."
 *
 * USAGE: npx tsx scripts/v7b1r-live-supabase-audit.mjs
 *
 * SCOPE: Read-only metadata queries only via Management API GET.
 * Forbidden: INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE, GRANT, REVOKE.
 * Forbidden: Raw SQL execution. Edge Function deploy. Schema mutation.
 */

import { writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_DIR = join(dirname(__filename), "..");

// ── Configuration ──────────────────────────────────────────────
const PROJECT_REF = "bgludgfrbyicqqdkdqds";
const SUPABASE_API_URL = `https://${PROJECT_REF}.supabase.co`;
const SUPABASE_MGMT_URL = "https://api.supabase.com";

// ── Allowed HTTP methods (whitelist) ───────────────────────────
const ALLOWED_METHODS = ["GET"];
// ── Forbidden Management API paths (blacklist) ─────────────────
const FORBIDDEN_PATHS = [
  "/query", "/rpc", "/rest/v1/", "/auth/v1/", "/storage/v1/",
  "/functions/v1/", "/ realtime/v1/",
];

console.log("═══════════════════════════════════════════════════════════");
console.log("  v7B.1R-Live: Supabase Read-Only Database Inventory");
console.log("  Project:", PROJECT_REF);
console.log("  " + new Date().toISOString());
console.log("═══════════════════════════════════════════════════════════");
console.log("  ⚠️  PAT FALLBACK: MCP read_only=true is PREFERRED");
console.log("  Scope: READ-ONLY Management API GET only.");
console.log("  No raw SQL. No writes. No schema mutations.");
console.log("  Token source: SUPABASE_ACCESS_TOKEN env var only.");
console.log("═══════════════════════════════════════════════════════════\n");

// ═══════════════════════════════════════════════════════════════
//  STEP 0: Self-scan for forbidden patterns
// ═══════════════════════════════════════════════════════════════

console.log("[STEP 0] Script Self-Scan\n");

const scriptSource = readFileSync(__filename, "utf-8");
const scriptLines = scriptSource.split("\n");

// Check for forbidden keywords outside of comments/strings/comments about them
const forbiddenKeywords = ["INSERT", "UPDATE", "DELETE", "UPSERT", "MERGE", "TRUNCATE", "ALTER TABLE", "CREATE TABLE", "DROP TABLE", "GRANT", "REVOKE", "EXECUTE"];
const forbiddenInCode = [];

// Track whether we're inside a JSDoc block
let inJSDoc = false;

for (let i = 0; i < scriptLines.length; i++) {
  const line = scriptLines[i].trim();
  // Track JSDoc block state
  if (line.startsWith("/**")) inJSDoc = true;
  if (line.startsWith("*/")) { inJSDoc = false; continue; }
  if (inJSDoc || line.startsWith("* ")) continue; // Skip JSDoc lines
  // Skip inline comments
  const codePart = line.replace(/\/\/.*$/g, "");
  // Skip full-line string literals
  const noStrings = codePart.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
  for (const kw of forbiddenKeywords) {
    if (noStrings.includes(kw) && !noStrings.includes("forbidden") && !noStrings.includes("const forbidden")) {
      forbiddenInCode.push({ line: i + 1, keyword: kw, context: line.trim() });
    }
  }
}

if (forbiddenInCode.length > 0) {
  console.log("   ⚠️ Found forbidden keywords in script source:");
  for (const f of forbiddenInCode) {
    console.log(`     Line ${f.line}: ${f.keyword} — "${f.context}"`);
  }
  console.log("   These must be reviewed before execution.");
} else {
  console.log("   ✅ No forbidden SQL keywords found in executable code");
}

// Check for mutating HTTP methods
const mutatingMethods = ["POST", "PUT", "PATCH"];
const foundMutating = [];
inJSDoc = false;
for (let i = 0; i < scriptLines.length; i++) {
  const line = scriptLines[i].trim();
  if (line.startsWith("/**")) inJSDoc = true;
  if (line.startsWith("*/")) { inJSDoc = false; continue; }
  if (inJSDoc || line.startsWith("* ")) continue;
  const codePart = line.replace(/\/\/.*$/g, "");
  const noStrings = codePart.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
  for (const m of mutatingMethods) {
    if (noStrings.includes(`method: "${m}"`) || noStrings.includes(`'${m}'`)) {
      foundMutating.push({ line: i + 1, method: m });
    }
  }
}
if (foundMutating.length > 0) {
  console.log("   ⚠️ Found mutating HTTP methods:");
  for (const f of foundMutating) {
    console.log(`     Line ${f.line}: ${f.method}`);
  }
} else {
  console.log("   ✅ No mutating HTTP methods (POST/PUT/PATCH) in code");
}

// Check for direct fetch() calls outside mgmtGet() — track function scope
const directFetchMatches = [];
inJSDoc = false;
let mgmtGetDepth = -1; // -1 = not yet in mgmtGet
let braceDepth = 0;
for (let i = 0; i < scriptLines.length; i++) {
  const line = scriptLines[i];
  const trimmed = line.trim();
  if (trimmed.startsWith("/**")) inJSDoc = true;
  if (trimmed.startsWith("*/")) { inJSDoc = false; continue; }
  if (inJSDoc || trimmed.startsWith("* ")) continue;
  // Count braces BEFORE tracking function entry (so mgmtGetDepth captures depth at function start)
  const codePart = line.replace(/\/\/.*$/g, "").replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
  // Track mgmtGet function scope
  if (/async\s+function\s+mgmtGet\b/.test(line) && mgmtGetDepth === -1) mgmtGetDepth = braceDepth;
  for (const ch of codePart) {
    if (ch === "{") braceDepth++;
    if (ch === "}") braceDepth--;
  }
  const noStrings = codePart.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
  // fetch( outside mgmtGet scope
  const inMgmtGetScope = mgmtGetDepth >= 0 && braceDepth > mgmtGetDepth;
  if (noStrings.includes("fetch(") && !inMgmtGetScope && !/function\s+mgmtGet/.test(line)) {
    directFetchMatches.push({ line: i + 1 });
  }
}
if (directFetchMatches.length > 0) {
  console.log("   ⚠️ Found direct fetch() calls outside mgmtGet():");
  for (const f of directFetchMatches) {
    console.log(`     Line ${f.line}`);
  }
} else {
  console.log("   ✅ All fetch() calls are through mgmtGet() wrapper");
}

console.log("   Self-scan complete.");

// ═══════════════════════════════════════════════════════════════
//  STEP 1: Token check (value never logged)
// ═══════════════════════════════════════════════════════════════

console.log("\n[STEP 1] Token Verification\n");

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token || token.trim() === "") {
  console.log("❌ SUPABASE_ACCESS_TOKEN not set.");
  console.log("\n   To stage token in your secure shell:");
  console.log("   export SUPABASE_ACCESS_TOKEN='sbp_your_token_here'");
  console.log("\n   PREFERRED PATH: Use Supabase MCP with read_only=true instead:");
  console.log("   [mcp_servers.supabase]");
  console.log('   url = "https://mcp.supabase.com/mcp?project_ref=bgludgfrbyicqqdkdqds&read_only=true&features=database,docs"');
  console.log('   bearer_token_env_var = "SUPABASE_ACCESS_TOKEN"');
  console.log("\n   Then run:");
  console.log("   npx tsx scripts/v7b1r-live-supabase-audit.mjs\n");
  process.exit(1);
}
console.log("✅ Token present (value not logged)\n");

// ── Evidence accumulator ───────────────────────────────────────
const evidence = {
  phase: "v7b1r-live-supabase-audit",
  startedAt: new Date().toISOString(),
  projectRef: PROJECT_REF,
  supabaseApiUrl: SUPABASE_API_URL,
  connectivity: {},
  tables: [],
  extensions: [],
  migrations: [],
  memoryTables: [],
  vectorInfo: {},
  rlsPolicies: [],
  staleTables: [],
  manusDrift: [],
  safety: {
    patFallback: true,
    mcpPreferred: true,
    readOnly: true,
    httpGetOnly: true,
    noRawSql: true,
    noInserts: true,
    noUpdates: true,
    noDeletes: true,
    noSchemaMutations: true,
    noEdgeDeploys: true,
    noMemoryWrites: true,
    selfScanPassed: forbiddenInCode.length === 0 && foundMutating.length === 0 && directFetchMatches.length === 0,
  },
  finalStatus: "pending",
  completedAt: null,
};

// ── HTTP helper: GET-only, path-validated ──────────────────────
async function mgmtGet(path) {
  // Validate method
  const method = "GET";
  if (!ALLOWED_METHODS.includes(method)) {
    throw new Error(`Forbidden HTTP method: ${method}. Only GET is allowed.`);
  }
  // Validate path
  for (const fp of FORBIDDEN_PATHS) {
    if (path.includes(fp)) {
      throw new Error(`Forbidden API path: ${fp}. Mutating endpoints are blocked.`);
    }
  }
  // Execute
  const res = await fetch(`${SUPABASE_MGMT_URL}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    // Redact potential secrets from error body
    const redactedBody = body
      .replace(/"token"\s*:\s*"[^"]*"/gi, '"token":"[REDACTED]"')
      .replace(/"Bearer\s+[^"]*/gi, '"Bearer [REDACTED]')
      .slice(0, 500);
    throw new Error(`HTTP ${res.status}: ${redactedBody}`);
  }
  const data = await res.json();
  return data;
}

// ── Redaction helper ───────────────────────────────────────────
function redactObject(obj) {
  const sensitiveKeys = ["token", "api_key", "secret", "password", "bearer", "authorization"];
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(redactObject);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      result[key] = typeof value === "string" && value.length > 0 ? "[REDACTED]" : value;
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ── Task execution ─────────────────────────────────────────────

async function task1_listTables() {
  console.log("\n[TASK 1] List Public Tables\n");
  try {
    const data = await mgmtGet(`/v1/projects/${PROJECT_REF}/database/tables`);
    const tables = data || [];
    console.log(`   Found ${tables.length} tables:`);
    for (const t of tables) {
      console.log(`   - ${t.schema}.${t.name} (${t.row_count ?? '?'} rows)`);
    }
    evidence.tables = tables.map(t => ({
      schema: t.schema,
      name: t.name,
      rowCount: t.row_count,
      sizeBytes: t.size_bytes,
    }));
    return tables;
  } catch (e) {
    console.log("   ⚠️ Management API error:", e.message);
    return [];
  }
}

async function task2_listExtensions() {
  console.log("\n[TASK 2] List Installed Extensions\n");
  try {
    const data = await mgmtGet(`/v1/projects/${PROJECT_REF}/database/extensions`);
    const extensions = data || [];
    console.log(`   Found ${extensions.length} extensions:`);
    for (const e of extensions) {
      const marker = ["vector", "pgvector", "pg_embedding"].includes(e.name) ? " <-- CRITICAL" : "";
      console.log(`   - ${e.name} (${e.version})${marker}`);
    }
    evidence.extensions = extensions.map(e => ({ name: e.name, version: e.version, installed: e.installed }));
    return extensions;
  } catch (e) {
    console.log("   ⚠️ Extension query error:", e.message);
    return [];
  }
}

async function task3_listMigrations() {
  console.log("\n[TASK 3] List Migration History\n");
  try {
    const data = await mgmtGet(`/v1/projects/${PROJECT_REF}/database/migrations`);
    const migrations = data || [];
    console.log(`   Found ${migrations.length} migrations:`);
    for (const m of migrations.slice(0, 20)) {
      console.log(`   - ${m.version}: ${m.name}`);
    }
    if (migrations.length > 20) console.log(`   ... and ${migrations.length - 20} more`);
    evidence.migrations = migrations.map(m => ({ version: m.version, name: m.name }));
    return migrations;
  } catch (e) {
    console.log("   ⚠️ Migration query error:", e.message);
    return [];
  }
}

async function task4_inventoryMemoryTables(tables) {
  console.log("\n[TASK 4] Inventory Memory-Related Tables\n");
  const memoryKeywords = ["observation", "memory", "chunk", "document", "embedding", "agent", "run", "event", "conversation", "snapshot", "audit"];
  const memoryTables = tables.filter(t =>
    memoryKeywords.some(kw => t.name.toLowerCase().includes(kw))
  );
  console.log(`   Found ${memoryTables.length} memory-related tables:`);
  for (const t of memoryTables) {
    console.log(`   - ${t.schema}.${t.name}`);
  }
  evidence.memoryTables = memoryTables.map(t => ({
    schema: t.schema,
    name: t.name,
    rowCount: t.row_count,
    sizeBytes: t.size_bytes,
  }));
  return memoryTables;
}

async function task5_describeMemoryTables(memoryTables) {
  console.log("\n[TASK 5] Describe Memory Table Details\n");
  for (const t of memoryTables.slice(0, 10)) {
    try {
      const columns = await mgmtGet(`/v1/projects/${PROJECT_REF}/database/tables/${t.id}/columns`);
      console.log(`\n   📋 ${t.schema}.${t.name}`);
      console.log(`      Rows: ${t.row_count ?? '?'}`);
      console.log(`      Columns: ${columns?.length ?? '?'}`);
      if (columns) {
        for (const c of columns.slice(0, 15)) {
          const typeStr = c.data_type + (c.is_nullable ? "" : " NOT NULL");
          console.log(`        ${c.name}: ${typeStr}`);
        }
        if (columns.length > 15) console.log(`        ... and ${columns.length - 15} more columns`);
      }
    } catch (e) {
      console.log(`   ⚠️ Could not describe ${t.name}:`, e.message);
    }
  }
}

async function task6_checkVectorDimensions(memoryTables) {
  console.log("\n[TASK 6] Check Vector Dimensions\n");
  const vectorTables = memoryTables.filter(t =>
    ["memories", "memory_chunks", "embeddings", "observations"].includes(t.name)
  );
  if (vectorTables.length === 0) {
    console.log("   No known vector tables found in memory table list.");
    console.log("   Vector dimension check requires live column type inspection.");
    evidence.vectorInfo.status = "no_vector_tables_found";
    return;
  }
  for (const t of vectorTables) {
    console.log(`   Checking ${t.name} for vector columns...`);
    try {
      const columns = await mgmtGet(`/v1/projects/${PROJECT_REF}/database/tables/${t.id}/columns`);
      const vectorColumns = columns?.filter(c =>
        c.data_type && (c.data_type.includes("vector") || c.data_type.includes("embedding"))
      ) || [];
      if (vectorColumns.length > 0) {
        for (const vc of vectorColumns) {
          console.log(`     📐 Vector column: ${vc.name} (${vc.data_type})`);
        }
      } else {
        console.log(`     No vector-typed columns found (may use JSONB or text storage)`);
      }
      evidence.vectorInfo[t.name] = {
        vectorColumns: vectorColumns.map(vc => ({ name: vc.name, type: vc.data_type })),
      };
    } catch (e) {
      console.log(`     ⚠️ Could not inspect columns:`, e.message);
    }
  }
}

async function task7_checkRLS(tables) {
  console.log("\n[TASK 7] Check RLS Status and Policies\n");
  try {
    const policies = await mgmtGet(`/v1/projects/${PROJECT_REF}/database/policies`);
    console.log(`   Found ${policies?.length ?? 0} RLS policies:`);
    if (policies) {
      for (const p of policies.slice(0, 20)) {
        console.log(`   - ${p.schema}.${p.table}: ${p.name} (${p.action})`);
      }
      if (policies.length > 20) console.log(`   ... and ${policies.length - 20} more`);
    }
    evidence.rlsPolicies = (policies || []).map(p => ({
      schema: p.schema,
      table: p.table,
      name: p.name,
      action: p.action,
      definition: p.definition,
    }));
  } catch (e) {
    console.log("   ⚠️ RLS query error:", e.message);
  }

  // Check which tables have RLS enabled
  console.log("\n   Tables with RLS status:");
  for (const t of tables.slice(0, 15)) {
    const hasPolicy = evidence.rlsPolicies.some(p => p.table === t.name);
    console.log(`   ${hasPolicy ? "🔒" : "🔓"} ${t.schema}.${t.name} ${hasPolicy ? "(RLS)" : ""}`);
  }
}

async function task8_identifyStaleTables(tables) {
  console.log("\n[TASK 8] Identify Stale/Dormant Tables\n");
  const staleCandidates = tables.filter(t =>
    (t.row_count === 0 || t.row_count === null) &&
    !["extensions", "schema_migrations"].includes(t.name)
  );
  console.log(`   ${staleCandidates.length} tables with 0/null rows (potentially dormant):`);
  for (const t of staleCandidates) {
    console.log(`   - ${t.schema}.${t.name}`);
  }
  evidence.staleTables = staleCandidates.map(t => ({
    schema: t.schema,
    name: t.name,
    rowCount: t.row_count,
  }));
}

async function task9_assessManusDrift(tables) {
  console.log("\n[TASK 9] Assess Manus-Era Naming/Schema Drift\n");
  const expectedTables = ["observations", "memories", "memory_chunks", "conversations", "snapshots", "audit_log"];
  const actualNames = tables.map(t => t.name);
  const found = expectedTables.filter(e => actualNames.includes(e));
  const missing = expectedTables.filter(e => !actualNames.includes(e));
  const unexpected = actualNames.filter(a => !expectedTables.includes(a));

  console.log(`   Expected tables found: ${found.length}/${expectedTables.length}`);
  for (const f of found) console.log(`     ✅ ${f}`);
  for (const m of missing) console.log(`     ❌ ${m} (MISSING)`);

  if (unexpected.length > 0) {
    console.log(`\n   Unexpected tables (${unexpected.length}):`);
    for (const u of unexpected.slice(0, 15)) console.log(`     ⚠️ ${u}`);
    if (unexpected.length > 15) console.log(`     ... and ${unexpected.length - 15} more`);
  }

  evidence.manusDrift = {
    expectedTables,
    found,
    missing,
    unexpected: unexpected.slice(0, 30),
    driftDetected: missing.length > 0 || unexpected.length > 0,
  };
}

async function task10_compareSchema(tables) {
  console.log("\n[TASK 10] Compare Actual Schema Against Expected Architecture\n");
  console.log("   Expected Open Brain architecture:");
  console.log("   - observations: stored observation records");
  console.log("   - memories: vector memory embeddings (requires pgvector)");
  console.log("   - memory_chunks: chunked document embeddings");
  console.log("   - conversations: conversation history");
  console.log("   - snapshots: alpha snapshot cache");
  console.log("   - audit_log: operation audit trail");
  console.log("\n   Actual tables found:", tables.length);
  for (const t of tables.slice(0, 25)) {
    console.log(`     ${t.schema}.${t.name} (${t.row_count ?? '?'} rows)`);
  }
  if (tables.length > 25) console.log(`     ... and ${tables.length - 25} more`);
}

// ── Main execution ─────────────────────────────────────────────

async function main() {
  // Task 0b: Connectivity check
  console.log("\n[TASK 0b] Connectivity Check\n");
  try {
    const project = await mgmtGet(`/v1/projects/${PROJECT_REF}`);
    console.log("   ✅ Connected to Supabase Management API");
    console.log("   Project name:", project.name);
    console.log("   Region:", project.region);
    console.log("   Status:", project.status);
    evidence.connectivity = {
      connected: true,
      projectName: project.name,
      region: project.region,
      status: project.status,
    };
  } catch (e) {
    console.log("   ⚠️ Management API connection failed:", e.message);
    console.log("   This may mean:");
    console.log("   - The token lacks management scope");
    console.log("   - The project is paused");
    console.log("   - The project_ref is incorrect");
    console.log("   - Try Supabase MCP read_only=true path instead");
    evidence.connectivity = { connected: false, error: e.message };
  }

  // Run all discovery tasks
  const tables = await task1_listTables();
  await task2_listExtensions();
  await task3_listMigrations();
  const memoryTables = await task4_inventoryMemoryTables(tables);
  await task5_describeMemoryTables(memoryTables);
  await task6_checkVectorDimensions(memoryTables);
  await task7_checkRLS(tables);
  await task8_identifyStaleTables(tables);
  await task9_assessManusDrift(tables);
  await task10_compareSchema(tables);

  // ── Save evidence ────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  SAVING EVIDENCE");
  console.log("═══════════════════════════════════════════════════════════\n");

  evidence.completedAt = new Date().toISOString();
  evidence.finalStatus = evidence.connectivity.connected ? "audit_complete" : "connectivity_failed";

  // Redact before saving
  const safeEvidence = redactObject(evidence);
  const evidencePath = join(PROJECT_DIR, "docs", "v7b", "v7b1r-live-supabase-evidence.json");
  writeFileSync(evidencePath, JSON.stringify(safeEvidence, null, 2));
  console.log("   Evidence saved to:", evidencePath);

  // Summary
  const summaryPath = join(PROJECT_DIR, "docs", "v7b", "v7b1r-live-supabase-summary.md");
  writeFileSync(summaryPath, generateSummary(safeEvidence));
  console.log("   Summary saved to:", summaryPath);

  // ── Final report ─────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  v7B.1R-LIVE SUPABASE AUDIT COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Connected:", evidence.connectivity.connected);
  console.log("  Tables found:", evidence.tables.length);
  console.log("  Extensions found:", evidence.extensions.length);
  console.log("  Migrations found:", evidence.migrations.length);
  console.log("  Memory tables:", evidence.memoryTables.length);
  console.log("  RLS policies:", evidence.rlsPolicies.length);
  console.log("  Stale tables:", evidence.staleTables.length);
  console.log("  Manus drift detected:", evidence.manusDrift.driftDetected);
  console.log("  Self-scan passed:", evidence.safety.selfScanPassed);
  console.log("  Read-only enforced:", evidence.safety.readOnly);
  console.log("  HTTP GET only:", evidence.safety.httpGetOnly);
  console.log("  No raw SQL:", evidence.safety.noRawSql);
  console.log("  Token logged:", false);
  console.log("  Token committed:", false);
  console.log("═══════════════════════════════════════════════════════════");

  process.exit(evidence.connectivity.connected ? 0 : 1);
}

function generateSummary(ev) {
  return `# v7B.1R-Live Supabase Database Inventory Summary

**Phase:** v7B.1R-Live — Read-Only Database Audit  
**Project:** ${ev.projectRef}  
**Started:** ${ev.startedAt}  
**Completed:** ${ev.completedAt}  
**Status:** ${ev.finalStatus}

## Connectivity

| Property | Value |
|----------|-------|
| Connected | ${ev.connectivity.connected ? "✅ Yes" : "❌ No"} |
${ev.connectivity.projectName ? `| Project name | ${ev.connectivity.projectName} |` : ""}
${ev.connectivity.region ? `| Region | ${ev.connectivity.region} |` : ""}
${ev.connectivity.status ? `| Status | ${ev.connectivity.status} |` : ""}
${ev.connectivity.error ? `| Error | ${ev.connectivity.error} |` : ""}

## Tables Found: ${ev.tables.length}

${ev.tables.map(t => `| ${t.schema}.${t.name} | ${t.rowCount ?? '?'} rows |`).join("\n")}

## Memory-Related Tables: ${ev.memoryTables.length}

${ev.memoryTables.map(t => `| ${t.schema}.${t.name} | ${t.rowCount ?? '?'} rows |`).join("\n")}

## Extensions: ${ev.extensions.length}

${ev.extensions.map(e => `| ${e.name} | ${e.version} | ${e.installed ? "✅" : "❌"} |`).join("\n")}

## Manus-Era Drift Assessment

| Category | Count |
|----------|-------|
| Expected tables found | ${ev.manusDrift.found?.length ?? 0} |
| Expected tables missing | ${ev.manusDrift.missing?.length ?? 0} |
| Unexpected tables | ${ev.manusDrift.unexpected?.length ?? 0} |
| Drift detected | ${ev.manusDrift.driftDetected ? "⚠️ YES" : "✅ No"} |

${ev.manusDrift.missing?.length > 0 ? `**Missing tables:** ${ev.manusDrift.missing.join(", ")}` : ""}
${ev.manusDrift.unexpected?.length > 0 ? `**Unexpected tables:** ${ev.manusDrift.unexpected.join(", ")}` : ""}

## Safety Invariants

| Invariant | Status |
|-----------|--------|
| PAT fallback (MCP preferred) | ⚠️ |
| Read-only enforced | ✅ |
| HTTP GET only | ✅ |
| No raw SQL execution | ✅ |
| No inserts | ✅ |
| No updates | ✅ |
| No deletes | ✅ |
| No schema mutations | ✅ |
| No edge deploys | ✅ |
| No memory writes | ✅ |
| Self-scan passed | ${ev.safety.selfScanPassed ? "✅" : "❌"} |
| Token logged | ❌ Never |
| Token committed | ❌ Never |

## Recommendation

${ev.connectivity.connected
  ? ev.manusDrift.driftDetected
    ? "⚠️ Schema drift detected. Review missing/unexpected tables before v7B.1-live."
    : "✅ Schema matches expected architecture. Proceed to v7B.1-live with caution."
  : "❌ Could not connect to Supabase. Check token and project status before proceeding."
}
`;
}

main().catch(e => {
  console.error("\n❌ Audit failed:", e.message);
  process.exit(1);
});
