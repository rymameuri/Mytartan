import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getUserStorageKey } from "../utils/userStorage";

const STORAGE_KEY = "tartan-ws-pane-widths";
const DEFAULTS = { sources: 280, studio: 300 };
const LIMITS = {
  sources: { min: 220, max: 440 },
  studio: { min: 260, max: 560 },
};

function readStoredWidths(userId) {
  try {
    const raw = localStorage.getItem(getUserStorageKey(STORAGE_KEY, userId));
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      sources: clamp(parsed.sources ?? DEFAULTS.sources, LIMITS.sources),
      studio: clamp(parsed.studio ?? DEFAULTS.studio, LIMITS.studio),
    };
  } catch {
    return DEFAULTS;
  }
}

export function clamp(value, { min, max }) {
  return Math.min(max, Math.max(min, Number(value) || min));
}

export function usePaneResize(containerRef) {
  const { user } = useAuth();
  const userId = user?.id;
  const [widths, setWidths] = useState(() => readStoredWidths(userId));
  const dragRef = useRef(null);

  useEffect(() => {
    setWidths(readStoredWidths(userId));
  }, [userId]);

  const persistWidths = useCallback(
    (next) => {
      try {
        localStorage.setItem(getUserStorageKey(STORAGE_KEY, userId), JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
    },
    [userId]
  );

  const stopDrag = useCallback(() => {
    if (!dragRef.current) return;
    persistWidths(dragRef.current.widths);
    dragRef.current = null;
    document.body.classList.remove("ws-resize-active");
  }, [persistWidths]);

  const startDrag = useCallback(
    (edge, event) => {
      if (!containerRef.current) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);

      dragRef.current = {
        edge,
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidths: { ...widths },
        widths: { ...widths },
      };
      document.body.classList.add("ws-resize-active");
    },
    [containerRef, widths]
  );

  useEffect(() => {
    function handlePointerMove(event) {
      const drag = dragRef.current;
      const container = containerRef.current;
      if (!drag || !container || event.pointerId !== drag.pointerId) return;

      const rect = container.getBoundingClientRect();
      const deltaX = event.clientX - drag.startX;
      let next = { ...drag.startWidths };

      if (drag.edge === "sources") {
        next.sources = clamp(drag.startWidths.sources + deltaX, LIMITS.sources);
        const chatWidth =
          rect.width - next.sources - drag.startWidths.studio;
        if (chatWidth < 280) {
          next.sources = rect.width - drag.startWidths.studio - 280;
        }
      } else {
        next.studio = clamp(drag.startWidths.studio - deltaX, LIMITS.studio);
        const chatWidth =
          rect.width - drag.startWidths.sources - next.studio;
        if (chatWidth < 280) {
          next.studio = rect.width - drag.startWidths.sources - 280;
        }
      }

      drag.widths = next;
      setWidths(next);
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
  }, [containerRef, stopDrag]);

  return { widths, startDrag };
}
