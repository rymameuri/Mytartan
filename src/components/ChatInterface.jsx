import { useEffect, useRef, useCallback, useState } from "react";
import ChatInputBar from "./ChatInputBar";
import MessageContent from "./MessageContent";
import { stripMarkdownFormatting } from "../utils/stripMarkdown";
import { toSpokenText } from "../utils/spokenText";
import { SpeakerIcon } from "./Icons";
import "./ChatInterface.css";

// ── TTS hook ─────────────────────────────────────────────────────────────────
function useSpeech(avatarRef) {
  const [speakingId, setSpeakingId] = useState(null);

  const speak = useCallback((text, id) => {
    if (!window.speechSynthesis) return;
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      avatarRef?.current?.stop?.();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    avatarRef?.current?.stop?.();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1;
    u.onend = () => setSpeakingId(null);
    u.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(u);
  }, [speakingId, avatarRef]);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    avatarRef?.current?.stop?.();
    setSpeakingId(null);
  }, [avatarRef]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  return { speakingId, speak, stop };
}

// ── ChatInterface ─────────────────────────────────────────────────────────────
function ChatInterface({ messages, isLoading, showHero, mascot, avatarRef, voiceModeRef, onSend }) {
  const messagesEndRef = useRef(null);
  const prevLoadingRef = useRef(false);
  const { speakingId, speak, stop } = useSpeech(avatarRef);

  const speakReply = useCallback(async (text, msgId) => {
    const plain = toSpokenText(stripMarkdownFormatting(text));
    if (avatarRef?.current) {
      try { await avatarRef.current.speak(plain); return; }
      catch (err) { console.warn("[Chat] LiveAvatar speak failed:", err.message); }
    }
    speak(plain, msgId);
  }, [avatarRef, speak]);

  // Auto-speak after voice query
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoading;
    if (wasLoading && !isLoading && voiceModeRef?.current) {
      const last = [...messages].reverse().find((m) => m.role === "assistant");
      if (last) speakReply(last.content, last.id ?? messages.lastIndexOf(last));
      voiceModeRef.current = false;
    }
  }, [isLoading, messages, speakReply, voiceModeRef]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="chat-interface">
      {/* ── Identity header ── */}
      <div className="chat-id-bar">
        <div className="chat-id-bar__avatar">
          <span className="chat-id-bar__status" />
        </div>
        <div className="chat-id-bar__text">
          <span className="chat-id-bar__name brand-display">My Tartan</span>
          <span className="chat-id-bar__sub">CMU-Q Student Assistant</span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="chat-body">
        {showHero ? (
          <div className="chat-hero">
            <div className="chat-hero__mascot">{mascot}</div>
            <p className="chat-hero__greeting brand-display">Hi, I&apos;m MyTartan!</p>
            <p className="chat-hero__sub">
              Ask me anything about CMU-Q — academics, campus life, policies, or resources.
            </p>
          </div>
        ) : (
          <div className="message-history">
            {messages.map((message, index) => {
              const isUser = message.role === "user";
              const msgId = message.id ?? index;
              return (
                <div
                  key={msgId}
                  className={`msg-row${isUser ? " msg-row--user" : " msg-row--assistant"}`}
                >
                  {!isUser && (
                    <div className="msg-avatar">
                      <span className="msg-avatar__dot" />
                    </div>
                  )}
                  <div className={`msg-bubble${isUser ? " msg-bubble--user" : " msg-bubble--assistant"}`}>
                    <MessageContent content={message.content} />
                    {!isUser && message.confidence?.message && (
                      <p className="msg-confidence" title={message.confidence.message}>
                        {message.confidence.message}
                      </p>
                    )}
                    {!isUser && (
                      <button
                        className={`speak-btn${speakingId === msgId ? " speak-btn--active" : ""}`}
                        onClick={() => speakingId === msgId ? stop() : speakReply(message.content, msgId)}
                        aria-label={speakingId === msgId ? "Stop" : "Read aloud"}
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
              <div className="msg-row msg-row--assistant">
                <div className="msg-avatar"><span className="msg-avatar__dot" /></div>
                <div className="msg-bubble msg-bubble--assistant typing-indicator" aria-label="thinking">
                  <span className="typing-label">thinking</span>
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

      {/* ── Input ── */}
      <div className="chat-input-area">
        <ChatInputBar
          onSend={onSend}
          isLoading={isLoading}
          voiceModeRef={voiceModeRef}
        />
      </div>
    </div>
  );
}

export default ChatInterface;
