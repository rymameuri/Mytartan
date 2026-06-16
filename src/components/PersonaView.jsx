import { useState, useRef, useCallback, useEffect } from "react";
import ChatInputBar from "./ChatInputBar";
import ScottyAvatar from "./ScottyAvatar";
import { MicIcon, MenuIcon, ShareIcon, DownloadIcon, VolumeIcon } from "./Icons";
import "./PersonaView.css";
import "./ChatInterface.css";

const MUTE_STORAGE_KEY = "mytartan-persona-muted";

function readMutedPreference() {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function usePersonaSpeech(avatarRef) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [caption, setCaption] = useState("");
  const speakTimerRef = useRef(null);

  const speakBrowser = useCallback((text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onstart = () => { setIsSpeaking(true); setCaption(""); };
    utterance.onboundary = (e) => {
      if (e.name === "word") setCaption(text.slice(0, e.charIndex + e.charLength));
    };
    utterance.onend = () => { setIsSpeaking(false); setCaption(text); };
    utterance.onerror = () => { setIsSpeaking(false); setCaption(text); };
    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback(async (text) => {
    clearTimeout(speakTimerRef.current);
    if (avatarRef?.current) {
      try {
        await avatarRef.current.speak(text);
        setIsSpeaking(true);
        setCaption(text);
        const ms = Math.max(2500, text.split(" ").length * 450);
        speakTimerRef.current = setTimeout(() => setIsSpeaking(false), ms);
        return;
      } catch (err) {
        console.warn("[PersonaView] LiveAvatar unavailable, using browser TTS:", err.message);
      }
    }
    speakBrowser(text);
  }, [avatarRef, speakBrowser]);

  const stop = useCallback(() => {
    clearTimeout(speakTimerRef.current);
    window.speechSynthesis?.cancel();
    avatarRef?.current?.stop?.();
    setIsSpeaking(false);
  }, [avatarRef]);

  useEffect(() => () => { clearTimeout(speakTimerRef.current); window.speechSynthesis?.cancel(); }, []);

  return { isSpeaking, caption, speak, stop, setCaption };
}

function useMicInput({ onResult }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const toggle = useCallback(() => {
    if (listening) { recognitionRef.current?.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice input isn't supported here. Try Chrome."); return; }
    const r = new SR();
    r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 1;
    r.onstart = () => setListening(true);
    r.onresult = (e) => { const t = e.results[0][0].transcript; if (t.trim()) onResult(t.trim()); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognitionRef.current = r;
    r.start();
  }, [listening, onResult]);

  return { listening, toggle };
}

function PersonaView({
  chatSessionKey = 0,
  messages = [],
  isLoading,
  onSend,
  onStop,
  onShare,
  onDownload,
  onOpenMenu,
  isDesktop,
  lastReply,
  voiceModeRef,
  avatarRef,
}) {
  const { isSpeaking, caption, speak, stop, setCaption } = usePersonaSpeech(avatarRef);
  const [isMuted, setIsMuted] = useState(readMutedPreference);
  const prevLoadingRef = useRef(false);
  const messagesEndRef = useRef(null);
  const hasMessages = messages.length > 0;

  useEffect(() => {
    stop();
    setCaption("");
    prevLoadingRef.current = false;
    voiceModeRef.current = false;
  }, [chatSessionKey, stop, setCaption, voiceModeRef]);

  const handleStop = useCallback(() => {
    stop();
    onStop?.();
  }, [stop, onStop]);

  const handleVoiceResult = useCallback((transcript) => {
    stop();
    voiceModeRef.current = true;
    setCaption("");
    onSend(transcript);
  }, [onSend, voiceModeRef, stop, setCaption]);

  const { listening, toggle: toggleMic } = useMicInput({ onResult: handleVoiceResult });

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUTE_STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      if (next) stop();
      return next;
    });
  }, [stop]);

  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoading;
    if (wasLoading && !isLoading && lastReply) {
      voiceModeRef.current = false;
      if (isMuted) {
        setCaption(lastReply);
      } else {
        speak(lastReply);
      }
    }
  }, [isLoading, lastReply, isMuted, voiceModeRef, speak, setCaption]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const micLabel = isLoading ? "Processing…" : listening ? "Listening…" : "Tap to speak";

  const captionText = isLoading
    ? "Thinking…"
    : caption || null;

  const avatarState = isSpeaking ? "speaking" : listening ? "listening" : "idle";
  const showIdleHint = !captionText && !isSpeaking && !isLoading && !hasMessages;

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
        <div className="pv-header__actions">
          <button
            type="button"
            className={`pv-icon-btn${isMuted ? " pv-icon-btn--active" : ""}`}
            aria-label={isMuted ? "Unmute persona" : "Mute persona"}
            aria-pressed={isMuted}
            title={isMuted ? "Unmute persona" : "Mute persona"}
            onClick={toggleMute}
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
          <div className="pv-messages message-history">
            {messages.map((message, index) => {
              const isUser = message.role === "user";
              const msgId = message.id ?? index;
              return (
                <div
                  key={msgId}
                  className={`msg-row${isUser ? " msg-row--user" : " msg-row--assistant"}`}
                >
                  <div className={`msg-bubble msg-bubble--on-pattern${isUser ? " msg-bubble--user" : " msg-bubble--assistant"}`}>
                    {message.content}
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
            <div ref={messagesEndRef} />
          </div>
        )}

        <div className="pv-stage">
          <div className={`pv-avatar-frame pv-avatar-frame--${avatarState}`}>
            <div className="pv-avatar-inner">
              <ScottyAvatar ref={avatarRef} persona />
            </div>
            <div className="pv-avatar-ring" aria-hidden="true" />
          </div>

          {!hasMessages && (
            <div className="pv-identity">
              <p className="pv-identity__name brand-display">My Tartan</p>
              <p className="pv-identity__role">
                <span className="pv-identity__dot" />
                CMU-Q Student Assistant
              </p>
            </div>
          )}

          {(captionText || isSpeaking) && (
            <div className={`pv-captions${isLoading ? " pv-captions--thinking" : ""}`}>
              <p className="pv-captions__text">{captionText}</p>
              {(isSpeaking || isLoading) && (
                <button type="button" className="pv-stop-btn" onClick={handleStop}>
                  <span className="pv-stop-btn__icon" />
                  Stop
                </button>
              )}
            </div>
          )}

          {showIdleHint && (
            <p className="pv-idle-hint">Ask me anything about CMU-Q</p>
          )}
        </div>
      </main>

      <footer className="pv-footer">
        <div className={`pv-mic-wrap${listening ? " pv-mic-wrap--active" : ""}`}>
          {listening && (
            <>
              <span className="pv-sonar pv-sonar--1" aria-hidden="true" />
              <span className="pv-sonar pv-sonar--2" aria-hidden="true" />
              <span className="pv-sonar pv-sonar--3" aria-hidden="true" />
            </>
          )}
          <button
            type="button"
            className={`pv-mic-btn${listening ? " pv-mic-btn--active" : ""}`}
            onClick={toggleMic}
            disabled={isLoading}
            aria-label={listening ? "Stop listening" : "Speak to MyTartan"}
          >
            <MicIcon active={listening} />
          </button>
        </div>
        <p className={`pv-mic-label${isLoading ? " pv-mic-label--muted" : ""}${listening ? " pv-mic-label--live" : ""}`}>
          {micLabel}
        </p>
        <div className="pv-input-area">
          <ChatInputBar
            onSend={onSend}
            isLoading={isLoading}
            voiceModeRef={voiceModeRef}
            compact
          />
        </div>
      </footer>
    </div>
  );
}

export default PersonaView;
