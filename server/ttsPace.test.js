const { SENTENCE_BREAK, paceTtsText } = require("./ttsPace");

describe("paceTtsText", () => {
  test("inserts a short break between sentences and not after the last", () => {
    const paced = paceTtsText("The library is in the Academic Building. Poetry Garden is quieter.");
    expect(paced).toContain(SENTENCE_BREAK);
    expect(paced.startsWith("The library")).toBe(true);
    expect(paced.endsWith("quieter.")).toBe(true);
    expect(paced.match(/<break /g)).toHaveLength(1);
  });

  test("turns clause dashes into sentence stops, not commas", () => {
    const paced = paceTtsText("Yeah — club fair Thursday on the green.");
    expect(paced).toMatch(/Yeah\./);
    expect(paced).not.toMatch(/Yeah,/);
    expect(paced).toContain(SENTENCE_BREAK);
  });

  test("leaves hyphenated campus names alone", () => {
    expect(paceTtsText("CMU-Q need-based aid is through QF.")).toMatch(/CMU-Q need-based aid/);
    expect(paceTtsText("Weeks 1–2 cover loops.")).toMatch(/Weeks 1 to 2 cover loops/);
  });

  test("does not stack break tags", () => {
    const once = paceTtsText("Okay. Next beat.");
    const twice = paceTtsText(once);
    expect(twice.match(/<break /g)).toHaveLength(1);
  });
});
