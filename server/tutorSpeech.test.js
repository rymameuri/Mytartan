const {
  buildSpeechSystemPrompt,
  buildIntroductionPrompt,
  buildLectureSpeechPrompt,
  fallbackIntroductionScript,
  fallbackLectureScript,
  cleanSpeechScript,
  normalizeSpeechMode,
  SPEECH_MODES,
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

  test("fallbackIntroductionScript is activity-specific and brief", () => {
    const script = fallbackIntroductionScript({
      tutorActivity: "flashcards",
      lectureTopic: "Recursion",
    });
    expect(script).toMatch(/flashcard/i);
    expect(script).not.toMatch(/Term:/);
  });

  test("buildIntroductionPrompt forbids reading content aloud", () => {
    const prompt = buildIntroductionPrompt({
      tutorActivity: "flashcards",
      lectureTopic: "Recursion",
      courseName: "15-112",
    });
    expect(prompt).toMatch(/INTRODUCTION/i);
    expect(prompt).toMatch(/Never quote/i);
    expect(prompt).toMatch(/1–2 short sentences/i);
  });

  test("buildLectureSpeechPrompt requires concept teaching and Socratic ending", () => {
    const prompt = buildLectureSpeechPrompt({
      tutorActivity: "quiz",
      lectureTopic: "Recursion",
      courseName: "15-112",
      studioItemContext: {
        concept: "base case in recursion",
        itemLabel: "Quiz question 2 of 5",
      },
    });
    expect(prompt).toMatch(/LECTURE/i);
    expect(prompt).toMatch(/NEVER repeat its exact wording/i);
    expect(prompt).toMatch(/Socratic/i);
    expect(prompt).toMatch(/base case in recursion/);
  });

  test("normalizeSpeechMode maps studioGeneration to introduction", () => {
    expect(normalizeSpeechMode({ speechMode: SPEECH_MODES.introduction })).toBe("introduction");
    expect(normalizeSpeechMode({ studioGeneration: true })).toBe("introduction");
    expect(normalizeSpeechMode({ speechMode: SPEECH_MODES.lecture })).toBe("lecture");
    expect(normalizeSpeechMode({})).toBeNull();
  });

  test("fallbackLectureScript references concept when provided", () => {
    const script = fallbackLectureScript({
      lectureTopic: "Recursion",
      studioItemContext: { concept: "base cases" },
    });
    expect(script).toMatch(/base cases/i);
    expect(script).toMatch(/\?/);
  });

  test("cleanSpeechScript strips markdown", () => {
    expect(cleanSpeechScript("Hello **world**")).toBe("Hello world");
  });
});
