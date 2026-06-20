import { useCallback, useEffect, useState } from "react";
import "./CourseLibrary.css";

const API_BASE = process.env.REACT_APP_API_URL || "";

async function fetchJson(url, options) {
  const response = await fetch(`${API_BASE}${url}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function courseLabel(course) {
  const code = course.courseCode ? ` (${course.courseCode})` : "";
  return `${course.courseName}${code}`;
}

function CourseLibrary({ onPickCourse, onClose }) {
  const [tab, setTab] = useState("pick");
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson("/api/courses");
      setCourses(data.courses ?? []);
    } catch (err) {
      setError(err.message || "Could not load courses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  async function handleApprove(id) {
    setBusyId(id);
    try {
      await fetchJson(`/api/courses/${id}/approve`, { method: "POST" });
      await loadCourses();
    } catch (err) {
      setError(err.message || "Could not approve course");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this saved course and all its contributions?")) return;
    setBusyId(id);
    try {
      await fetchJson(`/api/courses/${id}`, { method: "DELETE" });
      await loadCourses();
    } catch (err) {
      setError(err.message || "Could not delete course");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePick(id) {
    setBusyId(id);
    try {
      const data = await fetchJson(`/api/courses/${id}`);
      onPickCourse(data.course);
      onClose?.();
    } catch (err) {
      setError(err.message || "Could not load course");
    } finally {
      setBusyId(null);
    }
  }

  const approved = courses.filter((c) => c.status === "approved");
  const pending = courses.filter((c) => c.status === "pending");

  return (
    <div className="course-library">
      <div className="course-library__header">
        <div>
          <h3 className="course-library__title brand-display">Saved courses</h3>
          <p className="course-library__subtitle">
            Tutor messages are saved to a separate course library for review before sharing.
          </p>
        </div>
        {onClose && (
          <button type="button" className="course-library__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
      </div>

      <div className="course-library__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "pick"}
          className={`course-library__tab${tab === "pick" ? " course-library__tab--active" : ""}`}
          onClick={() => setTab("pick")}
        >
          Pick course ({approved.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "review"}
          className={`course-library__tab${tab === "review" ? " course-library__tab--active" : ""}`}
          onClick={() => setTab("review")}
        >
          Review pending ({pending.length})
        </button>
      </div>

      {error && <p className="course-library__error">{error}</p>}
      {loading && <p className="course-library__muted">Loading courses…</p>}

      {!loading && tab === "pick" && (
        <div className="course-library__list">
          {approved.length === 0 ? (
            <p className="course-library__muted">
              No approved courses yet. Submit a syllabus below or approve one in Review pending.
            </p>
          ) : (
            approved.map((course) => (
              <article key={course.id} className="course-library__card">
                <div>
                  <h4 className="course-library__card-title">{courseLabel(course)}</h4>
                  <p className="course-library__card-meta">
                    {course.instructor && `${course.instructor} · `}
                    {course.semester && `${course.semester} · `}
                    {course.contributionCount} saved message
                    {course.contributionCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="course-library__card-actions">
                  <button
                    type="button"
                    className="course-library__btn course-library__btn--primary"
                    disabled={busyId === course.id}
                    onClick={() => handlePick(course.id)}
                  >
                    Use this course
                  </button>
                  <button
                    type="button"
                    className="course-library__btn course-library__btn--danger"
                    disabled={busyId === course.id}
                    onClick={() => handleDelete(course.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {!loading && tab === "review" && (
        <div className="course-library__list">
          {pending.length === 0 ? (
            <p className="course-library__muted">No courses waiting for review.</p>
          ) : (
            pending.map((course) => (
              <article key={course.id} className="course-library__card">
                <div>
                  <h4 className="course-library__card-title">{courseLabel(course)}</h4>
                  <p className="course-library__card-meta">
                    Pending review · {course.contributionCount} saved message
                    {course.contributionCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="course-library__card-actions">
                  <button
                    type="button"
                    className="course-library__btn course-library__btn--primary"
                    disabled={busyId === course.id}
                    onClick={() => handleApprove(course.id)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="course-library__btn course-library__btn--danger"
                    disabled={busyId === course.id}
                    onClick={() => handleDelete(course.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default CourseLibrary;
