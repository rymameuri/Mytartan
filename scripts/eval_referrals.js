#!/usr/bin/env node
/**
 * Lightweight referral eval: intent + contact selection only (no LLM).
 *
 * Usage: node scripts/eval_referrals.js [--dataset=eval/referral-cases.json]
 */

const fs = require("fs");
const path = require("path");
const { classifyIntent } = require("../server/intentRouter");
const { selectContacts } = require("../server/contactMap");

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
  let failed = 0;

  console.log("\nTartan Scotty referral eval");
  console.log("─".repeat(50));

  for (const entry of cases) {
    const intent = classifyIntent(entry.query, entry.appMode || "qa");
    const topic = intent.topic === "general" ? "academics" : intent.topic;
    const contacts = selectContacts({
      profile: entry.profile || {},
      topic,
      now: entry.now ? new Date(entry.now) : new Date(),
    });
    const emails = emailsOf(contacts);
    const problems = [];

    for (const [key, value] of Object.entries(entry.expectIntent || {})) {
      if (intent[key] !== value) {
        problems.push(`intent.${key} expected ${value}, got ${intent[key]}`);
      }
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
