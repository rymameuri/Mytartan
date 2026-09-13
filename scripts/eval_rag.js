#!/usr/bin/env node
/**
 * Retrieval evaluation script for Tartan Scotty RAG.
 *
 * Measures precision@k and hit@k against a hand-labeled golden dataset.
 * Uses keyword retrieval (no API key required) so it runs in CI/local dev.
 *
 * Usage: node scripts/eval_rag.js [--k=3] [--dataset=eval/golden-set.json]
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "server", ".env") });

const { loadKnowledgeBase, retrieveRelevantDocs } = require("../server/knowledgeBase");

function parseArgs() {
  const args = { k: 3, dataset: path.join(__dirname, "..", "eval", "golden-set.json") };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--k=")) args.k = Number(arg.slice(4));
    if (arg.startsWith("--dataset=")) args.dataset = arg.slice(10);
  }
  return args;
}

function matchesFile(docFile, expected) {
  return (
    docFile === expected ||
    docFile.endsWith(`/${expected}`) ||
    docFile.includes(expected)
  );
}

function isRelevant(doc, expectedFiles) {
  if (!expectedFiles.length) return false;
  return expectedFiles.some((file) => matchesFile(doc.file, file));
}

function hitsExcluded(docs, excludedFiles = []) {
  if (!excludedFiles.length) return false;
  return docs.some((doc) => excludedFiles.some((file) => matchesFile(doc.file, file)));
}

function evaluateQuery(entry, k) {
  const results = retrieveRelevantDocs(entry.query, { limit: k });
  const topK = results.slice(0, k);
  const relevantInTopK = topK.filter((doc) => isRelevant(doc, entry.expectedFiles));
  const excludedHit = hitsExcluded(topK, entry.excludedFiles);
  const precisionAtK = entry.expectedFiles.length === 0
    ? (topK.length === 0 ? 1 : 0)
    : relevantInTopK.length / k;
  const hitAtK = entry.expectedFiles.length === 0
    ? topK.length === 0 && !excludedHit
    : relevantInTopK.length > 0 && !excludedHit;

  return {
    id: entry.id,
    query: entry.query,
    retrieved: topK.map((d) => ({ file: d.file, topic: d.topic, score: d.score })),
    precisionAtK,
    hitAtK,
    topScore: topK[0]?.score ?? 0,
  };
}

function main() {
  const { k, dataset } = parseArgs();

  if (!fs.existsSync(dataset)) {
    console.error(`Dataset not found: ${dataset}`);
    process.exit(1);
  }

  const goldenSet = JSON.parse(fs.readFileSync(dataset, "utf8"));
  const docCount = loadKnowledgeBase();

  console.log(`\nTartan Scotty RAG Evaluation`);
  console.log(`${"─".repeat(50)}`);
  console.log(`Knowledge base: ${docCount} chunks loaded`);
  console.log(`Golden set:     ${goldenSet.length} queries`);
  console.log(`k:              ${k}\n`);

  const results = goldenSet.map((entry) => evaluateQuery(entry, k));
  const withExpected = results.filter((r) => {
    const entry = goldenSet.find((e) => e.id === r.id);
    return entry.expectedFiles.length > 0;
  });
  const negatives = results.filter((r) => {
    const entry = goldenSet.find((e) => e.id === r.id);
    return entry.expectedFiles.length === 0;
  });

  const meanPrecision = withExpected.reduce((sum, r) => sum + r.precisionAtK, 0) / withExpected.length;
  const hitRate = withExpected.filter((r) => r.hitAtK).length / withExpected.length;
  const negativeAccuracy = negatives.filter((r) => r.hitAtK).length / Math.max(negatives.length, 1);

  console.log(`Mean precision@${k}:  ${(meanPrecision * 100).toFixed(1)}%`);
  console.log(`Hit@${k} (recall):    ${(hitRate * 100).toFixed(1)}%  (${withExpected.filter((r) => r.hitAtK).length}/${withExpected.length} queries)`);
  console.log(`Negative accuracy:  ${(negativeAccuracy * 100).toFixed(1)}%  (no false retrievals on gibberish)\n`);

  const misses = withExpected.filter((r) => !r.hitAtK);
  if (misses.length) {
    console.log(`Misses (${misses.length}):`);
    for (const miss of misses) {
      const expected = goldenSet.find((e) => e.id === miss.id).expectedFiles;
      console.log(`  [${miss.id}] "${miss.query}"`);
      console.log(`    expected: ${expected.join(", ")}`);
      console.log(`    got:      ${miss.retrieved.map((r) => r.file).join(", ") || "(none)"}`);
    }
    console.log();
  }

  const passThreshold = hitRate >= 0.75;
  console.log(passThreshold ? "✓ PASS (hit@k ≥ 75%)" : "✗ FAIL (hit@k < 75%)");
  process.exit(passThreshold ? 0 : 1);
}

main();
