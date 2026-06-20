import {
  tutorSpeechFallback,
  briefSpeechFromReply,
  isStructuredStudioContent,
  resolveTutorSpeech,
} from "./tutorSpeechFallback";

test("tutorSpeechFallback returns activity-specific script", () => {
  const text = tutorSpeechFallback({
    tutorActivity: "quiz",
    lectureTopic: "Recursion",
    courseName: "15-122",
  });
  expect(text).toMatch(/quiz/i);
  expect(text).toMatch(/Recursion/);
});

test("isStructuredStudioContent detects flashcard output", () => {
  const text = `Front: What is cyberspace?
Back: A digital environment`;
  expect(isStructuredStudioContent(text)).toBe(true);
  expect(isStructuredStudioContent("Let's talk about privacy.")).toBe(false);
});

test("resolveTutorSpeech never returns flashcard body for studio generation", () => {
  const speech = resolveTutorSpeech({
    pendingSpeech: "Front: foo Back: bar",
    reply: `Front: What is cyberspace?
Back: A digital environment`,
    isStudioGeneration: true,
    tutorActivity: "flashcards",
    lectureTopic: "Security",
  });
  expect(speech).toMatch(/Studio/i);
  expect(speech).not.toMatch(/Front/i);
  expect(speech).not.toMatch(/Back/i);
});

test("briefSpeechFromReply trims long replies", () => {
  const long = "A".repeat(250);
  expect(briefSpeechFromReply(long).length).toBeLessThanOrEqual(200);
});

test("briefSpeechFromReply skips structured studio lines", () => {
  const text = `Term: Cyberspace
Answer: A digital environment
Let's start with the core idea of privacy.`;
  expect(briefSpeechFromReply(text)).toMatch(/core idea of privacy/i);
});
