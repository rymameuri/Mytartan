const axios = require("axios");

const PLACEHOLDER_KEYS = new Set([
  "",
  "your_key",
  "your-key",
  "your_api_key",
  "your_hf_token",
  "hf_your_token",
  "changeme",
  "placeholder",
]);

const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V4-Flash-0731";
const DEFAULT_ROUTER_BASE_URL = "https://router.huggingface.co/v1";

function isConfiguredKey(value) {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (PLACEHOLDER_KEYS.has(trimmed.toLowerCase())) return false;
  return trimmed.length >= 10;
}

function getHuggingfaceApiKey() {
  return (
    process.env.HUGGINGFACE_API_KEY?.trim() ||
    process.env.HF_TOKEN?.trim() ||
    process.env.HUGGINGFACE_HUB_TOKEN?.trim() ||
    ""
  );
}

function getHuggingfaceModel() {
  return (
    process.env.HUGGINGFACE_MODEL?.trim() ||
    process.env.HF_MODEL?.trim() ||
    DEFAULT_MODEL
  );
}

function getHuggingfaceRouterBaseUrl() {
  return (
    process.env.HUGGINGFACE_ROUTER_BASE_URL?.trim() ||
    process.env.HF_ROUTER_BASE_URL?.trim() ||
    DEFAULT_ROUTER_BASE_URL
  ).replace(/\/$/, "");
}

function useHuggingfaceProvider() {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();
  return provider === "huggingface" || provider === "hf";
}

function hasHuggingfaceKey() {
  return isConfiguredKey(getHuggingfaceApiKey());
}

const VALID_MESSAGE_ROLES = new Set(["user", "assistant", "system"]);

function sanitizeMessages(messages) {
  return (messages || [])
    .filter(
      (message) =>
        message &&
        VALID_MESSAGE_ROLES.has(message.role) &&
        message.content != null &&
        String(message.content).trim()
    )
    .map(({ role, content }) => ({ role, content: String(content) }));
}

function buildChatPayload(systemPrompt, messages, { maxTokens, temperature, stream = false }) {
  const payload = {
    model: getHuggingfaceModel(),
    max_tokens: maxTokens,
    temperature,
    messages: [
      { role: "system", content: systemPrompt },
      ...sanitizeMessages(messages),
    ],
  };

  const reasoningEffort = process.env.HF_REASONING_EFFORT?.trim();
  if (reasoningEffort) {
    payload.reasoning_effort = reasoningEffort;
  }

  if (stream) payload.stream = true;
  return payload;
}

async function readAxiosErrorMessage(err) {
  const data = err.response?.data;
  if (!data) return err.message || "Hugging Face request failed";

  if (typeof data === "string") {
    try {
      return JSON.parse(data).error?.message || data;
    } catch {
      return data;
    }
  }

  if (Buffer.isBuffer(data)) {
    try {
      return JSON.parse(data.toString("utf8")).error?.message || err.message;
    } catch {
      return err.message || "Hugging Face request failed";
    }
  }

  if (typeof data.on === "function") {
    const body = await new Promise((resolve) => {
      let text = "";
      data.on("data", (chunk) => {
        text += chunk.toString();
      });
      data.on("end", () => resolve(text));
      data.on("error", () => resolve(""));
    });
    if (body) {
      try {
        return JSON.parse(body).error?.message || err.message;
      } catch {
        return body.slice(0, 240);
      }
    }
  }

  if (typeof data.error === "string") return data.error;
  if (data.error?.message) return data.error.message;
  if (typeof data.message === "string") return data.message;
  return err.message || "Hugging Face request failed";
}

async function postToHuggingface(payload, { stream = false } = {}) {
  try {
    return await axios.post(
      `${getHuggingfaceRouterBaseUrl()}/chat/completions`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${getHuggingfaceApiKey()}`,
          "Content-Type": "application/json",
        },
        ...(stream ? { responseType: "stream" } : {}),
      }
    );
  } catch (err) {
    const message = await readAxiosErrorMessage(err);
    const wrapped = new Error(message);
    wrapped.response = err.response;
    throw wrapped;
  }
}

function parseOpenAiSseStream(stream, onToken) {
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

async function chatWithHuggingface(systemPrompt, messages, { maxTokens, temperature }) {
  const response = await postToHuggingface(
    buildChatPayload(systemPrompt, messages, { maxTokens, temperature })
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Hugging Face returned an empty response");
  }
  return content;
}

async function streamChatWithHuggingface(
  systemPrompt,
  messages,
  onToken,
  { maxTokens, temperature }
) {
  const response = await postToHuggingface(
    buildChatPayload(systemPrompt, messages, { maxTokens, temperature, stream: true }),
    { stream: true }
  );

  await parseOpenAiSseStream(response.data, onToken);
}

function getHuggingfaceProviderLabel() {
  return `Hugging Face (${getHuggingfaceModel()})`;
}

module.exports = {
  chatWithHuggingface,
  streamChatWithHuggingface,
  sanitizeMessages,
  getHuggingfaceApiKey,
  getHuggingfaceModel,
  getHuggingfaceRouterBaseUrl,
  getHuggingfaceProviderLabel,
  hasHuggingfaceKey,
  useHuggingfaceProvider,
};
