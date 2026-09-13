import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import tartanScottyFacialBase from "../assets/tartan-scotty-facial-base.png";
import { useFacialCoords } from "../hooks/useFacialCoords";
import { facialCoordsToStyle } from "../utils/facialCoords";
import { computeRms, mouthFromAmplitude, smoothAmplitude } from "../utils/mouthSync";
import {
  createTtsError,
  fetchTtsAudio,
  getUnlockedAudioContext,
  unlockHtmlAudio,
} from "../utils/elevenLabsVoice";
import "./ScottyAvatar.css";

const VALID_AVATAR_STATES = new Set(["idle", "listening", "thinking", "speaking"]);

function cleanupPlayback({ audioRef, objectUrlRef, sourceRef, progressRafRef }) {
  if (progressRafRef?.current) {
    cancelAnimationFrame(progressRafRef.current);
    progressRafRef.current = null;
  }

  if (objectUrlRef.current) {
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }

  if (sourceRef.current) {
    try {
      sourceRef.current.disconnect();
    } catch {
      // already disconnected
    }
    sourceRef.current = null;
  }

  const audio = audioRef.current;
  if (audio) {
    audio.onplay = null;
    audio.onplaying = null;
    audio.ontimeupdate = null;
    audio.onloadedmetadata = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.src = "";
    audioRef.current = null;
  }
}

function audioDuration(audio) {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    return audio.duration;
  }
  if (audio.seekable?.length) {
    const end = audio.seekable.end(audio.seekable.length - 1);
    if (Number.isFinite(end) && end > 0) return end;
  }
  return NaN;
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
  const facialCoords = useFacialCoords();
  const [mouth, setMouth] = useState(null);
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const timeDataRef = useRef(null);
  const sourceRef = useRef(null);
  const objectUrlRef = useRef(null);
  const progressRafRef = useRef(null);
  const speakResolveRef = useRef(null);
  const speakRejectRef = useRef(null);
  const mouthRef = useRef(null);
  const smoothedLevelRef = useRef(0);

  const resetMouth = useCallback(() => {
    mouthRef.current = null;
    smoothedLevelRef.current = 0;
    setMouth(null);
  }, []);

  const sampleMouth = useCallback(() => {
    const analyser = analyserRef.current;
    const samples = timeDataRef.current;
    if (!analyser || !samples) return;

    analyser.getByteTimeDomainData(samples);
    smoothedLevelRef.current = smoothAmplitude(
      smoothedLevelRef.current,
      computeRms(samples)
    );
    const next = mouthFromAmplitude(
      smoothedLevelRef.current,
      mouthRef.current || "closed"
    );
    if (next !== mouthRef.current) {
      mouthRef.current = next;
      setMouth(next);
    }
  }, []);

  const endPlayback = useCallback(
    (error) => {
      cleanupPlayback({ audioRef, objectUrlRef, sourceRef, progressRafRef });
      resetMouth();
      if (error) {
        speakRejectRef.current?.(error);
      } else {
        speakResolveRef.current?.();
      }
      speakResolveRef.current = null;
      speakRejectRef.current = null;
    },
    [resetMouth]
  );

  useImperativeHandle(ref, () => ({
    async speak(text, { onStart, onTimeUpdate, muted = false } = {}) {
      if (!text?.trim()) {
        throw new Error("speak() requires non-empty text");
      }

      cleanupPlayback({ audioRef, objectUrlRef, sourceRef, progressRafRef });
      resetMouth();
      unlockHtmlAudio();

      const blob = await fetchTtsAudio(text);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audio.setAttribute("playsinline", "true");
      audio.preload = "auto";
      audio.muted = Boolean(muted);
      audio.volume = muted ? 0 : 1;
      audioRef.current = audio;

      if (!audioCtxRef.current) {
        audioCtxRef.current = getUnlockedAudioContext() || null;
        if (!audioCtxRef.current) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) {
            audioCtxRef.current = new AudioContext();
          }
        }
      }

      const ctx = audioCtxRef.current;
      if (ctx) {
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        if (!analyserRef.current) {
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          analyser.smoothingTimeConstant = 0.55;
          analyser.connect(ctx.destination);
          analyserRef.current = analyser;
          timeDataRef.current = new Uint8Array(analyser.fftSize);
        }
        const source = ctx.createMediaElementSource(audio);
        source.connect(analyserRef.current);
        sourceRef.current = source;
        mouthRef.current = "closed";
        smoothedLevelRef.current = 0;
        setMouth("closed");
      }

      const emitProgress = () => {
        onTimeUpdate?.(audio.currentTime, audioDuration(audio));
      };

      const startProgressLoop = () => {
        if (progressRafRef.current) {
          cancelAnimationFrame(progressRafRef.current);
        }
        const tick = () => {
          emitProgress();
          sampleMouth();
          if (!audio.paused && !audio.ended) {
            progressRafRef.current = requestAnimationFrame(tick);
          } else {
            progressRafRef.current = null;
          }
        };
        progressRafRef.current = requestAnimationFrame(tick);
      };

      return new Promise((resolve, reject) => {
        speakResolveRef.current = resolve;
        speakRejectRef.current = reject;
        let started = false;
        const handleStart = () => {
          if (started) return;
          started = true;
          onStart?.();
          startProgressLoop();
        };

        audio.onplay = handleStart;
        audio.onplaying = handleStart;

        audio.ontimeupdate = () => {
          if (started) emitProgress();
        };
        audio.onloadedmetadata = () => {
          if (started) emitProgress();
        };

        audio.onended = () => {
          endPlayback();
        };

        audio.onerror = () => {
          endPlayback(new Error("Audio playback failed"));
        };

        const startPlayback = async () => {
          try {
            if (ctx?.state === "suspended") {
              await ctx.resume();
            }
            await audio.play();
          } catch (firstErr) {
            try {
              unlockHtmlAudio();
              if (ctx?.state === "suspended") {
                await ctx.resume();
              }
              await audio.play();
            } catch {
              endPlayback(
                createTtsError(firstErr.message || "Audio playback was blocked", {
                  ttsSucceeded: true,
                })
              );
            }
          }
        };
        startPlayback();
      });
    },

    stop() {
      endPlayback();
    },
  }), [endPlayback, resetMouth, sampleMouth]);

  useEffect(
    () => () => {
      if (speakRejectRef.current) {
        speakRejectRef.current(new Error("Avatar unmounted"));
      }
      speakResolveRef.current = null;
      speakRejectRef.current = null;
      cleanupPlayback({ audioRef, objectUrlRef, sourceRef, progressRafRef });
      if (audioCtxRef.current) {
        audioCtxRef.current.close?.().catch(() => {});
        audioCtxRef.current = null;
        analyserRef.current = null;
        timeDataRef.current = null;
      }
    },
    []
  );

  const resolvedState = VALID_AVATAR_STATES.has(avatarState) ? avatarState : "idle";

  const className = [
    "scotty-avatar",
    `scotty-avatar--${resolvedState}`,
    mouth && "scotty-avatar--lip-sync",
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
    <div
      className={className}
      data-mouth={mouth || undefined}
      style={facialCoordsToStyle(facialCoords)}
      role="img"
      aria-label="Scotty, the My Tartan terrier mascot"
    >
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
