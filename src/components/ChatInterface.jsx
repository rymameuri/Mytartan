import { useEffect, useRef, useState, useCallback } from "react";
import { SendIcon, SpeakerIcon, MicIcon } from "./Icons";
import "./ChatInterface.css";

function useSpeech() {
  const [speakingId, setSpeakingId] = useState(null);

  const speak = useCallback((text, id) => {
    if (!window.speechSynthesis) return;

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  }, [speakingId]);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
  }, []);

  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, []);

  return { speakingId, speak, stop };
}

function useMic({ onTranscript, onAutoSend }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const toggle = useCallback(() => {
    if (!supported) return;

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim();
      if (transcript) {
        onTranscript(transcript);
        // Auto-send after a short delay so state can settle
        setTimeout(() => onAutoSend(transcript), 50);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening, supported, onTranscript, onAutoSend]);

  return { listening, toggle, supported };
}

function ChatInterface({ messages, onSend, isLoading, showHero, mascot }) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const voiceModeRef = useRef(false); // tracks whether last message was sent by voice
  const prevLoadingRef = useRef(false);

  const { speakingId, speak, stop } = useSpeech();

  const handleAutoSend = useCallback((transcript) => {
    if (!transcript || isLoading) return;
    voiceModeRef.current = true;
    setInput("");
    onSend(transcript);
  }, [isLoading, onSend]);

  const { listening, toggle: toggleMic, supported: micSupported } = useMic({
    onTranscript: useCallback((transcript) => setInput(transcript), []),
    onAutoSend: handleAutoSend,
  });

  // Auto-speak Scotty's reply when it arrives after a voice message
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoading;

    if (wasLoading && !isLoading && voiceModeRef.current) {
      // Find the last assistant message
      const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
      if (lastAssistant) {
        const id = lastAssistant.id ?? messages.lastIndexOf(lastAssistant);
        speak(lastAssistant.content, id);
      }
      voiceModeRef.current = false;
    }
  }, [isLoading, messages, speak]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function handleSubmit(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    voiceModeRef.current = false; // typed, not voice
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
              const msgId = message.id ?? index;
              return (
                <div
                  key={msgId}
                  className={`message-row${isUser ? " message-row--user" : " message-row--assistant"}`}
                >
                  <div className={`message-bubble${isUser ? " message-bubble--user" : " message-bubble--assistant"}`}>
                    {message.content}
                    {!isUser && (
                      <button
                        className={`speak-btn${speakingId === msgId ? " speak-btn--active" : ""}`}
                        onClick={() => speakingId === msgId ? stop() : speak(message.content, msgId)}
                        aria-label={speakingId === msgId ? "Stop speaking" : "Read aloud"}
                        title={speakingId === msgId ? "Stop" : "Read aloud"}
                      >
                        <SpeakerIcon active={speakingId === msgId} />
                      </button>
                    )}
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
            placeholder={listening ? "Listening…" : "Ask Scotty anything..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            aria-label="Message input"
          />
          {micSupported && (
            <button
              type="button"
              className={`chat-mic${listening ? " chat-mic--active" : ""}`}
              onClick={toggleMic}
              disabled={isLoading}
              aria-label={listening ? "Stop listening" : "Speak your message"}
              title={listening ? "Stop" : "Speak"}
            >
              <MicIcon active={listening} />
            </button>
          )}
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
