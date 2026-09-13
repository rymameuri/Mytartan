import { useState, useRef, useCallback, useEffect } from "react";

export const SPEECH_LANG_FALLBACKS = ["en-QA", "en-GB", "en-US"];
export const MAX_SPEECH_ALTERNATIVES = 3;

const CAMPUS_HINTS = [
  "stuco",
  "stellic",
  "caps",
  "cmu",
  "qatar",
  "registration",
  "midterm",
  "financial",
  "advisor",
  "minor",
  "canvas",
  "handshake",
];

export function pickSpeechLanguage(index = 0) {
  const safe = Math.max(0, Math.min(index, SPEECH_LANG_FALLBACKS.length - 1));
  return SPEECH_LANG_FALLBACKS[safe];
}

export function hasCampusHint(text) {
  const lower = String(text || "").toLowerCase();
  return CAMPUS_HINTS.some((hint) => lower.includes(hint));
}

export function pickBestAlternative(result) {
  if (!result || result.length === 0) return "";
  let best = result[0];
  let bestScore = (result[0]?.confidence ?? 0.45) + (hasCampusHint(result[0]?.transcript) ? 0.1 : 0);
  for (let i = 1; i < result.length; i += 1) {
    const alt = result[i];
    const score = (alt?.confidence ?? 0.4) + (hasCampusHint(alt?.transcript) ? 0.1 : 0);
    if (score > bestScore) {
      best = alt;
      bestScore = score;
    }
  }
  return best?.transcript || "";
}

export function transcriptFromResults(results) {
  let finalText = "";
  let interim = "";
  for (let i = 0; i < results.length; i += 1) {
    const result = results[i];
    const piece = pickBestAlternative(result);
    if (result?.isFinal) finalText += `${piece} `;
    else interim += piece;
  }
  return `${finalText}${interim}`.replace(/\s+/g, " ").trim();
}

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function transcribeBlob(blob) {
  const audio = await blobToBase64(blob);
  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio, mimeType: blob.type || "audio/webm" }),
  });
  if (!response.ok) throw new Error("transcribe failed");
  const data = await response.json();
  return String(data.text || "").trim();
}

export function useMicInput({ onResult } = {}) {
  const [listening, setListening] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");
  const committedRef = useRef(false);
  const langIndexRef = useRef(0);
  const canTranscribeRef = useRef(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const setLiveTranscript = useCallback((value) => {
    transcriptRef.current = value;
    setTranscript(value);
  }, []);

  const reset = useCallback(() => {
    committedRef.current = false;
    setLiveTranscript("");
    setListening(false);
    setReviewing(false);
    setIsFinalizing(false);
    recognitionRef.current = null;
  }, [setLiveTranscript]);

  const confirm = useCallback(() => {
    if (committedRef.current) return;
    const text = transcriptRef.current.trim();
    if (!text) {
      reset();
      return;
    }
    committedRef.current = true;
    setReviewing(false);
    setListening(false);
    setIsFinalizing(false);
    onResultRef.current?.(text);
    setLiveTranscript("");
  }, [reset, setLiveTranscript]);

  const stopRecorder = useCallback(async () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (!recorder) return null;
    return new Promise((resolve) => {
      recorder.onstop = () => {
        try {
          recorder.stream?.getTracks?.().forEach((track) => track.stop());
        } catch {
          // stream already closed
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        resolve(blob.size > 400 ? blob : null);
      };
      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

  const startRecorder = useCallback(async () => {
    if (!canTranscribeRef.current || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.start();
      recorderRef.current = recorder;
    } catch {
      recorderRef.current = null;
    }
  }, []);

  const enterReview = useCallback(async () => {
    setListening(false);
    if (!recorderRef.current) {
      setIsFinalizing(false);
      if (transcriptRef.current.trim()) setReviewing(true);
      else reset();
      return;
    }
    setIsFinalizing(true);
    const blob = await stopRecorder();
    if (blob) {
      try {
        const text = await transcribeBlob(blob);
        if (text) setLiveTranscript(text);
      } catch {
        // Keep the Web Speech draft.
      }
    }
    setIsFinalizing(false);
    if (transcriptRef.current.trim()) setReviewing(true);
    else reset();
  }, [reset, setLiveTranscript, stopRecorder]);

  const finishListening = useCallback(
    (mode) => {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        try {
          if (mode === "discard") recognition.abort();
          else recognition.stop();
        } catch {
          // already stopped
        }
      }
      if (mode === "discard") {
        if (recorderRef.current) {
          stopRecorder().then(() => reset());
        } else {
          reset();
        }
        return;
      }
      enterReview();
    },
    [enterReview, reset, stopRecorder]
  );

  const startRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input isn't supported here. Try Chrome.");
      return false;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = pickSpeechLanguage(langIndexRef.current);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = MAX_SPEECH_ALTERNATIVES;

    committedRef.current = false;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      setLiveTranscript(transcriptFromResults(event.results));
    };
    recognition.onerror = (event) => {
      const error = event?.error;
      if (error === "aborted") return;
      if (error === "language-not-supported" && langIndexRef.current < SPEECH_LANG_FALLBACKS.length - 1) {
        langIndexRef.current += 1;
        try {
          recognition.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
        startRecognition();
        return;
      }
      if (error === "not-allowed" || error === "service-not-allowed") {
        alert("Microphone permission is blocked. Allow mic access and try again.");
        finishListening("discard");
        return;
      }
      setListening(false);
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      finishListening("review");
    };

    recognitionRef.current = recognition;
    setListening(true);
    setReviewing(false);
    try {
      recognition.start();
    } catch {
      try {
        recognition.continuous = false;
        recognition.start();
      } catch {
        recognitionRef.current = null;
        setListening(false);
        return false;
      }
    }
    startRecorder();
    return true;
  }, [finishListening, setLiveTranscript, startRecorder]);

  const stop = useCallback(
    (options = {}) => {
      if (options.submit === false) {
        finishListening("discard");
        return;
      }
      if (reviewing) {
        confirm();
        return;
      }
      finishListening("review");
    },
    [confirm, finishListening, reviewing]
  );

  const toggle = useCallback(() => {
    if (isFinalizing) return;
    if (reviewing) {
      confirm();
      return;
    }
    if (recognitionRef.current || listening) {
      finishListening("review");
      return;
    }
    langIndexRef.current = 0;
    setLiveTranscript("");
    startRecognition();
  }, [confirm, finishListening, isFinalizing, listening, reviewing, setLiveTranscript, startRecognition]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/kb/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) canTranscribeRef.current = Boolean(data?.transcribeAvailable);
      })
      .catch(() => {
        canTranscribeRef.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      try {
        recognitionRef.current?.abort?.();
      } catch {
        // unmount
      }
      stopRecorder();
    },
    [stopRecorder]
  );

  return {
    listening,
    reviewing,
    isFinalizing,
    transcript,
    setTranscript: setLiveTranscript,
    phase: isFinalizing ? "finalizing" : reviewing ? "review" : listening ? "listening" : "idle",
    toggle,
    stop,
    confirm,
    reset,
  };
}
