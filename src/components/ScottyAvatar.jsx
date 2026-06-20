import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  LiveAvatarSession,
  SessionEvent,
  SessionState,
} from "@heygen/liveavatar-web-sdk";
import "./ScottyAvatar.css";

const API_BASE = process.env.REACT_APP_API_URL || "";

function toErrorMessage(value, fallback) {
  if (typeof value === "string") return value;
  if (value?.message) return value.message;
  return fallback;
}

function toDisplayError(message) {
  if (!message) return "Avatar unavailable";
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|Failed to fetch/i.test(message)) {
    return "Avatar unavailable — using voice fallback";
  }
  return message;
}

async function fetchSessionToken() {
  const response = await fetch(`${API_BASE}/api/liveavatar-token`, {
    method: "POST",
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      toErrorMessage(body.error, "Failed to fetch LiveAvatar session token")
    );
  }

  return body.token;
}

const ScottyAvatar = forwardRef(function ScottyAvatar(
  { compact = false, hero = false, persona = false, dock = false, dockLg = false, hidden = false },
  ref
) {
  const videoRef = useRef(null);
  const sessionRef = useRef(null);
  const isReadyRef = useRef(false);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  useImperativeHandle(ref, () => ({
    speak(text) {
      const session = sessionRef.current;
      if (!session || !isReadyRef.current) {
        return Promise.reject(new Error("Avatar session is not ready"));
      }
      if (session.state !== SessionState.CONNECTED) {
        return Promise.reject(new Error("Avatar session is not connected"));
      }
      if (!text?.trim()) {
        return Promise.reject(new Error("speak() requires non-empty text"));
      }

      try {
        session.repeat(text);
        return Promise.resolve();
      } catch (err) {
        return Promise.reject(err);
      }
    },
    stop() {
      const session = sessionRef.current;
      if (!session || !isReadyRef.current) return;
      if (session.state !== SessionState.CONNECTED) return;

      try {
        session.interrupt();
      } catch (err) {
        console.warn("[ScottyAvatar] interrupt failed:", err.message);
      }
    },
  }));

  useEffect(() => {
    let cancelled = false;
    const videoEl = videoRef.current;

    async function startSession() {
      try {
        setStatus("loading");
        setError(null);
        isReadyRef.current = false;

        const token = await fetchSessionToken();
        if (cancelled) return;

        const session = new LiveAvatarSession(token, { voiceChat: false });
        sessionRef.current = session;

        session.on(SessionEvent.SESSION_STREAM_READY, () => {
          if (cancelled) return;
          const el = videoRef.current;
          if (el) {
            session.attach(el);
            el.play().catch((playErr) => {
              console.warn("[ScottyAvatar] autoplay blocked, tap to enable:", playErr.message);
            });
          }
          isReadyRef.current = true;
          setStatus("ready");
        });

        session.on(SessionEvent.SESSION_DISCONNECTED, () => {
          if (cancelled) return;
          isReadyRef.current = false;
          setStatus("error");
          setError("Avatar offline");
        });

        await session.start();
      } catch (err) {
        if (cancelled) return;
        isReadyRef.current = false;
        console.error("[ScottyAvatar] session failed:", err);
        setStatus("error");
        setError(toDisplayError(err.message || "Failed to start avatar"));
      }
    }

    startSession();

    return () => {
      cancelled = true;
      isReadyRef.current = false;
      const session = sessionRef.current;
      sessionRef.current = null;

      if (videoEl) {
        videoEl.srcObject = null;
      }

      if (session) {
        session.stop().catch(() => {});
      }
    };
  }, []);

  const className = [
    "scotty-avatar",
    compact && "scotty-avatar--compact",
    hero && "scotty-avatar--hero",
    persona && "scotty-avatar--persona",
    dock && "scotty-avatar--dock",
    dockLg && "scotty-avatar--dock-lg",
    hidden && "scotty-avatar--hidden",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {status === "loading" && (
        <div className="scotty-avatar__overlay scotty-avatar__overlay--loading">
          <span className="scotty-avatar__spinner" aria-hidden="true" />
        </div>
      )}
      {status === "error" && (
        <div
          className="scotty-avatar__overlay scotty-avatar__overlay--error"
          title={dock || compact ? error : undefined}
        >
          {dock || compact ? "!" : error}
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className={`scotty-avatar__video${status === "ready" ? " scotty-avatar__video--visible" : ""}`}
      />
    </div>
  );
});

export default ScottyAvatar;
