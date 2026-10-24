/**
 * Pull the next finished sentence so speech can start before the full reply lands.
 * `fromIndex` is how much of `text` has already been spoken.
 */
function nextSpeakablePiece(text, fromIndex = 0, { flush = false, minChars = 24 } = {}) {
  const source = String(text || "");
  const rest = source.slice(fromIndex);
  if (!rest.trim()) return null;

  const match = rest.match(/[\s\S]*?[.!?]+(?:\s+|$)/);
  if (match) {
    const raw = match[0];
    const spoken = raw.trim();
    if (spoken.length >= minChars) {
      return { text: spoken, end: fromIndex + raw.length };
    }
  }

  if (flush) {
    const spoken = rest.trim();
    if (spoken.length >= 12) {
      return { text: spoken, end: source.length };
    }
  }

  return null;
}

export { nextSpeakablePiece };
