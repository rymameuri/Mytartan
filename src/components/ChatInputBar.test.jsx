import { render, screen, fireEvent } from "@testing-library/react";
import ChatInputBar from "./ChatInputBar";

const noOp = () => {};

describe("ChatInputBar", () => {
  test("renders the message input box", () => {
    render(<ChatInputBar onSend={noOp} isLoading={false} />);
    expect(screen.getByLabelText(/message input/i)).toBeInTheDocument();
  });

  test("renders the send button", () => {
    render(<ChatInputBar onSend={noOp} isLoading={false} />);
    expect(screen.getByLabelText(/send message/i)).toBeInTheDocument();
  });

  test("send button is disabled when input is empty", () => {
    render(<ChatInputBar onSend={noOp} isLoading={false} />);
    expect(screen.getByLabelText(/send message/i)).toBeDisabled();
  });

  test("send button is disabled while loading", () => {
    render(<ChatInputBar onSend={noOp} isLoading={true} />);
    expect(screen.getByLabelText(/send message/i)).toBeDisabled();
  });

  test("send button is enabled after typing a message", () => {
    render(<ChatInputBar onSend={noOp} isLoading={false} />);
    fireEvent.change(screen.getByLabelText(/message input/i), { target: { value: "hello" } });
    expect(screen.getByLabelText(/send message/i)).toBeEnabled();
  });

  test("calls onSend with the typed text when send button is clicked", () => {
    const mockSend = jest.fn();
    render(<ChatInputBar onSend={mockSend} isLoading={false} />);

    fireEvent.change(screen.getByLabelText(/message input/i), { target: { value: "What is StuCo?" } });
    fireEvent.click(screen.getByLabelText(/send message/i));

    expect(mockSend).toHaveBeenCalledWith("What is StuCo?");
  });

  test("calls onSend when Enter is pressed", () => {
    const mockSend = jest.fn();
    render(<ChatInputBar onSend={mockSend} isLoading={false} />);

    const input = screen.getByLabelText(/message input/i);
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(mockSend).toHaveBeenCalledWith("Hello");
  });

  test("clears the input after sending", () => {
    render(<ChatInputBar onSend={noOp} isLoading={false} />);
    const input = screen.getByLabelText(/message input/i);

    fireEvent.change(input, { target: { value: "test message" } });
    fireEvent.click(screen.getByLabelText(/send message/i));

    expect(input.value).toBe("");
  });

  test("shows a live voice draft the user can edit", () => {
    const onChange = jest.fn();
    render(
      <ChatInputBar
        onSend={noOp}
        isLoading={false}
        value="um what is stew co"
        onChange={onChange}
        showMic
        micActive
      />
    );
    expect(screen.getByLabelText(/message input/i).value).toBe("um what is stew co");
    expect(screen.getByLabelText(/stop listening/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/message input/i), {
      target: { value: "What is StuCo?" },
    });
    expect(onChange).toHaveBeenCalledWith("What is StuCo?");
  });

  test("does not call onSend for whitespace-only input", () => {
    const mockSend = jest.fn();
    render(<ChatInputBar onSend={mockSend} isLoading={false} />);

    const input = screen.getByLabelText(/message input/i);
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(mockSend).not.toHaveBeenCalled();
  });
});
