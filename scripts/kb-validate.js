#!/usr/bin/env node
/**
 * Unified knowledge-base validation pipeline.
 *
 * Usage: npm run kb:validate
 *
 * Runs format lint, manifest sync check, unit tests, topic suggestions,
 * retrieval eval, and key-facts freshness warnings.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const KEY_FACTS_PATH = path.join(ROOT, "data", "key-facts.json");
const STALE_DAYS = 90;

function runStep(label, command, args, options = {}) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`▶ ${label}`);
  console.log(`  ${command} ${args.join(" ")}`);

  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
    env: process.env,
    ...options,
  });

  if (result.status !== 0) {
    console.error(`\n✗ FAILED: ${label}`);
    process.exit(result.status ?? 1);
  }

  console.log(`✓ ${label}`);
}

function checkKeyFactsFreshness() {
  console.log(`\n${"─".repeat(50)}`);
  console.log("▶ Key facts freshness (soft warning)");

  if (!fs.existsSync(KEY_FACTS_PATH)) {
    console.log("  (no key-facts.json — skipped)");
    return;
  }

  const facts = JSON.parse(fs.readFileSync(KEY_FACTS_PATH, "utf8")).filter(
    (f) => f?.id && f?.lastVerified
  );
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);

  const stale = facts.filter((f) => new Date(f.lastVerified) < cutoff);

  if (!stale.length) {
    console.log(`✓ All ${facts.length} key facts verified within ${STALE_DAYS} days`);
    return;
  }

  console.warn(`⚠ ${stale.length} key fact(s) older than ${STALE_DAYS} days:`);
  for (const f of stale) {
    console.warn(`  - ${f.id} (lastVerified: ${f.lastVerified})`);
  }
  console.warn("  Update lastVerified in data/key-facts.json when facts change.");
}

function main() {
  console.log("Tartan Scotty — Knowledge Base Validation");
  console.log(`${"═".repeat(50)}`);

  // 1. Format lint (dry run; fails on missing headers)
  runStep(
    "Format lint (headers & structure)",
    "python3",
    [path.join("scripts", "clean_knowledge_base.py"), "--strict"]
  );

  // 2. Manifest integrity
  runStep("Manifest sync check", "node", [path.join("scripts", "kb-sync-manifest.js"), "--check"]);

  // 3. Knowledge base unit tests
  runStep("Knowledge base unit tests", "npx", [
    "jest",
    "server/knowledgeBase.test.js",
    "--testEnvironment",
    "node",
    "--no-coverage",
  ]);

  // 4. Topic suggestions
  runStep("Topic suggestions alignment", "npx", [
    "react-scripts",
    "test",
    "--watchAll=false",
    "--testPathPattern=topicSuggestions",
  ], {
    env: { ...process.env, CI: "true" },
  });

  // 5. Retrieval eval
  runStep("Retrieval eval (golden set)", "node", [path.join("scripts", "eval_rag.js")]);

  // 6. Key facts freshness (warn only)
  checkKeyFactsFreshness();

  console.log(`\n${"═".repeat(50)}`);
  console.log("✓ All KB validation checks passed");
  console.log(`${"═".repeat(50)}\n`);
}

main();
