import { useEffect, useState } from "react";
import { CloseIcon } from "./Icons";
import { importCanvasCourses, listCanvasCourses } from "../utils/courseApi";
import "./CanvasImportModal.css";

function CanvasImportModal({ token, onClose, onImported }) {
  const [courses, setCourses] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [importErrors, setImportErrors] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await listCanvasCourses(token);
        if (!cancelled) {
          setCourses(data);
          setSelected(new Set(data.filter((c) => !c.alreadyImported).map((c) => c.id)));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load Canvas courses");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function toggleCourse(courseId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  async function handleImport(event) {
    event.preventDefault();
    if (selected.size === 0) {
      setError("Select at least one course to import");
      return;
    }

    setImporting(true);
    setError("");
    setImportErrors([]);

    try {
      const result = await importCanvasCourses([...selected], token);
      setImportErrors(result.errors ?? []);
      onImported?.(result.courses ?? []);
      if ((result.errors ?? []).length === 0) {
        onClose();
      }
    } catch (err) {
      setError(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="canvas-import__backdrop" onClick={onClose} role="presentation">
      <div
        className="canvas-import"
        role="dialog"
        aria-modal="true"
        aria-labelledby="canvas-import-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="canvas-import__header">
          <h2 id="canvas-import-title" className="canvas-import__title">
            Import from Canvas
          </h2>
          <button type="button" className="canvas-import__close" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        {loading && <p className="canvas-import__muted">Loading Canvas courses…</p>}
        {error && <p className="canvas-import__error">{error}</p>}

        {!loading && courses.length === 0 && !error && (
          <p className="canvas-import__muted">No active Canvas courses found.</p>
        )}

        {!loading && courses.length > 0 && (
          <form onSubmit={handleImport}>
            <ul className="canvas-import__list">
              {courses.map((course) => (
                <li key={course.id} className="canvas-import__item">
                  <label className="canvas-import__label">
                    <input
                      type="checkbox"
                      checked={selected.has(course.id)}
                      onChange={() => toggleCourse(course.id)}
                    />
                    <span className="canvas-import__course-text">
                      <strong>{course.name}</strong>
                      {course.courseCode && (
                        <span className="canvas-import__code"> ({course.courseCode})</span>
                      )}
                      {course.term && (
                        <span className="canvas-import__term"> · {course.term}</span>
                      )}
                      {course.alreadyImported && (
                        <span className="canvas-import__imported-badge">Already imported</span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            {importErrors.length > 0 && (
              <ul className="canvas-import__errors">
                {importErrors.map((item) => (
                  <li key={item.canvasCourseId}>
                    Course {item.canvasCourseId}: {item.message}
                  </li>
                ))}
              </ul>
            )}

            <div className="canvas-import__actions">
              <button type="button" className="canvas-import__secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="canvas-import__primary"
                disabled={importing || selected.size === 0}
              >
                {importing ? "Importing…" : `Import ${selected.size} course${selected.size === 1 ? "" : "s"}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default CanvasImportModal;
