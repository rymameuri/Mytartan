import {
  normalizeSpeechCaption,
  splitSpeechWords,
  splitIntoCaptionLines,
  captionForWordIndex,
  captionForCharIndex,
  wordIndexForPlaybackProgress,
  captionForPlaybackProgress,
  speechWordWeight,
  msForCaptionStep,
} from "./speechCaption";

test("normalizeSpeechCaption collapses whitespace", () => {
  expect(normalizeSpeechCaption("  Hello   world  ")).toBe("Hello world");
});

test("normalizeSpeechCaption hides ElevenLabs break tags", () => {
  expect(normalizeSpeechCaption('Okay. <break time="0.4s"/> Next beat.')).toBe("Okay. Next beat.");
});

test("sentence-ending words hold longer in captions", () => {
  expect(speechWordWeight("Building.")).toBeGreaterThan(speechWordWeight("library"));
  expect(msForCaptionStep("Building.", 400)).toBeGreaterThan(msForCaptionStep("library", 400));
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

test("captionForWordIndex grows the current line up to the spoken word", () => {
  const text =
    "Professor Nui? Where do I even begin! She is nothing short of extraordinary.";
  const first = captionForWordIndex(text, 0);
  const mid = captionForWordIndex(text, 8);
  expect(first).toBe("Professor");
  expect(first).not.toMatch(/Where do I/i);
  expect(mid).toBe("She is");
  expect(mid).not.toMatch(/extraordinary/i);
});

test("captionForCharIndex maps spoken position to words heard so far", () => {
  const text = "One two three four five six seven eight nine ten eleven twelve.";
  const early = captionForCharIndex(text, 3);
  const later = captionForCharIndex(text, 50);
  expect(early).toBe("One");
  expect(later).toMatch(/^eight nine ten/);
  expect(later).not.toMatch(/twelve/i);
});

test("splitSpeechWords handles empty input", () => {
  expect(splitSpeechWords("")).toEqual([]);
});

test("wordIndexForPlaybackProgress tracks audio clock", () => {
  expect(wordIndexForPlaybackProgress(12, 0, 10, 0)).toBe(0);
  expect(wordIndexForPlaybackProgress(12, 5, 10, 0)).toBe(6);
  expect(wordIndexForPlaybackProgress(12, 10, 10, 0)).toBe(11);
  expect(wordIndexForPlaybackProgress(12, 0, NaN)).toBe(0);
});

test("wordIndexForPlaybackProgress lags behind the audio clock", () => {
  expect(wordIndexForPlaybackProgress(12, 5, 10, 0.28)).toBe(5);
  expect(wordIndexForPlaybackProgress(12, 0.2, 10)).toBe(0);
});

test("weighted playback progress holds on a sentence stop", () => {
  const words = ["Library", "first.", "Poetry", "Garden", "next."];
  const weights = words.map(speechWordWeight);
  expect(
    wordIndexForPlaybackProgress(words.length, 1.2, 10, 0, weights)
  ).toBeLessThanOrEqual(1);
});

test("captionForPlaybackProgress only shows words already spoken", () => {
  const text = "One two three four five six seven eight nine ten eleven twelve.";
  expect(captionForPlaybackProgress(text, 0, 10)).toBe("One");
  expect(captionForPlaybackProgress(text, 8, 10)).toBe("eight nine ten");
});
