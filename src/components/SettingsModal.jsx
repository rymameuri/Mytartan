import { useEffect } from "react";
import { CloseIcon } from "./Icons";
import CanvasConnect from "./CanvasConnect";
import "./SettingsModal.css";

function SettingsModal({ onClose, canvasConnection }) {
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
          <h3 className="settings-modal__section-title">Connect Canvas</h3>
          <CanvasConnect {...canvasConnection} />
        </section>
      </div>
    </div>
  );
}

export default SettingsModal;
