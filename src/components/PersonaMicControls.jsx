import ChatInputBar from "./ChatInputBar";
import { MicIcon } from "./Icons";
import "./PersonaMicControls.css";

function PersonaMicControls({
  listening = false,
  isLoading = false,
  isSpeaking = false,
  micLabel,
  onMicClick,
  onSend,
  voiceModeRef,
  placeholder = "Ask MyTartan anything...",
  inputOnly = false,
  micOnly = false,
}) {
  const label =
    micLabel ??
    (isLoading
      ? "Processing…"
      : listening
        ? "Listening…"
        : isSpeaking
          ? "Tap to stop"
          : "Tap to speak to Scotty");

  return (
    <div className="persona-mic-controls">
      {!inputOnly && (
        <>
          <div className={`pmc-wrap${listening ? " pmc-wrap--active" : ""}`}>
            {listening && (
              <>
                <span className="pmc-sonar pmc-sonar--1" aria-hidden="true" />
                <span className="pmc-sonar pmc-sonar--2" aria-hidden="true" />
                <span className="pmc-sonar pmc-sonar--3" aria-hidden="true" />
              </>
            )}
            <button
              type="button"
              className={`pmc-btn${listening ? " pmc-btn--active" : ""}`}
              onClick={onMicClick}
              disabled={isLoading}
              aria-label={
                isSpeaking ? "Stop speaking" : listening ? "Stop listening" : "Speak to Scotty"
              }
            >
              <MicIcon active={listening} />
            </button>
          </div>
          <p
            className={`pmc-label${isLoading ? " pmc-label--muted" : ""}${
              listening ? " pmc-label--live" : ""
            }`}
          >
            {label}
          </p>
        </>
      )}
      {!micOnly && (
        <div className="pmc-input">
          <ChatInputBar
            onSend={onSend}
            isLoading={isLoading}
            voiceModeRef={voiceModeRef}
            compact
            placeholder={placeholder}
          />
        </div>
      )}
    </div>
  );
}

export default PersonaMicControls;
