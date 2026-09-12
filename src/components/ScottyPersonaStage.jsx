import ScottyAvatar from "./ScottyAvatar";
import ScottyHeadbandFrame from "./ScottyHeadbandFrame";
import { VolumeIcon } from "./Icons";
import "./ScottyPersonaStage.css";

function ScottyPersonaStage({
  avatarRef,
  avatarState = "idle",
  title = "Scotty",
  subtitle = "Your CMU-Q classmate",
  hint = "",
  compact = false,
  rail = false,
  isMuted = false,
  onToggleMute,
}) {
  return (
    <aside
      className={`scotty-persona${compact ? " scotty-persona--compact" : ""}${
        rail ? " scotty-persona--rail" : ""
      }`}
      aria-label="Scotty persona"
    >
      <div className={`sp-stage sp-stage--${avatarState}`}>
        <div className={`sp-avatar-frame sp-avatar-frame--${avatarState}`}>
          <ScottyHeadbandFrame avatarState={avatarState} className="shb--sm">
            <ScottyAvatar ref={avatarRef} persona avatarState={avatarState} />
          </ScottyHeadbandFrame>
        </div>

        <div className="sp-identity">
          <p className="sp-identity__name brand-display">{title}</p>
          <p className="sp-identity__role">
            <span className="sp-identity__dot" />
            {subtitle}
          </p>
          {hint && <p className="sp-identity__hint">{hint}</p>}
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
