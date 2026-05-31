import { useEffect, useRef, useState } from "react";
import { SendIcon } from "./Icons";
import "./ChatInterface.css";

function ChatInterface({ messages, onSend, isLoading, showHero, mascot }) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function handleSubmit(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
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
    <div className="chat-interface">
      <div className="chat-body">
        <div className={`hero${showHero ? "" : " hero--collapsed"}`}>
          <div className="hero__mascot">{mascot}</div>
          {showHero && (
            <div className="hero__bubble">
              Hey there! I&apos;m Scotty, your Tartan AI. Ask me about campus, classes,
              or just chat!
            </div>
          )}
        </div>

        {!showHero && (
          <div className="message-history">
            {messages.map((message, index) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id ?? index}
                  className={`message-row${isUser ? " message-row--user" : " message-row--assistant"}`}
                >
                  <div className={`message-bubble${isUser ? " message-bubble--user" : " message-bubble--assistant"}`}>
                    {message.content}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="message-row message-row--assistant">
                <div className="message-bubble message-bubble--assistant typing-indicator">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <div className="chat-input-wrap">
          <input
            type="text"
            className="chat-input"
            placeholder="Ask Scotty anything..."
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
    </div>
  );
}

export default ChatInterface;
