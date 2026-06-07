#!/usr/bin/env node
/**
 * security-scan.mjs — Lightweight security/policy scan.
 *
 * Scans the built output for:
 * - Private credentials (API keys, passwords, secrets)
 * - Execution/trading code patterns
 * - Wallet/blockchain private patterns
 * - Forbidden file types
 *
 * Run: npm run scan:security
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const SCAN_DIRS = ["dist", "public"];
const FORBIDDEN_PATTERNS = [
  // Credentials
  /api[_-]?key\s*[=:]\s*['"][a-zA-Z0-9]{16,}['"]/i,
  /password\s*[=:]\s*['"][^'"]+['"]/i,
  /secret\s*[=:]\s*['"][a-zA-Z0-9]{8,}['"]/i,
  /token\s*[=:]\s*['"][a-zA-Z0-9]{16,}['"]/i,
  /private[_-]?key\s*[=:]\s*['"][^'"]+['"]/i,
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /sk-[a-zA-Z0-9]{20,}/i,
  // Execution / trading
  /execute_trade|place_order|send_transaction|swap_tokens/i,
  /wallet_address|private_key.*wallet|live_provider/i,
  // Forbidden instructions
  /fetch\(['"]https:\/\/api\.binance/i,
  /fetch\(['"]https:\/\/api\.coinbase/i,
  /fetch\(['"]wss:\/\/stream\.binance/i,
  /new\s+WebSocket\s*\(\s*['"]wss:\/\//i,
];

const FORBIDDEN_EXTENSIONS = [".env", ".key", ".pem", ".p12", ".pfx", ".secret", ".token"];

const WHITELISTED_PATHS = [
  "validate-fixtures.mjs",
  "security-scan.mjs",
  "mock-alpha-snapshot.json",
  "invalid-",
  "missing-",
  "stale-",
  "fixture",
];

function shouldScanFile(filePath) {
  const ext = extname(filePath);
  if (FORBIDDEN_EXTENSIONS.includes(ext)) return true; // Flag forbidden extensions
  return [".js", ".jsx", ".ts", ".tsx", ".html", ".json", ".mjs"].includes(ext);
}

function isWhitelisted(filePath) {
  return WHITELISTED_PATHS.some((w) => filePath.includes(w));
}

function scanFile(filePath) {
  const findings = [];
  const content = readFileSync(filePath, "utf-8");

  FORBIDDEN_PATTERNS.forEach((pattern, idx) => {
    const lines = content.split("\n");
    lines.forEach((line, lineNum) => {
      if (pattern.test(line)) {
        findings.push({
          pattern: pattern.toString(),
          line: lineNum + 1,
          snippet: line.trim().slice(0, 80),
        });
      }
    });
  });

  return findings;
}

function walkDir(dir, files = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (entry === "node_modules") continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

console.log("═══════════════════════════════════════════════════════════");
console.log("  Security & Policy Scan");
console.log("═══════════════════════════════════════════════════════════\n");

let totalFiles = 0;
let scannedFiles = 0;
let flaggedFiles = 0;
let forbiddenExtensionsFound = 0;

for (const scanDir of SCAN_DIRS) {
  try {
    const files = walkDir(scanDir);
    for (const filePath of files) {
      totalFiles++;
      const isWhitelistedFile = isWhitelisted(filePath);

      // Check forbidden extensions
      const ext = extname(filePath);
      if (FORBIDDEN_EXTENSIONS.includes(ext)) {
        forbiddenExtensionsFound++;
        console.log(`🚫 Forbidden extension: ${filePath}`);
        continue;
      }

      if (!shouldScanFile(filePath)) continue;
      scannedFiles++;

      const findings = scanFile(filePath);
      const realFindings = findings.filter((f) => !isWhitelistedFile);

      if (realFindings.length > 0) {
        flaggedFiles++;
        console.log(`⚠️  ${filePath}:`);
        realFindings.forEach((f) => {
          console.log(`   Line ${f.line}: ${f.snippet}`);
        });
      }
    }
  } catch (err) {
    console.log(`   ⚠️  Directory "${scanDir}" not found (may need to build first)`);
  }
}

console.log(`\n───────────────────────────────────────────────────────────`);
console.log(`  Files scanned: ${scannedFiles}/${totalFiles}`);
console.log(`  Flagged files: ${flaggedFiles}`);
console.log(`  Forbidden extensions: ${forbiddenExtensionsFound}`);

console.log(`\n═══════════════════════════════════════════════════════════`);
if (flaggedFiles === 0 && forbiddenExtensionsFound === 0) {
  console.log("  ✅ No security issues detected");
  process.exit(0);
} else {
  console.log("  🚫 Security/policy issues found");
  process.exit(1);
}
