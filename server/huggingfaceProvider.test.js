const axios = require("axios");

jest.mock("axios", () => ({
  post: jest.fn(),
  defaults: { proxy: false },
}));

const {
  chatWithHuggingface,
  hasHuggingfaceKey,
  useHuggingfaceProvider,
  getHuggingfaceModel,
  sanitizeMessages,
} = require("./huggingfaceProvider");

describe("huggingfaceProvider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
    process.env.AI_PROVIDER = "huggingface";
    process.env.HUGGINGFACE_API_KEY = "hf_test_token_1234567890";
    process.env.HUGGINGFACE_MODEL = "deepseek-ai/DeepSeek-V4-Flash-0731";
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("detects huggingface provider mode", () => {
    expect(useHuggingfaceProvider()).toBe(true);
    expect(hasHuggingfaceKey()).toBe(true);
    expect(getHuggingfaceModel()).toBe("deepseek-ai/DeepSeek-V4-Flash-0731");
  });

  test("chatWithHuggingface returns assistant text", async () => {
    axios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: "I am Scotty." } }],
      },
    });

    const reply = await chatWithHuggingface(
      "You are Scotty.",
      [{ role: "user", content: "Who are you?" }],
      { maxTokens: 128, temperature: 0.35 }
    );

    expect(reply).toBe("I am Scotty.");
    expect(axios.post).toHaveBeenCalledWith(
      "https://router.huggingface.co/v1/chat/completions",
      expect.objectContaining({
        model: "deepseek-ai/DeepSeek-V4-Flash-0731",
        messages: [
          { role: "system", content: "You are Scotty." },
          { role: "user", content: "Who are you?" },
        ],
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer hf_test_token_1234567890",
        }),
      })
    );
  });

  test("sanitizeMessages strips frontend-only fields", () => {
    const cleaned = sanitizeMessages([
      {
        role: "user",
        content: "hi",
        id: "abc",
        streaming: false,
        confidence: null,
      },
      {
        role: "assistant",
        content: "Hello!",
        feedbackContext: { mode: "qa" },
      },
    ]);

    expect(cleaned).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "Hello!" },
    ]);
  });
});
