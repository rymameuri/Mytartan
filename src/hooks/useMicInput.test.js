import { renderHook, act } from "@testing-library/react";
import {
  useMicInput,
  pickSpeechLanguage,
  pickBestAlternative,
  transcriptFromResults,
  SPEECH_LANG_FALLBACKS,
  MAX_SPEECH_ALTERNATIVES,
} from "./useMicInput";

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
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ transcribeAvailable: false }),
  });
});

afterEach(() => {
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
  delete global.fetch;
});

test("prefers en-QA then en-GB then en-US", () => {
  expect(pickSpeechLanguage(0)).toBe("en-QA");
  expect(pickSpeechLanguage(1)).toBe("en-GB");
  expect(pickSpeechLanguage(2)).toBe("en-US");
  expect(SPEECH_LANG_FALLBACKS).toEqual(["en-QA", "en-GB", "en-US"]);
});

test("picks the campus-hint alternative over a generic one", () => {
  const result = [
    { transcript: "what is the stew", confidence: 0.9 },
    { transcript: "what is stuco", confidence: 0.82 },
  ];
  result.length = 2;
  expect(pickBestAlternative(result)).toBe("what is stuco");
});

test("exposes live interim transcript without sending", () => {
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
      results: [[{ transcript: "um what is", isFinal: false }]],
    });
  });

  expect(result.current.listening).toBe(true);
  expect(result.current.transcript).toBe("um what is");
  expect(onResult).not.toHaveBeenCalled();
  expect(active.lang).toBe("en-QA");
  expect(active.maxAlternatives).toBe(MAX_SPEECH_ALTERNATIVES);
  expect(active.interimResults).toBe(true);
});

test("second tap reviews; third tap confirms send", () => {
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
      results: [[{ transcript: "What is StuCo?", isFinal: true }]],
    });
  });

  act(() => {
    result.current.toggle();
  });

  expect(onResult).not.toHaveBeenCalled();
  expect(result.current.listening).toBe(false);
  expect(result.current.reviewing).toBe(true);
  expect(result.current.transcript).toBe("What is StuCo?");

  act(() => {
    result.current.toggle();
  });

  expect(onResult).toHaveBeenCalledWith("What is StuCo?");
  expect(onResult).toHaveBeenCalledTimes(1);
});

test("sends the edited draft on confirm", () => {
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
      results: [[{ transcript: "what is stew co", isFinal: true }]],
    });
  });
  act(() => {
    result.current.toggle();
  });
  act(() => {
    result.current.setTranscript("What is StuCo?");
  });
  act(() => {
    result.current.confirm();
  });

  expect(onResult).toHaveBeenCalledWith("What is StuCo?");
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
    result.current.stop({ submit: false });
  });

  expect(onResult).not.toHaveBeenCalled();
  expect(result.current.listening).toBe(false);
  expect(result.current.reviewing).toBe(false);
});

test("transcriptFromResults keeps interim words visible", () => {
  const results = [
    { 0: { transcript: "how do I ", confidence: 0.9 }, isFinal: true, length: 1 },
    { 0: { transcript: "register", confidence: 0.6 }, isFinal: false, length: 1 },
  ];
  results.length = 2;
  expect(transcriptFromResults(results)).toBe("how do I register");
});
