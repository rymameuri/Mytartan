/**
 * Tests for knowledgeBase.js
 *
 * Run with: npm test -- --testPathPattern=knowledgeBase
 */

const path = require("path");
const { loadKnowledgeBase, retrieveRelevantDocs, buildContextBlock } = require("./knowledgeBase");

// Load the real knowledge base before all tests
beforeAll(() => {
  const count = loadKnowledgeBase();
  expect(count).toBeGreaterThan(0); // fails fast if KB files are missing
});

// ─── loadKnowledgeBase ────────────────────────────────────────────────────────

describe("loadKnowledgeBase", () => {
  test("loads more than 0 documents", () => {
    const count = loadKnowledgeBase();
    expect(count).toBeGreaterThan(0);
  });
});

// ─── retrieveRelevantDocs ─────────────────────────────────────────────────────

describe("retrieveRelevantDocs", () => {
  test("returns empty array for empty query", () => {
    const results = retrieveRelevantDocs("");
    expect(results).toEqual([]);
  });

  test("returns empty array for null query", () => {
    const results = retrieveRelevantDocs(null);
    expect(results).toEqual([]);
  });

  test("returns empty array for whitespace-only query", () => {
    const results = retrieveRelevantDocs("   ");
    expect(results).toEqual([]);
  });

  test("returns empty array for completely irrelevant gibberish", () => {
    const results = retrieveRelevantDocs("xyzzy frobble quuxington");
    expect(results).toEqual([]);
  });

  test("returns results for a real CMU-Q question about registration", () => {
    const results = retrieveRelevantDocs("How do I register for courses?");
    expect(results.length).toBeGreaterThan(0);
  });

  test("returns results for a question about minors", () => {
    const results = retrieveRelevantDocs("How do I declare a minor?");
    expect(results.length).toBeGreaterThan(0);
    const topics = results.map((r) => r.topic.toLowerCase());
    expect(topics.some((t) => t.includes("minor"))).toBe(true);
  });

  test("returns results for a question about StuCo", () => {
    const results = retrieveRelevantDocs("What is StuCo?");
    expect(results.length).toBeGreaterThan(0);
  });

  test("each result has topic, body, and file fields", () => {
    const results = retrieveRelevantDocs("registration");
    expect(results.length).toBeGreaterThan(0);
    for (const doc of results) {
      expect(doc).toHaveProperty("topic");
      expect(doc).toHaveProperty("body");
      expect(doc).toHaveProperty("file");
    }
  });

  test("respects the limit option", () => {
    const results = retrieveRelevantDocs("course registration minors schedule", { limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });
});

// ─── buildContextBlock ────────────────────────────────────────────────────────

describe("buildContextBlock", () => {
  test("returns empty string for empty array", () => {
    expect(buildContextBlock([])).toBe("");
  });

  test("includes the document topic in the output", () => {
    const results = retrieveRelevantDocs("registration");
    const block = buildContextBlock(results);
    expect(block.length).toBeGreaterThan(0);
    expect(block).toContain("[Source:");
  });
});
