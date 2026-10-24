import { assistantUnavailableMessage, formatDemoReply, matchDemoAnswer } from "./demoAnswers";

test("matches the TAFAWQ GPA question to the saved fact", () => {
  const match = matchDemoAnswer("What GPA do I need for TAFAWQ?");
  expect(match.id).toBe("tafawq-gpa");
  expect(match.answer).toMatch(/4\.0/);
});

test("does not treat an unrelated question as a saved fact", () => {
  expect(matchDemoAnswer("Who is the president of France?")).toBeNull();
});

test("labels a fallback reply as a saved fact", () => {
  const reply = formatDemoReply(matchDemoAnswer("How do I connect to CMUQ-SECURE WiFi?"));
  expect(reply).toMatch(/CMUQ-SECURE/);
  expect(reply).toMatch(/not a generated reply/i);
});

test("the outage message does not tell the presenter to start npm", () => {
  expect(assistantUnavailableMessage()).not.toMatch(/npm/);
});
