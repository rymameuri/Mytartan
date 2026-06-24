import { useState, useRef, useCallback, useEffect } from "react";
import ScottyAvatar from "./ScottyAvatar";
import ScottyHeadbandFrame from "./ScottyHeadbandFrame";
import MessageContent from "./MessageContent";
import PersonaMicControls from "./PersonaMicControls";
import PersonaCaption from "./PersonaCaption";
import AvatarScaleHandle from "./AvatarScaleHandle";
import { useMicInput } from "../hooks/useMicInput";
import { useAvatarZoom } from "../hooks/useAvatarZoom";
import { MenuIcon, ShareIcon, DownloadIcon, VolumeIcon, ChevronIcon } from "./Icons";
import SettingsButton from "./SettingsButton";
import "./PersonaView.css";
import MessageFeedback from "./MessageFeedback";
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
  onOpenSettings,
  voiceModeRef,
  avatarRef,
  speechCaption = "",
}) {
  const messagesContainerRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [interactionMode, setInteractionMode] = useState("persona");
  const { zoom, setZoom, resetZoom, avatarStyle, minZoom, maxZoom } = useAvatarZoom();
  const hasMessages = messages.length > 0;
  const hasUserMessages = messages.some((message) => message.role === "user");
  const showChatHistory = interactionMode === "chat" && hasUserMessages;
  const showPersonaStage = interactionMode === "persona" || !hasUserMessages;

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
    setInteractionMode("persona");
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
    if (!showChatHistory) return undefined;

    const el = messagesContainerRef.current;
    if (!el) return undefined;

    el.addEventListener("scroll", checkScrollPosition, { passive: true });
    checkScrollPosition();

    return () => el.removeEventListener("scroll", checkScrollPosition);
  }, [showChatHistory, checkScrollPosition]);

  useEffect(() => {
    if (!showChatHistory) return;
    if (isNearBottomRef.current) {
      const isStreaming = messages.some((message) => message.streaming);
      requestAnimationFrame(() => scrollToBottom(isStreaming ? "auto" : "smooth"));
    } else {
      checkScrollPosition();
    }
  }, [messages, isLoading, showChatHistory, scrollToBottom, checkScrollPosition]);

  const micLabel = isLoading
    ? "Processing…"
    : listening
      ? "Listening…"
      : isSpeaking
        ? "Tap to stop"
        : "Tap to speak";

  const avatarState = isSpeaking ? "speaking" : listening ? "listening" : "idle";
  const showIdleHint = showPersonaStage && !isSpeaking && !isLoading && !hasUserMessages;
  const isTutor = mode === "tutor";

  return (
    <div className={`pv${interactionMode === "persona" ? " pv--persona-mode" : ""}`}>
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
          <div className="pv-interaction-tabs" role="tablist" aria-label="Input mode">
            <button
              type="button"
              role="tab"
              aria-selected={interactionMode === "persona"}
              className={`pv-interaction-tab${
                interactionMode === "persona" ? " pv-interaction-tab--active" : ""
              }`}
              onClick={() => setInteractionMode("persona")}
            >
              Persona
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={interactionMode === "chat"}
              className={`pv-interaction-tab${
                interactionMode === "chat" ? " pv-interaction-tab--active" : ""
              }`}
              onClick={() => setInteractionMode("chat")}
            >
              Chat
            </button>
          </div>
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
          <SettingsButton onClick={onOpenSettings} />
        </div>
      </header>

      <main className={`pv-body${showChatHistory ? " pv-body--chat" : " pv-body--idle"}`}>
        {showChatHistory && (
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
                      {!isUser && !message.streaming && !message.studio && (
                        <MessageFeedback
                          messageId={message.id ?? `pv-${msgId}`}
                          reply={message.content}
                          feedbackContext={message.feedbackContext ?? { mode }}
                          disabled={isLoading}
                        />
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

        <div className={`pv-stage${interactionMode === "persona" ? " pv-stage--persona-main" : ""}`}>
          <div
            className={`pv-avatar-frame pv-avatar-frame--${avatarState}`}
            style={avatarStyle}
          >
            <ScottyHeadbandFrame avatarState={avatarState}>
              <ScottyAvatar ref={avatarRef} persona />
            </ScottyHeadbandFrame>
          </div>

          {interactionMode === "persona" && (
            <AvatarScaleHandle
              zoom={zoom}
              setZoom={setZoom}
              minZoom={minZoom}
              maxZoom={maxZoom}
              onReset={resetZoom}
            />
          )}

          {showPersonaStage && (
            <div className="pv-identity">
              <p className="pv-identity__name brand-display">My Tartan</p>
              <p className="pv-identity__role">
                <span className="pv-identity__dot" />
                {isTutor ? "Course Tutor" : "CMU-Q Student Assistant"}
              </p>
            </div>
          )}

          {isSpeaking && speechCaption && (
            <PersonaCaption text={speechCaption} />
          )}

          {showIdleHint && (
            <p className="pv-idle-hint">
              {isTutor
                ? "Open your class dashboard to add materials and study"
                : interactionMode === "chat"
                  ? "Type a question about CMU-Q registration, campus life, or policies"
                  : "Tap the mic and ask me anything about CMU-Q"}
            </p>
          )}

          {interactionMode === "persona" && isLoading && (
            <p className="pv-idle-hint pv-idle-hint--live">Scotty is thinking…</p>
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
          micOnly={interactionMode === "persona"}
          placeholder={
            isTutor
              ? "Ask Scotty about your course…"
              : "Ask about CMU-Q registration, campus life, policies…"
          }
        />
      </footer>
    </div>
  );
}

export default PersonaView;
