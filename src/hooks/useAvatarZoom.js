import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getUserStorageKey } from "../utils/userStorage";

const STORAGE_KEY = "tartan-avatar-zoom";
const DEFAULT_ZOOM = 148;
const MIN_ZOOM = 115;
const MAX_ZOOM = 220;

function readStoredZoom(userId) {
  try {
    const raw = localStorage.getItem(getUserStorageKey(STORAGE_KEY, userId));
    if (raw == null) return DEFAULT_ZOOM;
    const value = Number(raw);
    if (Number.isNaN(value)) return DEFAULT_ZOOM;
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  } catch {
    return DEFAULT_ZOOM;
  }
}

export function useAvatarZoom() {
  const { user } = useAuth();
  const userId = user?.id;
  const [zoom, setZoom] = useState(() => readStoredZoom(userId));
  const skipNextPersist = useRef(false);

  useEffect(() => {
    skipNextPersist.current = true;
    setZoom(readStoredZoom(userId));
  }, [userId]);

  useEffect(() => {
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(getUserStorageKey(STORAGE_KEY, userId), String(zoom));
    } catch {
      /* ignore */
    }
  }, [zoom, userId]);

  const resetZoom = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
  }, []);

  const avatarStyle = {
    "--avatar-zoom-size": `${zoom}%`,
  };

  return { zoom, setZoom, resetZoom, avatarStyle, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM };
}

export function useAvatarZoomDrag({ zoom, setZoom, minZoom, maxZoom }) {
  const dragRef = useRef(null);

  const stopDrag = useCallback(() => {
    dragRef.current = null;
    document.body.classList.remove("avatar-zoom-active");
  }, []);

  const startDrag = useCallback(
    (event) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startZoom: zoom,
      };
      document.body.classList.add("avatar-zoom-active");
    },
    [zoom]
  );

  useEffect(() => {
    function handlePointerMove(event) {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      const deltaY = drag.startY - event.clientY;
      const next = Math.min(
        maxZoom,
        Math.max(minZoom, Math.round(drag.startZoom + deltaY * 0.6))
      );
      setZoom(next);
    }

    function handlePointerUp(event) {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      stopDrag();
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [maxZoom, minZoom, setZoom, stopDrag]);

  return { startDrag, stopDrag };
}

export { DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM };
