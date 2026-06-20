import { stripMarkdownFormatting } from "./stripMarkdown";

describe("stripMarkdownFormatting", () => {
  test("removes bold markdown asterisks", () => {
    expect(stripMarkdownFormatting("Hello **world**")).toBe("Hello world");
  });

  test("removes multiple bold segments", () => {
    expect(stripMarkdownFormatting("**One** and **two**")).toBe("One and two");
  });

  test("removes inline code backticks", () => {
    expect(stripMarkdownFormatting("Use `recursion` here")).toBe("Use recursion here");
  });

  test("returns empty string for invalid input", () => {
    expect(stripMarkdownFormatting(null)).toBe("");
  });
});
