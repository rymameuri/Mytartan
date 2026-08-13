import { forwardRef, useImperativeHandle } from "react";
import tartanScottyMascot from "../assets/tartan-scotty-mascot.png";
import "./ScottyAvatar.css";

/**
 * A lightweight expressive mascot that works without an external avatar service.
 * Speech is intentionally delegated to usePersonaSpeech's browser TTS fallback,
 * while the surrounding state classes animate the character in sync with playback.
 */
const ScottyAvatar = forwardRef(function ScottyAvatar(
  { compact = false, hero = false, persona = false, dock = false, dockLg = false, hidden = false },
  ref
) {
  useImperativeHandle(ref, () => ({
    speak() {
      return Promise.resolve({ useBrowserTts: true });
    },
    stop() {},
  }));

  const className = [
    "scotty-avatar",
    compact && "scotty-avatar--compact",
    hero && "scotty-avatar--hero",
    persona && "scotty-avatar--persona",
    dock && "scotty-avatar--dock",
    dockLg && "scotty-avatar--dock-lg",
    hidden && "scotty-avatar--hidden",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} role="img" aria-label="Scotty, the My Tartan terrier mascot">
      <div className="scotty-avatar__mascot-stage" aria-hidden="true">
        <img
          className="scotty-avatar__mascot"
          src={tartanScottyMascot}
          alt=""
          draggable="false"
        />
        <span className="scotty-avatar__mouth" />
        <span className="scotty-avatar__spark scotty-avatar__spark--one" />
        <span className="scotty-avatar__spark scotty-avatar__spark--two" />
      </div>
    </div>
  );
});

export default ScottyAvatar;
