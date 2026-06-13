/**
 * advisoryPacketRenderer.ts — v7C.1 Advisory Packet Renderer
 *
 * Renders an AdvisoryMemoryPacket into human-readable output formats
 * for operator consumption. Pure rendering — no side effects.
 */

import type { AdvisoryMemoryPacket, AdvisoryMemoryItem } from "./advisoryMemoryPacket";

// ── Render Formats ───────────────────────────────────────────────────────────

export type RenderFormat = "markdown" | "json" | "text";

export interface RenderOptions {
  /** Include provenance details */
  includeProvenance?: boolean;

  /** Include boundary metadata (counts) */
  includeBoundary?: boolean;

  /** Include immutable guarantees */
  includeGuarantees?: boolean;

  /** Truncate content to N characters (0 = no truncation) */
  truncateContent?: number;

  /** Format */
  format: RenderFormat;
}

export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  format: "markdown",
  includeProvenance: true,
  includeBoundary: true,
  includeGuarantees: true,
  truncateContent: 0,
};

// ── Core Renderers ───────────────────────────────────────────────────────────

/**
 * Render an advisory packet as Markdown.
 */
export function renderAsMarkdown(
  packet: AdvisoryMemoryPacket,
  options: RenderOptions = DEFAULT_RENDER_OPTIONS,
): string {
  const lines: string[] = [];

  lines.push("# Advisory Memory Context");
  lines.push("");
  lines.push(`> **Version:** ${packet.version} | **Generated:** ${packet.generatedAt}`);
  lines.push("");
  lines.push("> ⚠️ **This packet is advisory context only.** It cannot authorize trades, " +
    "governance changes, writes, or promotions. It cannot trigger execution.",
  );
  lines.push("");

  // Advisory items
  if (packet.advisoryItems.length === 0) {
    lines.push("*No advisory-safe memories available.*");
    lines.push("");
  } else {
    lines.push(`## Advisory Context (${packet.advisoryItems.length} items)`);
    lines.push("");

    for (let i = 0; i < packet.advisoryItems.length; i++) {
      const item = packet.advisoryItems[i];
      lines.push(renderItemMarkdown(item, i + 1, options));
      lines.push("");
    }
  }

  // Boundary metadata
  if (options.includeBoundary !== false) {
    lines.push("---");
    lines.push("");
    lines.push("## Classification Boundary");
    lines.push("");
    lines.push(`| Category | Count | In Packet |`);
    lines.push(`|----------|-------|-----------|`);
    lines.push(`| Advisory-safe | ${packet.boundary.advisorySafeCount} | ✅ Yes |`);
    lines.push(`| Stale (degraded) | ${packet.boundary.staleCount} | ✅ Yes (flagged) |`);
    lines.push(`| Blocked | ${packet.boundary.blockedCount} | ❌ No |`);
    lines.push(`| Quarantined | ${packet.boundary.quarantinedCount} | ❌ No |`);
    lines.push(`| Excluded | ${packet.boundary.excludedCount} | ❌ No |`);
    lines.push(`| **Total evaluated** | **${packet.boundary.totalEvaluated}** | — |`);
    lines.push("");
  }

  // Guarantees
  if (options.includeGuarantees !== false) {
    lines.push("---");
    lines.push("");
    lines.push("## Immutable Guarantees");
    lines.push("");
    lines.push("- [x] Packet cannot authorize trades");
    lines.push("- [x] Packet cannot authorize governed-state changes");
    lines.push("- [x] Packet cannot authorize writes");
    lines.push("- [x] Packet cannot authorize promotions");
    lines.push("- [x] Packet cannot trigger execution");
    lines.push("- [x] Packet is read-only");
    lines.push("");
  }

  // Audit reference
  lines.push("---");
  lines.push("");
  lines.push(`*Audit trace: ${packet.auditRef.pipelineVersion} / ${packet.auditRef.traceFormat}*`);
  lines.push("");

  return lines.join("\n");
}

function renderItemMarkdown(
  item: AdvisoryMemoryItem,
  index: number,
  options: RenderOptions,
): string {
  const lines: string[] = [];

  const degradationFlag = item.classification.safetyLevel === "stale"
    ? " [DEGRADED — stale memory]"
    : "";

  lines.push(`### ${index}. ${item.source}${degradationFlag}`);
  lines.push("");

  const content = options.truncateContent && options.truncateContent > 0
    ? item.content.substring(0, options.truncateContent) + "..."
    : item.content;
  lines.push("> " + content.replace(/\n/g, "\n> "));
  lines.push("");

  lines.push(`- **Confidence:** ${(item.confidence * 100).toFixed(0)}%`);
  lines.push(`- **Written:** ${item.writtenAt}`);

  if (options.includeProvenance !== false) {
    lines.push(`- **Source:** ${item.provenance.originalSource}`);
    lines.push(`- **Retrieved:** ${item.retrievedAt}`);
    lines.push(`- **Method:** ${item.provenance.retrievalMethod}`);
  }

  if (item.classification.flags.length > 0) {
    lines.push(`- **Flags:** ${item.classification.flags.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Render an advisory packet as plain text.
 */
export function renderAsText(
  packet: AdvisoryMemoryPacket,
  options: RenderOptions = { ...DEFAULT_RENDER_OPTIONS, format: "text" },
): string {
  const lines: string[] = [];

  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("  ADVISORY MEMORY CONTEXT");
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push(`  Version: ${packet.version}`);
  lines.push(`  Generated: ${packet.generatedAt}`);
  lines.push("");
  lines.push("  [ADVISORY ONLY — Cannot authorize any action]");
  lines.push("");

  if (packet.advisoryItems.length === 0) {
    lines.push("  No advisory-safe memories available.");
  } else {
    lines.push(`  Context Items: ${packet.advisoryItems.length}`);
    lines.push("");

    for (let i = 0; i < packet.advisoryItems.length; i++) {
      const item = packet.advisoryItems[i];
      const label = item.classification.safetyLevel === "stale" ? " [DEGRADED]" : "";
      lines.push(`  ── ${i + 1}. ${item.source}${label} ──`);

      const content = options.truncateContent && options.truncateContent > 0
        ? item.content.substring(0, options.truncateContent) + "..."
        : item.content;
      // Wrap content at 56 chars
      const wrapped = wrapText(content, 56);
      for (const line of wrapped) lines.push(`    ${line}`);

      lines.push(`    Confidence: ${(item.confidence * 100).toFixed(0)}% | Written: ${item.writtenAt}`);
      if (options.includeProvenance !== false) {
        lines.push(`    Source: ${item.provenance.originalSource} | Method: ${item.provenance.retrievalMethod}`);
      }
      lines.push("");
    }
  }

  if (options.includeBoundary !== false) {
    lines.push("  ── Classification Boundary ──");
    lines.push(`    Advisory-safe:  ${packet.boundary.advisorySafeCount} (included)`);
    lines.push(`    Stale:          ${packet.boundary.staleCount} (included, degraded)`);
    lines.push(`    Blocked:        ${packet.boundary.blockedCount} (excluded)`);
    lines.push(`    Quarantined:    ${packet.boundary.quarantinedCount} (excluded)`);
    lines.push(`    Excluded:       ${packet.boundary.excludedCount} (excluded)`);
    lines.push(`    Total:          ${packet.boundary.totalEvaluated}`);
    lines.push("");
  }

  lines.push("  [Read-only packet | No execution authority]");
  lines.push("═══════════════════════════════════════════════════════════");

  return lines.join("\n");
}

/**
 * Render an advisory packet as JSON.
 */
export function renderAsJSON(packet: AdvisoryMemoryPacket): string {
  return JSON.stringify(packet, null, 2);
}

/**
 * Render packet in the specified format.
 */
export function renderPacket(
  packet: AdvisoryMemoryPacket,
  options: RenderOptions = DEFAULT_RENDER_OPTIONS,
): string {
  switch (options.format) {
    case "markdown": return renderAsMarkdown(packet, options);
    case "text": return renderAsText(packet, options);
    case "json": return renderAsJSON(packet);
    default: return renderAsText(packet, { ...options, format: "text" });
  }
}

// ── Utility ──────────────────────────────────────────────────────────────────

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).length > maxWidth && currentLine.length > 0) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + " " + word : word;
    }
  }

  if (currentLine) lines.push(currentLine.trim());
  return lines.length > 0 ? lines : [text];
}
