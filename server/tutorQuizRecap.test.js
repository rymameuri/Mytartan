const {
  buildQuizRecapSystemPrompt,
  parseQuizRecapResponse,
  fallbackQuizRecap,
  formatQuizResultsSummary,
} = require("./tutorQuizRecap");

describe("tutorQuizRecap", () => {
  const sampleResults = {
    score: 1,
    total: 2,
    results: [
      {
        question: "What is a base case?",
        selectedText: "Stopping condition",
        correctText: "Stopping condition",
        isCorrect: true,
        explanation: "Recursion must terminate.",
      },
      {
        question: "What is the call stack?",
        selectedText: "Memory",
        correctText: "Active calls",
        isCorrect: false,
        explanation: "Tracks function calls.",
      },
    ],
  };

  test("buildQuizRecapSystemPrompt mentions score analysis", () => {
    const prompt = buildQuizRecapSystemPrompt({
      lectureTopic: "Recursion",
      courseName: "15-112",
    });
    expect(prompt).toMatch(/quiz/i);
    expect(prompt).toMatch(/Recursion/);
    expect(prompt).toMatch(/---SPEECH---/);
  });

  test("parseQuizRecapResponse splits chat and speech sections", () => {
    const parsed = parseQuizRecapResponse(
      "You scored 4 out of 5.\n\nReview loops.\n---SPEECH---\nNice job on loops."
    );
    expect(parsed.analysis).toMatch(/You scored 4 out of 5/);
    expect(parsed.speech).toBe("Nice job on loops.");
  });

  test("fallbackQuizRecap mentions missed questions", () => {
    const recap = fallbackQuizRecap({
      quizResults: sampleResults,
      lectureTopic: "Recursion",
      courseName: "15-112",
    });
    expect(recap.analysis).toMatch(/1 out of 2/);
    expect(recap.speech).toMatch(/1 out of 2/);
    expect(recap.analysis).toMatch(/missed/i);
  });

  test("formatQuizResultsSummary includes correctness", () => {
    const summary = formatQuizResultsSummary(sampleResults.results);
    expect(summary).toMatch(/Correct/);
    expect(summary).toMatch(/Incorrect/);
  });
});
