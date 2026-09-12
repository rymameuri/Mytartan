export const FACIAL_ALIGN_STORAGE_KEY = "scotty-facial-align-v2";
export const FACIAL_COORDS_EVENT = "scotty-facial-coords";

export const DEFAULT_FACIAL_COORDS = {
  eyeTop: 37,
  eyeLeft: 34.7,
  eyeRight: 31.9,
  eyeWidth: 7.6,
  mouthTop: 62.4,
  mouthLeft: 51.3,
  mouthWidth: 11.6,
  mouthHeight: 7.5,
};

function round1(n) {
  return Math.round(n * 10) / 10;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function readCoord(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return round1(clamp(n, min, max));
}

export function normalizeFacialCoords(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    eyeTop: readCoord(source.eyeTop, DEFAULT_FACIAL_COORDS.eyeTop, 0, 100),
    eyeLeft: readCoord(source.eyeLeft, DEFAULT_FACIAL_COORDS.eyeLeft, 0, 100),
    eyeRight: readCoord(source.eyeRight, DEFAULT_FACIAL_COORDS.eyeRight, 0, 100),
    eyeWidth: readCoord(source.eyeWidth, DEFAULT_FACIAL_COORDS.eyeWidth, 2, 20),
    mouthTop: readCoord(source.mouthTop, DEFAULT_FACIAL_COORDS.mouthTop, 0, 100),
    mouthLeft: readCoord(source.mouthLeft, DEFAULT_FACIAL_COORDS.mouthLeft, 0, 100),
    mouthWidth: readCoord(source.mouthWidth, DEFAULT_FACIAL_COORDS.mouthWidth, 3, 40),
    mouthHeight: readCoord(source.mouthHeight, DEFAULT_FACIAL_COORDS.mouthHeight, 1.5, 30),
  };
}

export function loadFacialCoords() {
  try {
    const raw = localStorage.getItem(FACIAL_ALIGN_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FACIAL_COORDS };
    return normalizeFacialCoords(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_FACIAL_COORDS };
  }
}

export function saveFacialCoords(coords) {
  const next = normalizeFacialCoords(coords);
  localStorage.setItem(FACIAL_ALIGN_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(FACIAL_COORDS_EVENT));
  return next;
}

export function clearFacialCoords() {
  localStorage.removeItem(FACIAL_ALIGN_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(FACIAL_COORDS_EVENT));
  return { ...DEFAULT_FACIAL_COORDS };
}

export function facialCoordsToStyle(coords) {
  const c = normalizeFacialCoords(coords);
  return {
    "--scotty-eye-top": `${c.eyeTop}%`,
    "--scotty-eye-left": `${c.eyeLeft}%`,
    "--scotty-eye-right": `${c.eyeRight}%`,
    "--scotty-eye-width": `${c.eyeWidth}%`,
    "--scotty-mouth-left": `${c.mouthLeft}%`,
    "--scotty-mouth-top": `${c.mouthTop}%`,
    "--scotty-mouth-width": `${c.mouthWidth}%`,
    "--scotty-mouth-height": `${c.mouthHeight}%`,
  };
}

export function buildFacialCss(coords) {
  const c = normalizeFacialCoords(coords);
  return `/* Locked facial coordinates — paste into ScottyAvatar.css */
.scotty-avatar {
  --scotty-eye-top: ${c.eyeTop}%;
  --scotty-eye-left: ${c.eyeLeft}%;
  --scotty-eye-right: ${c.eyeRight}%;
  --scotty-eye-width: ${c.eyeWidth}%;
  --scotty-mouth-left: ${c.mouthLeft}%;
  --scotty-mouth-top: ${c.mouthTop}%;
  --scotty-mouth-width: ${c.mouthWidth}%;
  --scotty-mouth-height: ${c.mouthHeight}%;
}`;
}
