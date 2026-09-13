/**
 * Tests for server.js API routes
 *
 * Run with: npm test -- --testPathPattern=server.test
 */

const request = require("supertest");

jest.mock("axios", () => ({
  get: jest.fn(),
  defaults: { proxy: false },
}));

const axios = require("axios");

// Disable real AI providers so tests run in KB-only mode (no external API calls)
process.env.AI_PROVIDER = "claude";
process.env.HUGGINGFACE_API_KEY = "";
process.env.HF_TOKEN = "";
process.env.ANTHROPIC_API_KEY = "placeholder";
process.env.CLAUDE_API_KEY = "placeholder";
process.env.AI_GATEWAY_BASE_URL = "";

const app = require("./server");
const feedbackStore = require("./feedbackStore");
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  LOW_CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_REPLY,
  isSmallTalk,
  getSmallTalkReply,
  buildSystemPrompt,
  isCampusFactQuery,
} = require("./server");

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
    expect(res.body).toHaveProperty("activeMethod", "tfidf+rerank");
    expect(res.body).toHaveProperty("documentCount");
    expect(res.body).toHaveProperty("lastQuery");
    expect(res.body.lastQuery).toHaveProperty("usedQueryRewriting");
    expect(res.body.lastQuery).toHaveProperty("usedReranking");
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

  test("answers how are you as a check-in instead of a knowledge-base miss", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ messages: [{ role: "user", content: "hi sorry how are you" }], mode: "qa" });

    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/i'm good|what's going on|scotty here/i);
    expect(res.body.reply).not.toMatch(/don't have that one|student affairs/i);
  });

  test("answers a plain how are you as a check-in instead of a knowledge-base miss", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ messages: [{ role: "user", content: "how are you" }], mode: "qa" });

    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/i'm good|what's going on/i);
    expect(res.body.reply).not.toMatch(/don't have that information|relevant information|knowledge base/i);
    expect(res.body.reply).not.toMatch(/mycmuq-student-affairs/i);
  });

  test("small talk skips KB pipeline and avoids low-confidence fallback", async () => {
    for (const content of [
      "how are you",
      "hi sorry how are you",
      "hello how are you",
      "how's it going",
      "thanks",
      "thank you so much for all your support",
      "good morning",
    ]) {
      const res = await request(app)
        .post("/api/chat")
        .send({ messages: [{ role: "user", content }], mode: "chat" });

      expect(res.status).toBe(200);
      expect(res.body.reply).not.toBe(LOW_CONFIDENCE_REPLY);
      expect(res.body.reply).not.toMatch(/don't have that information/i);
      expect(res.body.reply).not.toMatch(/not confident I have accurate information/i);
    }
  });

  test("short campus questions are not classified as small talk", async () => {
    expect(isSmallTalk("deadlines?")).toBe(false);
    expect(isSmallTalk("financial aid?")).toBe(false);

    const res = await request(app)
      .post("/api/chat")
      .send({ messages: [{ role: "user", content: "deadlines?" }], mode: "qa" });

    expect(res.status).toBe(200);
    expect(res.body.reply).not.toMatch(/^Hey — Scotty here/);
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

  test("unknown campus fact says so once without dumping the contact directory", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({
        messages: [{ role: "user", content: "heygen xyzzy quuxington" }],
        mode: "qa",
      });

    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/don't have the official answer/i);
    expect(res.body.reply).not.toMatch(/mycmuq-student-affairs/i);
    expect((res.body.reply.match(/@[a-z0-9.-]+/gi) || []).length).toBeLessThanOrEqual(3);
    expect(res.body.reply).not.toMatch(/hbouamor@/);
    expect(res.body.reply).not.toMatch(/atorinab@/);
    expect(res.body.confidence).toMatchObject({ sourceCount: 0, score: 0 });
  });

  test("does not treat casual non-campus chat as a knowledge-base miss", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({
        messages: [{ role: "user", content: "I'm so done with this week" }],
        mode: "qa",
      });

    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/what's going on|i'm here/i);
    expect(res.body.reply).not.toMatch(/don't have that one/i);
    expect(res.body.reply).not.toMatch(/mycmuq-student-affairs/i);
  });

  test("returns low-confidence reply when retrieval score is weak", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({
        messages: [{ role: "user", content: "What are the quantum physics lab hours?" }],
        mode: "qa",
      });

    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/don't have the official answer/i);
    expect((res.body.reply.match(/@[a-z0-9.-]+/gi) || []).length).toBeLessThanOrEqual(3);
    expect(res.body.reply).not.toMatch(/hbouamor@/);
    expect(res.body.reply).not.toMatch(/atorinab@/);
    expect(res.body.confidence.score).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
  });

  test("returns 400 for tutor mode with invalid courseContext", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({
        messages: [{ role: "user", content: "Explain loops" }],
        mode: "tutor",
        courseContext: { courseName: "CS" },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/courseName and syllabusText/i);
  });

  test("accepts tutor mode with valid courseContext", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({
        messages: [{ role: "user", content: "Explain loops" }],
        mode: "tutor",
        courseContext: {
          courseName: "Intro to CS",
          syllabusText: "Week 2 covers loops and iteration.",
        },
      });

    expect(res.status).not.toBe(400);
  });

  test("CS profile unknown academic refers CS advising, not every office", async () => {
    const email = `cs-referral-${Date.now()}@example.com`;
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send({ email, password: "testpass123" });
    await request(app)
      .patch("/api/auth/profile")
      .set("Authorization", `Bearer ${signupRes.body.token}`)
      .send({
        major: "Computer Science",
        graduationDate: "May 2030",
        learningStyle: "visual",
        intendedUse: "campus navigation",
      });

    const res = await request(app)
      .post("/api/chat")
      .set("Authorization", `Bearer ${signupRes.body.token}`)
      .send({
        messages: [{ role: "user", content: "heygen xyzzy quuxington" }],
        mode: "qa",
      });

    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/don't have the official answer/i);
    expect(res.body.reply).toMatch(/rdriley@andrew\.cmu\.edu/);
    expect(res.body.reply).toMatch(/ddourado@andrew\.cmu\.edu/);
    expect(res.body.reply).not.toMatch(/hbouamor@/);
    expect(res.body.reply).not.toMatch(/atorinab@/);
    expect(res.body.reply).not.toMatch(/srian@/);
    expect((res.body.reply.match(/@[a-z0-9.-]+/gi) || []).length).toBeLessThanOrEqual(3);
  });

  test("IS profile unknown academic refers IS advising, not CS", async () => {
    const email = `is-referral-${Date.now()}@example.com`;
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send({ email, password: "testpass123" });
    await request(app)
      .patch("/api/auth/profile")
      .set("Authorization", `Bearer ${signupRes.body.token}`)
      .send({
        major: "Information Systems",
        graduationDate: "May 2028",
        learningStyle: "reading",
        intendedUse: "campus navigation",
      });

    const res = await request(app)
      .post("/api/chat")
      .set("Authorization", `Bearer ${signupRes.body.token}`)
      .send({
        messages: [{ role: "user", content: "heygen xyzzy quuxington" }],
        mode: "qa",
      });

    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/hbouamor@andrew\.cmu\.edu/);
    expect(res.body.reply).not.toMatch(/rdriley@/);
    expect(res.body.reply).not.toMatch(/atorinab@/);
    expect((res.body.reply.match(/@[a-z0-9.-]+/gi) || []).length).toBeLessThanOrEqual(3);
  });

  test("mental-health message hands off to CaPS without fake therapy or a directory", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({
        messages: [{ role: "user", content: "I'm really struggling mentally" }],
        mode: "qa",
      });

    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/I'm here with you/);
    expect(res.body.reply).toMatch(/not a counselor/i);
    expect(res.body.reply).toMatch(/atorinab@andrew\.cmu\.edu/);
    expect(res.body.reply).not.toMatch(/rdriley@/);
    expect(res.body.reply).not.toMatch(/hbouamor@/);
    expect(res.body.reply).not.toMatch(/diagnos/i);
    expect((res.body.reply.match(/@[a-z0-9.-]+/gi) || []).length).toBe(1);
  });
});

describe("isSmallTalk", () => {
  test("check-in replies stay conversational", () => {
    expect(getSmallTalkReply("how are you")).toMatch(/i'm good|what's going on/i);
    expect(getSmallTalkReply("how are you")).not.toMatch(/don't have|knowledge base|relevant information/i);
  });

  test("small-talk system prompt does not require a knowledge-base answer", () => {
    const prompt = buildSystemPrompt("qa", [], { smallTalk: true });
    expect(prompt).toMatch(/SMALL TALK/i);
    expect(prompt).not.toMatch(/No matching knowledge base excerpts/i);
    expect(prompt).not.toMatch(/You MUST tell the user you do not have that information/i);
  });

  test("chat mode with no excerpts stays conversational", () => {
    const prompt = buildSystemPrompt("chat", []);
    expect(prompt).toMatch(/just talk like a friend/i);
    expect(prompt).not.toMatch(/Tell them casually that you do not have that one/i);
  });

  test("detects campus-fact queries vs hangout chat", () => {
    expect(isCampusFactQuery("heygen xyzzy quuxington")).toBe(true);
    expect(isCampusFactQuery("financial aid")).toBe(true);
    expect(isCampusFactQuery("I'm so done with this week")).toBe(false);
    expect(isCampusFactQuery("tell me a joke")).toBe(false);
  });

  test("classifies greetings and pleasantries as small talk", () => {
    expect(isSmallTalk("how are you")).toBe(true);
    expect(isSmallTalk("hello how are you")).toBe(true);
    expect(isSmallTalk("hi sorry how are you")).toBe(true);
    expect(isSmallTalk("how's it going")).toBe(true);
    expect(isSmallTalk("thanks")).toBe(true);
    expect(isSmallTalk("thank you so much for all your support")).toBe(true);
    expect(isSmallTalk("good morning")).toBe(true);
    expect(isSmallTalk("hey what's up")).toBe(true);
    expect(isSmallTalk("ok cool")).toBe(true);
    expect(isSmallTalk("bye see you")).toBe(true);
  });

  test("does not classify gratitude mixed with campus questions as small talk", () => {
    expect(isSmallTalk("thank you for helping me with registration")).toBe(false);
    expect(isSmallTalk("thanks, where is the library")).toBe(false);
  });

  test("does not classify short campus questions as small talk", () => {
    expect(isSmallTalk("deadlines?")).toBe(false);
    expect(isSmallTalk("financial aid?")).toBe(false);
    expect(isSmallTalk("where is the library")).toBe(false);
    expect(isSmallTalk("registration help")).toBe(false);
    expect(isSmallTalk("how are you doing with registration")).toBe(false);
  });

  test("does not classify longer messages as small talk", () => {
    expect(isSmallTalk("hi there I wanted to ask about registration deadlines")).toBe(false);
  });
});

describe("Course library API", () => {
  let createdCourseId;
  let authToken;

  beforeEach(async () => {
    const email = `course-api-${Date.now()}@example.com`;
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send({ email, password: "testpass123" });
    authToken = signupRes.body.token;
  });

  afterEach(async () => {
    if (createdCourseId) {
      await request(app)
        .delete(`/api/courses/${createdCourseId}`)
        .set("Authorization", `Bearer ${authToken}`);
      createdCourseId = null;
    }
  });

  test("requires auth for course routes", async () => {
    const res = await request(app).get("/api/courses");
    expect(res.status).toBe(401);
  });

  test("creates, approves, contributes, and deletes a course", async () => {
    const createRes = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        courseName: "Test Course",
        courseCode: "TEST-101",
        syllabusText: "Sample syllabus body",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.course.status).toBe("active");
    createdCourseId = createRes.body.course.id;

    const materialRes = await request(app)
      .post(`/api/courses/${createdCourseId}/materials`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Lecture 1", content: "Intro to loops" });

    expect(materialRes.status).toBe(200);
    expect(materialRes.body.course.materials).toHaveLength(1);

    const listRes = await request(app)
      .get("/api/courses")
      .set("Authorization", `Bearer ${authToken}`);
    expect(listRes.body.courses.some((course) => course.id === createdCourseId)).toBe(true);

    const contributeRes = await request(app)
      .post(`/api/courses/${createdCourseId}/contribute`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ content: "What is recursion?" });

    expect(contributeRes.status).toBe(200);
    expect(contributeRes.body.course.contributions).toHaveLength(1);

    const approveRes = await request(app)
      .post(`/api/courses/${createdCourseId}/approve`)
      .set("Authorization", `Bearer ${authToken}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.course.status).toBe("approved");
  });
});

// ─── Canvas connection ────────────────────────────────────────────────────────

describe("POST /api/canvas/connect", () => {
  let authToken;

  beforeEach(async () => {
    axios.get.mockReset();
    const email = `canvas-test-${Date.now()}@example.com`;
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send({ email, password: "testpass123" });
    authToken = signupRes.body.token;
  });

  test("returns 401 without auth", async () => {
    const res = await request(app)
      .post("/api/canvas/connect")
      .send({ canvasUrl: "https://canvas.cmu.edu", token: "abc" });
    expect(res.status).toBe(401);
  });

  test("returns success when Canvas token is valid", async () => {
    axios.get.mockResolvedValueOnce({ data: { name: "Test User", id: 42 } });

    const res = await request(app)
      .post("/api/canvas/connect")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ canvasUrl: "https://canvas.cmu.edu/", token: "valid-token" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      user: { name: "Test User", id: 42 },
    });
    expect(axios.get).toHaveBeenCalledWith(
      "https://canvas.cmu.edu/api/v1/users/self",
      expect.objectContaining({
        headers: { Authorization: "Bearer valid-token" },
      })
    );

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${authToken}`);
    const { getUserById } = require("./userStore");
    const stored = getUserById(meRes.body.id);
    expect(stored.canvas.url).toBe("https://canvas.cmu.edu");
    expect(stored.canvas.token).toBe("valid-token");
    expect(meRes.body.canvas).toBeUndefined();
  });

  test("returns error when Canvas token is invalid", async () => {
    axios.get.mockRejectedValueOnce(new Error("Unauthorized"));

    const res = await request(app)
      .post("/api/canvas/connect")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ canvasUrl: "https://canvas.cmu.edu", token: "bad-token" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, error: "Invalid token or URL" });
  });
});

describe("POST /api/canvas/disconnect", () => {
  test("clears connection for authenticated user", async () => {
    axios.get.mockResolvedValueOnce({ data: { name: "Test User", id: 42 } });

    const email = `canvas-disconnect-${Date.now()}@example.com`;
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send({ email, password: "testpass123" });
    const authToken = signupRes.body.token;

    await request(app)
      .post("/api/canvas/connect")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ canvasUrl: "https://canvas.cmu.edu", token: "valid-token" });

    const res = await request(app)
      .post("/api/canvas/disconnect")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    const statusRes = await request(app)
      .get("/api/canvas/status")
      .set("Authorization", `Bearer ${authToken}`);
    expect(statusRes.body.connected).toBe(false);

    const { getUserById } = require("./userStore");
    const stored = getUserById(signupRes.body.user.id);
    expect(stored.canvas).toBeUndefined();
  });
});

describe("Canvas connection status in chat", () => {
  test("answers directly when user asks if Canvas is connected", async () => {
    axios.get.mockResolvedValueOnce({ data: { name: "Test User", id: 42 } });

    const email = `canvas-chat-${Date.now()}@example.com`;
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send({ email, password: "testpass123" });
    const authToken = signupRes.body.token;

    await request(app)
      .post("/api/canvas/connect")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ canvasUrl: "https://canvas.cmu.edu", token: "valid-token" });

    const res = await request(app)
      .post("/api/chat")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        mode: "qa",
        messages: [{ role: "user", content: "hi are you connected to my canvas" }],
      });

    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/connected to your Canvas at https:\/\/canvas\.cmu\.edu/i);
    expect(res.body.reply).not.toMatch(/not confident/i);
  });

  test("tells user to connect when Canvas is not linked", async () => {
    const email = `canvas-chat-off-${Date.now()}@example.com`;
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send({ email, password: "testpass123" });
    const authToken = signupRes.body.token;

    const res = await request(app)
      .post("/api/chat")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        mode: "qa",
        messages: [{ role: "user", content: "are you connected to canvas" }],
      });

    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/not yet/i);
    expect(res.body.reply).toMatch(/settings/i);
  });
});

describe("Canvas course import API", () => {
  test("lists Canvas courses when connected", async () => {
    axios.get.mockImplementation(async (url) => {
      if (url.includes("/users/self")) {
        return { data: { name: "Test User", id: 1 }, headers: {} };
      }
      if (url.includes("/courses?enrollment_state=active")) {
        return {
          data: [{ id: 101, name: "Intro to CS", course_code: "15-112", term: { name: "Fall 2026" } }],
          headers: {},
        };
      }
      return { data: [], headers: {} };
    });

    const email = `canvas-import-${Date.now()}@example.com`;
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send({ email, password: "testpass123" });
    const authToken = signupRes.body.token;

    await request(app)
      .post("/api/canvas/connect")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ canvasUrl: "https://canvas.cmu.edu", token: "valid-token" });

    const listRes = await request(app)
      .get("/api/canvas/courses")
      .set("Authorization", `Bearer ${authToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.courses[0].name).toBe("Intro to CS");
  });
});

describe("POST /api/feedback", () => {
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "tartan-feedback-api-"));
    feedbackStore.setFeedbackDir(testDir);
  });

  afterEach(() => {
    feedbackStore.setFeedbackDir(feedbackStore.DEFAULT_FEEDBACK_DIR);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test("accepts thumbs up feedback", async () => {
    const res = await request(app).post("/api/feedback").send({
      rating: "up",
      messageId: "msg-123",
      userQuery: "When is add/drop?",
      reply: "Add/drop ends Friday of week 1.",
      mode: "qa",
      confidence: { score: 85, sourceCount: 2, sources: [] },
    });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.id).toBeTruthy();
  });

  test("requires reason for thumbs down", async () => {
    const res = await request(app).post("/api/feedback").send({
      rating: "down",
      messageId: "msg-456",
      userQuery: "Where is the gym?",
      reply: "The gym is on the roof.",
      mode: "campus",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reason/i);
  });
});
