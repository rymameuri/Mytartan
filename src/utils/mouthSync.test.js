import { computeRms, mouthFromAmplitude, smoothAmplitude } from "./mouthSync";

test("computeRms is 0 for silence", () => {
  expect(computeRms(new Uint8Array(8).fill(128))).toBe(0);
  expect(computeRms([])).toBe(0);
});

test("computeRms rises with louder samples", () => {
  const quiet = new Uint8Array([128, 130, 126, 129]);
  const loud = new Uint8Array([128, 200, 40, 210]);
  expect(computeRms(loud)).toBeGreaterThan(computeRms(quiet));
});

test("mouth stays closed on silence and opens as level rises", () => {
  expect(mouthFromAmplitude(0)).toBe("closed");
  expect(mouthFromAmplitude(0.06, "closed")).toBe("small");
  expect(mouthFromAmplitude(0.2, "small")).toBe("wide");
});

test("hysteresis keeps a wide mouth from collapsing on a tiny dip", () => {
  expect(mouthFromAmplitude(0.11, "wide")).toBe("wide");
  expect(mouthFromAmplitude(0.08, "wide")).toBe("small");
  expect(mouthFromAmplitude(0.01, "small")).toBe("closed");
});

test("smoothAmplitude eases toward the next sample", () => {
  expect(smoothAmplitude(0, 1, 0.5)).toBe(0.5);
  expect(smoothAmplitude(0.5, 0.5, 0.4)).toBe(0.5);
});
