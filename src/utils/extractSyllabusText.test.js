import fs from "fs";
import path from "path";
import { extractSyllabusText } from "./extractSyllabusText";

jest.mock("pdfjs-dist", () => ({
  version: "4.10.38",
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({
        getTextContent: async () => ({
          items: [{ str: "CMU-Q 15-112 Fundamentals of Programming" }, { str: "Recursion" }],
        }),
      }),
    }),
  }),
}));

jest.mock("mammoth", () => ({
  extractRawText: jest.fn(async () => ({
    value: "CMU-Q 15-112 Syllabus\nWeek 6: Recursion",
  })),
}));

function makeFile(content, name, type = "text/plain") {
  return new File([content], name, { type });
}

describe("extractSyllabusText", () => {
  test("reads plain text files", async () => {
    const file = makeFile("Week 1: Intro\nWeek 2: Loops", "syllabus.txt");
    const text = await extractSyllabusText(file);
    expect(text).toMatch(/Week 1: Intro/);
  });

  test("rejects unsupported file types", async () => {
    const file = makeFile("data", "notes.doc", "application/msword");
    await expect(extractSyllabusText(file)).rejects.toThrow(/Unsupported file type/i);
  });

  test("rejects oversized text files", async () => {
    const big = "x".repeat(3 * 1024 * 1024);
    const file = makeFile(big, "big.txt");
    await expect(extractSyllabusText(file)).rejects.toThrow(/too large/i);
  });

  test("extracts text from PDF files", async () => {
    const file = makeFile("%PDF-sample", "sample-syllabus.pdf", "application/pdf");
    const text = await extractSyllabusText(file);
    expect(text).toMatch(/Fundamentals of Programming/i);
    expect(text).toMatch(/Recursion/i);
  });

  test("extracts text from Word docx files", async () => {
    const file = makeFile("docx-bytes", "syllabus.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    const text = await extractSyllabusText(file);
    expect(text).toMatch(/15-112 Syllabus/i);
    expect(text).toMatch(/Recursion/i);
  });

  test("sample demo PDF exists for manual upload demos", () => {
    const pdfPath = path.join(__dirname, "../../public/samples/sample-syllabus.pdf");
    expect(fs.existsSync(pdfPath)).toBe(true);
    expect(fs.statSync(pdfPath).size).toBeGreaterThan(100);
  });
});
