import { tutorSpeechFallback, briefSpeechFromReply } from "./tutorSpeechFallback";

test("tutorSpeechFallback returns activity-specific script", () => {
  const text = tutorSpeechFallback({
    tutorActivity: "quiz",
    lectureTopic: "Recursion",
    courseName: "15-122",
  });
  expect(text).toMatch(/quiz/i);
  expect(text).toMatch(/Recursion/);
});

test("briefSpeechFromReply trims long replies", () => {
  const long = "A".repeat(250);
  expect(briefSpeechFromReply(long).length).toBeLessThanOrEqual(200);
});
