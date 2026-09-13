import {
  answersGroundedInSource,
  filterQuizQuestions,
  generateQuizFromSource,
  isBibliographicJunk,
} from "./documentQuiz";
import { detectTeachIntent, extractConcept, teachReaction, tryOpenTeachStudio } from "./teachStudio";

const NOTES = `
Recursion needs a base case so the calls can stop.
The call stack stores active function frames until they return.
A recursive call should move toward the base case, not repeat the same input.
Memoization stores answers so overlapping subproblems are not recomputed.
`;

describe("document quiz flow", () => {
  test("detects quiz-me intent and not a campus-policy dump", () => {
    expect(detectTeachIntent("quiz me on this")).toEqual({ kind: "quiz", concept: "" });
    expect(detectTeachIntent("create a quiz for this")).toEqual({ kind: "quiz", concept: "" });
    expect(detectTeachIntent("create a quiz for this", { hasSource: true })).toEqual({
      kind: "quiz",
      concept: "",
    });
    expect(detectTeachIntent("Where is CaPS?")).toBeNull();
  });

  test("create a quiz for this + document opens a quiz studio", () => {
    const source = { name: "Cresswell 2009_Place.pdf", text: NOTES };
    const result = tryOpenTeachStudio("create a quiz for this", { source });
    expect(result).toBeTruthy();
    expect(result.opened).toBe(true);
    expect(result.kind).toBe("quiz");
    expect(result.studio.kind).toBe("quiz");
    expect(result.studio.sourceName).toBe("Cresswell 2009_Place.pdf");
    expect(result.studio.questions.length).toBeGreaterThanOrEqual(2);
    expect(tryOpenTeachStudio("Where is CaPS?", { source })).toBe(false);
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
    const correct = question.options.find((option) => option.id === question.correct);
    expect(taught.startsWith("Not quite.")).toBe(true);
    expect(taught.length).toBeLessThan(320);
    expect(taught).not.toBe(correct.text);
    expect(taught).not.toContain(correct.text);
  });

  test("rejects citation and affiliation lines from a paper extract", () => {
    const paper = `
Cresswell, Royal Holloway, University of London, Egham, UK & 2009 Elsevier Inc.
© 2009 Elsevier Inc. All rights reserved. doi:10.1016/j.geoforum.2008.07.001
Place is a way of understanding how location becomes meaningful through human practice.
Geography treats place as more than a point on a map.
A sense of place grows from everyday encounters, not from a publisher address.
`;
    expect(isBibliographicJunk("Cresswell, Royal Holloway, University of London, Egham, UK & 2009 Elsevier Inc.")).toBe(
      true
    );
    const quiz = generateQuizFromSource(paper, { sourceName: "Cresswell 2009_Place.pdf", count: 4 });
    expect(quiz.questions.length).toBeGreaterThanOrEqual(2);
    const blob = JSON.stringify(quiz).toLowerCase();
    expect(blob).not.toMatch(/elsevier|royal holloway|egham|doi:10/);
    quiz.questions.forEach((question) => {
      const correct = question.options.find((option) => option.id === question.correct);
      expect(isBibliographicJunk(correct.text)).toBe(false);
      expect(teachReaction(question)).not.toMatch(/elsevier|royal holloway/i);
      expect(teachReaction(question)).not.toContain(correct.text);
    });
    expect(
      filterQuizQuestions([
        {
          text: "Who wrote this?",
          options: [
            { id: "A", text: "Cresswell, Royal Holloway, University of London, Egham, UK & 2009 Elsevier Inc." },
            { id: "B", text: "Place is a way of understanding location." },
          ],
          correct: "A",
          explanation: "Cresswell, Royal Holloway, University of London, Egham, UK & 2009 Elsevier Inc.",
        },
      ])
    ).toHaveLength(0);
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

  test("notes-ready study asks open the matching studio", () => {
    expect(detectTeachIntent("whiteboard this", { hasSource: true }).kind).toBe("mindmap");
    expect(detectTeachIntent("cheat sheet from this", { hasSource: true }).kind).toBe("sheet");
    expect(tryOpenTeachStudio("whiteboard this", { hasSource: true })).toBe(true);
    expect(tryOpenTeachStudio("cheat sheet from this", { hasSource: true })).toBe(true);
  });
});
