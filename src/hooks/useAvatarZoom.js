import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getUserStorageKey } from "../utils/userStorage";

const STORAGE_KEY = "tartan-avatar-zoom";
const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 85;
const MAX_ZOOM = 130;
const ZOOM_EVENT = "tartan-avatar-zoom";

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
  const [zoom, setZoomState] = useState(() => readStoredZoom(userId));
  const skipNextPersist = useRef(false);

  useEffect(() => {
    skipNextPersist.current = true;
    setZoomState(readStoredZoom(userId));
  }, [userId]);

  useEffect(() => {
    function handleZoomEvent(event) {
      const next = event.detail?.zoom;
      if (typeof next !== "number") return;
      setZoomState((prev) => (prev === next ? prev : next));
    }
    window.addEventListener(ZOOM_EVENT, handleZoomEvent);
    return () => window.removeEventListener(ZOOM_EVENT, handleZoomEvent);
  }, []);

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

  const setZoom = useCallback((next) => {
    setZoomState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value)));
      if (Number.isNaN(clamped) || clamped === prev) return prev;
      queueMicrotask(() => {
        window.dispatchEvent(new CustomEvent(ZOOM_EVENT, { detail: { zoom: clamped } }));
      });
      return clamped;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
  }, [setZoom]);

  const avatarStyle = {
    "--avatar-scale": (zoom / 100).toFixed(2),
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
