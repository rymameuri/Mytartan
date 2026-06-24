const fs = require("fs");
const path = require("path");
const os = require("os");

const feedbackStore = require("./feedbackStore");

describe("feedbackStore", () => {
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "tartan-feedback-"));
    feedbackStore.setFeedbackDir(testDir);
  });

  afterEach(() => {
    feedbackStore.setFeedbackDir(feedbackStore.DEFAULT_FEEDBACK_DIR);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test("validates required fields", () => {
    const result = feedbackStore.validateFeedbackPayload({});
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'rating must be "up" or "down"',
        "messageId is required",
        "reply is required",
        "mode is required",
      ])
    );
  });

  test("requires reason for thumbs down", () => {
    const result = feedbackStore.validateFeedbackPayload({
      rating: "down",
      messageId: "msg-1",
      reply: "Some answer",
      mode: "qa",
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("reason is required for thumbs down");
  });

  test("appends feedback as JSONL", () => {
    const validated = feedbackStore.validateFeedbackPayload({
      rating: "up",
      messageId: "msg-1",
      userQuery: "What is add/drop?",
      reply: "Add/drop is in week 1.",
      mode: "qa",
      confidence: { score: 80, sourceCount: 2, sources: [] },
      keyFacts: [{ id: "add-drop-week", topic: "Add/drop" }],
    });
    expect(validated.ok).toBe(true);

    const record = feedbackStore.createFeedbackRecord(validated.value, "user-1");
    feedbackStore.appendFeedback(record);

    const lines = fs
      .readFileSync(feedbackStore.getFeedbackFilePath(), "utf8")
      .trim()
      .split("\n");
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.rating).toBe("up");
    expect(parsed.userId).toBe("user-1");
    expect(parsed.messageId).toBe("msg-1");
  });
});
