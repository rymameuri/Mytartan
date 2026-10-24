import { nextSpeakablePiece } from "./speakableChunks";

test("waits until a sentence is long enough to speak", () => {
  expect(nextSpeakablePiece("Hi. ", 0)).toBeNull();
});

test("returns the first finished sentence and keeps the rest", () => {
  const text = "TAFAWQ requires a 4.0 GPA. The fee is separate.";
  const first = nextSpeakablePiece(text, 0);
  expect(first.text).toBe("TAFAWQ requires a 4.0 GPA.");
  const second = nextSpeakablePiece(text, first.end, { flush: true });
  expect(second.text).toBe("The fee is separate.");
});

test("flushes a short tail when the reply is done", () => {
  const text = "Ask the registrar.";
  expect(nextSpeakablePiece(text, 0)).toBeNull();
  expect(nextSpeakablePiece(text, 0, { flush: true }).text).toBe("Ask the registrar.");
});
