import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import tartanScottyFacialBase from "../assets/tartan-scotty-facial-base.png";
import "./ScottyAvatar.css";

const API_BASE = process.env.REACT_APP_API_URL || "";
const VALID_AVATAR_STATES = new Set(["idle", "listening", "thinking", "speaking"]);

function cleanupPlayback({ audioRef, objectUrlRef, sourceRef }) {
  if (objectUrlRef.current) {
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }

  sourceRef.current = null;

  const audio = audioRef.current;
  if (audio) {
    audio.onplay = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.src = "";
    audioRef.current = null;
  }
}

function ScottyEyes() {
  return (
    <div className="scotty-avatar__eyes" aria-hidden="true">
      <span className="scotty-avatar__eye scotty-avatar__eye--left">
        <span className="scotty-avatar__pupil" />
      </span>
      <span className="scotty-avatar__eye scotty-avatar__eye--right">
        <span className="scotty-avatar__pupil" />
      </span>
    </div>
  );
}

function ScottyMouth() {
  return (
    <span className="scotty-avatar__mouth" aria-hidden="true">
      <span className="scotty-avatar__mouth-state scotty-avatar__mouth-state--closed" />
      <span className="scotty-avatar__mouth-state scotty-avatar__mouth-state--small">
        <span className="scotty-avatar__mouth-opening" />
        <span className="scotty-avatar__tongue" />
      </span>
      <span className="scotty-avatar__mouth-state scotty-avatar__mouth-state--wide">
        <span className="scotty-avatar__mouth-opening" />
        <span className="scotty-avatar__tongue" />
      </span>
    </span>
  );
}

/**
 * Expressive Scotty mascot. Facial layers share one figure group with the art.
 * Speech uses ElevenLabs via /api/tts; browser TTS is the fallback in usePersonaSpeech.
 */
const ScottyAvatar = forwardRef(function ScottyAvatar(
  {
    compact = false,
    hero = false,
    persona = false,
    dock = false,
    dockLg = false,
    hidden = false,
    avatarState = "idle",
  },
  ref
) {
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const objectUrlRef = useRef(null);
  const speakResolveRef = useRef(null);
  const speakRejectRef = useRef(null);

  useImperativeHandle(ref, () => ({
    async speak(text) {
      if (!text?.trim()) {
        throw new Error("speak() requires non-empty text");
      }

      cleanupPlayback({ audioRef, objectUrlRef, sourceRef });

      const response = await fetch(`${API_BASE}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to generate speech");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          audioCtxRef.current = new AudioContext();
        }
      }

      const ctx = audioCtxRef.current;
      if (ctx) {
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        const source = ctx.createMediaElementSource(audio);
        source.connect(ctx.destination);
        sourceRef.current = source;
      }

      return new Promise((resolve, reject) => {
        speakResolveRef.current = resolve;
        speakRejectRef.current = reject;

        audio.onended = () => {
          cleanupPlayback({ audioRef, objectUrlRef, sourceRef });
          speakResolveRef.current?.();
          speakResolveRef.current = null;
          speakRejectRef.current = null;
        };

        audio.onerror = () => {
          cleanupPlayback({ audioRef, objectUrlRef, sourceRef });
          const err = new Error("Audio playback failed");
          speakRejectRef.current?.(err);
          speakResolveRef.current = null;
          speakRejectRef.current = null;
        };

        audio.play().catch((playErr) => {
          cleanupPlayback({ audioRef, objectUrlRef, sourceRef });
          speakRejectRef.current?.(playErr);
          speakResolveRef.current = null;
          speakRejectRef.current = null;
        });
      });
    },

    stop() {
      if (speakResolveRef.current) {
        speakResolveRef.current();
        speakResolveRef.current = null;
        speakRejectRef.current = null;
      }
      cleanupPlayback({ audioRef, objectUrlRef, sourceRef });
    },
  }));

  useEffect(
    () => () => {
      if (speakRejectRef.current) {
        speakRejectRef.current(new Error("Avatar unmounted"));
      }
      speakResolveRef.current = null;
      speakRejectRef.current = null;
      cleanupPlayback({ audioRef, objectUrlRef, sourceRef });
    },
    []
  );

  const resolvedState = VALID_AVATAR_STATES.has(avatarState) ? avatarState : "idle";

  const className = [
    "scotty-avatar",
    `scotty-avatar--${resolvedState}`,
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
    <div className={className} role="img" aria-label="Scotty, the My Tartan terrier mascot">
      <div className="scotty-avatar__mascot-stage" aria-hidden="true">
        <div className="scotty-avatar__figure">
          <img
            className="scotty-avatar__mascot"
            src={tartanScottyFacialBase}
            alt=""
            draggable="false"
          />
          <div className="scotty-avatar__facial-stage">
            <ScottyEyes />
            <ScottyMouth />
          </div>
        </div>
      </div>
    </div>
  );
});

export default ScottyAvatar;
