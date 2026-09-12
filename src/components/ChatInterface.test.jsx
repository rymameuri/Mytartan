import { render, screen } from "@testing-library/react";
import ChatInterface from "./ChatInterface";

// jsdom doesn't implement scrollIntoView — mock it so tests don't crash
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

const noOp = () => {};

describe("ChatInterface layout", () => {
  test("shows the hero bubble when showHero is true", () => {
    render(<ChatInterface messages={[]} isLoading={false} showHero={true} />);
    expect(screen.getByText(/hi, i'm scotty/i)).toBeInTheDocument();
    expect(screen.getByText(/mytartan/i)).toBeInTheDocument();
  });

  test("hides the hero bubble when showHero is false", () => {
    render(<ChatInterface messages={[]} isLoading={false} showHero={false} />);
    expect(screen.queryByText(/hi, i'm scotty/i)).not.toBeInTheDocument();
  });
});

describe("Displaying messages", () => {
  const messages = [
    { role: "user", content: "What is StuCo?" },
    { role: "assistant", content: "StuCo is the Student College at CMU-Q." },
  ];

  test("renders user messages", () => {
    render(<ChatInterface messages={messages} isLoading={false} showHero={false} />);
    expect(screen.getByText("What is StuCo?")).toBeInTheDocument();
  });

  test("renders assistant messages", () => {
    render(<ChatInterface messages={messages} isLoading={false} showHero={false} />);
    expect(screen.getByText("StuCo is the Student College at CMU-Q.")).toBeInTheDocument();
  });

  test("shows confidence badge on assistant messages", () => {
    const withConfidence = [
      ...messages,
      {
        role: "assistant",
        content: "Registration opens in Student Information Online.",
        confidence: {
          score: 87,
          sourceCount: 2,
          message: "Scotty is 87% confident in this answer based on 2 sources",
        },
      },
    ];
    render(<ChatInterface messages={withConfidence} isLoading={false} showHero={false} />);
    expect(screen.getByText(/87% confident/i)).toBeInTheDocument();
  });

  test("shows typing indicator when loading", () => {
    render(<ChatInterface messages={messages} isLoading={true} showHero={false} />);
    expect(document.querySelector(".typing-indicator")).toBeInTheDocument();
    expect(screen.getByText("thinking")).toBeInTheDocument();
  });

  test("hides typing indicator when not loading", () => {
    render(<ChatInterface messages={messages} isLoading={false} showHero={false} />);
    expect(document.querySelector(".typing-indicator")).not.toBeInTheDocument();
  });
});
