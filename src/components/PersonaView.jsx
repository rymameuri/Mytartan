import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import ScottyAvatar from "./ScottyAvatar";
import MessageContent from "./MessageContent";
import PersonaMicControls from "./PersonaMicControls";
import { useMicInput } from "../hooks/useMicInput";
import { MenuIcon, ShareIcon, DownloadIcon, VolumeIcon, ChevronIcon } from "./Icons";
import SettingsButton from "./SettingsButton";
import { orderStarterChips } from "../data/starterChips";
import TeachStudio from "./TeachStudio";
import "./PersonaView.css";
import MessageFeedback from "./MessageFeedback";
import "./ChatInterface.css";

function PersonaView({
  chatSessionKey = 0,
  messages = [],
  isLoading,
  mode = "qa",
  onSend,
  onShare,
  onDownload,
  onOpenMenu,
  isDesktop,
  isSpeaking = false,
  isPreparingSpeech = false,
  stopSpeech,
  isMuted = false,
  onToggleMute,
  onOpenSettings,
  voiceModeRef,
  avatarRef,
  speechCaption = "",
  profile = null,
  teachStudio = null,
  documentSource = null,
  onCloseStudio,
  onQuizAnswer,
  onDocumentQuizComplete,
  onMindMapStep,
}) {
  const messagesContainerRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const hasMessages = messages.length > 0;
  const hasUserMessages = messages.some((message) => message.role === "user");
  const showChatHistory = hasUserMessages;
  const lastAssistantReply = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.content?.trim())?.content;

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

  const [composerText, setComposerText] = useState("");

  const handleVoiceResult = useCallback((spoken) => {
    stopSpeech?.();
    voiceModeRef.current = true;
    onSend(spoken);
    setComposerText("");
  }, [onSend, voiceModeRef, stopSpeech]);

  const {
    listening,
    reviewing,
    isFinalizing,
    transcript,
    setTranscript,
    toggle: toggleMic,
    reset: resetMic,
  } = useMicInput({
    onResult: handleVoiceResult,
  });

  useEffect(() => {
    if (listening || reviewing) setComposerText(transcript);
  }, [listening, reviewing, transcript]);

  const isThinking = !isSpeaking && (isLoading || isPreparingSpeech || isFinalizing);

  const handleComposerChange = useCallback((next) => {
    setComposerText(next);
    if (listening || reviewing) setTranscript(next);
  }, [listening, reviewing, setTranscript]);

  const handleComposerSend = useCallback((text, extra) => {
    if (reviewing) {
      stopSpeech?.();
      voiceModeRef.current = true;
    } else if (voiceModeRef) {
      voiceModeRef.current = false;
    }
    onSend(text, undefined, extra || {});
    setComposerText("");
    resetMic();
  }, [onSend, resetMic, reviewing, stopSpeech, voiceModeRef]);

  const handleMicClick = useCallback(() => {
    if (isLoading || isPreparingSpeech || isFinalizing) return;
    if (isSpeaking) {
      stopSpeech?.();
      return;
    }
    toggleMic();
  }, [isLoading, isPreparingSpeech, isFinalizing, isSpeaking, stopSpeech, toggleMic]);

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

  const micLabel = isLoading || isPreparingSpeech || isFinalizing
    ? "Thinking…"
    : listening
      ? "Listening… tap again when you're done"
      : reviewing
        ? "Edit if needed, then send — or tap the mic"
      : isSpeaking
        ? "Tap to stop"
        : "Tap the mic";

  const avatarState = isSpeaking
    ? "speaking"
    : listening
      ? "listening"
      : isLoading || isPreparingSpeech || isFinalizing
        ? "thinking"
        : "idle";
  const showIdleHint =
    !showChatHistory &&
    !isSpeaking &&
    !isLoading &&
    !isPreparingSpeech &&
    !isFinalizing &&
    !hasUserMessages;
  const starterChips = useMemo(() => orderStarterChips(profile ?? {}), [profile]);
  const composerBusy = isLoading || isPreparingSpeech || isFinalizing;
  const studioOpen = Boolean(teachStudio);

  const handleChipClick = useCallback((prompt) => {
    if (composerBusy) return;
    if (voiceModeRef) voiceModeRef.current = false;
    onSend(prompt);
  }, [composerBusy, onSend, voiceModeRef]);

  return (
    <div className={`pv${!showChatHistory && !studioOpen ? " pv--persona-mode" : ""}${studioOpen ? " pv--studio" : ""}`}>
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
        <div className="pv-header__identity">
          {showChatHistory && (
            <div className="pv-header__avatar" aria-hidden="true">
              <ScottyAvatar persona avatarState={avatarState} />
            </div>
          )}
          <div className="pv-header__copy">
            <p className="pv-header__name">Scotty</p>
            <p className="pv-header__role">
              Your CMU-Q classmate
              <span className="pv-header__app"> · MyTartan</span>
            </p>
          </div>
        </div>
        <div className="pv-header__actions">
          <button
            type="button"
            className={`pv-icon-btn${isMuted ? " pv-icon-btn--active" : ""}`}
            aria-label={isMuted ? "Unmute Scotty" : "Mute Scotty"}
            aria-pressed={isMuted}
            title={isMuted ? "Unmute Scotty" : "Mute Scotty"}
            onClick={onToggleMute}
          >
            <VolumeIcon muted={isMuted} />
          </button>
          {hasMessages && (
            <>
              <button
                type="button"
                className="pv-icon-btn"
                aria-label="Share chat"
                onClick={onShare}
              >
                <ShareIcon />
              </button>
              <button
                type="button"
                className="pv-icon-btn"
                aria-label="Download chat"
                onClick={onDownload}
              >
                <DownloadIcon />
              </button>
            </>
          )}
          <SettingsButton onClick={onOpenSettings} />
        </div>
      </header>

      {studioOpen ? (
        <TeachStudio
          studio={teachStudio}
          messages={messages}
          isLoading={isLoading}
          avatarState={avatarState}
          avatarRef={avatarRef}
          onClose={onCloseStudio}
          onAnswer={onQuizAnswer}
          onQuizComplete={onDocumentQuizComplete}
          onMindMapStep={onMindMapStep}
          isDesktop={isDesktop}
        />
      ) : (
      <main
        className={`pv-body${showChatHistory ? " pv-body--chat" : " pv-body--idle"}`}
      >
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
                    <div className={`msg-bubble${isUser ? " msg-bubble--user" : " msg-bubble--assistant"}`}>
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
                  <div
                    className="msg-bubble msg-bubble--assistant typing-indicator"
                    aria-label="thinking"
                  >
                    <span className="typing-label">thinking</span>
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
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

        {!showChatHistory && (
          <div className="pv-empty">
            <div className={`pv-empty__mark pv-empty__mark--${avatarState}`}>
              <ScottyAvatar ref={avatarRef} persona avatarState={avatarState} />
            </div>
            <h1 className="pv-empty__title">Hey, I&apos;m Scotty</h1>
            <p className="pv-empty__lede">
              {isThinking
                ? "Thinking…"
                : isSpeaking && speechCaption
                  ? speechCaption
                  : showIdleHint
                    ? "What's going on?"
                    : lastAssistantReply || "What's going on?"}
            </p>
            {showIdleHint && (
              <ul className="pv-empty__chips" aria-label="Suggested questions">
                {starterChips.map((chip) => (
                  <li key={chip.id}>
                    <button
                      type="button"
                      className="pv-empty__chip"
                      disabled={composerBusy}
                      onClick={() => handleChipClick(chip.prompt)}
                    >
                      {chip.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
      )}

      <footer className="pv-footer">
        <PersonaMicControls
          listening={listening}
          reviewing={reviewing}
          isLoading={isLoading || isPreparingSpeech || isFinalizing}
          isSpeaking={isSpeaking}
          micLabel={micLabel}
          onMicClick={handleMicClick}
          onSend={handleComposerSend}
          voiceModeRef={voiceModeRef}
          placeholder={
            listening
              ? "Listening…"
              : reviewing
                ? "Edit this, then send"
                : "Message Scotty"
          }
          inputOnly
          showComposerMic
          allowAttach
          value={composerText}
          onChange={handleComposerChange}
        />
        <p className="pv-footer__hint">
          {listening
            ? "Listening. Tap the mic when you're done, then edit or send."
            : reviewing
              ? "Edit if it looks messy, then send."
              : studioOpen && teachStudio?.kind === "quiz"
                ? "One question at a time, from your notes — not campus policy."
                : studioOpen && teachStudio?.kind === "mindmap"
                  ? "The map grows as Scotty explains."
                : documentSource
                  ? `Notes ready: ${documentSource.name}. Say “quiz me on this” or “whiteboard this”.`
                : "Scotty can get things wrong. Check campus sources."}
        </p>
      </footer>
    </div>
  );
}

export default PersonaView;
