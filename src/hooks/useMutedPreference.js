import { useCallback, useEffect, useState } from "react";
import { MUTE_STORAGE_KEY, readMutedPreference } from "./usePersonaSpeech";
import { getUserStorageKey } from "../utils/userStorage";

export function writeMutedPreference(muted, userId) {
  try {
    localStorage.setItem(getUserStorageKey(MUTE_STORAGE_KEY, userId), String(muted));
  } catch {
    /* ignore */
  }
}

export function useMutedPreference(onMute, userId) {
  const [isMuted, setIsMuted] = useState(() => readMutedPreference(userId));

  useEffect(() => {
    setIsMuted(readMutedPreference(userId));
  }, [userId]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      writeMutedPreference(next, userId);
      if (next) onMute?.();
      return next;
    });
  }, [onMute, userId]);

  return { isMuted, toggleMute, setIsMuted };
}
