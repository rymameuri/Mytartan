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

export function usePersonaSpeech(avatarRef, userId) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPreparingSpeech, setIsPreparingSpeech] = useState(false);
  const [caption, setCaption] = useState("");
  const speakTimerRef = useRef(null);
  const revealTimerRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const boundarySeenRef = useRef(false);
  const fullTextRef = useRef("");
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

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
      if (!text?.trim()) return;

      boundarySeenRef.current = false;
      fullTextRef.current = text;
      clearRevealTimers();
      setIsPreparingSpeech(false);
      setIsSpeaking(true);
      updateCaptionForWord(text, 0);
      startTimedReveal(text, msPerSpeechWord(BROWSER_TTS_RATE));

      if (!window.speechSynthesis) {
        const words = splitSpeechWords(text);
        const holdMs = Math.max(words.length * msPerSpeechWord(BROWSER_TTS_RATE), 1200);
        speakTimerRef.current = setTimeout(finishSpeaking, holdMs);
        return;
      }

      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = BROWSER_TTS_RATE;
      utterance.pitch = 1;
      utterance.volume = readMutedPreference(userIdRef.current) ? 0 : 1;

      utterance.onboundary = (event) => {
        boundarySeenRef.current = true;
        if (event.charIndex != null) {
          setCaption(captionForCharIndex(text, event.charIndex));
        }
      };

      utterance.onend = () => {
        finishSpeaking();
      };

      utterance.onerror = () => {
        const words = splitSpeechWords(text);
        const holdMs = Math.max(words.length * msPerSpeechWord(BROWSER_TTS_RATE), 1200);
        speakTimerRef.current = setTimeout(finishSpeaking, holdMs);
      };

      window.speechSynthesis.speak(utterance);
    },
    [clearRevealTimers, finishSpeaking, startTimedReveal, updateCaptionForWord]
  );

  const speak = useCallback(
    async (text) => {
      clearTimeout(speakTimerRef.current);
      clearRevealTimers();
      clearCaption();

      const normalized = normalizeSpeechCaption(toSpokenText(text));
      if (!normalized) return;

      fullTextRef.current = normalized;
      setIsPreparingSpeech(true);
      setIsSpeaking(true);
      updateCaptionForWord(normalized, 0);

      if (avatarRef?.current?.speak) {
        try {
          await avatarRef.current.speak(normalized, {
            muted: readMutedPreference(userIdRef.current),
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
          avatarRef.current?.stop?.();
          console.warn("[usePersonaSpeech] ElevenLabs unavailable, using browser TTS:", err.message);
        }
      }

      speakBrowser(normalized);
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

  const stop = useCallback(() => {
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
  const lastSpokenRef = useRef(null);

  useEffect(() => {
    prevLoadingRef.current = false;
    lastSpokenRef.current = null;
  }, [chatSessionKey]);

  useEffect(() => {
    if (!enabled) return;

    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoading;
    if (isLoading) return;

    const scripted = speechText?.trim();
    const replyCandidate = lastReply?.trim();
    const toSpeak =
      scripted ||
      (replyCandidate && !isStructuredStudioContent(replyCandidate)
        ? replyCandidate
        : "");

    if (lastSpokenRef.current === null) {
      lastSpokenRef.current = toSpeak || "";
      if (!wasLoading) return;
    }

    if (!toSpeak) return;
    if (!wasLoading && lastSpokenRef.current === toSpeak) return;

    lastSpokenRef.current = toSpeak;
    if (voiceModeRef) voiceModeRef.current = false;
    speak(toSpeak);
  }, [enabled, isLoading, lastReply, speechText, voiceModeRef, speak, chatSessionKey, userId]);
}
