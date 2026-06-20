import { useState, useRef, useCallback, useEffect } from "react";
import { isStructuredStudioContent } from "../utils/tutorSpeechFallback";
import { getUserStorageKey } from "../utils/userStorage";
import {
  normalizeSpeechCaption,
  splitSpeechWords,
  msPerSpeechWord,
  captionForCharIndex,
  captionForWordIndex,
} from "../utils/speechCaption";

export const MUTE_STORAGE_KEY = "mytartan-persona-muted";

const BROWSER_TTS_RATE = 0.92;

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
  const [caption, setCaption] = useState("");
  const speakTimerRef = useRef(null);
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
    },
    [clearRevealTimers, finishSpeaking, startTimedReveal, updateCaptionForWord]
  );

  const speak = useCallback(
    async (text) => {
      clearTimeout(speakTimerRef.current);
      clearRevealTimers();
      clearCaption();

      const normalized = normalizeSpeechCaption(text);
      if (!normalized) return;

      fullTextRef.current = normalized;

      if (avatarRef?.current) {
        try {
          await avatarRef.current.speak(normalized);
          setIsSpeaking(true);
          updateCaptionForWord(normalized, 0);
          const msPerWord = 450;
          startTimedReveal(normalized, msPerWord);
          const ms = Math.max(2500, splitSpeechWords(normalized).length * msPerWord + 300);
          speakTimerRef.current = setTimeout(() => {
            finishSpeaking();
          }, ms);
          return;
        } catch (err) {
          console.warn("[usePersonaSpeech] LiveAvatar unavailable, using browser TTS:", err.message);
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

  return { isSpeaking, speak, stop, caption };
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
