import { renderHook, act } from "@testing-library/react";
import { useAutoSpeakReply, usePersonaSpeech } from "./usePersonaSpeech";

function mockSpeechSynthesis() {
  const speak = jest.fn();
  const cancel = jest.fn();
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      speak,
      cancel,
      getVoices: () => [],
      paused: false,
      resume: jest.fn(),
    },
  });
  return { speak, cancel };
}

describe("useAutoSpeakReply", () => {
  test("speaks once when a QA reply finishes loading, then skips the same text", () => {
    const speak = jest.fn();
    const { rerender } = renderHook(
      ({ isLoading, lastReply }) =>
        useAutoSpeakReply({
          enabled: true,
          isLoading,
          lastReply,
          speak,
          chatSessionKey: 1,
          userId: "u1",
        }),
      { initialProps: { isLoading: true, lastReply: "" } }
    );

    rerender({ isLoading: false, lastReply: "The library is in the Academic Building." });
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith("The library is in the Academic Building.");

    rerender({ isLoading: false, lastReply: "The library is in the Academic Building." });
    expect(speak).toHaveBeenCalledTimes(1);
  });

  test("does not speak a hydrated reply that was never loading", () => {
    const speak = jest.fn();
    renderHook(() =>
      useAutoSpeakReply({
        enabled: true,
        isLoading: false,
        lastReply: "Already on screen from last visit.",
        speak,
        chatSessionKey: 2,
        userId: "u1",
      })
    );
    expect(speak).not.toHaveBeenCalled();
  });
});

describe("usePersonaSpeech", () => {
  beforeEach(() => {
    mockSpeechSynthesis();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ configured: false }),
    });
  });

  test("speak ignores a second call with the same text while in flight", async () => {
    let release;
    const hanging = new Promise((resolve) => {
      release = resolve;
    });
    const avatarSpeak = jest.fn(() => hanging);
    const avatarStop = jest.fn();
    const avatarRef = { current: { speak: avatarSpeak, stop: avatarStop } };

    const { result } = renderHook(() => usePersonaSpeech(avatarRef, "u1"));

    await act(async () => {
      result.current.speak("Hello from Scotty.");
      result.current.speak("Hello from Scotty.");
    });

    expect(avatarSpeak).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
    });
  });

  test("starting a new speak cancels in-flight audio first", async () => {
    const avatarSpeak = jest.fn().mockResolvedValue(undefined);
    const avatarStop = jest.fn();
    const avatarRef = { current: { speak: avatarSpeak, stop: avatarStop } };
    const { cancel } = mockSpeechSynthesis();

    const { result } = renderHook(() => usePersonaSpeech(avatarRef, "u1"));

    await act(async () => {
      await result.current.speak("First reply.");
    });
    await act(async () => {
      await result.current.speak("Second reply.");
    });

    expect(avatarStop).toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
    expect(avatarSpeak).toHaveBeenCalledTimes(2);
    expect(avatarSpeak.mock.calls[0][0]).toMatch(/First reply/);
    expect(avatarSpeak.mock.calls[1][0]).toMatch(/Second reply/);
  });
});
