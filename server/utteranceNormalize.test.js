const { normalizeUtterance, looksMessy, applyAsrFixes } = require("./utteranceNormalize");
const { classifyIntent } = require("./intentRouter");

describe("utteranceNormalize", () => {
  test("strips yawns and filler into a usable query", () => {
    const { normalized, messy } = normalizeUtterance(
      "um yawn uh what is stew co at cmu q"
    );
    expect(messy).toBe(true);
    expect(normalized).toMatch(/stuco/i);
    expect(normalized).not.toMatch(/\bum\b/i);
    expect(normalized).not.toMatch(/yawn/i);
  });

  test("fixes common ASR campus misses", () => {
    expect(applyAsrFixes("what is stellar")).toMatch(/stellic/i);
    expect(applyAsrFixes("email the caps cue")).toMatch(/caps-q/i);
    expect(applyAsrFixes("financial aide please")).toMatch(/financial aid/i);
  });

  test("emotional fragments route to support, not a failed academic fact", () => {
    expect(classifyIntent(normalizeUtterance("ugh midterms").normalized)).toMatchObject({
      role: "emotional_support",
      topic: "academic_support",
    });
    expect(classifyIntent(normalizeUtterance("I can't do this").normalized)).toMatchObject({
      role: "emotional_support",
    });
    expect(classifyIntent("When are midterms?").intent).toBe("academic_fact");
  });
});
