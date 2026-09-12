import { useEffect } from "react";
import { CloseIcon } from "./Icons";
import CanvasConnect from "./CanvasConnect";
import { useAvatarZoom } from "../hooks/useAvatarZoom";
import { COURSE_TUTOR_ENABLED } from "../config/features";
import "./SettingsModal.css";

function SettingsModal({ onClose, canvasConnection }) {
  const { zoom, setZoom, resetZoom, minZoom, maxZoom } = useAvatarZoom();
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="settings-modal__backdrop" onClick={onClose} role="presentation">
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-modal__header">
          <h2 id="settings-modal-title" className="settings-modal__title">
            Settings
          </h2>
          <button type="button" className="settings-modal__close" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        <section className="settings-modal__section">
          <h3 className="settings-modal__section-title">Scotty look</h3>
          <p className="settings-modal__hint">
            Adjust how large Scotty appears, or open the face editor to place his mouth and eyes.
          </p>
          <label className="settings-modal__zoom">
            <span className="settings-modal__zoom-label">Scotty size</span>
            <div className="settings-modal__zoom-row">
              <input
                type="range"
                min={minZoom}
                max={maxZoom}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                aria-valuetext={`${zoom} percent`}
              />
              <span className="settings-modal__zoom-value">{zoom}%</span>
              <button type="button" className="settings-modal__text-btn" onClick={resetZoom}>
                Reset
              </button>
            </div>
          </label>
          <a className="settings-modal__link" href="/?facialAlign">
            Open face editor
          </a>
        </section>

        {COURSE_TUTOR_ENABLED && (
          <section className="settings-modal__section">
            <h3 className="settings-modal__section-title">Connect Canvas</h3>
            <CanvasConnect {...canvasConnection} />
          </section>
        )}
      </div>
    </div>
  );
}

export default SettingsModal;
