const { chunkMaterial, stripHtml, buildMaterialEntries } = require("./canvasImportService");

describe("canvasImportService helpers", () => {
  test("stripHtml removes tags", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  test("chunkMaterial splits long content", () => {
    const long = "a".repeat(9000);
    const chunks = chunkMaterial("Lecture", long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].title).toBe("Lecture (Part 1)");
    expect(chunks[1].title).toContain("Part 2");
  });

  test("buildMaterialEntries assigns external ids to chunks", () => {
    const entries = buildMaterialEntries("Doc", "a".repeat(9000), "canvas:file:9");
    expect(entries[0].externalItemId).toBe("canvas:file:9");
    expect(entries[1].externalItemId).toBe("canvas:file:9:part:2");
  });
});
