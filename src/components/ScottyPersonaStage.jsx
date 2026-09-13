import ScottyAvatar from "./ScottyAvatar";
import ScottyHeadbandFrame from "./ScottyHeadbandFrame";
import { VolumeIcon } from "./Icons";
import "./ScottyPersonaStage.css";

const STATE_SUBTITLE = {
  speaking: "Talking with you",
  listening: "Listening…",
  thinking: "Thinking…",
};

function ScottyPersonaStage({
  avatarRef,
  avatarState = "idle",
  title = "Scotty",
  subtitle = "Your CMU-Q classmate",
  hint = "",
  compact = false,
  rail = false,
  hero = false,
  tone,
  isMuted = false,
  onToggleMute,
  children,
}) {
  const resolvedTone = tone || (rail ? "dark" : "cream");
  const liveSubtitle = STATE_SUBTITLE[avatarState] || subtitle;

  return (
    <aside
      className={`scotty-persona scotty-persona--${resolvedTone}${
        compact ? " scotty-persona--compact" : ""
      }${rail ? " scotty-persona--rail" : ""}${hero ? " scotty-persona--hero" : ""}`}
      aria-label="Scotty persona"
      data-avatar-state={avatarState}
    >
      <div className={`sp-stage sp-stage--${avatarState}`}>
        <div className={`sp-avatar-frame sp-avatar-frame--${avatarState}`}>
          <span className="sp-avatar-glow" aria-hidden="true" />
          <ScottyHeadbandFrame avatarState={avatarState} className="shb--sm">
            <ScottyAvatar ref={avatarRef} persona avatarState={avatarState} />
          </ScottyHeadbandFrame>
        </div>

        <div className="sp-identity">
          <p className="sp-identity__name brand-display">{title}</p>
          <p className="sp-identity__role">
            <span className={`sp-identity__dot sp-identity__dot--${avatarState}`} />
            {liveSubtitle}
          </p>
          {hint && <p className="sp-identity__hint">{hint}</p>}
          {children}
          {onToggleMute && (
            <button
              type="button"
              className={`sp-mute-btn${isMuted ? " sp-mute-btn--active" : ""}`}
              aria-label={isMuted ? "Unmute persona" : "Mute persona"}
              aria-pressed={isMuted}
              title={isMuted ? "Unmute persona" : "Mute persona"}
              onClick={onToggleMute}
            >
              <VolumeIcon muted={isMuted} />
              {isMuted ? "Unmute Scotty" : "Mute Scotty"}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

export default ScottyPersonaStage;
