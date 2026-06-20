import {
  parseFlashcards,
  parseQuizQuestions,
  parseWhiteboardClusters,
  normalizeQuizText,
} from "./parseStudyOutput";

describe("parseStudyOutput", () => {
  test("parseFlashcards extracts front/back pairs", () => {
    const text = `Front: What is recursion?
Back: A function that calls itself

Front: Base case
Back: The stopping condition`;
    const cards = parseFlashcards(text);
    expect(cards).toHaveLength(2);
    expect(cards[0].front).toMatch(/recursion/i);
  });

  test("parseQuizQuestions extracts multiple-choice questions", () => {
    const text = `1. What is a base case?
A) The first line of code
B) The stopping condition for recursion
C) A type of loop
D) An error handler
Correct: B
Explanation: Recursion needs a base case to stop.

2. What does the call stack track?
A) Memory leaks
B) Active function calls
C) File handles
D) Network packets
Correct: B
Explanation: Each call is pushed onto the stack.`;
    const questions = parseQuizQuestions(text);
    expect(questions).toHaveLength(2);
    expect(questions[0].text).toMatch(/base case/i);
    expect(questions[0].options).toHaveLength(4);
    expect(questions[0].correct).toBe("B");
    expect(questions[0].explanation).toMatch(/Recursion needs/i);
    expect(questions[1].options[1].text).toMatch(/Active function calls/i);
  });

  test("parseQuizQuestions handles dense single-block LLM output", () => {
    const text = `Here's your quiz! 1. What is cyberspace? A) A physical place B) A digital environment C) A network cable D) A browser Correct: B Explanation: Cyberspace is the digital realm. 2. Who wrote about digital law? A) Dan Geer B) Alan Turing C) Tim Berners-Lee D) Ada Lovelace Correct: A Explanation: Geer discussed physics of digital law.`;
    const questions = parseQuizQuestions(text);
    expect(questions.length).toBeGreaterThanOrEqual(2);
    expect(questions[0].options).toHaveLength(4);
    expect(questions[0].correct).toBe("B");
    expect(normalizeQuizText(text)).toMatch(/\n1\. /);
  });

  test("parseWhiteboardClusters extracts clusters", () => {
    const text = `Cluster: Core ideas
- recursion
- base case

Cluster: Examples
- factorial`;
    const clusters = parseWhiteboardClusters(text);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].bullets).toContain("recursion");
  });
});
