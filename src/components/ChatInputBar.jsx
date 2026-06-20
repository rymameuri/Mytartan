import { useState } from "react";
import { SendIcon, MicIcon } from "./Icons";
import "./ChatInputBar.css";

function ChatInputBar({
  onSend,
  isLoading,
  voiceModeRef,
  compact,
  placeholder = "Ask MyTartan anything...",
  onMicClick,
  micActive = false,
  showMic = false,
}) {
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
        {showMic && (
          <button
            type="button"
            className={`chat-mic-btn${micActive ? " chat-mic-btn--active" : ""}`}
            onClick={onMicClick}
            disabled={isLoading}
            aria-label={micActive ? "Stop listening" : "Speak to Scotty"}
          >
            <MicIcon active={micActive} />
          </button>
        )}
        <input
          type="text"
          className="chat-input"
          placeholder={placeholder}
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
