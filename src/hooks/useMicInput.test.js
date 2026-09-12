import { renderHook, act } from "@testing-library/react";
import { useMicInput } from "./useMicInput";

class MockSpeechRecognition {
  constructor() {
    this.lang = "";
    this.continuous = false;
    this.interimResults = false;
    this.maxAlternatives = 1;
    this.onstart = null;
    this.onresult = null;
    this.onend = null;
    this.onerror = null;
    this.pendingTranscript = "";
  }

  start() {
    this.onstart?.();
  }

  stop() {
    if (this.pendingTranscript) {
      this.onresult?.({
        results: [[{ transcript: this.pendingTranscript, isFinal: true }]],
      });
    }
    this.onend?.();
  }

  abort() {
    this.onend?.();
  }
}

beforeEach(() => {
  window.SpeechRecognition = MockSpeechRecognition;
});

afterEach(() => {
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
});

test("sends spoken text when the mic is clicked off", () => {
  const onResult = jest.fn();
  let active;
  window.SpeechRecognition = class extends MockSpeechRecognition {
    start() {
      active = this;
      this.onstart?.();
    }
  };

  const { result } = renderHook(() => useMicInput({ onResult }));

  act(() => {
    result.current.toggle();
  });

  act(() => {
    active.onresult({
      results: [[{ transcript: "What is StuCo?" }]],
    });
  });

  act(() => {
    result.current.toggle();
  });

  expect(onResult).toHaveBeenCalledWith("What is StuCo?");
  expect(onResult).toHaveBeenCalledTimes(1);
  expect(result.current.listening).toBe(false);
});

test("sends text that only arrives after stop()", () => {
  const onResult = jest.fn();
  let active;
  window.SpeechRecognition = class extends MockSpeechRecognition {
    start() {
      active = this;
      this.onstart?.();
    }
  };

  const { result } = renderHook(() => useMicInput({ onResult }));

  act(() => {
    result.current.toggle();
  });

  active.pendingTranscript = "Ask about registration";

  act(() => {
    result.current.toggle();
  });

  expect(onResult).toHaveBeenCalledWith("Ask about registration");
  expect(result.current.listening).toBe(false);
});

test("does not send when stopping without submit", () => {
  const onResult = jest.fn();
  let active;
  window.SpeechRecognition = class extends MockSpeechRecognition {
    start() {
      active = this;
      this.onstart?.();
    }
  };

  const { result } = renderHook(() => useMicInput({ onResult }));

  act(() => {
    result.current.toggle();
  });

  act(() => {
    active.onresult({
      results: [[{ transcript: "discard me" }]],
    });
  });

  act(() => {
    result.current.stop();
  });

  expect(onResult).not.toHaveBeenCalled();
  expect(result.current.listening).toBe(false);
});
