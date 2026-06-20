import { clamp } from "./usePaneResize";

export { clamp };

describe("usePaneResize clamp helper", () => {
  test("clamps values within bounds", () => {
    expect(clamp(500, { min: 220, max: 440 })).toBe(440);
    expect(clamp(100, { min: 220, max: 440 })).toBe(220);
    expect(clamp(300, { min: 220, max: 440 })).toBe(300);
  });
});
