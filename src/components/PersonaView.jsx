import { useState, useRef, useCallback, useEffect } from "react";
import ScottyAvatar from "./ScottyAvatar";
import MessageContent from "./MessageContent";
import PersonaMicControls from "./PersonaMicControls";
import { useMicInput } from "../hooks/useMicInput";
import { MenuIcon, ShareIcon, DownloadIcon, VolumeIcon, ChevronIcon } from "./Icons";
import "./PersonaView.css";
import "./ChatInterface.css";

function PersonaView({
  chatSessionKey = 0,
  messages = [],
  isLoading,
  mode = "qa",
  courseContext = null,
  onSend,
  onShare,
  onDownload,
  onOpenMenu,
  onSwitchMode,
  isDesktop,
  isSpeaking = false,
  stopSpeech,
  isMuted = false,
  onToggleMute,
  voiceModeRef,
  avatarRef,
}) {
  const messagesContainerRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const hasMessages = messages.length > 0;

  const SCROLL_THRESHOLD = 72;

  const checkScrollPosition = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= SCROLL_THRESHOLD;
    isNearBottomRef.current = nearBottom;
    setShowScrollDown(!nearBottom);
  }, []);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    isNearBottomRef.current = true;
    setShowScrollDown(false);
  }, []);

  useEffect(() => {
    stopSpeech?.();
    voiceModeRef.current = false;
    isNearBottomRef.current = true;
    setShowScrollDown(false);
  }, [chatSessionKey, stopSpeech, voiceModeRef]);

  const handleVoiceResult = useCallback((transcript) => {
    stopSpeech?.();
    voiceModeRef.current = true;
    onSend(transcript);
  }, [onSend, voiceModeRef, stopSpeech]);

  const { listening, toggle: toggleMic } = useMicInput({ onResult: handleVoiceResult });

  const handleMicClick = useCallback(() => {
    if (isLoading) return;
    if (isSpeaking) {
      stopSpeech?.();
      return;
    }
    toggleMic();
  }, [isLoading, isSpeaking, stopSpeech, toggleMic]);

  useEffect(() => {
    if (!hasMessages) return undefined;

    const el = messagesContainerRef.current;
    if (!el) return undefined;

    el.addEventListener("scroll", checkScrollPosition, { passive: true });
    checkScrollPosition();

    return () => el.removeEventListener("scroll", checkScrollPosition);
  }, [hasMessages, checkScrollPosition]);

  useEffect(() => {
    if (!hasMessages) return;
    if (isNearBottomRef.current) {
      const isStreaming = messages.some((message) => message.streaming);
      requestAnimationFrame(() => scrollToBottom(isStreaming ? "auto" : "smooth"));
    } else {
      checkScrollPosition();
    }
  }, [messages, isLoading, hasMessages, scrollToBottom, checkScrollPosition]);

  const micLabel = isLoading
    ? "Processing…"
    : listening
      ? "Listening…"
      : isSpeaking
        ? "Tap to stop"
        : "Tap to speak";

  const avatarState = isSpeaking ? "speaking" : listening ? "listening" : "idle";
  const showIdleHint = !isSpeaking && !isLoading && !hasMessages;
  const isTutor = mode === "tutor";

  return (
    <div className="pv">
      <div className="pv__overlay" aria-hidden="true" />

      <header className="pv-header">
        {!isDesktop && (
          <button
            type="button"
            className="pv-icon-btn"
            aria-label="Open menu"
            onClick={onOpenMenu}
          >
            <MenuIcon />
          </button>
        )}
        {!isDesktop && (
          <span className="pv-brand__name brand-display">MY TARTAN</span>
        )}
        <div className="pv-mode-tabs" role="tablist" aria-label="Assistant mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "qa"}
            className={`pv-mode-tab${mode === "qa" ? " pv-mode-tab--active" : ""}`}
            onClick={() => onSwitchMode?.("qa")}
          >
            Q&amp;A
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "tutor"}
            className={`pv-mode-tab${mode === "tutor" ? " pv-mode-tab--active" : ""}`}
            onClick={() => onSwitchMode?.("tutor")}
          >
            Course Tutor
          </button>
        </div>
        <div className="pv-header__actions">
          <button
            type="button"
            className={`pv-icon-btn${isMuted ? " pv-icon-btn--active" : ""}`}
            aria-label={isMuted ? "Unmute persona" : "Mute persona"}
            aria-pressed={isMuted}
            title={isMuted ? "Unmute persona" : "Mute persona"}
            onClick={onToggleMute}
          >
            <VolumeIcon muted={isMuted} />
          </button>
          <button
            type="button"
            className="pv-icon-btn"
            aria-label="Share chat"
            onClick={onShare}
            disabled={!hasMessages}
          >
            <ShareIcon />
          </button>
          <button
            type="button"
            className="pv-icon-btn"
            aria-label="Download chat"
            onClick={onDownload}
            disabled={!hasMessages}
          >
            <DownloadIcon />
          </button>
        </div>
      </header>

      <main className={`pv-body${hasMessages ? " pv-body--chat" : " pv-body--idle"}`}>
        {hasMessages && (
          <div className="pv-messages-wrap">
            <div
              className="pv-messages message-history"
              ref={messagesContainerRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions"
            >
              {messages.map((message, index) => {
                const isUser = message.role === "user";
                const msgId = message.id ?? index;
                return (
                  <div
                    key={msgId}
                    className={`msg-row${isUser ? " msg-row--user" : " msg-row--assistant"}`}
                  >
                    <div className={`msg-bubble msg-bubble--on-pattern${isUser ? " msg-bubble--user" : " msg-bubble--assistant"}`}>
                      <MessageContent content={message.content} />
                      {!isUser && message.confidence?.message && (
                        <p className="msg-confidence" title={message.confidence.message}>
                          {message.confidence.message}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="msg-row msg-row--assistant">
                  <div className="msg-bubble msg-bubble--assistant msg-bubble--on-pattern typing-indicator">
                    <span className="typing-dot typing-dot--on-pattern" />
                    <span className="typing-dot typing-dot--on-pattern" />
                    <span className="typing-dot typing-dot--on-pattern" />
                  </div>
                </div>
              )}
            </div>

            {showScrollDown && (
              <button
                type="button"
                className="pv-scroll-down"
                aria-label="Scroll to latest message"
                onClick={() => scrollToBottom()}
              >
                <ChevronIcon />
              </button>
            )}
          </div>
        )}

        <div className="pv-stage">
          <div className={`pv-avatar-frame pv-avatar-frame--${avatarState}`}>
            <div className="pv-scotty-ears" aria-hidden="true">
              <span className="pv-dog-ear pv-dog-ear--left">
                <span className="pv-dog-ear__inner" />
                <span className="pv-dog-ear__fur" />
              </span>
              <span className="pv-dog-ear pv-dog-ear--right">
                <span className="pv-dog-ear__inner" />
                <span className="pv-dog-ear__fur" />
              </span>
            </div>
            <div className="pv-avatar-inner">
              <ScottyAvatar ref={avatarRef} persona />
            </div>
            <div className="pv-scotty-whiskers" aria-hidden="true">
              <span className="pv-scotty-whisker pv-scotty-whisker--l1" />
              <span className="pv-scotty-whisker pv-scotty-whisker--l2" />
              <span className="pv-scotty-whisker pv-scotty-whisker--l3" />
              <span className="pv-scotty-whisker pv-scotty-whisker--r1" />
              <span className="pv-scotty-whisker pv-scotty-whisker--r2" />
              <span className="pv-scotty-whisker pv-scotty-whisker--r3" />
            </div>
            <div className="pv-avatar-ring" aria-hidden="true" />
          </div>

          {!hasMessages && (
            <div className="pv-identity">
              <p className="pv-identity__name brand-display">My Tartan</p>
              <p className="pv-identity__role">
                <span className="pv-identity__dot" />
                {isTutor ? "Course Tutor" : "CMU-Q Student Assistant"}
              </p>
            </div>
          )}

          {showIdleHint && (
            <p className="pv-idle-hint">
              {isTutor
                ? "Open your class dashboard to add materials and study"
                : "Ask me anything about CMU-Q"}
            </p>
          )}
        </div>
      </main>

      <footer className="pv-footer">
        <PersonaMicControls
          listening={listening}
          isLoading={isLoading}
          isSpeaking={isSpeaking}
          micLabel={micLabel}
          onMicClick={handleMicClick}
          onSend={onSend}
          voiceModeRef={voiceModeRef}
        />
      </footer>
    </div>
  );
}

export default PersonaView;
