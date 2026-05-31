const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const {
  loadKnowledgeBase,
  retrieveRelevantDocs,
  buildContextBlock,
} = require("./knowledgeBase");

const app = express();
const PORT = process.env.PORT || 3001;
const HF_MODEL = process.env.HF_MODEL || "meta-llama/Meta-Llama-3-8B-Instruct";

function formatApiError(err, fallback = "Request failed") {
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

const KB_GROUNDING_RULES = `You are Tartan Scotty, Carnegie Mellon University in Qatar's (CMU-Q) student assistant.

CRITICAL RULES:
- Answer CMU-Q questions using ONLY the official knowledge base excerpts provided below.
- NEVER invent names, roles, emails, dates, policies, or contacts.
- If the knowledge base does not contain the answer, say you do not have that information and suggest scotty.qatar.cmu.edu or the relevant CMU-Q office.
- At CMU-Q, "StuCo" means the Student College (student-taught courses), NOT a generic student council or student government. Do not make up StuCo officer titles or members.
- Speak in clear, natural, everyday English. Be warm and helpful, but do not use Scottish dialect, accent, or slang (no "laddie", "wee", "aye", "bonny", etc.). Write like a friendly student services assistant, not a cartoon character.`;

const SYSTEM_PROMPTS = {
  qa: `${KB_GROUNDING_RULES} Be accurate, concise, and helpful about academics, registration, student life, policies, and CMU-Q resources.`,
  campus: `${KB_GROUNDING_RULES} Help students navigate CMU-Q campus life, resources, and student services.`,
  chat: `${KB_GROUNDING_RULES} Be a warm, approachable companion while staying factual about CMU-Q.`,
  tutor: `You are Tartan Scotty, CMU-Q's student assistant and academic tutor. Help students understand concepts, work through problems step by step, and develop study strategies. Guide them toward answers rather than giving them outright. Speak in clear, natural English — no Scottish dialect or mascot slang.`,
};

const KB_MODES = new Set(["qa", "campus", "chat"]);

function buildSystemPrompt(mode, userQuery) {
  let prompt = SYSTEM_PROMPTS[mode];
  if (!KB_MODES.has(mode)) return prompt;

  const docs = retrieveRelevantDocs(userQuery);
  if (docs.length) {
    prompt += `\n\nOFFICIAL CMU-Q KNOWLEDGE BASE (use this as your only source for factual answers):\n${buildContextBlock(docs)}`;
  } else {
    prompt +=
      "\n\nNo matching knowledge base excerpts were found for this question. Do not guess CMU-Q-specific facts.";
  }

  return prompt;
}

app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "Tartan Scotty API server",
    frontend: "http://localhost:3000",
    routes: ["POST /api/chat", "POST /api/liveavatar-token"],
  });
});

async function chatWithHuggingFace(systemPrompt, messages) {
  const response = await axios.post(
    "https://router.huggingface.co/v1/chat/completions",
    {
      model: HF_MODEL,
      max_tokens: 1024,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.choices[0].message.content;
}

async function chatWithAnthropic(systemPrompt, messages) {
  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-haiku-20240307",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    },
    {
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
    }
  );

  return response.data.content[0].text;
}

app.post("/api/chat", async (req, res) => {
  const { messages, mode } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages must be an array" });
  }

  if (!SYSTEM_PROMPTS[mode]) {
    return res.status(400).json({ error: "Invalid mode. Use: qa, campus, chat, or tutor" });
  }

  const latestUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const userQuery = latestUserMessage?.content || "";
  const systemPrompt = buildSystemPrompt(mode, userQuery);

  const useHuggingFace = Boolean(process.env.HUGGINGFACE_API_KEY);
  if (!useHuggingFace && !process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: "Configure HUGGINGFACE_API_KEY or ANTHROPIC_API_KEY in server/.env",
    });
  }

  try {
    const reply = useHuggingFace
      ? await chatWithHuggingFace(systemPrompt, messages)
      : await chatWithAnthropic(systemPrompt, messages);

    res.json({ reply });
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ error: formatApiError(err, "Failed to get chat response") });
  }
});

async function createLiveAvatarToken(_req, res) {
  const apiKey = process.env.LIVEAVATAR_API_KEY || process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "LIVEAVATAR_API_KEY is not configured in server/.env",
    });
  }

  try {
    const mode = process.env.LIVEAVATAR_MODE || "FULL";
    const avatarId =
      process.env.LIVEAVATAR_AVATAR_ID ||
      "65f9e3c9-d48b-4118-b73a-4ae2e3cbb8f0";

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
              ...(process.env.LIVEAVATAR_VOICE_ID && {
                voice_id: process.env.LIVEAVATAR_VOICE_ID,
              }),
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

app.listen(PORT, () => {
  const provider = process.env.HUGGINGFACE_API_KEY ? "Hugging Face" : "Anthropic";
  console.log(`Server running on http://localhost:${PORT} (chat: ${provider})`);
  console.log(`Knowledge base loaded: ${kbCount} documents`);
});
