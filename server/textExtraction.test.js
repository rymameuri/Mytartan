const { extractTextFromBuffer } = require("./textExtraction");

describe("textExtraction", () => {
  test("extracts plain text files", async () => {
    const result = await extractTextFromBuffer(Buffer.from("Hello syllabus"), "notes.txt");
    expect(result.text).toBe("Hello syllabus");
  });

  test("skips unsupported extensions", async () => {
    const result = await extractTextFromBuffer(Buffer.from("data"), "photo.png");
    expect(result.skipReason).toMatch(/Unsupported file type/i);
  });

  test("skips empty text files", async () => {
    const result = await extractTextFromBuffer(Buffer.from("   "), "empty.md");
    expect(result.skipReason).toMatch(/Empty text file/i);
  });
});
