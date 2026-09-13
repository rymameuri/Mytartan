import { STARTER_CHIPS, orderStarterChips } from "./starterChips";

describe("orderStarterChips", () => {
  test("defaults to the solid campus set with a mood chip first", () => {
    const chips = orderStarterChips();
    expect(chips.map((chip) => chip.id)).toEqual(STARTER_CHIPS.map((chip) => chip.id));
    expect(chips[0].id).toBe("stressed");
    expect(chips.some((chip) => chip.tags.includes("mood"))).toBe(true);
  });

  test("puts mood chips first when onboarding was about talking", () => {
    const chips = orderStarterChips({ intendedUse: "Someone to talk to" });
    expect(chips[0].tags).toContain("mood");
    expect(chips.some((chip) => chip.id === "stressed")).toBe(true);
  });

  test("puts campus chips first for finding your way around", () => {
    const chips = orderStarterChips({ intendedUse: "Finding my way around campus" });
    expect(chips[0].tags).toContain("campus");
  });
});
