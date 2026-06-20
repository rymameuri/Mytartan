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
  render(<QuizPlayer questions={sampleQuestions} title="Quiz · Recursion" />);

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
});
