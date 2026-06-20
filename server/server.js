const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const {
  loadKnowledgeBase,
  retrieveRelevantDocs,
  retrieveRelevantDocsAsync,
  buildContextBlock,
  computeConfidence,
  getRetrievalStatus,
  isProfessorNuiQuery,
  getProfessorNuiReply,
} = require("./knowledgeBase");
const {
  buildTutorSystemPrompt,
  hasValidCourseContext,
} = require("./tutorPrompt");
const { generateTutorSpeechScript } = require("./tutorSpeech");
const {
  listCourses,
  getCourse,
  createCourse,
  approveCourse,
  addContribution,
  deleteCourse,
  toPublicSummary,
  toCourseContext,
  addMaterial,
  deleteMaterial,
} = require("./courseStore");

const app = express();
const PORT = process.env.PORT || 3001;
const AI_MAX_TOKENS = 200;
const AI_MAX_TOKENS_TUTOR = 512;
const AI_TEMPERATURE = 0.3;

const PLACEHOLDER_KEYS = new Set([
  "",
  "your_key",
  "your-key",
  "your_api_key",
  "changeme",
  "placeholder",
]);

function isConfiguredKey(value) {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (PLACEHOLDER_KEYS.has(trimmed.toLowerCase())) return false;
  return trimmed.length >= 10;
}

function getAiGatewayBaseUrl() {
  return process.env.AI_GATEWAY_BASE_URL?.trim().replace(/\/$/, "") || "";
}

function getAiModel() {
  return process.env.AI_MODEL?.trim() || "us.anthropic.claude-haiku-4-5-20251001-v1:0";
}

function getAnthropicApiKey() {
  return process.env.ANTHROPIC_API_KEY?.trim() || "";
}

function getClaudeApiKey() {
  return (
    process.env.CLAUDE_API_KEY?.trim() ||
    process.env.AI_GATEWAY_API_KEY?.trim() ||
    getAnthropicApiKey()
  );
}

function useAiGateway() {
  return Boolean(getAiGatewayBaseUrl());
}

function hasAiKey() {
  return isConfiguredKey(getClaudeApiKey());
}

function hasAnthropicKey() {
  return !useAiGateway() && isConfiguredKey(getAnthropicApiKey());
}

function getAiProviderLabel() {
  if (useAiGateway() && hasAiKey()) {
    return `Claude via CMU AI Gateway (${getAiModel()})`;
  }
  if (hasAnthropicKey()) {
    return "Anthropic Claude (direct)";
  }
  return "knowledge base only (add AI_GATEWAY_BASE_URL + CLAUDE_API_KEY, or ANTHROPIC_API_KEY)";
}

function formatApiError(err, fallback = "Request failed") {
  const status = err.response?.status;
  if (status === 401) {
    if (useAiGateway()) {
      return "Your Claude API key is invalid or expired. Update CLAUDE_API_KEY in server/.env and restart the server.";
    }
    return "Your Anthropic API key is invalid or expired. Update ANTHROPIC_API_KEY in server/.env and restart the server.";
  }

  const data = err.response?.data;
  if (!data) return err.message || fallback;

  const nested = data.error;
  if (typeof nested === "string") return nested;
  if (nested?.message) {
    if (nested.code === "endpoint_sunset") {
      return "HeyGen Interactive Avatar API has been retired. Migrate to LiveAvatar: https://docs.liveavatar.com";
    }
    return nested.message;
  }

  if (typeof data.message === "string") return data.message;
  return err.message || fallback;
}

const NO_KB_MATCH_REPLY =
  "I don't have that information in my knowledge base right now. For the most up-to-date details, please check scotty.qatar.cmu.edu or contact the relevant CMU-Q office.";

const KB_GROUNDING_RULES = `You are Tartan Scotty, Carnegie Mellon University in Qatar's (CMU-Q) student assistant. Answer questions like a knowledgeable friend — naturally and conversationally, not like a formal document.

CRITICAL RULES:
- Answer CMU-Q questions using ONLY the official knowledge base excerpts provided below.
- NEVER invent names, roles, emails, dates, policies, or contacts.
- If the knowledge base does not contain the answer — or the excerpts do not actually address what the user asked — you MUST say clearly that you do not have that information. Do not guess, infer, or fill gaps from general knowledge.
- When you do not have the answer, always direct the user to scotty.qatar.cmu.edu for official CMU-Q resources, and mention the relevant CMU-Q office when appropriate.
- At CMU-Q, "StuCo" means the Student College (student-taught courses), NOT a generic student council or student government. Do not make up StuCo officer titles or members.
- Speak in clear, natural, everyday English. Be warm and helpful, but do not use Scottish dialect, accent, or slang (no "laddie", "wee", "aye", "bonny", etc.). Write like a friendly student services assistant, not a cartoon character.
- Do NOT include [Source:] labels, file names, or file paths anywhere in your response. Use the knowledge base to answer, but never echo back source citations.
- Do NOT use markdown formatting in responses — no asterisks, bold, italics, or backticks. Write plain text only.
- If a question is ambiguous (e.g. "measure" likely means "major/degree", "stucco" means "StuCo"), interpret it charitably in the CMU-Q academic context before answering.

RESPONSE STYLE:
- Be warm but get to the point fast — lead with the direct answer in the first sentence.
- Keep answers to 1–3 short sentences unless the user asks for more detail.
- Never open with stiff phrases like "According to the official knowledge base" or "Here's how it works:"
- Do not number every step unless the user is explicitly asking for a process in order.
- Avoid bullet points for simple answers — weave the info into natural sentences.
- Skip filler affirmations like "Great question!" or "That's an exciting opportunity!" Do not repeat the question back or use formulaic greetings.
- If there are important caveats, mention them naturally at the end, not as a separate bulleted list.
- If you do not know, say so plainly in one sentence, then tell the user to check scotty.qatar.cmu.edu for official information.`;

const SYSTEM_PROMPTS = {
  qa: `${KB_GROUNDING_RULES} Be accurate, concise, and helpful about academics, registration, student life, policies, and CMU-Q resources.`,
  campus: `${KB_GROUNDING_RULES} Help students navigate CMU-Q campus life, resources, and student services.`,
  chat: `${KB_GROUNDING_RULES} Be a warm, approachable companion while staying factual about CMU-Q.`,
};

const KB_MODES = new Set(["qa", "campus", "chat"]);

const CONVERSATIONAL_PATTERNS = [
  /^(hi|hello|hey|howdy|yo|sup|hiya)(\s+scotty)?[\s!.?]*$/i,
  /^good\s+(morning|afternoon|evening)(\s+scotty)?[\s!.?]*$/i,
  /^(thanks|thank\s+you|thx|ty)[\s!.?]*$/i,
  /^(bye|goodbye|see\s+ya|see\s+you)[\s!.?]*$/i,
  /^(how\s+are\s+you|what'?s\s+up)[\s?!.]*$/i,
];

function isConversationalQuery(query) {
  const normalized = query.trim().replace(/\s+/g, " ");
  if (!normalized) return false;
  return CONVERSATIONAL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function getAiGenerationOptions(mode) {
  return {
    maxTokens: mode === "tutor" ? AI_MAX_TOKENS_TUTOR : AI_MAX_TOKENS,
    temperature: AI_TEMPERATURE,
  };
}

async function retrieveForQuery(mode, userQuery) {
  if (!KB_MODES.has(mode)) {
    return { docs: [], confidence: null };
  }

  const docs = await retrieveRelevantDocsAsync(userQuery);
  const confidence = computeConfidence(docs);
  return { docs, confidence };
}

function buildSystemPrompt(
  mode,
  docs,
  {
    conversational = false,
    courseContext = null,
    tutorActivity = null,
    lectureTopic = "",
    studioGeneration = false,
  } = {}
) {
  if (mode === "tutor") {
    return buildTutorSystemPrompt(courseContext, {
      tutorActivity,
      lectureTopic,
      studioGeneration,
    });
  }

  let prompt = SYSTEM_PROMPTS[mode];
  if (!KB_MODES.has(mode)) return prompt;

  if (conversational) {
    prompt +=
      "\n\nThe user is greeting you or making casual small talk. Reply warmly in one or two short sentences and invite them to ask about CMU-Q if they'd like. No knowledge base lookup is needed for this.";
  } else if (docs.length) {
    prompt += `\n\nOFFICIAL CMU-Q KNOWLEDGE BASE (use this as your only source for factual answers):\n${buildContextBlock(docs)}`;
  } else {
    prompt +=
      "\n\nNo matching knowledge base excerpts were found for this question. You MUST tell the user you do not have that information. Do not guess or invent CMU-Q-specific facts. Direct them to scotty.qatar.cmu.edu for official resources.";
  }

  return prompt;
}

function answerFromKnowledgeBase(userQuery) {
  const docs = retrieveRelevantDocs(userQuery, { limit: 2, maxDocChars: 2000 });
  if (!docs.length) {
    return { reply: NO_KB_MATCH_REPLY, confidence: computeConfidence([]) };
  }

  const blocks = docs.map((doc) => `**${doc.topic}**\n${doc.body.trim()}`);
  const reply = `${blocks.join("\n\n---\n\n")}\n\n— From CMU-Q official resources (scotty.qatar.cmu.edu). For more details, visit the relevant page on the Scotty portal.`;

  return { reply, confidence: computeConfidence(docs) };
}

function sendSseEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function streamTextChunks(text, onChunk) {
  const words = text.split(/(\s+)/);
  for (const word of words) {
    if (word) onChunk(word);
    await new Promise((resolve) => setTimeout(resolve, 18));
  }
}

function parseAnthropicSseStream(stream, onToken) {
  return new Promise((resolve, reject) => {
    let buffer = "";

    stream.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === "[DONE]") continue;

        try {
          const event = JSON.parse(payload);
          if (event.type === "content_block_delta" && event.delta?.text) {
            onToken(event.delta.text);
          }
        } catch {
          // ignore malformed SSE chunks
        }
      }
    });

    stream.on("end", resolve);
    stream.on("error", reject);
  });
}

function parseGatewaySseStream(stream, onToken) {
  return new Promise((resolve, reject) => {
    let buffer = "";

    stream.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === "[DONE]") continue;

        try {
          const event = JSON.parse(payload);
          const text = event.choices?.[0]?.delta?.content;
          if (text) onToken(text);
        } catch {
          // ignore malformed SSE chunks
        }
      }
    });

    stream.on("end", resolve);
    stream.on("error", reject);
  });
}

async function streamChatWithAnthropic(systemPrompt, messages, onToken, { maxTokens, temperature }) {
  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-haiku-20240307",
      max_tokens: maxTokens,
      temperature,
      stream: true,
      system: systemPrompt,
      messages,
    },
    {
      headers: {
        "x-api-key": getAnthropicApiKey(),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      responseType: "stream",
    }
  );

  await parseAnthropicSseStream(response.data, onToken);
}

async function streamChatWithClaudeGateway(systemPrompt, messages, onToken, { maxTokens, temperature }) {
  const response = await axios.post(
    `${getAiGatewayBaseUrl()}/v1/chat/completions`,
    {
      model: getAiModel(),
      max_tokens: maxTokens,
      temperature,
      stream: true,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    },
    {
      headers: {
        Authorization: `Bearer ${getClaudeApiKey()}`,
        "Content-Type": "application/json",
      },
      responseType: "stream",
    }
  );

  await parseGatewaySseStream(response.data, onToken);
}

async function streamChatReply(systemPrompt, messages, onToken, aiOptions) {
  if (!hasAiKey()) {
    throw new Error("No AI provider configured");
  }
  if (useAiGateway()) {
    await streamChatWithClaudeGateway(systemPrompt, messages, onToken, aiOptions);
    return;
  }
  await streamChatWithAnthropic(systemPrompt, messages, onToken, aiOptions);
}

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked origin: ${origin}`));
    },
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "Tartan Scotty API server",
    frontend: "http://localhost:3000",
    routes: [
      "GET /api/kb/status",
      "GET /api/courses",
      "POST /api/courses",
      "GET /api/courses/:id",
      "POST /api/courses/:id/approve",
      "POST /api/courses/:id/contribute",
      "DELETE /api/courses/:id",
      "POST /api/chat",
      "POST /api/chat/stream",
      "POST /api/liveavatar-token",
    ],
  });
});

app.get("/api/kb/status", (_req, res) => {
  res.json(getRetrievalStatus());
});

app.get("/api/courses", (_req, res) => {
  const courses = listCourses().map(toPublicSummary);
  res.json({ courses });
});

app.post("/api/courses", (req, res) => {
  try {
    const course = createCourse(req.body, { status: "active" });
    res.status(201).json({ course: toCourseContext(course) });
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to create course" });
  }
});

app.get("/api/courses/:id", (req, res) => {
  const course = getCourse(req.params.id);
  if (!course) {
    return res.status(404).json({ error: "Course not found" });
  }
  return res.json({ course: toCourseContext(course) });
});

app.post("/api/courses/:id/approve", (req, res) => {
  const course = approveCourse(req.params.id);
  if (!course) {
    return res.status(404).json({ error: "Course not found" });
  }
  return res.json({ course: toCourseContext(course) });
});

app.post("/api/courses/:id/contribute", (req, res) => {
  const { content, role } = req.body ?? {};
  try {
    const course = addContribution(req.params.id, content, { role });
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }
    return res.json({ course: toCourseContext(course) });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Failed to save contribution" });
  }
});

app.delete("/api/courses/:id", (req, res) => {
  const deleted = deleteCourse(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Course not found" });
  }
  return res.json({ ok: true });
});

app.post("/api/courses/:id/materials", (req, res) => {
  try {
    const course = addMaterial(req.params.id, req.body ?? {});
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }
    return res.json({ course: toCourseContext(course) });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Failed to add material" });
  }
});

app.delete("/api/courses/:id/materials/:materialId", (req, res) => {
  const course = deleteMaterial(req.params.id, req.params.materialId);
  if (!course) {
    return res.status(404).json({ error: "Course or material not found" });
  }
  return res.json({ course: toCourseContext(course) });
});

async function chatWithAnthropic(systemPrompt, messages, { maxTokens, temperature }) {
  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-haiku-20240307",
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages,
    },
    {
      headers: {
        "x-api-key": getAnthropicApiKey(),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
    }
  );

  return response.data.content[0].text;
}

async function chatWithClaudeGateway(systemPrompt, messages, { maxTokens, temperature }) {
  const response = await axios.post(
    `${getAiGatewayBaseUrl()}/v1/chat/completions`,
    {
      model: getAiModel(),
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    },
    {
      headers: {
        Authorization: `Bearer ${getClaudeApiKey()}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.choices[0].message.content;
}

async function getChatReply(systemPrompt, messages, aiOptions) {
  if (!hasAiKey()) {
    throw new Error("No AI provider configured");
  }
  if (useAiGateway()) {
    return chatWithClaudeGateway(systemPrompt, messages, aiOptions);
  }
  return chatWithAnthropic(systemPrompt, messages, aiOptions);
}

async function sendChatReply(res, reply, { stream = false, confidence = null } = {}) {
  if (stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    if (confidence) {
      sendSseEvent(res, { type: "confidence", confidence });
    }
    await streamTextChunks(reply, (text) => sendSseEvent(res, { type: "token", text }));
    sendSseEvent(res, { type: "done" });
    return res.end();
  }

  const payload = { reply };
  if (confidence) {
    payload.confidence = confidence;
  }
  return res.json(payload);
}

const VALID_MODES = new Set(["qa", "campus", "chat", "tutor"]);

async function handleChatRequest(req, res, { stream = false } = {}) {
  const {
    messages,
    mode,
    courseContext = null,
    tutorActivity = null,
    lectureTopic = "",
    studioGeneration = false,
  } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages must be an array" });
  }

  if (!VALID_MODES.has(mode)) {
    return res.status(400).json({ error: "Invalid mode. Use: qa, campus, chat, or tutor" });
  }

  if (mode === "tutor" && courseContext && !hasValidCourseContext(courseContext)) {
    return res.status(400).json({
      error: "Tutor mode requires courseContext with courseName and syllabusText.",
    });
  }

  const latestUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const userQuery = latestUserMessage?.content || "";
  const conversational = KB_MODES.has(mode) && isConversationalQuery(userQuery);

  if (KB_MODES.has(mode) && isProfessorNuiQuery(userQuery)) {
    const reply = getProfessorNuiReply();
    const professorNuiConfidence = computeConfidence([{ score: 999, method: "keyword" }]);
    return sendChatReply(res, reply, { stream, confidence: professorNuiConfidence });
  }

  const { docs, confidence } = conversational
    ? { docs: [], confidence: null }
    : await retrieveForQuery(mode, userQuery);
  const systemPrompt = buildSystemPrompt(mode, docs, {
    conversational,
    courseContext,
    tutorActivity,
    lectureTopic,
    studioGeneration,
  });
  const aiOptions = getAiGenerationOptions(mode);

  if (KB_MODES.has(mode) && !conversational && docs.length === 0) {
    const reply = NO_KB_MATCH_REPLY;
    const noMatchConfidence = computeConfidence([]);
    return sendChatReply(res, reply, { stream, confidence: noMatchConfidence });
  }

  if (!hasAiKey()) {
    if (conversational) {
      const reply =
        "Hey! I'm Scotty, your CMU-Q assistant. Ask me anything about registration, campus life, policies, or student resources.";
      return sendChatReply(res, reply, { stream });
    }

    if (KB_MODES.has(mode)) {
      const { reply, confidence: kbConfidence } = answerFromKnowledgeBase(userQuery);
      return sendChatReply(res, reply, { stream, confidence: kbConfidence });
    }
    if (mode === "tutor") {
      return res.status(500).json({
        error:
          "Tutor mode requires an AI API key. Add AI_GATEWAY_BASE_URL + CLAUDE_API_KEY, or ANTHROPIC_API_KEY, in server/.env.",
      });
    }
    return res.status(500).json({
      error:
        "No AI API key configured. Add AI_GATEWAY_BASE_URL + CLAUDE_API_KEY for Claude via CMU AI Gateway, or ANTHROPIC_API_KEY for direct Claude access, in server/.env.",
    });
  }

  try {
    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      if (confidence?.sourceCount > 0) {
        sendSseEvent(res, { type: "confidence", confidence });
      }

      let reply = "";
      await streamChatReply(systemPrompt, messages, (text) => {
        reply += text;
        sendSseEvent(res, { type: "token", text });
      }, aiOptions);

      if (mode === "tutor" && reply.trim()) {
        const speechText = await generateTutorSpeechScript(
          getChatReply,
          {
            reply,
            userQuery,
            tutorActivity,
            lectureTopic,
            courseName: courseContext?.courseName,
            studioGeneration,
          },
          aiOptions
        );
        if (speechText) {
          sendSseEvent(res, { type: "speech", text: speechText });
        }
      }

      sendSseEvent(res, { type: "done" });
      return res.end();
    }

    const reply = await getChatReply(systemPrompt, messages, aiOptions);
    const payload = { reply };
    if (confidence?.sourceCount > 0) {
      payload.confidence = confidence;
    }
    if (mode === "tutor" && reply.trim()) {
      payload.speech = await generateTutorSpeechScript(
        getChatReply,
        {
          reply,
          userQuery,
          tutorActivity,
          lectureTopic,
          courseName: courseContext?.courseName,
          studioGeneration,
        },
        aiOptions
      );
    }
    return res.json(payload);
  } catch (err) {
    if (stream) {
      sendSseEvent(res, {
        type: "error",
        error: formatApiError(err, "Failed to get chat response"),
      });
      return res.end();
    }
    const status = err.response?.status || 500;
    return res.status(status).json({ error: formatApiError(err, "Failed to get chat response") });
  }
}

app.post("/api/chat", (req, res) => handleChatRequest(req, res, { stream: false }));
app.post("/api/chat/stream", (req, res) => handleChatRequest(req, res, { stream: true }));

async function createLiveAvatarToken(_req, res) {
  const apiKey = process.env.LIVEAVATAR_API_KEY || process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "LIVEAVATAR_API_KEY is not configured in server/.env",
    });
  }

  try {
    const mode = process.env.LIVEAVATAR_MODE || "FULL";
    const avatarId = process.env.LIVEAVATAR_AVATAR_ID?.trim();
    if (!avatarId) {
      return res.status(500).json({
        error:
          "LIVEAVATAR_AVATAR_ID is not configured in server/.env. Copy an avatar ID from https://app.liveavatar.com",
      });
    }
    const voiceId =
      process.env.LIVEAVATAR_VOICE_ID?.trim() ||
      "5903397f-01dc-403c-a06b-057a82f52186";

    const payload =
      mode === "FULL"
        ? {
            mode: "FULL",
            avatar_id: avatarId,
            avatar_persona: {
              language: process.env.LIVEAVATAR_LANGUAGE || "en",
              ...(process.env.LIVEAVATAR_CONTEXT_ID && {
                context_id: process.env.LIVEAVATAR_CONTEXT_ID,
              }),
              voice_id: voiceId,
            },
          }
        : {
            mode: "LITE",
            avatar_id: avatarId,
            is_sandbox: process.env.LIVEAVATAR_SANDBOX === "true",
          };

    const response = await axios.post(
      "https://api.liveavatar.com/v1/sessions/token",
      payload,
      {
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    const token =
      response.data?.data?.session_token || response.data?.data?.sessionToken;

    if (!token) {
      return res.status(502).json({ error: "LiveAvatar did not return a session token" });
    }

    res.json({ token });
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data;

    if (data?.data && Array.isArray(data.data)) {
      const detail = data.data.map((item) => item.message).join("; ");
      return res.status(status).json({ error: detail || data.message });
    }

    const apiMessage = data?.message;
    const message =
      apiMessage === "Invalid API key"
        ? "Invalid LiveAvatar API key. Get one at https://app.liveavatar.com/developers"
        : formatApiError(err, "Failed to fetch LiveAvatar session token");
    res.status(status).json({ error: message });
  }
}

app.post("/api/liveavatar-token", createLiveAvatarToken);
app.post("/api/heygen-token", createLiveAvatarToken);

const kbCount = loadKnowledgeBase();

// Only start listening when run directly (not when imported by tests)
if (require.main === module) {
  app.listen(PORT, () => {
    const provider = getAiProviderLabel();
    console.log(`Server running on http://localhost:${PORT} (chat: ${provider})`);
    console.log(`Knowledge base loaded: ${kbCount} documents`);
  });
}

module.exports = app;
module.exports.buildSystemPrompt = buildSystemPrompt;
