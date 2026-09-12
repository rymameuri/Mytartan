import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import tartanScottyFacialBase from "../assets/tartan-scotty-facial-base.png";
import {
  DEFAULT_FACIAL_COORDS,
  buildFacialCss,
  clearFacialCoords,
  facialCoordsToStyle,
  loadFacialCoords,
  saveFacialCoords,
} from "../utils/facialCoords";
import "./ScottyAvatar.css";
import "./FacialAlignTool.css";

const MOUTH_PREVIEWS = [
  { id: "small", label: "Small open" },
  { id: "wide", label: "Wide open" },
  { id: "closed", label: "Closed" },
  { id: "speaking", label: "Speaking" },
];

function round1(n) {
  return Math.round(n * 10) / 10;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function SliderRow({ id, label, value, min, max, step, onChange }) {
  return (
    <label className="fat-slider" htmlFor={id}>
      <span className="fat-slider__meta">
        <span>{label}</span>
        <span>{value}%</span>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function FacialAlignTool() {
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const coordsRef = useRef(null);
  const [coords, setCoords] = useState(loadFacialCoords);
  const [selected, setSelected] = useState("mouth");
  const [mouthPreview, setMouthPreview] = useState("small");
  const [freezeMotion, setFreezeMotion] = useState(true);
  const [copied, setCopied] = useState(false);
  const [savedNote, setSavedNote] = useState("");

  coordsRef.current = coords;
  const cssSnippet = useMemo(() => buildFacialCss(coords), [coords]);
  const speaking = mouthPreview === "speaking";

  useEffect(() => {
    saveFacialCoords(coords);
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
        next.mouthLeft = round1(clamp(xPct - drag.offsetX, 0, 100));
        next.mouthTop = round1(clamp(yPct - drag.offsetY, 0, 100));
      } else if (drag.target === "mouth-resize") {
        const halfW = Math.abs(xPct - prev.mouthLeft);
        const halfH = Math.abs(yPct - prev.mouthTop);
        next.mouthWidth = round1(clamp(halfW * 2, 3, 40));
        next.mouthHeight = round1(clamp(halfH * 2, 1.5, 30));
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
    const stage = stageRef.current;
    const current = coordsRef.current;
    let offsetX = 0;
    let offsetY = 0;

    if (target === "mouth" && stage && current) {
      const rect = stage.getBoundingClientRect();
      if (rect.width && rect.height) {
        const xPct = ((point.clientX - rect.left) / rect.width) * 100;
        const yPct = ((point.clientY - rect.top) / rect.height) * 100;
        offsetX = xPct - current.mouthLeft;
        offsetY = yPct - current.mouthTop;
      }
    }

    dragRef.current = { target, offsetX, offsetY };
  }

  function setCoord(key, value) {
    setCoords((prev) => ({ ...prev, [key]: value }));
    if (key.startsWith("mouth")) setSelected("mouth");
    if (key.startsWith("eye")) setSelected(key === "eyeRight" ? "eye-right" : "eye-left");
  }

  function nudge(key, delta) {
    setCoords((prev) => {
      const bounds = key.includes("Width") || key.includes("Height") || key === "eyeWidth"
        ? [1.5, 40]
        : [0, 100];
      return {
        ...prev,
        [key]: round1(clamp(prev[key] + delta, bounds[0], bounds[1])),
      };
    });
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

  function saveLook() {
    saveFacialCoords(coords);
    setSavedNote("Saved. Open the app and Scotty will use this mouth position and size.");
    copyCss();
  }

  function resetDefaults() {
    clearFacialCoords();
    setCoords({ ...DEFAULT_FACIAL_COORDS });
    setSavedNote("Reset to the default face.");
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
          <h1>Scotty face editor</h1>
          <p>
            Drag the mouth, pull the red handle to scale it, or use the sliders.
            Changes save automatically and show up in the persona view.
          </p>
        </div>
        <a className="fat-link" href="/">
          Back to app
        </a>
      </header>

      <div className="fat-layout">
        <div className="fat-preview">
          <div className={stageClass}>
            <div
              className={`scotty-avatar scotty-avatar--persona fat-avatar fat-avatar--${mouthPreview}`}
              style={facialCoordsToStyle(coords)}
            >
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
                        style={{ animation: "none" }}
                        onPointerDown={(e) => startDrag("eye-left", e)}
                      >
                        <span className="scotty-avatar__pupil" />
                        <span className="fat-label">L</span>
                      </span>
                      <span
                        className={`scotty-avatar__eye scotty-avatar__eye--right fat-handle${
                          selected === "eye-right" ? " fat-handle--active" : ""
                        }`}
                        style={{ animation: "none" }}
                        onPointerDown={(e) => startDrag("eye-right", e)}
                      >
                        <span className="scotty-avatar__pupil" />
                        <span className="fat-label">R</span>
                      </span>
                    </div>

                    <span className="scotty-avatar__mouth">
                      <span className="scotty-avatar__mouth-state scotty-avatar__mouth-state--closed" />
                      <span className="scotty-avatar__mouth-state scotty-avatar__mouth-state--small">
                        <span className="scotty-avatar__mouth-opening" />
                        <span className="scotty-avatar__tongue" />
                      </span>
                      <span className="scotty-avatar__mouth-state scotty-avatar__mouth-state--wide">
                        <span className="scotty-avatar__mouth-opening" />
                        <span className="scotty-avatar__tongue" />
                      </span>
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
            <fieldset className="fat-preview-modes">
              <legend>Mouth preview</legend>
              {MOUTH_PREVIEWS.map((option) => (
                <label key={option.id}>
                  <input
                    type="radio"
                    name="mouth-preview"
                    checked={mouthPreview === option.id}
                    onChange={() => setMouthPreview(option.id)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          </div>

          <div className="fat-sliders">
            <h2>Mouth</h2>
            <SliderRow
              id="mouth-left"
              label="Move left / right"
              value={coords.mouthLeft}
              min={20}
              max={80}
              step={0.1}
              onChange={(value) => setCoord("mouthLeft", value)}
            />
            <SliderRow
              id="mouth-top"
              label="Move up / down"
              value={coords.mouthTop}
              min={45}
              max={80}
              step={0.1}
              onChange={(value) => setCoord("mouthTop", value)}
            />
            <SliderRow
              id="mouth-width"
              label="Width"
              value={coords.mouthWidth}
              min={3}
              max={40}
              step={0.1}
              onChange={(value) => setCoord("mouthWidth", value)}
            />
            <SliderRow
              id="mouth-height"
              label="Height"
              value={coords.mouthHeight}
              min={1.5}
              max={30}
              step={0.1}
              onChange={(value) => setCoord("mouthHeight", value)}
            />
          </div>

          <div className="fat-sliders">
            <h2>Eyes</h2>
            <SliderRow
              id="eye-top"
              label="Move up / down"
              value={coords.eyeTop}
              min={20}
              max={55}
              step={0.1}
              onChange={(value) => setCoord("eyeTop", value)}
            />
            <SliderRow
              id="eye-width"
              label="Size"
              value={coords.eyeWidth}
              min={3}
              max={14}
              step={0.1}
              onChange={(value) => setCoord("eyeWidth", value)}
            />
          </div>

          <div className="fat-nudge">
            <h2>Nudge selected ({selected})</h2>
            <div className="fat-nudge-grid">
              <button
                type="button"
                onClick={() => {
                  if (selected === "eye-left") nudge("eyeLeft", -0.2);
                  if (selected === "eye-right") nudge("eyeRight", 0.2);
                  if (selected === "mouth") nudge("mouthLeft", -0.2);
                }}
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selected === "eye-left" || selected === "eye-right") nudge("eyeTop", -0.2);
                  if (selected === "mouth") nudge("mouthTop", -0.2);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selected === "eye-left") nudge("eyeLeft", 0.2);
                  if (selected === "eye-right") nudge("eyeRight", -0.2);
                  if (selected === "mouth") nudge("mouthLeft", 0.2);
                }}
              >
                →
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selected === "eye-left" || selected === "eye-right") nudge("eyeTop", 0.2);
                  if (selected === "mouth") nudge("mouthTop", 0.2);
                }}
              >
                ↓
              </button>
            </div>
            {selected === "mouth" && (
              <div className="fat-size-row">
                <button type="button" onClick={() => nudge("mouthWidth", -0.5)}>
                  Mouth −W
                </button>
                <button type="button" onClick={() => nudge("mouthWidth", 0.5)}>
                  Mouth +W
                </button>
                <button type="button" onClick={() => nudge("mouthHeight", -0.5)}>
                  Mouth −H
                </button>
                <button type="button" onClick={() => nudge("mouthHeight", 0.5)}>
                  Mouth +H
                </button>
              </div>
            )}
          </div>

          <pre className="fat-css">{cssSnippet}</pre>

          <div className="fat-actions">
            <button type="button" className="fat-btn" onClick={copyCss}>
              {copied ? "Copied" : "Copy CSS"}
            </button>
            <button type="button" className="fat-btn fat-btn--primary" onClick={saveLook}>
              Save look
            </button>
            <button type="button" className="fat-btn fat-btn--ghost" onClick={resetDefaults}>
              Reset
            </button>
          </div>

          {savedNote && <p className="fat-note">{savedNote}</p>}
        </aside>
      </div>
    </div>
  );
}

export default FacialAlignTool;
