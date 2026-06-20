import ScottyHeadbandFrame from "./ScottyHeadbandFrame";
import { VolumeIcon } from "./Icons";
import "./ScottyPersonaDock.css";

function ScottyPersonaDock({
  avatarState = "idle",
  isMuted = false,
  onToggleMute,
  variant = "bar",
  children,
}) {
  const resolvedState =
    avatarState === "listening"
      ? "listening"
      : avatarState === "speaking"
        ? "speaking"
        : "idle";

  const statusLabel =
    resolvedState === "speaking"
      ? "Speaking…"
      : resolvedState === "listening"
        ? "Listening…"
        : "Ready to help";

  if (variant === "hero") {
    return (
      <div className={`sp-dock sp-dock--hero sp-dock--${resolvedState}`} aria-label="My Tartan assistant">
        <div className="sp-dock__frame">
          <ScottyHeadbandFrame avatarState={resolvedState} className="shb--sm">
            {children}
          </ScottyHeadbandFrame>
          {resolvedState === "speaking" && (
            <div className="sp-dock__waves" aria-hidden="true">
              <span /><span /><span /><span /><span />
            </div>
          )}
        </div>
        <p className="sp-dock__brand">My Tartan</p>
        <p className="sp-dock__tagline">{statusLabel}</p>
        {onToggleMute && (
          <button
            type="button"
            className={`sp-dock__mute sp-dock__mute--hero${isMuted ? " sp-dock__mute--active" : ""}`}
            aria-label={isMuted ? "Unmute Scotty" : "Mute Scotty"}
            aria-pressed={isMuted}
            onClick={onToggleMute}
          >
            <VolumeIcon muted={isMuted} />
            {isMuted ? "Unmute" : "Mute"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`sp-dock sp-dock--bar sp-dock--${resolvedState}`} aria-label="My Tartan assistant">
      <div className="sp-dock__frame sp-dock__frame--sm">
        <span className="sp-dock__ring sp-dock__ring--outer" aria-hidden="true" />
        <div className="sp-dock__avatar-wrap sp-dock__avatar-wrap--sm">{children}</div>
        <span className={`sp-dock__live-dot sp-dock__live-dot--${resolvedState}`} aria-hidden="true" />
      </div>

      <div className="sp-dock__meta">
        <span className="sp-dock__name">My Tartan</span>
        <span className="sp-dock__status">{statusLabel}</span>
      </div>

      {resolvedState === "speaking" && (
        <div className="sp-dock__waves sp-dock__waves--inline" aria-hidden="true">
          <span /><span /><span /><span /><span />
        </div>
      )}

      {onToggleMute && (
        <button
          type="button"
          className={`sp-dock__mute${isMuted ? " sp-dock__mute--active" : ""}`}
          aria-label={isMuted ? "Unmute Scotty" : "Mute Scotty"}
          aria-pressed={isMuted}
          onClick={onToggleMute}
        >
          <VolumeIcon muted={isMuted} />
        </button>
      )}
    </div>
  );
}

export default ScottyPersonaDock;
