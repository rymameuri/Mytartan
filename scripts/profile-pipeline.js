#!/usr/bin/env node
/**
 * Local latency profile. Mocks the LLM and ElevenLabs so timings are
 * in-process only (no network, no real API keys).
 *
 * Usage: node scripts/profile-pipeline.js
 */

const { performance } = require("perf_hooks");
const { Readable } = require("stream");

process.env.AI_PROVIDER = "claude";
process.env.AI_GATEWAY_BASE_URL = "";
process.env.ANTHROPIC_API_KEY = "sk-local-mock-not-a-real-key";
process.env.CLAUDE_API_KEY = "";
process.env.HUGGINGFACE_API_KEY = "";
process.env.ELEVENLABS_API_KEY = "el-local-mock-not-a-real-key";
process.env.ELEVENLABS_VOICE_ID = "voice-mock";

const axios = require("axios");

axios.post = async (url, _body, config = {}) => {
  const target = String(url);
  if (target.includes("elevenlabs")) {
    return { data: Buffer.alloc(256, 1) };
  }
  if (config.responseType === "stream") {
    const chunks = [
      `data: ${JSON.stringify({ type: "content_block_delta", delta: { text: "TAFAWQ requires a 4.0 GPA. " } })}\n\n`,
      `data: ${JSON.stringify({ type: "content_block_delta", delta: { text: "That is the merit cutoff." } })}\n\n`,
    ];
    return { data: Readable.from(chunks) };
  }
  if (target.includes("rerank") || target.includes("anthropic")) {
    return { data: { content: [{ text: "[0, 1, 2]" }] } };
  }
  return { data: { content: [{ text: "TAFAWQ requires a cumulative GPA of 4.0." }] } };
};

const request = require("supertest");
const app = require("../server/server");
const { loadKnowledgeBase, retrieveRelevantDocs } = require("../server/knowledgeBase");

function msSince(start) {
  return performance.now() - start;
}

async function main() {
  let start = performance.now();
  const chunks = loadKnowledgeBase();
  console.log(`kb load: ${chunks} chunks in ${msSince(start).toFixed(1)} ms`);

  const queries = [
    "What GPA do I need for tafawq?",
    "How do I register for courses at CMU-Q?",
    "What is the Information Systems program?",
    "What are the important academic dates?",
    "How do I connect to CMUQ-SECURE WiFi?",
  ];
  start = performance.now();
  const rounds = 30;
  for (let i = 0; i < rounds; i += 1) {
    for (const query of queries) {
      retrieveRelevantDocs(query, { limit: 4, maxChars: 6500, maxDocChars: 900 });
    }
  }
  const avg = msSince(start) / (rounds * queries.length);
  console.log(`retrieval avg: ${avg.toFixed(2)} ms over ${rounds * queries.length} queries`);

  start = performance.now();
  const streamed = await request(app)
    .post("/api/chat/stream")
    .send({
      messages: [{ role: "user", content: "What GPA do I need for tafawq?" }],
      mode: "qa",
    });
  console.log(`mocked stream total: ${msSince(start).toFixed(1)} ms status ${streamed.status}`);
  const timingLine = String(streamed.text)
    .split("\n")
    .find((line) => line.includes('"timings"') || line.includes("llmTtftMs") || line.includes("retrievalMs"));
  if (timingLine) console.log(`stream timings event: ${timingLine.trim()}`);

  start = performance.now();
  const tts = await request(app)
    .post("/api/tts")
    .send({ text: "TAFAWQ requires a 4.0 GPA." });
  console.log(
    `mocked tts overhead: ${msSince(start).toFixed(1)} ms status ${tts.status} bytes ${tts.body?.length || 0}`
  );

  start = performance.now();
  const hi = await request(app)
    .post("/api/chat")
    .send({ messages: [{ role: "user", content: "hi" }], mode: "qa" });
  console.log(`small talk: ${msSince(start).toFixed(1)} ms status ${hi.status}`);

  start = performance.now();
  const empty = await request(app)
    .post("/api/chat")
    .send({ messages: [{ role: "user", content: "   " }], mode: "qa" });
  console.log(`empty question: ${msSince(start).toFixed(1)} ms status ${empty.status}`);

  start = performance.now();
  const missingTts = await request(app).post("/api/tts").send({ text: "" });
  console.log(`empty tts: ${msSince(start).toFixed(1)} ms status ${missingTts.status}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
