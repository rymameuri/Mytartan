import { render, screen, fireEvent } from "@testing-library/react";
import QuizPlayer from "./QuizPlayer";

const sampleQuestions = [
  {
    number: "1",
    text: "What is a base case?",
    options: [
      { id: "A", text: "First line" },
      { id: "B", text: "Stopping condition" },
      { id: "C", text: "Loop" },
      { id: "D", text: "Error" },
    ],
    correct: "B",
    explanation: "Recursion must terminate.",
  },
  {
    number: "2",
    text: "What is the call stack?",
    options: [
      { id: "A", text: "Memory" },
      { id: "B", text: "Active calls" },
      { id: "C", text: "Files" },
      { id: "D", text: "Network" },
    ],
    correct: "B",
    explanation: "Tracks function calls.",
  },
];

test("QuizPlayer lets student answer and submit quiz", () => {
  const onComplete = jest.fn();
  render(
    <QuizPlayer questions={sampleQuestions} title="Quiz · Recursion" onComplete={onComplete} />
  );

  expect(screen.getByText(/Question 1 of 2/i)).toBeInTheDocument();
  expect(screen.getByText(/What is a base case/i)).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText(/Stopping condition/i));
  fireEvent.click(screen.getByRole("button", { name: /Next/i }));

  expect(screen.getByText(/Question 2 of 2/i)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/Active calls/i));
  fireEvent.click(screen.getByRole("button", { name: /Submit quiz/i }));

  expect(screen.getByText(/Your score/i)).toBeInTheDocument();
  expect(screen.getByText(/2 \/ 2/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Retake quiz/i })).toBeInTheDocument();
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(onComplete).toHaveBeenCalledWith(
    expect.objectContaining({
      score: 2,
      total: 2,
      pct: 100,
      title: "Quiz · Recursion",
      results: expect.arrayContaining([
        expect.objectContaining({ isCorrect: true, question: "What is a base case?" }),
        expect.objectContaining({ isCorrect: true, question: "What is the call stack?" }),
      ]),
    })
  );
});

test("immediate reveal teaches one question at a time", () => {
  const onAnswer = jest.fn();
  const onComplete = jest.fn();
  render(
    <QuizPlayer
      questions={sampleQuestions}
      title="Quiz · Recursion"
      revealMode="immediate"
      onAnswer={onAnswer}
      onComplete={onComplete}
    />
  );

  fireEvent.click(screen.getByLabelText(/First line/i));
  expect(onAnswer).toHaveBeenCalledWith(
    expect.objectContaining({ correct: false, selected: "A", index: 0 })
  );
  expect(screen.getByLabelText(/First line/i).closest("label").className).toMatch(/wrong/);
  expect(screen.getByLabelText(/Stopping condition/i).closest("label").className).toMatch(/correct/);
  expect(screen.queryByRole("button", { name: /Previous/i })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
  expect(screen.getByText(/Question 2 of 2/i)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/Active calls/i));
  expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true, index: 1 }));
  fireEvent.click(screen.getByRole("button", { name: /See results/i }));
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Your score/i)).toBeInTheDocument();
});
