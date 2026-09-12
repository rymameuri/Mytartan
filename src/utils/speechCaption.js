const DEFAULT_WORDS_PER_LINE = 7;

export function normalizeSpeechCaption(text) {
  if (!text || typeof text !== "string") return "";
  return text.replace(/\s+/g, " ").trim();
}

export function splitSpeechWords(text) {
  return normalizeSpeechCaption(text).split(" ").filter(Boolean);
}

/** Estimate ms per word from TTS rate (1.0 = default browser speed). */
export function msPerSpeechWord(rate = 1.05) {
  const baseMs = 420;
  return Math.round(baseMs / Math.max(rate, 0.5));
}

export function splitIntoCaptionLines(text, maxWords = DEFAULT_WORDS_PER_LINE) {
  const normalized = normalizeSpeechCaption(text);
  if (!normalized) return [];

  const sentences = normalized.match(/[^.!?]+[.!?]?/g) || [normalized];
  const lines = [];

  for (const sentence of sentences) {
    const words = splitSpeechWords(sentence);
    if (!words.length) continue;
    if (words.length <= maxWords) {
      lines.push(words.join(" "));
      continue;
    }
    for (let i = 0; i < words.length; i += maxWords) {
      lines.push(words.slice(i, i + maxWords).join(" "));
    }
  }

  return lines;
}

export function buildCaptionLineMap(text, maxWords = DEFAULT_WORDS_PER_LINE) {
  const lines = splitIntoCaptionLines(text, maxWords);
  const lineStarts = [];
  let wordCursor = 0;

  for (const line of lines) {
    lineStarts.push(wordCursor);
    wordCursor += splitSpeechWords(line).length;
  }

  return { lines, lineStarts };
}

export function captionForWordIndex(text, wordIndex, maxWords = DEFAULT_WORDS_PER_LINE) {
  const { lines, lineStarts } = buildCaptionLineMap(text, maxWords);
  if (!lines.length) return "";

  const index = Math.max(0, wordIndex);
  let lineIdx = 0;
  for (let i = lineStarts.length - 1; i >= 0; i -= 1) {
    if (index >= lineStarts[i]) {
      lineIdx = i;
      break;
    }
  }

  return lines[Math.min(lineIdx, lines.length - 1)];
}

export function captionForCharIndex(text, charIndex, maxWords = DEFAULT_WORDS_PER_LINE) {
  if (!text) return "";
  const prefix = text.slice(0, Math.max(0, charIndex));
  const wordsSpoken = splitSpeechWords(prefix).length;
  return captionForWordIndex(text, Math.max(0, wordsSpoken - 1), maxWords);
}

/** Map audio clock (0–1) onto the spoken word currently being heard. */
export function wordIndexForPlaybackProgress(wordCount, currentTime, duration) {
  if (!wordCount) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const progress = Math.min(1, Math.max(0, currentTime / duration));
  return Math.min(wordCount - 1, Math.floor(progress * wordCount));
}

export function captionForPlaybackProgress(
  text,
  currentTime,
  duration,
  maxWords = DEFAULT_WORDS_PER_LINE
) {
  const words = splitSpeechWords(text);
  if (!words.length) return "";
  return captionForWordIndex(
    text,
    wordIndexForPlaybackProgress(words.length, currentTime, duration),
    maxWords
  );
}
