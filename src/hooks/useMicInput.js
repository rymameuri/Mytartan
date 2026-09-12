import { useState, useRef, useCallback, useEffect } from "react";

const SUBMIT_TIMEOUT_MS = 1200;

function transcriptFromResults(results) {
  let finalText = "";
  let interim = "";
  for (let i = 0; i < results.length; i += 1) {
    const result = results[i];
    const piece = result?.[0]?.transcript || "";
    if (result?.isFinal) finalText += `${piece} `;
    else interim += piece;
  }
  return `${finalText}${interim}`.replace(/\s+/g, " ").trim();
}

export function useMicInput({ onResult }) {
  const [listening, setListening] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");
  const committedRef = useRef(false);
  const pendingSubmitRef = useRef(false);
  const fallbackTimerRef = useRef(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const clearFallback = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const commit = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    pendingSubmitRef.current = false;
    const text = transcriptRef.current.trim();
    transcriptRef.current = "";
    setIsFinalizing(false);
    if (text) onResultRef.current(text);
  }, []);

  const finish = useCallback(
    (shouldSubmit) => {
      clearFallback();
      recognitionRef.current = null;
      setListening(false);
      if (shouldSubmit) commit();
      else {
        committedRef.current = true;
        pendingSubmitRef.current = false;
        transcriptRef.current = "";
        setIsFinalizing(false);
      }
    },
    [clearFallback, commit]
  );

  const stop = useCallback(
    (options = {}) => {
      const submit = options.submit === true;
      const recognition = recognitionRef.current;

      if (!recognition) {
        setListening(false);
        if (submit) commit();
        else setIsFinalizing(false);
        return;
      }

      if (!submit) {
        finish(false);
        try {
          recognition.abort();
        } catch {
          // Recognition may already be stopped.
        }
        return;
      }

      pendingSubmitRef.current = true;
      committedRef.current = false;
      setListening(false);
      setIsFinalizing(true);

      try {
        recognition.stop();
      } catch {
        finish(true);
        return;
      }

      clearFallback();
      fallbackTimerRef.current = setTimeout(() => finish(true), SUBMIT_TIMEOUT_MS);
    },
    [clearFallback, commit, finish]
  );

  const toggle = useCallback(() => {
    if (isFinalizing) return;

    if (recognitionRef.current || listening) {
      stop({ submit: true });
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input isn't supported here. Try Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    committedRef.current = false;
    pendingSubmitRef.current = false;
    transcriptRef.current = "";

    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      transcriptRef.current = transcriptFromResults(event.results);
      if (pendingSubmitRef.current && transcriptRef.current) {
        finish(true);
      }
    };
    recognition.onerror = (event) => {
      const error = event?.error;
      if (error === "aborted") return;
      if (error === "not-allowed" || error === "service-not-allowed") {
        alert("Microphone permission is blocked. Allow mic access and try again.");
        finish(false);
        return;
      }
      setListening(false);
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      finish(pendingSubmitRef.current || Boolean(transcriptRef.current.trim()));
    };

    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      try {
        recognition.continuous = false;
        recognition.start();
      } catch {
        recognitionRef.current = null;
        setListening(false);
      }
    }
  }, [isFinalizing, listening, stop, finish]);

  useEffect(() => () => clearFallback(), [clearFallback]);

  return { listening, isFinalizing, toggle, stop };
}
