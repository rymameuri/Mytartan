import { useState } from "react";
import { SendIcon, MicIcon } from "./Icons";
import "./ChatInputBar.css";

function ChatInputBar({
  onSend,
  isLoading,
  voiceModeRef,
  compact,
  placeholder = "Message Scotty",
  onMicClick,
  micActive = false,
  reviewing = false,
  showMic = false,
  value,
  onChange,
}) {
  const [input, setInput] = useState("");
  const isControlled = value !== undefined;
  const textValue = isControlled ? value : input;

  function setText(next) {
    if (isControlled) onChange?.(next);
    else setInput(next);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const text = String(textValue || "").trim();
    if (!text || isLoading) return;
    if (voiceModeRef && !reviewing) voiceModeRef.current = false;
    onSend(text);
    setText("");
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
      <div className={`chat-input-wrap${micActive ? " chat-input-wrap--listening" : ""}${reviewing ? " chat-input-wrap--review" : ""}`}>
        {showMic && (
          <button
            type="button"
            className={`chat-mic-btn${micActive ? " chat-mic-btn--active" : ""}${reviewing ? " chat-mic-btn--review" : ""}`}
            onClick={onMicClick}
            disabled={isLoading}
            aria-label={
              micActive
                ? "Stop listening"
                : reviewing
                  ? "Send voice note"
                  : "Speak to Scotty"
            }
          >
            <MicIcon active={micActive || reviewing} />
          </button>
        )}
        <input
          type="text"
          className="chat-input"
          placeholder={placeholder}
          value={textValue}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          aria-label="Message input"
        />
        <button
          type="submit"
          className="chat-send"
          disabled={isLoading || !String(textValue || "").trim()}
          aria-label="Send message"
        >
          <SendIcon />
        </button>
      </div>
    </form>
  );
}

export default ChatInputBar;
