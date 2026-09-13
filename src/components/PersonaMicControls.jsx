import ChatInputBar from "./ChatInputBar";
import { MicIcon } from "./Icons";
import "./PersonaMicControls.css";

function PersonaMicControls({
  listening = false,
  reviewing = false,
  isLoading = false,
  isSpeaking = false,
  micLabel,
  onMicClick,
  onSend,
  voiceModeRef,
  placeholder = "or type here",
  inputOnly = false,
  micOnly = false,
  showComposerMic = false,
  value,
  onChange,
}) {
  const label =
    micLabel ??
    (isLoading
      ? "Thinking…"
      : listening
        ? "Listening… tap again when you're done"
        : reviewing
          ? "Edit if needed, then send — or tap the mic"
        : isSpeaking
          ? "Tap to stop"
          : "Tap the mic");

  return (
    <div className="persona-mic-controls">
      {!inputOnly && (
        <>
          <div className={`pmc-wrap${listening ? " pmc-wrap--active" : ""}`}>
            {(listening || reviewing) && (
              <>
                <span className="pmc-sonar pmc-sonar--1" aria-hidden="true" />
                <span className="pmc-sonar pmc-sonar--2" aria-hidden="true" />
                <span className="pmc-sonar pmc-sonar--3" aria-hidden="true" />
              </>
            )}
            <button
              type="button"
              className={`pmc-btn${listening || reviewing ? " pmc-btn--active" : ""}`}
              onClick={onMicClick}
              disabled={isLoading}
              aria-label={
                isSpeaking
                  ? "Stop speaking"
                  : listening
                    ? "Stop listening"
                    : reviewing
                      ? "Send voice note"
                      : "Speak to Scotty"
              }
            >
              <MicIcon active={listening} />
            </button>
          </div>
          <p
            className={`pmc-label${isLoading ? " pmc-label--muted" : ""}${
              listening || reviewing ? " pmc-label--live" : ""
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
            showMic={showComposerMic}
            onMicClick={onMicClick}
            micActive={listening}
            reviewing={reviewing}
            value={value}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
}

export default PersonaMicControls;
