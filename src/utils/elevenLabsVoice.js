const API_BASE = process.env.REACT_APP_API_URL || "";

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

let unlockedAudio = null;
let unlockedCtx = null;

export function ttsEndpoint() {
  return `${API_BASE}/api/tts`;
}

export function ttsStatusEndpoint() {
  return `${API_BASE}/api/tts/status`;
}

/** Unlock HTMLAudio + AudioContext from a click so later /api/tts MPEG can play. */
export function unlockHtmlAudio() {
  if (typeof window === "undefined") return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      if (!unlockedCtx || unlockedCtx.state === "closed") {
        unlockedCtx = new AudioContext();
      }
      if (unlockedCtx.state === "suspended") {
        unlockedCtx.resume().catch(() => {});
      }
    }
    if (!unlockedAudio) {
      unlockedAudio = new Audio();
      unlockedAudio.setAttribute("playsinline", "true");
    }
    unlockedAudio.muted = true;
    unlockedAudio.volume = 0;
    unlockedAudio.src = SILENT_WAV;
    try {
      const playing = unlockedAudio.play();
      if (playing?.catch) playing.catch(() => {});
    } catch {
      // jsdom and locked autoplay both land here; speak() still tries the MPEG.
    }
  } catch {
    // Unlock is best-effort; speak() still tries play() and fails loud if blocked.
  }
}

export function getUnlockedAudioContext() {
  return unlockedCtx;
}

export function createTtsError(message, { ttsSucceeded = false, missingKeys = false } = {}) {
  const error = new Error(message);
  error.ttsSucceeded = ttsSucceeded;
  error.missingKeys = missingKeys;
  return error;
}

/**
 * Browser TTS is only allowed when ElevenLabs is not configured.
 * After /api/tts 200, never fall back — even if autoplay is blocked.
 */
export function shouldFallBackToBrowserTts(error, { configured = false } = {}) {
  if (configured) return false;
  if (error?.ttsSucceeded) return false;
  if (error?.missingKeys) return true;
  return /ELEVENLABS_API_KEY|must be set|not configured/i.test(String(error?.message || ""));
}

export async function fetchTtsStatus() {
  const response = await fetch(ttsStatusEndpoint(), { method: "GET" });
  if (!response.ok) {
    return { configured: false };
  }
  const body = await response.json().catch(() => ({}));
  return { configured: Boolean(body.configured) };
}

export async function fetchTtsAudio(text) {
  const response = await fetch(ttsEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body.error || `ElevenLabs TTS failed (${response.status})`;
    throw createTtsError(message, {
      missingKeys: /ELEVENLABS_API_KEY|must be set/i.test(message),
    });
  }

  if (!contentType.includes("audio")) {
    throw createTtsError(
      `ElevenLabs TTS returned ${contentType || "no content-type"} instead of audio/mpeg`
    );
  }

  const blob = await response.blob();
  if (!blob.size) {
    throw createTtsError("ElevenLabs TTS returned empty audio");
  }

  console.info("[Scotty voice] ElevenLabs /api/tts 200", contentType || "audio/mpeg");
  return blob;
}
