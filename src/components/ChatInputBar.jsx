import { useRef, useState } from "react";
import { SendIcon, MicIcon, PaperclipIcon } from "./Icons";
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
  allowAttach = false,
  value,
  onChange,
}) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);
  const isControlled = value !== undefined;
  const textValue = isControlled ? value : input;

  function setText(next) {
    if (isControlled) onChange?.(next);
    else setInput(next);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const text = String(textValue || "").trim();
    if ((!text && files.length === 0) || isLoading) return;
    if (voiceModeRef && !reviewing) voiceModeRef.current = false;
    if (files.length) onSend(text, { files });
    else onSend(text);
    setText("");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFiles(event) {
    const next = Array.from(event.target.files || []);
    if (!next.length) return;
    setFiles((prev) => [...prev, ...next].slice(0, 4));
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  }

  const canSend = Boolean(String(textValue || "").trim() || files.length);

  return (
    <form
      className={`chat-input-bar${compact ? " chat-input-bar--compact" : ""}`}
      onSubmit={handleSubmit}
    >
      {files.length > 0 && (
        <ul className="chat-attach-list" aria-label="Attached files">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="chat-attach-chip">
              <span>{file.name}</span>
              <button type="button" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={`chat-input-wrap${micActive ? " chat-input-wrap--listening" : ""}${reviewing ? " chat-input-wrap--review" : ""}`}>
        {allowAttach && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="chat-attach-input"
              accept=".pdf,.pptx,.docx,.txt,.md,.csv,image/*"
              multiple
              onChange={handleFiles}
              aria-label="Attach notes"
            />
            <button
              type="button"
              className="chat-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              aria-label="Attach PDF, PowerPoint, or image"
            >
              <PaperclipIcon />
            </button>
          </>
        )}
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
          disabled={isLoading || !canSend}
          aria-label="Send message"
        >
          <SendIcon />
        </button>
      </div>
    </form>
  );
}

export default ChatInputBar;
