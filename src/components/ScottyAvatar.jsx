import { forwardRef, useImperativeHandle } from "react";
import tartanScottyFacialBase from "../assets/tartan-scotty-facial-base.png";
import scottyMouthClosed from "../assets/scotty-mouth-closed.png";
import scottyMouthSmallOpen from "../assets/scotty-mouth-small-open.png";
import scottyMouthWideOpen from "../assets/scotty-mouth-wide-open.png";
import "./ScottyAvatar.css";

function ScottyEyes() {
  return (
    <div className="scotty-avatar__eyes" aria-hidden="true">
      <span className="scotty-avatar__eye scotty-avatar__eye--left">
        <span className="scotty-avatar__pupil" />
      </span>
      <span className="scotty-avatar__eye scotty-avatar__eye--right">
        <span className="scotty-avatar__pupil" />
      </span>
    </div>
  );
}

function ScottyMouth() {
  return (
    <span className="scotty-avatar__mouth" aria-hidden="true">
      <img className="scotty-avatar__mouth-shape scotty-avatar__mouth-shape--closed" src={scottyMouthClosed} alt="" />
      <img className="scotty-avatar__mouth-shape scotty-avatar__mouth-shape--small" src={scottyMouthSmallOpen} alt="" />
      <img className="scotty-avatar__mouth-shape scotty-avatar__mouth-shape--wide" src={scottyMouthWideOpen} alt="" />
    </span>
  );
}

/**
 * A lightweight expressive mascot that works without an external avatar service.
 * Speech is delegated to usePersonaSpeech's browser TTS fallback, while the
 * surrounding state classes animate the character and its facial layers in sync.
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
          src={tartanScottyFacialBase}
          alt=""
          draggable="false"
        />
        <div className="scotty-avatar__facial-stage">
          <ScottyEyes />
          <ScottyMouth />
        </div>
      </div>
    </div>
  );
});

export default ScottyAvatar;
