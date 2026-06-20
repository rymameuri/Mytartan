import { useState, useRef, useCallback, useEffect } from "react";
import { isStructuredStudioContent } from "../utils/tutorSpeechFallback";

export const MUTE_STORAGE_KEY = "mytartan-persona-muted";

export function readMutedPreference() {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "true";
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
  const speakTimerRef = useRef(null);

  const speakBrowser = useCallback((text) => {
    if (!window.speechSynthesis || !text?.trim()) return;
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback(async (text) => {
    clearTimeout(speakTimerRef.current);
    if (avatarRef?.current) {
      try {
        await avatarRef.current.speak(text);
        setIsSpeaking(true);
        const ms = Math.max(2500, text.split(" ").length * 450);
        speakTimerRef.current = setTimeout(() => setIsSpeaking(false), ms);
        return;
      } catch (err) {
        console.warn("[usePersonaSpeech] LiveAvatar unavailable, using browser TTS:", err.message);
      }
    }
    speakBrowser(text);
  }, [avatarRef, speakBrowser]);

  const stop = useCallback(() => {
    clearTimeout(speakTimerRef.current);
    window.speechSynthesis?.cancel();
    avatarRef?.current?.stop?.();
    setIsSpeaking(false);
  }, [avatarRef]);

  useEffect(
    () => () => {
      clearTimeout(speakTimerRef.current);
      window.speechSynthesis?.cancel();
    },
    []
  );

  return { isSpeaking, speak, stop };
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
}) {
  const prevLoadingRef = useRef(false);

  useEffect(() => {
    prevLoadingRef.current = false;
  }, [chatSessionKey]);

  useEffect(() => {
    if (!enabled) return;

    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoading;

    if (wasLoading && !isLoading && !readMutedPreference()) {
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
  }, [enabled, isLoading, lastReply, speechText, voiceModeRef, speak, chatSessionKey]);
}
