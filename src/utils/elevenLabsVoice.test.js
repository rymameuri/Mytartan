import { createTtsError, shouldFallBackToBrowserTts, ttsEndpoint } from "./elevenLabsVoice";

describe("ElevenLabs voice routing", () => {
  test("uses a relative /api/tts path so CRA proxy and same-origin deploys work", () => {
    expect(ttsEndpoint()).toMatch(/\/api\/tts$/);
  });

  test("never falls back to browser TTS after a successful /api/tts", () => {
    expect(
      shouldFallBackToBrowserTts(createTtsError("Audio playback failed", { ttsSucceeded: true }), {
        configured: true,
      })
    ).toBe(false);
    expect(
      shouldFallBackToBrowserTts(createTtsError("Audio playback failed", { ttsSucceeded: true }), {
        configured: false,
      })
    ).toBe(false);
  });

  test("never falls back when ElevenLabs keys are configured", () => {
    expect(shouldFallBackToBrowserTts(new Error("network down"), { configured: true })).toBe(false);
    expect(
      shouldFallBackToBrowserTts(createTtsError("ElevenLabs TTS failed"), { configured: true })
    ).toBe(false);
  });

  test("allows browser TTS only when keys are missing", () => {
    expect(
      shouldFallBackToBrowserTts(
        createTtsError("ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID must be set in server/.env", {
          missingKeys: true,
        }),
        { configured: false }
      )
    ).toBe(true);
  });
});
