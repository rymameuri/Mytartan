#!/usr/bin/env node
/**
 * Sync knowledge-base/manifest.json with .txt files on disk.
 *
 * Usage:
 *   node scripts/kb-sync-manifest.js           # merge disk → manifest, write files
 *   node scripts/kb-sync-manifest.js --check   # fail if manifest would change (CI)
 *   node scripts/kb-sync-manifest.js --dry-run # print diff without writing
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const KB_ROOT = path.join(ROOT, "knowledge-base");
const MANIFEST_PATH = path.join(KB_ROOT, "manifest.json");
const MYCMUQ_INDEX_PATH = path.join(KB_ROOT, "mycmuq", "index.json");

const MANIFEST_VERSION = 1;

function parseArgs() {
  return {
    check: process.argv.includes("--check"),
    dryRun: process.argv.includes("--dry-run"),
  };
}

function walkTxtFiles(dir, prefix = "") {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (entry.name === "user-courses") continue;
      files.push(...walkTxtFiles(fullPath, relativePath));
    } else if (entry.name.endsWith(".txt")) {
      files.push(relativePath);
    }
  }

  return files.sort();
}

function parseKbHeaders(content) {
  const lines = content.split("\n");
  const dividerIndex = lines.findIndex((line) => line.trim() === "---");
  const headerLines = dividerIndex >= 0 ? lines.slice(0, dividerIndex) : lines.slice(0, 12);

  let sourceUrl = "";
  let topic = "";
  let section = "";
  let lastUpdated = "";

  for (const line of headerLines) {
    if (line.startsWith("SOURCE:")) sourceUrl = line.slice(7).trim();
    if (line.startsWith("TOPIC:")) topic = line.slice(6).trim();
    if (line.startsWith("SECTION:")) section = line.slice(8).trim();
    if (line.startsWith("LAST_UPDATED:")) lastUpdated = line.slice(13).trim();
  }

  const bodyStart = dividerIndex >= 0 ? dividerIndex + 1 : 0;
  const summary =
    lines
      .slice(bodyStart, bodyStart + 3)
      .map((l) => l.trim())
      .filter(Boolean)[0] || "";

  return { sourceUrl, topic, section, lastUpdated, summary };
}

function inferArea(relativePath) {
  const top = relativePath.split("/")[0];
  if (top === "mycmuq") return "mycmuq";
  if (top === "studies") return "studies";
  if (top === "help") return "help";
  if (top === "life") return "life";
  return top;
}

function scanDiskEntries() {
  const paths = walkTxtFiles(KB_ROOT);
  const entries = [];

  for (const relativePath of paths) {
    const fullPath = path.join(KB_ROOT, relativePath);
    const content = fs.readFileSync(fullPath, "utf8");
    const headers = parseKbHeaders(content);

    entries.push({
      path: relativePath.replace(/\\/g, "/"),
      area: inferArea(relativePath),
      topic: headers.topic,
      section: headers.section,
      sourceUrl: headers.sourceUrl,
      lastUpdated: headers.lastUpdated || null,
      summary: headers.summary.slice(0, 120),
      owner: null,
      synonyms: [],
      keyFactIds: [],
      topicSuggestionLabel: null,
    });
  }

  return entries;
}

function loadExistingManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return {
      version: MANIFEST_VERSION,
      generated: null,
      description:
        "Central registry for all knowledge-base .txt files. Run npm run kb:sync-manifest after adding or removing pages.",
      entries: [],
    };
  }

  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

function mergeEntries(diskEntries, existingEntries) {
  const existingByPath = new Map(
    (existingEntries || []).map((entry) => [entry.path, entry])
  );

  return diskEntries.map((disk) => {
    const prev = existingByPath.get(disk.path);
    if (!prev) return disk;

    return {
      ...disk,
      lastUpdated: disk.lastUpdated || prev.lastUpdated || null,
      owner: prev.owner ?? null,
      synonyms: prev.synonyms ?? [],
      keyFactIds: prev.keyFactIds ?? [],
      topicSuggestionLabel: prev.topicSuggestionLabel ?? null,
    };
  });
}

function buildMycmuqIndex(manifest) {
  const mycmuqEntries = manifest.entries
    .filter((e) => e.path.startsWith("mycmuq/"))
    .map((e) => ({
      file: e.path.replace(/^mycmuq\//, ""),
      topic: e.topic,
      section: e.section,
      summary: e.summary,
    }))
    .sort((a, b) => a.file.localeCompare(b.file));

  let existing = {};
  if (fs.existsSync(MYCMUQ_INDEX_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(MYCMUQ_INDEX_PATH, "utf8"));
    } catch {
      existing = {};
    }
  }

  return {
    source: existing.source || "sites.google.com/andrew.cmu.edu/mycmuq",
    generated: manifest.generated,
    description:
      existing.description ||
      "myCMU-Q portal content (generated from knowledge-base/manifest.json).",
    structure: existing.structure || {},
    total_files: mycmuqEntries.length,
    entries: mycmuqEntries,
    topicSuggestions: existing.topicSuggestions || undefined,
  };
}

function stableStringify(obj) {
  return `${JSON.stringify(obj, null, 2)}\n`;
}

function main() {
  const { check, dryRun } = parseArgs();
  const diskEntries = scanDiskEntries();
  const existing = loadExistingManifest();
  const mergedEntries = mergeEntries(diskEntries, existing.entries);

  const manifest = {
    version: MANIFEST_VERSION,
    generated: new Date().toISOString().slice(0, 10),
    description: existing.description,
    entries: mergedEntries,
  };

  const mycmuqIndex = buildMycmuqIndex(manifest);

  const manifestJson = stableStringify(manifest);
  const mycmuqJson = stableStringify(mycmuqIndex);

  const prevManifestJson = fs.existsSync(MANIFEST_PATH)
    ? fs.readFileSync(MANIFEST_PATH, "utf8")
    : "";
  const prevMycmuqJson = fs.existsSync(MYCMUQ_INDEX_PATH)
    ? fs.readFileSync(MYCMUQ_INDEX_PATH, "utf8")
    : "";

  const manifestChanged = manifestJson !== prevManifestJson;
  const mycmuqChanged = mycmuqJson !== prevMycmuqJson;

  const existingPaths = new Set((existing.entries || []).map((e) => e.path));
  const diskPaths = new Set(diskEntries.map((e) => e.path));
  const orphans = [...diskPaths].filter((p) => !existingPaths.size || !existingPaths.has(p));
  const stale = [...existingPaths].filter((p) => !diskPaths.has(p));

  console.log(`KB manifest sync`);
  console.log(`${"─".repeat(50)}`);
  console.log(`Files on disk:     ${diskEntries.length}`);
  console.log(`Manifest entries:  ${mergedEntries.length}`);
  if (orphans.length && existing.entries?.length) {
    console.log(`New files:         ${orphans.length}`);
  }
  if (stale.length) {
    console.log(`Removed from disk: ${stale.length}`);
    for (const p of stale) console.log(`  - ${p}`);
  }

  if (check) {
    if (manifestChanged || mycmuqChanged) {
      console.error("\n✗ Manifest is out of date. Run: npm run kb:sync-manifest");
      process.exit(1);
    }
    console.log("\n✓ Manifest is in sync with knowledge-base/");
    process.exit(0);
  }

  if (dryRun) {
    console.log(manifestChanged ? "\nWould update manifest.json" : "\nmanifest.json unchanged");
    console.log(mycmuqChanged ? "Would update mycmuq/index.json" : "mycmuq/index.json unchanged");
    process.exit(0);
  }

  fs.writeFileSync(MANIFEST_PATH, manifestJson);
  fs.writeFileSync(MYCMUQ_INDEX_PATH, mycmuqJson);
  console.log(`\n✓ Wrote ${MANIFEST_PATH}`);
  console.log(`✓ Wrote ${MYCMUQ_INDEX_PATH} (${mycmuqIndex.total_files} myCMUQ files)`);
}

main();
