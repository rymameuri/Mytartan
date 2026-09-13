import { answersGroundedInSource, generateQuizFromSource } from "./documentQuiz";
import { detectTeachIntent, extractConcept, teachReaction } from "./teachStudio";

const NOTES = `
Recursion needs a base case so the calls can stop.
The call stack stores active function frames until they return.
A recursive call should move toward the base case, not repeat the same input.
Memoization stores answers so overlapping subproblems are not recomputed.
`;

describe("document quiz flow", () => {
  test("detects quiz-me intent and not a campus-policy dump", () => {
    expect(detectTeachIntent("quiz me on this")).toEqual({ kind: "quiz", concept: "" });
    expect(detectTeachIntent("Where is CaPS?")).toBeNull();
  });

  test("builds one-at-a-time MCQs grounded in the uploaded notes", () => {
    const quiz = generateQuizFromSource(NOTES, { sourceName: "recursion.txt", count: 4 });
    expect(quiz.questions.length).toBeGreaterThanOrEqual(2);
    expect(quiz.title).toMatch(/recursion\.txt/i);
    quiz.questions.forEach((question) => {
      expect(question.options.length).toBeGreaterThanOrEqual(2);
      expect(question.options.map((option) => option.id)).toContain(question.correct);
      expect(question.text.toLowerCase()).not.toMatch(/caps|add\/drop|financial aid/);
    });
    expect(answersGroundedInSource(quiz.questions, NOTES)).toBe(true);
  });

  test("refuses to invent a quiz from empty or campus-less text", () => {
    expect(generateQuizFromSource("Hi", { sourceName: "tiny.txt" }).questions).toHaveLength(0);
    expect(generateQuizFromSource("", { sourceName: "empty" }).error).toBe("not_enough_text");
  });

  test("wrong-answer teaching uses the question, not a chat dump", () => {
    const quiz = generateQuizFromSource(NOTES, { count: 1 });
    const question = quiz.questions[0];
    const taught = teachReaction(question);
    expect(taught.startsWith("Not quite.")).toBe(true);
    expect(taught.length).toBeLessThan(320);
  });
});

describe("teach intent", () => {
  test("whiteboard and struggle open a mind-map, not a quiz", () => {
    expect(detectTeachIntent("whiteboard recursion").kind).toBe("mindmap");
    expect(extractConcept("whiteboard recursion")).toBe("recursion");
    expect(detectTeachIntent("I don't understand binary search")).toMatchObject({
      kind: "mindmap",
      struggle: true,
      concept: "binary search",
    });
  });

  test("explain this with notes opens a mind-map", () => {
    expect(detectTeachIntent("can you explain this", { hasSource: true }).kind).toBe("mindmap");
    expect(detectTeachIntent("can you explain this", { hasSource: false })).toBeNull();
  });
});
