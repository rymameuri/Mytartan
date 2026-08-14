import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import tartanScottyFacialBase from "../assets/tartan-scotty-facial-base.png";
import scottyMouthClosed from "../assets/scotty-mouth-closed.png";
import scottyMouthSmallOpen from "../assets/scotty-mouth-small-open.png";
import scottyMouthWideOpen from "../assets/scotty-mouth-wide-open.png";
import "./ScottyAvatar.css";
import "./FacialAlignTool.css";

const STORAGE_KEY = "scotty-facial-align-v1";

const DEFAULTS = {
  eyeTop: 36.5,
  eyeLeft: 34.7,
  eyeRight: 34.7,
  eyeWidth: 7.6,
  mouthTop: 60.8,
  mouthLeft: 50,
  mouthWidth: 31,
  mouthHeight: 31,
};

function round1(n) {
  return Math.round(n * 10) / 10;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function buildCss(coords) {
  return `/* Locked facial coordinates — paste into ScottyAvatar.css */
.scotty-avatar__eye {
  top: ${coords.eyeTop}%;
  width: ${coords.eyeWidth}%;
}

.scotty-avatar__eye--left {
  left: ${coords.eyeLeft}%;
}

.scotty-avatar__eye--right {
  right: ${coords.eyeRight}%;
}

.scotty-avatar__mouth-shape {
  left: ${coords.mouthLeft}%;
  top: ${coords.mouthTop}%;
  width: ${coords.mouthWidth}%;
  height: ${coords.mouthHeight}%;
}`;
}

function FacialAlignTool() {
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const [coords, setCoords] = useState(loadSaved);
  const [selected, setSelected] = useState("mouth");
  const [speaking, setSpeaking] = useState(false);
  const [freezeMotion, setFreezeMotion] = useState(true);
  const [copied, setCopied] = useState(false);
  const [lockedNote, setLockedNote] = useState("");

  const cssSnippet = useMemo(() => buildCss(coords), [coords]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
  }, [coords]);

  const updateFromPointer = useCallback((clientX, clientY) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage) return;

    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const xPct = ((clientX - rect.left) / rect.width) * 100;
    const yPct = ((clientY - rect.top) / rect.height) * 100;

    setCoords((prev) => {
      const next = { ...prev };

      if (drag.target === "eye-left") {
        next.eyeTop = round1(clamp(yPct - prev.eyeWidth / 2, 0, 100));
        next.eyeLeft = round1(clamp(xPct - prev.eyeWidth / 2, 0, 100));
      } else if (drag.target === "eye-right") {
        next.eyeTop = round1(clamp(yPct - prev.eyeWidth / 2, 0, 100));
        next.eyeRight = round1(clamp(100 - (xPct + prev.eyeWidth / 2), 0, 100));
      } else if (drag.target === "mouth") {
        next.mouthLeft = round1(clamp(xPct, 0, 100));
        next.mouthTop = round1(clamp(yPct, 0, 100));
      } else if (drag.target === "mouth-resize") {
        const halfW = Math.abs(xPct - prev.mouthLeft);
        const halfH = Math.abs(yPct - prev.mouthTop);
        next.mouthWidth = round1(clamp(halfW * 2, 8, 80));
        next.mouthHeight = round1(clamp(halfH * 2, 8, 80));
      }

      return next;
    });
  }, []);

  useEffect(() => {
    function onMove(event) {
      if (!dragRef.current) return;
      event.preventDefault();
      const point = event.touches ? event.touches[0] : event;
      updateFromPointer(point.clientX, point.clientY);
    }

    function onUp() {
      dragRef.current = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [updateFromPointer]);

  function startDrag(target, event) {
    event.preventDefault();
    event.stopPropagation();
    setSelected(target.startsWith("mouth") ? "mouth" : target);
    const point = event.touches ? event.touches[0] : event;
    dragRef.current = { target };
    updateFromPointer(point.clientX, point.clientY);
  }

  function nudge(key, delta) {
    setCoords((prev) => ({
      ...prev,
      [key]: round1(clamp(prev[key] + delta, 0, 100)),
    }));
  }

  async function copyCss() {
    try {
      await navigator.clipboard.writeText(cssSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function lockForAgent() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
    setLockedNote(
      "Coordinates saved. Tell the agent: “lock the facial coordinates from FacialAlignTool”"
    );
    copyCss();
  }

  function resetDefaults() {
    setCoords({ ...DEFAULTS });
    setLockedNote("");
  }

  const stageClass = [
    "fat-stage",
    "pv-avatar-frame",
    freezeMotion && "fat-stage--frozen",
    speaking && "fat-stage--speaking shb--speaking pv-avatar-frame--speaking",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="fat">
      <header className="fat-header">
        <div>
          <h1>Scotty facial align</h1>
          <p>
            Same square frame as the app. Eyes/mouth are constrained inside the avatar
            group — drag, then Lock.
          </p>
        </div>
        <a className="fat-link" href="/">
          Back to app
        </a>
      </header>

      <div className="fat-layout">
        <div className="fat-preview">
          <div className={stageClass}>
            <div className="scotty-avatar scotty-avatar--persona fat-avatar">
              <div className="scotty-avatar__mascot-stage" aria-hidden="true">
                <div className="scotty-avatar__figure">
                  <img
                    className="scotty-avatar__mascot"
                    src={tartanScottyFacialBase}
                    alt=""
                    draggable="false"
                  />
                  <div className="scotty-avatar__facial-stage" ref={stageRef}>
                    <div className="scotty-avatar__eyes">
                      <span
                        className={`scotty-avatar__eye scotty-avatar__eye--left fat-handle${
                          selected === "eye-left" ? " fat-handle--active" : ""
                        }`}
                        style={{
                          top: `${coords.eyeTop}%`,
                          left: `${coords.eyeLeft}%`,
                          width: `${coords.eyeWidth}%`,
                          animation: "none",
                        }}
                        onPointerDown={(e) => startDrag("eye-left", e)}
                      >
                        <span className="scotty-avatar__pupil" />
                        <span className="fat-label">L</span>
                      </span>
                      <span
                        className={`scotty-avatar__eye scotty-avatar__eye--right fat-handle${
                          selected === "eye-right" ? " fat-handle--active" : ""
                        }`}
                        style={{
                          top: `${coords.eyeTop}%`,
                          right: `${coords.eyeRight}%`,
                          width: `${coords.eyeWidth}%`,
                          animation: "none",
                        }}
                        onPointerDown={(e) => startDrag("eye-right", e)}
                      >
                        <span className="scotty-avatar__pupil" />
                        <span className="fat-label">R</span>
                      </span>
                    </div>

                    <span className="scotty-avatar__mouth">
                      <img
                        className="scotty-avatar__mouth-shape scotty-avatar__mouth-shape--closed"
                        src={scottyMouthClosed}
                        alt=""
                        style={{
                          left: `${coords.mouthLeft}%`,
                          top: `${coords.mouthTop}%`,
                          width: `${coords.mouthWidth}%`,
                          height: `${coords.mouthHeight}%`,
                          opacity: speaking ? undefined : 1,
                        }}
                      />
                      <img
                        className="scotty-avatar__mouth-shape scotty-avatar__mouth-shape--small"
                        src={scottyMouthSmallOpen}
                        alt=""
                        style={{
                          left: `${coords.mouthLeft}%`,
                          top: `${coords.mouthTop}%`,
                          width: `${coords.mouthWidth}%`,
                          height: `${coords.mouthHeight}%`,
                        }}
                      />
                      <img
                        className="scotty-avatar__mouth-shape scotty-avatar__mouth-shape--wide"
                        src={scottyMouthWideOpen}
                        alt=""
                        style={{
                          left: `${coords.mouthLeft}%`,
                          top: `${coords.mouthTop}%`,
                          width: `${coords.mouthWidth}%`,
                          height: `${coords.mouthHeight}%`,
                        }}
                      />
                      <button
                        type="button"
                        className={`fat-mouth-hit fat-handle${
                          selected === "mouth" ? " fat-handle--active" : ""
                        }`}
                        style={{
                          left: `${coords.mouthLeft}%`,
                          top: `${coords.mouthTop}%`,
                          width: `${coords.mouthWidth}%`,
                          height: `${coords.mouthHeight}%`,
                        }}
                        aria-label="Drag mouth"
                        onPointerDown={(e) => startDrag("mouth", e)}
                      >
                        <span className="fat-label">Mouth</span>
                      </button>
                      <button
                        type="button"
                        className="fat-resize"
                        aria-label="Resize mouth"
                        style={{
                          left: `calc(${coords.mouthLeft}% + ${coords.mouthWidth / 2}% )`,
                          top: `calc(${coords.mouthTop}% + ${coords.mouthHeight / 2}% )`,
                        }}
                        onPointerDown={(e) => startDrag("mouth-resize", e)}
                      />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="fat-panel">
          <div className="fat-controls">
            <label>
              <input
                type="checkbox"
                checked={freezeMotion}
                onChange={(e) => setFreezeMotion(e.target.checked)}
              />
              Freeze body motion
            </label>
            <label>
              <input
                type="checkbox"
                checked={speaking}
                onChange={(e) => setSpeaking(e.target.checked)}
              />
              Preview speaking mouth
            </label>
          </div>

          <div className="fat-values">
            <h2>Coordinates</h2>
            <dl>
              <div>
                <dt>eye top</dt>
                <dd>{coords.eyeTop}%</dd>
              </div>
              <div>
                <dt>eye left</dt>
                <dd>{coords.eyeLeft}%</dd>
              </div>
              <div>
                <dt>eye right</dt>
                <dd>{coords.eyeRight}%</dd>
              </div>
              <div>
                <dt>eye width</dt>
                <dd>{coords.eyeWidth}%</dd>
              </div>
              <div>
                <dt>mouth left</dt>
                <dd>{coords.mouthLeft}%</dd>
              </div>
              <div>
                <dt>mouth top</dt>
                <dd>{coords.mouthTop}%</dd>
              </div>
              <div>
                <dt>mouth width</dt>
                <dd>{coords.mouthWidth}%</dd>
              </div>
              <div>
                <dt>mouth height</dt>
                <dd>{coords.mouthHeight}%</dd>
              </div>
            </dl>
          </div>

          <div className="fat-nudge">
            <h2>Nudge selected ({selected})</h2>
            <div className="fat-nudge-grid">
              <button type="button" onClick={() => {
                if (selected === "eye-left") nudge("eyeLeft", -0.2);
                if (selected === "eye-right") nudge("eyeRight", 0.2);
                if (selected === "mouth") nudge("mouthLeft", -0.2);
              }}>←</button>
              <button type="button" onClick={() => {
                if (selected === "eye-left" || selected === "eye-right") nudge("eyeTop", -0.2);
                if (selected === "mouth") nudge("mouthTop", -0.2);
              }}>↑</button>
              <button type="button" onClick={() => {
                if (selected === "eye-left") nudge("eyeLeft", 0.2);
                if (selected === "eye-right") nudge("eyeRight", -0.2);
                if (selected === "mouth") nudge("mouthLeft", 0.2);
              }}>→</button>
              <button type="button" onClick={() => {
                if (selected === "eye-left" || selected === "eye-right") nudge("eyeTop", 0.2);
                if (selected === "mouth") nudge("mouthTop", 0.2);
              }}>↓</button>
            </div>
            {selected === "mouth" && (
              <div className="fat-size-row">
                <button type="button" onClick={() => nudge("mouthWidth", -0.5)}>Mouth −W</button>
                <button type="button" onClick={() => nudge("mouthWidth", 0.5)}>Mouth +W</button>
                <button type="button" onClick={() => nudge("mouthHeight", -0.5)}>Mouth −H</button>
                <button type="button" onClick={() => nudge("mouthHeight", 0.5)}>Mouth +H</button>
              </div>
            )}
            {(selected === "eye-left" || selected === "eye-right") && (
              <div className="fat-size-row">
                <button type="button" onClick={() => nudge("eyeWidth", -0.2)}>Eyes −</button>
                <button type="button" onClick={() => nudge("eyeWidth", 0.2)}>Eyes +</button>
              </div>
            )}
          </div>

          <pre className="fat-css">{cssSnippet}</pre>

          <div className="fat-actions">
            <button type="button" className="fat-btn" onClick={copyCss}>
              {copied ? "Copied" : "Copy CSS"}
            </button>
            <button type="button" className="fat-btn fat-btn--primary" onClick={lockForAgent}>
              Lock coordinates
            </button>
            <button type="button" className="fat-btn fat-btn--ghost" onClick={resetDefaults}>
              Reset
            </button>
          </div>

          {lockedNote && <p className="fat-note">{lockedNote}</p>}
        </aside>
      </div>
    </div>
  );
}

export default FacialAlignTool;
