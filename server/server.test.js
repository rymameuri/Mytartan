/**
 * Tests for server.js API routes
 *
 * Run with: npm test -- --testPathPattern=server.test
 */

const request = require("supertest");

// Point to placeholder keys so the server starts in KB-only mode (no real API calls)
process.env.ANTHROPIC_API_KEY = "placeholder";
process.env.HUGGINGFACE_API_KEY = "placeholder";

const app = require("./server");

// ─── GET / ────────────────────────────────────────────────────────────────────

describe("GET /", () => {
  test("returns 200 with API info", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
    expect(res.body).toHaveProperty("routes");
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
});
