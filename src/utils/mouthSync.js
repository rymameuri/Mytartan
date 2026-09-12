export const MOUTH_STATES = ["closed", "small", "wide"];

const ENTER_SMALL = 0.042;
const ENTER_WIDE = 0.125;
const LEAVE_SMALL = 0.028;
const LEAVE_WIDE = 0.1;
const SMOOTH_ALPHA = 0.45;

export function computeRms(bytes) {
  if (!bytes?.length) return 0;
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    const normalized = (bytes[i] - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / bytes.length);
}

export function smoothAmplitude(previous, next, alpha = SMOOTH_ALPHA) {
  if (!Number.isFinite(previous)) return next;
  if (!Number.isFinite(next)) return previous;
  return previous + (next - previous) * alpha;
}

/**
 * Map smoothed speech amplitude to the three cartoon mouth frames.
 * Hysteresis keeps the mouth from flickering on every sample.
 */
export function mouthFromAmplitude(level, previous = "closed") {
  const amplitude = Number.isFinite(level) ? level : 0;

  if (previous === "wide") {
    if (amplitude < LEAVE_SMALL) return "closed";
    if (amplitude < LEAVE_WIDE) return "small";
    return "wide";
  }

  if (previous === "small") {
    if (amplitude < LEAVE_SMALL) return "closed";
    if (amplitude >= ENTER_WIDE) return "wide";
    return "small";
  }

  if (amplitude >= ENTER_WIDE) return "wide";
  if (amplitude >= ENTER_SMALL) return "small";
  return "closed";
}
