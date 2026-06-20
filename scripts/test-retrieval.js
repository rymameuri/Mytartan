#!/usr/bin/env node
/**
 * Manual retrieval smoke test for the CMU-Q knowledge base pipeline.
 *
 * Runs sample queries (slang, abbreviations, and a follow-up) through the
 * async retrieval path and prints the top chunks for review.
 *
 * Usage: node scripts/test-retrieval.js
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "server", ".env") });

const {
  loadKnowledgeBase,
  retrieveRelevantDocsAsync,
  getRetrievalStatus,
} = require("../server/knowledgeBase");

const SAMPLES = [
  {
    label: "slang — StuCo abbreviation",
    query: "how do i teach a stuco course",
  },
  {
    label: "slang — financial aid shorthand",
    query: "who do i contact about fa and scholarships",
  },
  {
    label: "standalone — registration",
    query: "How do I register for courses at CMU-Q?",
  },
  {
    label: "follow-up — add/drop deadline",
    query: "what about the deadline for that?",
    recentMessages: [
      { role: "user", content: "How do I add or drop a course during the semester?" },
      {
        role: "assistant",
        content:
          "Schedule changes follow the academic calendar deadlines. You can add, drop, or withdraw using the forms on Scotty.",
      },
    ],
  },
  {
    label: "abbreviation — cross registration at EC",
    query: "can i cross reg at another ec school",
  },
];

async function runSample(sample) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Sample: ${sample.label}`);
  console.log(`Query:  ${sample.query}`);

  const docs = await retrieveRelevantDocsAsync(sample.query, {
    limit: 5,
    recentMessages: sample.recentMessages || [],
  });

  const status = getRetrievalStatus();
  console.log(
    `Pipeline: rewrite=${status.lastQuery.usedQueryRewriting}, rerank=${status.lastQuery.usedReranking}`
  );
  if (status.lastQuery.retrievalQuery && status.lastQuery.retrievalQuery !== sample.query) {
    console.log(`Rewritten query: ${status.lastQuery.retrievalQuery}`);
  }

  if (!docs.length) {
    console.log("Results: (no matches)");
    return;
  }

  console.log(`Results: ${docs.length} chunk(s)`);
  docs.forEach((doc, index) => {
    console.log(`\n  [${index + 1}] score=${doc.score?.toFixed?.(2) ?? doc.score} method=${doc.method}`);
    console.log(`      topic: ${doc.topic}`);
    console.log(`      file:  ${doc.file}`);
    console.log(`      preview: ${doc.body.slice(0, 180).replace(/\s+/g, " ")}...`);
  });
}

async function main() {
  const docCount = loadKnowledgeBase();
  console.log(`Tartan Scotty retrieval test`);
  console.log(`Loaded ${docCount} knowledge-base chunks`);

  for (const sample of SAMPLES) {
    await runSample(sample);
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log("Done. Review the chunks above to verify synonym expansion, rewriting, and reranking.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
