import { useState, useRef, useCallback, useEffect } from "react";
import { isStructuredStudioContent } from "../utils/tutorSpeechFallback";
import { getUserStorageKey } from "../utils/userStorage";
import {
  normalizeSpeechCaption,
  splitSpeechWords,
  msPerSpeechWord,
  captionForCharIndex,
  captionForWordIndex,
  captionForPlaybackProgress,
} from "../utils/speechCaption";
import { toSpokenText } from "../utils/spokenText";

export const MUTE_STORAGE_KEY = "mytartan-persona-muted";

const BROWSER_TTS_RATE = 1.05;

export function readMutedPreference(userId) {
  try {
    return localStorage.getItem(getUserStorageKey(MUTE_STORAGE_KEY, userId)) === "true";
  } catch {
    return false;
  }
}

/** Call synchronously from a click handler so browser TTS works after async replies. */
export function armSpeechSynthesis() {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance("\u200B");
  utterance.volume = 0;
  utterance.rate = 10;
  window.speechSynthesis.speak(utterance);
}

export function usePersonaSpeech(avatarRef) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPreparingSpeech, setIsPreparingSpeech] = useState(false);
  const [caption, setCaption] = useState("");
  const speakTimerRef = useRef(null);
  const queueRef = useRef([]);
  const drainingRef = useRef(false);
  const runIdRef = useRef(0);
  const revealTimerRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const boundarySeenRef = useRef(false);
  const fullTextRef = useRef("");

  const clearRevealTimers = useCallback(() => {
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const clearCaption = useCallback(() => {
    setCaption("");
    fullTextRef.current = "";
  }, []);

  const updateCaptionForWord = useCallback((text, wordIndex) => {
    setCaption(captionForWordIndex(text, wordIndex));
  }, []);

  const startTimedReveal = useCallback(
    (text, msPerWord) => {
      clearRevealTimers();
      const words = splitSpeechWords(text);
      if (!words.length) return;

      let wordIndex = 0;
      updateCaptionForWord(text, 0);

      revealTimerRef.current = setInterval(() => {
        wordIndex += 1;
        if (wordIndex >= words.length) {
          clearRevealTimers();
          return;
        }
        updateCaptionForWord(text, wordIndex);
      }, msPerWord);
    },
    [clearRevealTimers, updateCaptionForWord]
  );

  const finishSpeaking = useCallback(() => {
    clearTimeout(speakTimerRef.current);
    speakTimerRef.current = null;
    clearRevealTimers();
    setIsPreparingSpeech(false);
    setIsSpeaking(false);
    clearCaption();
  }, [clearRevealTimers, clearCaption]);

  const speakBrowser = useCallback(
    (text) => {
      if (!window.speechSynthesis || !text?.trim()) return;

      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      boundarySeenRef.current = false;
      fullTextRef.current = text;
      clearRevealTimers();
      setCaption("");

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = BROWSER_TTS_RATE;
      utterance.pitch = 1;

      fallbackTimerRef.current = setTimeout(() => {
        if (!boundarySeenRef.current) {
          startTimedReveal(text, msPerSpeechWord(BROWSER_TTS_RATE));
        }
      }, 400);

      utterance.onstart = () => {
        setIsSpeaking(true);
        updateCaptionForWord(text, 0);
      };

      utterance.onboundary = (event) => {
        boundarySeenRef.current = true;
        if (fallbackTimerRef.current) {
          clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        if (revealTimerRef.current) {
          clearInterval(revealTimerRef.current);
          revealTimerRef.current = null;
        }
        if (event.charIndex != null) {
          setCaption(captionForCharIndex(text, event.charIndex));
        }
      };

      utterance.onend = () => {
        finishSpeaking();
      };

      utterance.onerror = () => {
        finishSpeaking();
      };

      window.speechSynthesis.speak(utterance);
      return new Promise((resolve) => {
        const done = () => resolve();
        const previousEnd = utterance.onend;
        const previousError = utterance.onerror;
        utterance.onend = () => {
          previousEnd?.();
          done();
        };
        utterance.onerror = () => {
          previousError?.();
          done();
        };
      });
    },
    [clearRevealTimers, finishSpeaking, startTimedReveal, updateCaptionForWord]
  );

  const speakOne = useCallback(
    async (normalized) => {
      clearTimeout(speakTimerRef.current);
      clearRevealTimers();
      clearCaption();

      fullTextRef.current = normalized;

      if (avatarRef?.current) {
        try {
          setIsPreparingSpeech(true);
          await avatarRef.current.speak(normalized, {
            onStart: () => {
              setIsPreparingSpeech(false);
              setIsSpeaking(true);
              updateCaptionForWord(normalized, 0);
              fallbackTimerRef.current = setTimeout(() => {
                if (!revealTimerRef.current) {
                  startTimedReveal(normalized, 580);
                }
              }, 800);
            },
            onTimeUpdate: (currentTime, duration) => {
              if (fallbackTimerRef.current) {
                clearTimeout(fallbackTimerRef.current);
                fallbackTimerRef.current = null;
              }
              if (revealTimerRef.current) {
                clearInterval(revealTimerRef.current);
                revealTimerRef.current = null;
              }
              if (!Number.isFinite(duration) || duration <= 0) return;
              setCaption(captionForPlaybackProgress(normalized, currentTime, duration));
            },
          });
          finishSpeaking();
          return;
        } catch (err) {
          finishSpeaking();
          console.warn("[usePersonaSpeech] ElevenLabs unavailable, using browser TTS:", err.message);
        }
      }

      await speakBrowser(normalized);
    },
    [
      avatarRef,
      speakBrowser,
      clearRevealTimers,
      clearCaption,
      startTimedReveal,
      finishSpeaking,
      updateCaptionForWord,
    ]
  );

  const speak = useCallback(
    (text) => {
      const normalized = normalizeSpeechCaption(toSpokenText(text));
      if (!normalized) return;
      queueRef.current.push(normalized);
      if (drainingRef.current) return;

      const runId = runIdRef.current;
      drainingRef.current = true;
      (async () => {
        try {
          while (queueRef.current.length && runId === runIdRef.current) {
            const next = queueRef.current.shift();
            await speakOne(next);
          }
        } finally {
          if (runId === runIdRef.current) drainingRef.current = false;
        }
      })();
    },
    [speakOne]
  );

  const stop = useCallback(() => {
    runIdRef.current += 1;
    queueRef.current = [];
    drainingRef.current = false;
    clearTimeout(speakTimerRef.current);
    speakTimerRef.current = null;
    clearRevealTimers();
    window.speechSynthesis?.cancel();
    avatarRef?.current?.stop?.();
    setIsPreparingSpeech(false);
    setIsSpeaking(false);
    clearCaption();
  }, [avatarRef, clearRevealTimers, clearCaption]);

  useEffect(
    () => () => {
      clearTimeout(speakTimerRef.current);
      clearRevealTimers();
      window.speechSynthesis?.cancel();
    },
    [clearRevealTimers]
  );

  return { isSpeaking, isPreparingSpeech, speak, stop, caption };
}

/**
 * Auto-read assistant replies aloud (respects mute preference in localStorage).
 */
export function useAutoSpeakReply({
  enabled,
  isLoading,
  lastReply,
  speechText = "",
  voiceModeRef,
  speak,
  chatSessionKey = 0,
  userId,
}) {
  const prevLoadingRef = useRef(false);

  useEffect(() => {
    prevLoadingRef.current = false;
  }, [chatSessionKey]);

  useEffect(() => {
    if (!enabled) return;

    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoading;

    if (wasLoading && !isLoading && !readMutedPreference(userId)) {
      if (voiceModeRef) voiceModeRef.current = false;
      const scripted = speechText?.trim();
      const replyCandidate = lastReply?.trim();
      const toSpeak =
        scripted ||
        (replyCandidate && !isStructuredStudioContent(replyCandidate)
          ? replyCandidate
          : "");
      if (toSpeak) speak(toSpeak);
    }
  }, [enabled, isLoading, lastReply, speechText, voiceModeRef, speak, chatSessionKey, userId]);
}
