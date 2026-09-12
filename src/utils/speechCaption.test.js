import {
  normalizeSpeechCaption,
  splitSpeechWords,
  splitIntoCaptionLines,
  captionForWordIndex,
  captionForCharIndex,
  wordIndexForPlaybackProgress,
  captionForPlaybackProgress,
} from "./speechCaption";

test("normalizeSpeechCaption collapses whitespace", () => {
  expect(normalizeSpeechCaption("  Hello   world  ")).toBe("Hello world");
});

test("splitIntoCaptionLines keeps short sentences on one line", () => {
  expect(splitIntoCaptionLines("Hello world.")).toEqual(["Hello world."]);
});

test("splitIntoCaptionLines breaks long speech into chunks", () => {
  const text =
    "Professor Nui? Where do I even begin! She is nothing short of extraordinary.";
  const lines = splitIntoCaptionLines(text, 7);
  expect(lines.length).toBeGreaterThan(1);
  lines.forEach((line) => {
    expect(splitSpeechWords(line).length).toBeLessThanOrEqual(7);
  });
});

test("captionForWordIndex swaps lines instead of growing prefix", () => {
  const text =
    "Professor Nui? Where do I even begin! She is nothing short of extraordinary.";
  const first = captionForWordIndex(text, 0);
  const mid = captionForWordIndex(text, 8);
  expect(first).not.toBe(mid);
  expect(first).not.toMatch(/extraordinary/i);
  expect(mid).not.toMatch(/^Professor Nui\? Where do I even begin! She is nothing$/);
});

test("captionForCharIndex maps spoken position to current line", () => {
  const text = "One two three four five six seven eight nine ten eleven twelve.";
  const early = captionForCharIndex(text, 5);
  const later = captionForCharIndex(text, 50);
  expect(early).toBe("One two three four five six seven");
  expect(later).toBe("eight nine ten eleven twelve.");
});

test("splitSpeechWords handles empty input", () => {
  expect(splitSpeechWords("")).toEqual([]);
});

test("wordIndexForPlaybackProgress tracks audio clock", () => {
  expect(wordIndexForPlaybackProgress(12, 0, 10)).toBe(0);
  expect(wordIndexForPlaybackProgress(12, 5, 10)).toBe(6);
  expect(wordIndexForPlaybackProgress(12, 10, 10)).toBe(11);
  expect(wordIndexForPlaybackProgress(12, 0, NaN)).toBe(0);
});

test("captionForPlaybackProgress stays on the spoken line", () => {
  const text = "One two three four five six seven eight nine ten eleven twelve.";
  expect(captionForPlaybackProgress(text, 0, 10)).toBe(
    "One two three four five six seven"
  );
  expect(captionForPlaybackProgress(text, 8, 10)).toBe(
    "eight nine ten eleven twelve."
  );
});
