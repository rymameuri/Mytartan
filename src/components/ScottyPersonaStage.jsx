import ScottyAvatar from "./ScottyAvatar";
import { VolumeIcon } from "./Icons";
import "./ScottyPersonaStage.css";

function ScottyPersonaStage({
  avatarRef,
  avatarState = "idle",
  title = "My Tartan",
  subtitle = "CMU-Q Student Assistant",
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
          <div className="sp-scotty-ears" aria-hidden="true">
            <span className="sp-dog-ear sp-dog-ear--left">
              <span className="sp-dog-ear__inner" />
              <span className="sp-dog-ear__fur" />
            </span>
            <span className="sp-dog-ear sp-dog-ear--right">
              <span className="sp-dog-ear__inner" />
              <span className="sp-dog-ear__fur" />
            </span>
          </div>
          <div className="sp-avatar-inner">
            <ScottyAvatar ref={avatarRef} persona />
          </div>
          <div className="sp-scotty-whiskers" aria-hidden="true">
            <span className="sp-scotty-whisker sp-scotty-whisker--l1" />
            <span className="sp-scotty-whisker sp-scotty-whisker--l2" />
            <span className="sp-scotty-whisker sp-scotty-whisker--l3" />
            <span className="sp-scotty-whisker sp-scotty-whisker--r1" />
            <span className="sp-scotty-whisker sp-scotty-whisker--r2" />
            <span className="sp-scotty-whisker sp-scotty-whisker--r3" />
          </div>
          <div className="sp-avatar-ring" aria-hidden="true" />
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
