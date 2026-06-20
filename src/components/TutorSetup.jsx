import { useState, useRef } from "react";
import { SAMPLE_COURSE } from "../data/sampleCourse";
import { extractSyllabusText } from "../utils/extractSyllabusText";
import CourseLibrary from "./CourseLibrary";
import "./TutorSetup.css";

const ACCEPTED_FILE_TYPES = ".txt,.md,.csv,.pdf,.docx";

const EMPTY_FORM = {
  courseName: "",
  courseCode: "",
  instructor: "",
  semester: "",
  syllabusText: "",
  additionalNotes: "",
};

function TutorSetup({ onComplete, onCancel, initialValues = null }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    ...(initialValues ?? {}),
  }));
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsingFile, setParsingFile] = useState(false);
  const [showLibrary, setShowLibrary] = useState(true);
  const fileInputRef = useRef(null);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setParsingFile(true);
    setError("");

    try {
      const text = await extractSyllabusText(file);
      updateField("syllabusText", text);
      setFileName(file.name);
    } catch (err) {
      setError(err.message || "Could not read that file.");
      setFileName("");
    } finally {
      setParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleLoadSample() {
    setForm({ ...SAMPLE_COURSE });
    setFileName("");
    setError("");
  }

  function handlePickCourse(course) {
    onComplete({
      id: course.id,
      courseName: course.courseName,
      courseCode: course.courseCode,
      instructor: course.instructor,
      semester: course.semester,
      syllabusText: course.syllabusText,
      additionalNotes: course.additionalNotes,
      contributions: course.contributions ?? [],
      status: course.status,
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    const courseName = form.courseName.trim();
    const syllabusText = form.syllabusText.trim();

    if (!courseName) {
      setError("Please enter a course name.");
      return;
    }
    if (!syllabusText) {
      setError("Please paste your syllabus or upload a file.");
      return;
    }

    onComplete({
      courseName,
      courseCode: form.courseCode.trim(),
      instructor: form.instructor.trim(),
      semester: form.semester.trim(),
      syllabusText,
      additionalNotes: form.additionalNotes.trim(),
    });
  }

  return (
    <div className="tutor-setup">
      <div className="tutor-setup__card">
        <header className="tutor-setup__header">
          <p className="tutor-setup__eyebrow">Course Tutor</p>
          <h2 className="tutor-setup__title brand-display">Set up your session</h2>
          <p className="tutor-setup__subtitle">
            Add your syllabus and course details so Scotty can tutor you on your actual material.
            Everything you send in tutor mode is saved to the course library for review.
          </p>
          <div className="tutor-setup__header-actions">
            <button
              type="button"
              className="tutor-setup__sample-btn"
              onClick={handleLoadSample}
            >
              Try sample course (15-112)
            </button>
            <button
              type="button"
              className="tutor-setup__sample-btn"
              onClick={() => setShowLibrary((open) => !open)}
            >
              {showLibrary ? "Hide saved courses" : "Pick a saved course"}
            </button>
          </div>
        </header>

        {showLibrary && (
          <CourseLibrary
            onPickCourse={handlePickCourse}
            onClose={() => setShowLibrary(false)}
          />
        )}

        <form className="tutor-setup__form" onSubmit={handleSubmit}>
          <p className="tutor-setup__form-label">Or add a new course</p>

          <div className="tutor-setup__row">
            <label className="tutor-setup__field tutor-setup__field--grow">
              <span className="tutor-setup__label">Course name *</span>
              <input
                type="text"
                value={form.courseName}
                onChange={(e) => updateField("courseName", e.target.value)}
                placeholder="e.g. Introduction to Computer Science"
                autoFocus
              />
            </label>
            <label className="tutor-setup__field">
              <span className="tutor-setup__label">Course code</span>
              <input
                type="text"
                value={form.courseCode}
                onChange={(e) => updateField("courseCode", e.target.value)}
                placeholder="e.g. 15-112"
              />
            </label>
          </div>

          <div className="tutor-setup__row">
            <label className="tutor-setup__field tutor-setup__field--grow">
              <span className="tutor-setup__label">Instructor</span>
              <input
                type="text"
                value={form.instructor}
                onChange={(e) => updateField("instructor", e.target.value)}
                placeholder="e.g. Dr. Smith"
              />
            </label>
            <label className="tutor-setup__field">
              <span className="tutor-setup__label">Semester</span>
              <input
                type="text"
                value={form.semester}
                onChange={(e) => updateField("semester", e.target.value)}
                placeholder="e.g. Spring 2026"
              />
            </label>
          </div>

          <label className="tutor-setup__field">
            <span className="tutor-setup__label">Syllabus *</span>
            <textarea
              value={form.syllabusText}
              onChange={(e) => updateField("syllabusText", e.target.value)}
              placeholder="Paste your syllabus here — topics, schedule, grading, readings…"
              rows={8}
            />
          </label>

          <div className="tutor-setup__upload-row">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              className="tutor-setup__file-input"
              onChange={handleFileChange}
            />
            <button
              type="button"
              className="tutor-setup__upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsingFile}
            >
              {parsingFile ? "Reading file…" : "Upload syllabus file"}
            </button>
            {fileName && <span className="tutor-setup__file-name">{fileName}</span>}
            <span className="tutor-setup__upload-hint">
              .txt, .md, .csv, .pdf, or .docx — text up to 2 MB, PDF/Word up to 10 MB
            </span>
          </div>

          <label className="tutor-setup__field">
            <span className="tutor-setup__label">Extra course notes</span>
            <textarea
              value={form.additionalNotes}
              onChange={(e) => updateField("additionalNotes", e.target.value)}
              placeholder="Optional — lecture notes, assignment descriptions, topics you're struggling with…"
              rows={3}
            />
          </label>

          {error && <p className="tutor-setup__error">{error}</p>}

          <div className="tutor-setup__actions">
            {onCancel && (
              <button type="button" className="tutor-setup__btn tutor-setup__btn--ghost" onClick={onCancel}>
                Back to Q&amp;A
              </button>
            )}
            <button type="submit" className="tutor-setup__btn tartan-btn" disabled={parsingFile}>
              Start tutoring
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TutorSetup;
