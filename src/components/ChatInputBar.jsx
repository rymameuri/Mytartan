import { useState } from "react";
import { SendIcon } from "./Icons";
import "./ChatInputBar.css";

function ChatInputBar({ onSend, isLoading, voiceModeRef, compact }) {
  const [input, setInput] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    if (voiceModeRef) voiceModeRef.current = false;
    onSend(text);
    setInput("");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  }

  return (
    <form
      className={`chat-input-bar${compact ? " chat-input-bar--compact" : ""}`}
      onSubmit={handleSubmit}
    >
      <div className="chat-input-wrap">
        <input
          type="text"
          className="chat-input"
          placeholder="Ask MyTartan anything..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          aria-label="Message input"
        />
        <button
          type="submit"
          className="chat-send"
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
        >
          <SendIcon />
        </button>
      </div>
    </form>
  );
}

export default ChatInputBar;
