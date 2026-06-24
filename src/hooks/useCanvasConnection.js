import { useCallback, useEffect, useState } from "react";
import { getUserStorageKey } from "../utils/userStorage";

const API_BASE = process.env.REACT_APP_API_URL || "";
const STORAGE_KEY = "mytartan_canvas";

function readStored(userId) {
  try {
    const raw = localStorage.getItem(getUserStorageKey(STORAGE_KEY, userId));
    if (!raw) return { canvasConnected: false, canvasUrl: "" };
    const parsed = JSON.parse(raw);
    return {
      canvasConnected: Boolean(parsed.canvasConnected),
      canvasUrl: parsed.canvasUrl ?? "",
    };
  } catch {
    return { canvasConnected: false, canvasUrl: "" };
  }
}

function writeStored(userId, data) {
  try {
    const key = getUserStorageKey(STORAGE_KEY, userId);
    if (!data.canvasConnected) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(
        key,
        JSON.stringify({ canvasConnected: true, canvasUrl: data.canvasUrl })
      );
    }
  } catch {
    /* ignore */
  }
}

export function useCanvasConnection(userId, authToken) {
  const [state, setState] = useState(() => readStored(userId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setState(readStored(userId));
    setError("");
  }, [userId]);

  useEffect(() => {
    if (!authToken) return undefined;

    let cancelled = false;

    async function syncServerStatus() {
      try {
        const response = await fetch(`${API_BASE}/api/canvas/status`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!response.ok || cancelled) return;

        const data = await response.json();
        if (cancelled) return;

        if (data.connected && data.canvasUrl) {
          const next = { canvasConnected: true, canvasUrl: data.canvasUrl };
          writeStored(userId, next);
          setState(next);
        } else {
          writeStored(userId, { canvasConnected: false });
          setState({ canvasConnected: false, canvasUrl: "" });
        }
      } catch {
        /* keep local state if status check fails */
      }
    }

    syncServerStatus();
    return () => {
      cancelled = true;
    };
  }, [authToken, userId]);

  const connect = useCallback(
    async (canvasUrl, token) => {
      if (!authToken) {
        setError("Authentication required");
        return null;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/api/canvas/connect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ canvasUrl, token }),
        });

        const data = await response.json().catch(() => ({}));

        if (!data.success) {
          setError(data.error || "Invalid token or URL");
          return null;
        }

        const normalizedUrl = String(canvasUrl).trim().replace(/\/$/, "");
        const next = { canvasConnected: true, canvasUrl: normalizedUrl };
        writeStored(userId, next);
        setState(next);
        return data.user;
      } catch {
        setError("Invalid token or URL");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [authToken, userId]
  );

  const disconnect = useCallback(async () => {
    if (authToken) {
      try {
        await fetch(`${API_BASE}/api/canvas/disconnect`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch {
        /* clear local state even if server call fails */
      }
    }

    writeStored(userId, { canvasConnected: false });
    setState({ canvasConnected: false, canvasUrl: "" });
    setError("");
  }, [authToken, userId]);

  return {
    connected: state.canvasConnected,
    canvasUrl: state.canvasUrl,
    connect,
    disconnect,
    loading,
    error,
  };
}
