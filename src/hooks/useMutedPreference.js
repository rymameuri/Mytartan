import { useCallback, useState } from "react";
import { MUTE_STORAGE_KEY, readMutedPreference } from "./usePersonaSpeech";

export function writeMutedPreference(muted) {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, String(muted));
  } catch {
    /* ignore */
  }
}

export function useMutedPreference(onMute) {
  const [isMuted, setIsMuted] = useState(readMutedPreference);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      writeMutedPreference(next);
      if (next) onMute?.();
      return next;
    });
  }, [onMute]);

  return { isMuted, toggleMute, setIsMuted };
}
