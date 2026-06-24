const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_FEEDBACK_DIR = path.join(__dirname, "..", "data", "feedback");
const FEEDBACK_FILE = "feedback.jsonl";

let feedbackDir = DEFAULT_FEEDBACK_DIR;

const VALID_RATINGS = new Set(["up", "down"]);
const VALID_REASONS = new Set([
  "wrong_info",
  "incomplete",
  "out_of_date",
  "hard_to_understand",
  "other",
]);

function setFeedbackDir(dir) {
  feedbackDir = dir;
}

function getFeedbackFilePath() {
  return path.join(feedbackDir, FEEDBACK_FILE);
}

function ensureFeedbackDir() {
  fs.mkdirSync(feedbackDir, { recursive: true });
}

function appendFeedback(entry) {
  ensureFeedbackDir();
  const line = `${JSON.stringify(entry)}\n`;
  fs.appendFileSync(getFeedbackFilePath(), line, "utf8");
  return entry;
}

function validateFeedbackPayload(body) {
  const errors = [];

  if (!body || typeof body !== "object") {
    return { ok: false, errors: ["body must be an object"] };
  }

  const rating = String(body.rating ?? "").trim().toLowerCase();
  if (!VALID_RATINGS.has(rating)) {
    errors.push('rating must be "up" or "down"');
  }

  const messageId = String(body.messageId ?? "").trim();
  if (!messageId) {
    errors.push("messageId is required");
  }

  const userQuery = String(body.userQuery ?? "").trim();
  const reply = String(body.reply ?? "").trim();
  if (!reply) {
    errors.push("reply is required");
  }

  const mode = String(body.mode ?? "").trim();
  if (!mode) {
    errors.push("mode is required");
  }

  let reason = null;
  if (body.reason != null && body.reason !== "") {
    reason = String(body.reason).trim();
    if (!VALID_REASONS.has(reason)) {
      errors.push(`reason must be one of: ${[...VALID_REASONS].join(", ")}`);
    }
  }

  if (rating === "down" && !reason) {
    errors.push("reason is required for thumbs down");
  }

  const comment =
    body.comment == null || body.comment === ""
      ? ""
      : String(body.comment).trim().slice(0, 500);

  if (errors.length) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      rating,
      messageId,
      userQuery,
      reply,
      mode,
      reason,
      comment,
      confidence: body.confidence ?? null,
      keyFacts: Array.isArray(body.keyFacts) ? body.keyFacts : [],
    },
  };
}

function createFeedbackRecord(payload, userId = null) {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    userId: userId ?? null,
    ...payload,
  };
}

module.exports = {
  DEFAULT_FEEDBACK_DIR,
  VALID_RATINGS,
  VALID_REASONS,
  setFeedbackDir,
  getFeedbackFilePath,
  appendFeedback,
  validateFeedbackPayload,
  createFeedbackRecord,
};
