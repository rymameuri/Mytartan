import { useCallback, useEffect, useRef, useState } from "react";
import { SAMPLE_COURSE } from "../data/sampleCourse";
import { extractSyllabusText } from "../utils/extractSyllabusText";
import {
  listCourses,
  saveCourseToLibrary,
  deleteCourse,
} from "../utils/courseApi";
import "./CourseTutorDashboard.css";

const ACCEPTED_FILE_TYPES = ".txt,.md,.csv,.pdf,.docx";

const EMPTY_FORM = {
  courseName: "",
  courseCode: "",
  instructor: "",
  semester: "",
  syllabusText: "",
  additionalNotes: "",
};

function CourseTutorDashboard({ onOpenClass, onBackToQa }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const fileInputRef = useRef(null);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCourses(await listCourses());
    } catch (err) {
      setError(err.message || "Could not load your classes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setParsingFile(true);
    try {
      const text = await extractSyllabusText(file);
      updateField("syllabusText", text);
    } catch (err) {
      setError(err.message || "Could not read file");
    } finally {
      setParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!form.courseName.trim()) {
      setError("Course name is required");
      return;
    }
    if (!form.syllabusText.trim()) {
      setError("Syllabus is required");
      return;
    }

    setSubmitting(true);
    try {
      const course = await saveCourseToLibrary({
        courseName: form.courseName.trim(),
        courseCode: form.courseCode.trim(),
        instructor: form.instructor.trim(),
        semester: form.semester.trim(),
        syllabusText: form.syllabusText.trim(),
        additionalNotes: form.additionalNotes.trim(),
      });
      setForm(EMPTY_FORM);
      setShowCreate(false);
      await loadCourses();
      onOpenClass(course);
    } catch (err) {
      setError(err.message || "Could not create class");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(courseId) {
    if (!window.confirm("Delete this class and all its materials?")) return;
    try {
      await deleteCourse(courseId);
      await loadCourses();
    } catch (err) {
      setError(err.message || "Could not delete class");
    }
  }

  return (
    <div className="tutor-dash">
      <header className="tutor-dash__header">
        <div>
          <p className="tutor-dash__eyebrow">Course Tutor</p>
          <h1 className="tutor-dash__title brand-display">Your classes</h1>
          <p className="tutor-dash__subtitle">
            Set up a class with your syllabus, add lecture materials over time, then study with
            quizzes, flashcards, or whiteboard brainstorms.
          </p>
        </div>
        <button type="button" className="tutor-dash__back-btn" onClick={onBackToQa}>
          Back to Q&amp;A
        </button>
      </header>

      <div className="tutor-dash__actions">
        <button
          type="button"
          className="tutor-dash__primary-btn tartan-btn"
          onClick={() => setShowCreate((open) => !open)}
        >
          {showCreate ? "Cancel" : "+ New class"}
        </button>
        <button
          type="button"
          className="tutor-dash__ghost-btn"
          onClick={() => {
            setForm({ ...SAMPLE_COURSE });
            setShowCreate(true);
          }}
        >
          Load sample (15-112)
        </button>
      </div>

      {showCreate && (
        <form className="tutor-dash__create-card" onSubmit={handleCreate}>
          <h2 className="tutor-dash__card-title">Set up your class</h2>
          <div className="tutor-dash__row">
            <label className="tutor-dash__field tutor-dash__field--grow">
              <span>Course name *</span>
              <input
                value={form.courseName}
                onChange={(e) => updateField("courseName", e.target.value)}
                placeholder="Fundamentals of Programming"
              />
            </label>
            <label className="tutor-dash__field">
              <span>Course code</span>
              <input
                value={form.courseCode}
                onChange={(e) => updateField("courseCode", e.target.value)}
                placeholder="15-112"
              />
            </label>
          </div>
          <div className="tutor-dash__row">
            <label className="tutor-dash__field tutor-dash__field--grow">
              <span>Professor *</span>
              <input
                value={form.instructor}
                onChange={(e) => updateField("instructor", e.target.value)}
                placeholder="Dr. Smith"
              />
            </label>
            <label className="tutor-dash__field">
              <span>Semester</span>
              <input
                value={form.semester}
                onChange={(e) => updateField("semester", e.target.value)}
                placeholder="Spring 2026"
              />
            </label>
          </div>
          <label className="tutor-dash__field">
            <span>Syllabus *</span>
            <textarea
              value={form.syllabusText}
              onChange={(e) => updateField("syllabusText", e.target.value)}
              rows={6}
              placeholder="Paste or upload your syllabus…"
            />
          </label>
          <div className="tutor-dash__upload-row">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              className="tutor-dash__file-input"
              onChange={handleFileChange}
            />
            <button
              type="button"
              className="tutor-dash__ghost-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsingFile}
            >
              {parsingFile ? "Reading…" : "Upload syllabus"}
            </button>
            <span className="tutor-dash__hint">.txt, .md, .csv, .pdf, .docx</span>
          </div>
          <button
            type="submit"
            className="tutor-dash__primary-btn tartan-btn"
            disabled={submitting}
          >
            {submitting ? "Creating…" : "Create class"}
          </button>
        </form>
      )}

      {error && <p className="tutor-dash__error">{error}</p>}
      {loading && <p className="tutor-dash__muted">Loading classes…</p>}

      {!loading && (
        <div className="tutor-dash__grid">
          {courses.length === 0 ? (
            <p className="tutor-dash__muted">
              No classes yet. Create one to start adding materials and studying with Scotty.
            </p>
          ) : (
            courses.map((course) => (
              <article key={course.id} className="tutor-dash__class-card">
                <div>
                  <h3 className="tutor-dash__class-name">
                    {course.courseName}
                    {course.courseCode ? ` (${course.courseCode})` : ""}
                  </h3>
                  <p className="tutor-dash__class-meta">
                    {course.instructor && `${course.instructor} · `}
                    {course.materialCount ?? 0} material
                    {(course.materialCount ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="tutor-dash__class-actions">
                  <button
                    type="button"
                    className="tutor-dash__primary-btn tartan-btn"
                    onClick={() => onOpenClass({ id: course.id })}
                  >
                    Open class
                  </button>
                  <button
                    type="button"
                    className="tutor-dash__danger-btn"
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

export default CourseTutorDashboard;
