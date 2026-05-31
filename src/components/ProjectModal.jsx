import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "./Icons";
import "./ProjectModal.css";

function ProjectModal({ title, label, initialValue = "", submitLabel, onSubmit, onClose }) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <div className="project-modal__backdrop" onClick={onClose} role="presentation">
      <div
        className="project-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="project-modal__header">
          <h2 id="project-modal-title" className="project-modal__title">
            {title}
          </h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="project-modal__label" htmlFor="project-modal-input">
            {label}
          </label>
          <input
            ref={inputRef}
            id="project-modal-input"
            type="text"
            className="project-modal__input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. Fall 2026 Planning"
            maxLength={80}
          />

          <div className="project-modal__actions">
            <button type="button" className="project-modal__btn project-modal__btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="project-modal__btn project-modal__btn--primary"
              disabled={!value.trim()}
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProjectModal;
