import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon } from "./Icons";
import { getSourceTypeLabel } from "../utils/sourceStudy";
import "./SourceReader.css";

function SourceReader({ source, onClose, onAskScotty }) {
  const contentRef = useRef(null);
  const [selection, setSelection] = useState(null);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    clearSelection();
  }, [source?.id, clearSelection]);

  function handleMouseUp() {
    const selectedText = window.getSelection()?.toString().trim();
    if (!selectedText || !contentRef.current) {
      setSelection(null);
      return;
    }

    const range = window.getSelection()?.getRangeAt(0);
    if (!range || !contentRef.current.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }

    if (selectedText.length < 3) {
      setSelection(null);
      return;
    }

    setSelection(selectedText);
  }

  function handleAskFullSource() {
    onAskScotty?.({ title: source.title, materialId: source.id, excerpt: null });
  }

  function handleAskSelection() {
    if (!selection) return;
    onAskScotty?.({
      title: source.title,
      materialId: source.id,
      excerpt: selection,
    });
    clearSelection();
  }

  if (!source) return null;

  const typeLabel = source.isSyllabus ? "Syllabus" : getSourceTypeLabel(source);

  return (
    <div className="source-reader">
      <header className="source-reader__header">
        <button type="button" className="source-reader__back" onClick={onClose}>
          ← Sources
        </button>
        <button type="button" className="source-reader__close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>

      <div className="source-reader__meta">
        <span className="source-reader__type">{typeLabel}</span>
        <h3 className="source-reader__title">{source.title}</h3>
      </div>

      <div className="source-reader__actions">
        <button type="button" className="source-reader__ask-btn" onClick={handleAskFullSource}>
          Ask Scotty about this source
        </button>
      </div>

      <div
        ref={contentRef}
        className="source-reader__content"
        onMouseUp={handleMouseUp}
        role="document"
        aria-label={source.title}
      >
        {source.content?.trim() ? (
          source.content.split("\n").map((paragraph, index) => (
            <p key={index} className="source-reader__paragraph">
              {paragraph.trim() || "\u00a0"}
            </p>
          ))
        ) : (
          <p className="source-reader__empty">No content in this source.</p>
        )}
      </div>

      {selection && (
        <div className="source-reader__selection-bar">
          <span className="source-reader__selection-preview">
            &ldquo;{selection.length > 60 ? `${selection.slice(0, 60)}…` : selection}&rdquo;
          </span>
          <button type="button" className="source-reader__ask-btn" onClick={handleAskSelection}>
            Ask about selection
          </button>
          <button type="button" className="source-reader__clear-btn" onClick={clearSelection}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

export default SourceReader;
