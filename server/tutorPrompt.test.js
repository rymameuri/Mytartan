/**
 * Tests for tutor mode prompt building
 */

const {
  buildTutorSystemPrompt,
  buildTutorWelcome,
  hasValidCourseContext,
} = require("./tutorPrompt");

describe("tutorPrompt", () => {
  const sampleContext = {
    courseName: "Intro to Computer Science",
    courseCode: "15-112",
    instructor: "Dr. Smith",
    semester: "Spring 2026",
    syllabusText: "Week 1: Functions. Week 2: Loops.",
    additionalNotes: "Midterm covers weeks 1-6.",
  };

  test("hasValidCourseContext requires course name and syllabus", () => {
    expect(hasValidCourseContext(sampleContext)).toBe(true);
    expect(hasValidCourseContext({ courseName: "CS", syllabusText: "topics" })).toBe(true);
    expect(hasValidCourseContext({ courseName: "CS" })).toBe(false);
    expect(hasValidCourseContext({ syllabusText: "topics" })).toBe(false);
    expect(hasValidCourseContext(null)).toBe(false);
  });

  test("buildTutorSystemPrompt includes course materials", () => {
    const prompt = buildTutorSystemPrompt(sampleContext);
    expect(prompt).toMatch(/Intro to Computer Science/);
    expect(prompt).toMatch(/15-112/);
    expect(prompt).toMatch(/Week 1: Functions/);
    expect(prompt).toMatch(/Midterm covers weeks 1-6/);
    expect(prompt).toMatch(/Do NOT give full homework/i);
  });

  test("buildTutorSystemPrompt handles missing context", () => {
    const prompt = buildTutorSystemPrompt(null);
    expect(prompt).toMatch(/No syllabus has been provided/i);
  });

  test("buildTutorSystemPrompt includes student contributions", () => {
    const prompt = buildTutorSystemPrompt({
      courseName: "Intro to CS",
      syllabusText: "Week 6: Recursion",
      contributions: [{ content: "How do I trace recursive calls?" }],
    });
    expect(prompt).toMatch(/STUDENT QUESTIONS & NOTES/i);
    expect(prompt).toMatch(/trace recursive calls/i);
  });

  test("buildTutorSystemPrompt uses studio format only when studioGeneration is true", () => {
    const studioPrompt = buildTutorSystemPrompt(sampleContext, {
      tutorActivity: "flashcards",
      lectureTopic: "Recursion",
      studioGeneration: true,
    });
    expect(studioPrompt).toMatch(/Term:/);
    expect(studioPrompt).toMatch(/STUDIO OUTPUT RULES/i);

    const chatPrompt = buildTutorSystemPrompt(sampleContext, {
      tutorActivity: "flashcards",
      lectureTopic: "Recursion",
      studioGeneration: false,
    });
    expect(chatPrompt).toMatch(/CONVERSATION MODE/i);
    expect(chatPrompt).not.toMatch(/Term:/);
  });

  test("buildTutorSystemPrompt adds lecture help rules for studio item context", () => {
    const prompt = buildTutorSystemPrompt(sampleContext, {
      tutorActivity: "flashcards",
      lectureTopic: "Recursion",
      speechMode: "lecture",
      studioItemContext: {
        activity: "flashcards",
        concept: "base case in recursion",
        term: "What is a base case?",
      },
    });
    expect(prompt).toMatch(/Never read content verbatim/i);
    expect(prompt).toMatch(/STUDIO ITEM HELP/i);
    expect(prompt).toMatch(/do not repeat/i);
    expect(prompt).toMatch(/Socratic question/i);
  });
});
