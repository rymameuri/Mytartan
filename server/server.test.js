/**
 * Tests for server.js API routes
 *
 * Run with: npm test -- --testPathPattern=server.test
 */

const request = require("supertest");

// Disable real AI providers so tests run in KB-only mode (no external API calls)
process.env.ANTHROPIC_API_KEY = "placeholder";
process.env.CLAUDE_API_KEY = "placeholder";
process.env.AI_GATEWAY_BASE_URL = "";

const app = require("./server");

// ─── GET / ────────────────────────────────────────────────────────────────────

describe("GET /", () => {
  test("returns 200 with API info", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
    expect(res.body).toHaveProperty("routes");
    expect(res.body.routes).toContain("GET /api/kb/status");
  });
});

describe("GET /api/kb/status", () => {
  test("returns retrieval status metadata", async () => {
    const res = await request(app).get("/api/kb/status");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("activeMethod", "keyword");
    expect(res.body).toHaveProperty("documentCount");
  });
});

// ─── POST /api/chat — validation ──────────────────────────────────────────────

describe("POST /api/chat — input validation", () => {
  test("returns 400 when messages is missing", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ mode: "qa" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("returns 400 when messages is not an array", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ messages: "hello", mode: "qa" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("returns 400 when mode is invalid", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ messages: [{ role: "user", content: "hi" }], mode: "invalidmode" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("accepts all valid modes without crashing", async () => {
    for (const mode of ["qa", "campus", "chat", "tutor"]) {
      const res = await request(app)
        .post("/api/chat")
        .send({ messages: [{ role: "user", content: "What is StuCo?" }], mode });
      // With placeholder keys the server will either return a KB reply or an error about the key
      // — either way it should NOT be a 400 (that would mean invalid input)
      expect(res.status).not.toBe(400);
    }
  });

  test("returns a dramatic praise reply for Professor N questions", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({
        messages: [{ role: "user", content: "Who is Professor N?" }],
        mode: "chat",
      });

    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/Professor Nui/i);
    expect(res.body.reply).toMatch(/extraordinary|legendary/i);
    expect(res.body.confidence.sourceCount).toBeGreaterThan(0);
  });

  test("returns a greeting reply for hi without an API key", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ messages: [{ role: "user", content: "hi" }], mode: "chat" });

    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/Scotty/i);
  });

  test("returns confidence metadata for KB-grounded replies", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ messages: [{ role: "user", content: "What is StuCo?" }], mode: "qa" });

    if (res.status === 200) {
      expect(res.body).toHaveProperty("confidence");
      expect(res.body.confidence).toHaveProperty("score");
      expect(res.body.confidence).toHaveProperty("sourceCount");
      expect(res.body.confidence.message).toMatch(/Scotty is \d+% confident/);
    }
  });

  test("tells user to check scotty.qatar.cmu.edu when KB has no match", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({
        messages: [{ role: "user", content: "xyzzy frobble quuxington nonsense" }],
        mode: "qa",
      });

    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/don't have that information/i);
    expect(res.body.reply).toMatch(/scotty\.qatar\.cmu\.edu/i);
    expect(res.body.confidence).toMatchObject({ sourceCount: 0, score: 0 });
  });
});
