import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatInterface from "./ChatInterface";

// jsdom doesn't implement scrollIntoView — mock it so tests don't crash
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

const noOp = () => {};

// ─── Layout ───────────────────────────────────────────────────────────────────

describe("ChatInterface layout", () => {
  test("renders the message input box", () => {
    render(<ChatInterface messages={[]} onSend={noOp} isLoading={false} showHero={false} />);
    expect(screen.getByLabelText(/message input/i)).toBeInTheDocument();
  });

  test("renders the send button", () => {
    render(<ChatInterface messages={[]} onSend={noOp} isLoading={false} showHero={false} />);
    expect(screen.getByLabelText(/send message/i)).toBeInTheDocument();
  });

  test("shows the hero bubble when showHero is true", () => {
    render(<ChatInterface messages={[]} onSend={noOp} isLoading={false} showHero={true} />);
    expect(screen.getByText(/hey there/i)).toBeInTheDocument();
  });

  test("hides the hero bubble when showHero is false", () => {
    render(<ChatInterface messages={[]} onSend={noOp} isLoading={false} showHero={false} />);
    expect(screen.queryByText(/hey there/i)).not.toBeInTheDocument();
  });
});

// ─── Send button state ────────────────────────────────────────────────────────

describe("Send button disabled state", () => {
  test("send button is disabled when input is empty", () => {
    render(<ChatInterface messages={[]} onSend={noOp} isLoading={false} showHero={false} />);
    expect(screen.getByLabelText(/send message/i)).toBeDisabled();
  });

  test("send button is disabled while loading", () => {
    render(<ChatInterface messages={[]} onSend={noOp} isLoading={true} showHero={false} />);
    expect(screen.getByLabelText(/send message/i)).toBeDisabled();
  });

  test("send button is enabled after typing a message", () => {
    render(<ChatInterface messages={[]} onSend={noOp} isLoading={false} showHero={false} />);
    fireEvent.change(screen.getByLabelText(/message input/i), { target: { value: "hello" } });
    expect(screen.getByLabelText(/send message/i)).toBeEnabled();
  });
});

// ─── Sending messages ─────────────────────────────────────────────────────────

describe("Sending messages", () => {
  test("calls onSend with the typed text when send button is clicked", () => {
    const mockSend = jest.fn();
    render(<ChatInterface messages={[]} onSend={mockSend} isLoading={false} showHero={false} />);

    fireEvent.change(screen.getByLabelText(/message input/i), { target: { value: "What is StuCo?" } });
    fireEvent.click(screen.getByLabelText(/send message/i));

    expect(mockSend).toHaveBeenCalledWith("What is StuCo?");
  });

  test("calls onSend when Enter is pressed", () => {
    const mockSend = jest.fn();
    render(<ChatInterface messages={[]} onSend={mockSend} isLoading={false} showHero={false} />);

    const input = screen.getByLabelText(/message input/i);
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(mockSend).toHaveBeenCalledWith("Hello");
  });

  test("clears the input after sending", () => {
    render(<ChatInterface messages={[]} onSend={noOp} isLoading={false} showHero={false} />);
    const input = screen.getByLabelText(/message input/i);

    fireEvent.change(input, { target: { value: "test message" } });
    fireEvent.click(screen.getByLabelText(/send message/i));

    expect(input.value).toBe("");
  });

  test("does not call onSend for whitespace-only input", () => {
    const mockSend = jest.fn();
    render(<ChatInterface messages={[]} onSend={mockSend} isLoading={false} showHero={false} />);

    const input = screen.getByLabelText(/message input/i);
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(mockSend).not.toHaveBeenCalled();
  });
});

// ─── Displaying messages ──────────────────────────────────────────────────────

describe("Displaying messages", () => {
  const messages = [
    { role: "user", content: "What is StuCo?" },
    { role: "assistant", content: "StuCo is the Student College at CMU-Q." },
  ];

  test("renders user messages", () => {
    render(<ChatInterface messages={messages} onSend={noOp} isLoading={false} showHero={false} />);
    expect(screen.getByText("What is StuCo?")).toBeInTheDocument();
  });

  test("renders assistant messages", () => {
    render(<ChatInterface messages={messages} onSend={noOp} isLoading={false} showHero={false} />);
    expect(screen.getByText("StuCo is the Student College at CMU-Q.")).toBeInTheDocument();
  });

  test("shows typing indicator when loading", () => {
    render(<ChatInterface messages={messages} onSend={noOp} isLoading={true} showHero={false} />);
    expect(document.querySelector(".typing-indicator")).toBeInTheDocument();
  });

  test("hides typing indicator when not loading", () => {
    render(<ChatInterface messages={messages} onSend={noOp} isLoading={false} showHero={false} />);
    expect(document.querySelector(".typing-indicator")).not.toBeInTheDocument();
  });
});
