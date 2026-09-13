import { detectTeachIntent } from "./teachStudio";
import { resolveCourseFlavor } from "./courseFlavor";
import {
  detectSheetKind,
  generateStudySheet,
  normalizeStudySheet,
  sheetToPlainText,
  visibleSheetSections,
} from "./studySheet";

const NOTES = `
Recursion needs a base case so the calls can stop.
The call stack stores active function frames until they return.
A recursive call must move toward the base case, not repeat the same input.
Memoization stores answers so overlapping subproblems are not recomputed.
Off-by-one errors on slices are easy to miss on an autograder.
`;

describe("cheat-sheet generation shape", () => {
  test("detects cheat-sheet / study-guide asks", () => {
    expect(detectTeachIntent("make a CMU-style cheat sheet").kind).toBe("sheet");
    expect(detectTeachIntent("condense this into a study guide").kind).toBe("sheet");
    expect(detectSheetKind("formula sheet please")).toBe("formula-sheet");
    expect(detectSheetKind("exam review from these slides")).toBe("exam-review");
  });

  test("builds tight sections grounded in the notes", () => {
    const sheet = generateStudySheet(NOTES, {
      sourceName: "15-112-recursion.pptx",
      major: "Computer Science",
      kind: "cheatsheet",
      density: "dense",
    });
    expect(sheet.kind).toBe("cheatsheet");
    expect(sheet.courseCode).toBe("15-112");
    expect(sheet.courseLabel).toBe("15-112");
    expect(sheet.disclaimer.toLowerCase()).toMatch(/not an official past paper/);
    expect(sheet.sections.length).toBeGreaterThanOrEqual(3);
    sheet.sections.forEach((section) => {
      expect(section).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          title: expect.any(String),
          items: expect.any(Array),
          narration: expect.any(String),
        })
      );
      expect(section.items.length).toBeGreaterThan(0);
    });
    const blob = JSON.stringify(sheet).toLowerCase();
    expect(blob).toMatch(/base case|call stack|memoization/);
    expect(blob).not.toMatch(/fall 20\d\d exam|official past paper q\d|midterm 2019/);
  });

  test("gentle density keeps fewer items than dense", () => {
    const dense = generateStudySheet(NOTES, { sourceName: "notes.txt", density: "dense" });
    const gentle = generateStudySheet(NOTES, { sourceName: "notes.txt", density: "gentle" });
    const count = (sheet) => sheet.sections.reduce((sum, section) => sum + section.items.length, 0);
    expect(count(gentle)).toBeLessThanOrEqual(count(dense));
  });

  test("reveals sections stepwise and exports plain text", () => {
    const sheet = generateStudySheet(NOTES, { sourceName: "notes.txt" });
    const first = visibleSheetSections(sheet, 0);
    expect(first.visibleSections).toHaveLength(1);
    const last = visibleSheetSections(sheet, 99);
    expect(last.visibleSections.length).toBe(sheet.sections.length);
    const text = sheetToPlainText(sheet);
    expect(text).toMatch(/KEY DEFINITIONS|GOTCHAS/i);
    expect(text).toMatch(/not official/i);
  });

  test("normalizeStudySheet drops empty sections", () => {
    const sheet = normalizeStudySheet({
      title: "X",
      sections: [{ title: "Empty", items: [] }, { title: "Keep", items: [{ body: "A precise definition." }] }],
    });
    expect(sheet.sections).toHaveLength(1);
    expect(sheet.sections[0].title).toBe("Keep");
  });

  test("filename and major bias CMU course flavor", () => {
    const cs = resolveCourseFlavor({
      sourceName: "15-213-bomb-lab.pdf",
      sourceText: "The stack stores return addresses.",
      major: "Computer Science",
    });
    expect(cs.label).toBe("15-213");
    const is = resolveCourseFlavor({
      sourceName: "requirements.pptx",
      sourceText: "Stakeholder needs drive the process model.",
      major: "Information Systems",
    });
    expect(is.id).toBe("is");
  });
});
