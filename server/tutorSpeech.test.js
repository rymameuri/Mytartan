const {
  buildSpeechSystemPrompt,
  buildStudioOrientationPrompt,
  fallbackSpeechScript,
  cleanSpeechScript,
} = require("./tutorSpeech");

describe("tutorSpeech", () => {
  test("buildSpeechSystemPrompt mentions activity and topic", () => {
    const prompt = buildSpeechSystemPrompt({
      tutorActivity: "flashcards",
      lectureTopic: "Recursion",
      courseName: "15-112",
    });
    expect(prompt).toMatch(/flashcards/i);
    expect(prompt).toMatch(/Recursion/);
    expect(prompt).toMatch(/voice-only/i);
  });

  test("fallbackSpeechScript is activity-specific", () => {
    expect(fallbackSpeechScript({ tutorActivity: "quiz", lectureTopic: "Loops" })).toMatch(/quiz/i);
    expect(fallbackSpeechScript({ tutorActivity: "whiteboard", lectureTopic: "Security" })).toMatch(
      /whiteboard|mapped/i
    );
    expect(fallbackSpeechScript({ tutorActivity: "flashcards", lectureTopic: "Privacy" })).toMatch(
      /Studio/i
    );
  });

  test("buildStudioOrientationPrompt forbids reading content aloud", () => {
    const prompt = buildStudioOrientationPrompt({
      tutorActivity: "flashcards",
      lectureTopic: "Recursion",
      courseName: "15-112",
    });
    expect(prompt).toMatch(/ORIENT/i);
    expect(prompt).toMatch(/Never quote flashcard/i);
  });

  test("cleanSpeechScript strips markdown", () => {
    expect(cleanSpeechScript("Hello **world**")).toBe("Hello world");
  });
});
