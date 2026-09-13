#!/usr/bin/env node
/**
 * Referral + situation eval: intent, contact selection, optional RAG gate (no LLM).
 *
 * Usage: node scripts/eval_referrals.js [--dataset=eval/referral-cases.json]
 */

const fs = require("fs");
const path = require("path");
const { classifyIntent, shouldSelectReferrals } = require("../server/intentRouter");
const { selectContacts } = require("../server/contactMap");
const {
  loadKnowledgeBase,
  retrieveRelevantDocs,
  computeConfidence,
} = require("../server/knowledgeBase");

function parseArgs() {
  const args = { dataset: path.join(__dirname, "..", "eval", "referral-cases.json") };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--dataset=")) args.dataset = arg.slice(10);
  }
  return args;
}

function emailsOf(contacts) {
  return contacts.map((contact) => contact.email).filter(Boolean);
}

function main() {
  const { dataset } = parseArgs();
  const cases = JSON.parse(fs.readFileSync(dataset, "utf8"));
  const needsRetrieval = cases.some((entry) => entry.expectRetrieval);
  if (needsRetrieval) {
    loadKnowledgeBase();
  }

  let failed = 0;

  console.log("\nTartan Scotty referral eval");
  console.log("─".repeat(50));

  for (const entry of cases) {
    const intent = classifyIntent(entry.query, entry.appMode || "qa");
    const topic = intent.topic === "general" ? "academics" : intent.topic;
    const willRefer = shouldSelectReferrals(intent);
    const contacts = willRefer
      ? selectContacts({
          profile: entry.profile || {},
          topic,
          now: entry.now ? new Date(entry.now) : new Date(),
        })
      : [];
    const emails = emailsOf(contacts);
    const problems = [];

    for (const [key, value] of Object.entries(entry.expectIntent || {})) {
      if (intent[key] !== value) {
        problems.push(`intent.${key} expected ${value}, got ${intent[key]}`);
      }
    }
    if (typeof entry.expectShouldRefer === "boolean" && willRefer !== entry.expectShouldRefer) {
      problems.push(`shouldSelectReferrals expected ${entry.expectShouldRefer}, got ${willRefer}`);
    }
    if (contacts.length > (entry.maxContacts || 3)) {
      problems.push(`selected ${contacts.length} contacts, max ${entry.maxContacts || 3}`);
    }
    for (const email of entry.mustIncludeEmails || []) {
      if (!emails.includes(email)) problems.push(`missing ${email}`);
    }
    for (const email of entry.mustExcludeEmails || []) {
      if (emails.includes(email)) problems.push(`should not include ${email}`);
    }

    if (entry.expectRetrieval) {
      const docs = retrieveRelevantDocs(entry.query, { limit: entry.expectRetrieval.limit || 3 });
      const confidence = computeConfidence(docs);
      const minDocs = entry.expectRetrieval.minDocs ?? 1;
      const minConfidence = entry.expectRetrieval.minConfidence ?? 40;
      if (docs.length < minDocs) {
        problems.push(`retrieval expected >= ${minDocs} docs, got ${docs.length}`);
      }
      if (confidence.score < minConfidence) {
        problems.push(`confidence ${confidence.score} < ${minConfidence} (would force I-don't-know)`);
      }
      for (const needle of entry.expectRetrieval.fileIncludes || []) {
        const hit = docs.some((doc) => doc.file.toLowerCase().includes(needle.toLowerCase()));
        if (!hit) problems.push(`retrieval missed file matching ${needle}`);
      }
    }

    const status = problems.length ? "FAIL" : "PASS";
    if (problems.length) failed += 1;
    console.log(`[${status}] ${entry.id}`);
    console.log(`  query: ${entry.query}`);
    console.log(`  intent: ${intent.role} / ${intent.topic} / ${intent.intent}`);
    console.log(`  contacts: ${emails.join(", ") || "(none)"}`);
    for (const problem of problems) {
      console.log(`  ! ${problem}`);
    }
  }

  console.log("─".repeat(50));
  console.log(failed ? `✗ ${failed}/${cases.length} cases failed` : `✓ ${cases.length}/${cases.length} cases passed`);
  process.exit(failed ? 1 : 0);
}

main();
