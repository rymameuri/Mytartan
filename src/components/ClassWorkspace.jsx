import { useEffect, useRef, useState, useCallback } from "react";
import { extractSyllabusText } from "../utils/extractSyllabusText";
import { useMicInput } from "../hooks/useMicInput";
import {
  refreshCourse,
  addCourseMaterial,
  deleteCourseMaterial,
} from "../utils/courseApi";
import {
  parseFlashcards,
  parseQuizQuestions,
  parseWhiteboardClusters,
} from "../utils/parseStudyOutput";
import MessageContent from "./MessageContent";
import QuizPlayer from "./QuizPlayer";
import PersonaMicControls from "./PersonaMicControls";
import { VolumeIcon } from "./Icons";
import "./ClassWorkspace.css";

const ACCEPTED_FILE_TYPES = ".txt,.md,.csv,.pdf,.docx";
const ACTIVITIES = [
  { id: "quiz", label: "Quiz" },
  { id: "flashcards", label: "Flashcards" },
  { id: "whiteboard", label: "Whiteboard brainstorm" },
];

function ClassWorkspace({
  courseId,
  courseContext,
  onCourseUpdate,
  onBack,
  messages,
  isLoading,
  onSend,
  onOpenMenu,
  isDesktop,
  voiceModeRef,
  isSpeaking = false,
  stopSpeech,
  isMuted = false,
  onToggleMute,
  chatSessionKey = 0,
  onListeningChange,
  tutorActivity,
  onTutorActivityChange,
  lectureTopic,
  onLectureTopicChange,
}) {
  const [tab, setTab] = useState("study");
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialContent, setMaterialContent] = useState("");
  const [materialError, setMaterialError] = useState("");
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [studyAnchorIndex, setStudyAnchorIndex] = useState(null);
  const fileInputRef = useRef(null);

  const sendTutorMessage = useCallback(
    (text) =>
      onSend(text, "tutor", {
        tutorActivity,
        lectureTopic: lectureTopic.trim(),
      }),
    [onSend, tutorActivity, lectureTopic]
  );

  const handleVoiceResult = useCallback(
    (transcript) => {
      stopSpeech?.();
      voiceModeRef.current = true;
      sendTutorMessage(transcript);
    },
    [stopSpeech, voiceModeRef, sendTutorMessage]
  );

  const { listening, toggle: toggleMic, stop: stopMic } = useMicInput({
    onResult: handleVoiceResult,
  });

  useEffect(() => {
    stopMic();
    onListeningChange?.(false);
  }, [chatSessionKey, stopMic, onListeningChange]);

  useEffect(() => {
    onListeningChange?.(listening);
  }, [listening, onListeningChange]);

  const handleMicClick = useCallback(() => {
    if (isLoading) return;
    if (isSpeaking) {
      stopSpeech?.();
      return;
    }
    toggleMic();
  }, [isLoading, isSpeaking, stopSpeech, toggleMic]);

  const micLabel = isLoading
    ? "Processing…"
    : listening
      ? "Listening…"
      : isSpeaking
        ? "Tap to stop"
        : "Tap to speak to Scotty";

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  const studyMessage = (() => {
    if (studyAnchorIndex == null) return null;
    for (let i = studyAnchorIndex + 1; i < messages.length; i++) {
      if (messages[i].role === "assistant") return messages[i];
    }
    return null;
  })();

  const studyContent = studyMessage?.content ?? "";
  const flashcards = parseFlashcards(studyContent);
  const quizQuestions = parseQuizQuestions(studyContent);
  const whiteboardClusters = parseWhiteboardClusters(studyContent);

  const hasStudyOutput =
    flashcards.length > 0 || quizQuestions.length > 0 || whiteboardClusters.length > 0;

  const hasUserMessages = messages.some((m) => m.role === "user");

  const showFallbackInCanvas =
    Boolean(studyMessage?.content) &&
    !hasStudyOutput &&
    !isLoading &&
    hasUserMessages;

  const chatMessages = messages.filter((message, index) => {
    if (index === 0 && message.role === "assistant" && hasUserMessages) {
      return false;
    }
    if (studyMessage && message === studyMessage) {
      return false;
    }
    return true;
  });

  const outputIsEmpty = !hasStudyOutput && !showFallbackInCanvas && !isLoading;

  const activeActivityLabel =
    ACTIVITIES.find((a) => a.id === tutorActivity)?.label ?? "activity";

  useEffect(() => {
    setFlashcardIndex(0);
    setFlashcardFlipped(false);
  }, [studyContent, tutorActivity]);

  async function handleAddMaterial(event) {
    event.preventDefault();
    if (!materialTitle.trim() || !materialContent.trim()) {
      setMaterialError("Title and content are required");
      return;
    }
    setAddingMaterial(true);
    setMaterialError("");
    try {
      const updated = await addCourseMaterial(courseId, {
        title: materialTitle.trim(),
        content: materialContent.trim(),
      });
      onCourseUpdate(updated);
      setMaterialTitle("");
      setMaterialContent("");
    } catch (err) {
      setMaterialError(err.message || "Could not add material");
    } finally {
      setAddingMaterial(false);
    }
  }

  async function handleDeleteMaterial(materialId) {
    try {
      const updated = await deleteCourseMaterial(courseId, materialId);
      onCourseUpdate(updated);
    } catch (err) {
      setMaterialError(err.message || "Could not delete material");
    }
  }

  async function handleMaterialFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setParsingFile(true);
    try {
      const text = await extractSyllabusText(file);
      setMaterialContent(text);
      if (!materialTitle.trim()) {
        setMaterialTitle(file.name.replace(/\.[^.]+$/, ""));
      }
    } catch (err) {
      setMaterialError(err.message || "Could not read file");
    } finally {
      setParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleStartActivity() {
    if (!lectureTopic.trim()) {
      setMaterialError("Enter a lecture or topic first");
      return;
    }
    setMaterialError("");
    setStudyAnchorIndex(messages.length);
    const prompts = {
      quiz: `Give me a quiz on ${lectureTopic.trim()}`,
      flashcards: `Give me flashcards on ${lectureTopic.trim()}`,
      whiteboard: `Let's brainstorm ${lectureTopic.trim()} on the whiteboard`,
    };
    onSend(prompts[tutorActivity], "tutor", {
      tutorActivity,
      lectureTopic: lectureTopic.trim(),
    });
  }

  async function handleRefreshCourse() {
    try {
      const updated = await refreshCourse(courseId);
      onCourseUpdate(updated);
    } catch (err) {
      setMaterialError(err.message || "Could not refresh class");
    }
  }

  const classLabel = courseContext?.courseCode
    ? `${courseContext.courseName} (${courseContext.courseCode})`
    : courseContext?.courseName;

  return (
    <div className="class-workspace">
      <div className="class-workspace__backdrop" aria-hidden="true" />

      <header className="class-workspace__header">
        {!isDesktop && (
          <button type="button" className="class-workspace__icon-btn" onClick={onOpenMenu}>
            Menu
          </button>
        )}
        <div className="class-workspace__heading">
          <button type="button" className="class-workspace__back-link" onClick={onBack}>
            ← All classes
          </button>
          <h1 className="class-workspace__title brand-display">{classLabel}</h1>
          {courseContext?.instructor && (
            <p className="class-workspace__meta">{courseContext.instructor}</p>
          )}
        </div>
        <button type="button" className="class-workspace__ghost-btn" onClick={handleRefreshCourse}>
          Refresh
        </button>
      </header>

      <div className="class-workspace__tabs">
        <button
          type="button"
          className={`class-workspace__tab${tab === "materials" ? " class-workspace__tab--active" : ""}`}
          onClick={() => setTab("materials")}
        >
          Materials ({courseContext?.materials?.length ?? 0})
        </button>
        <button
          type="button"
          className={`class-workspace__tab${tab === "study" ? " class-workspace__tab--active" : ""}`}
          onClick={() => setTab("study")}
        >
          Study with Scotty
        </button>
      </div>

      {materialError && tab === "materials" && (
        <p className="class-workspace__error">{materialError}</p>
      )}

      {tab === "materials" && (
        <div className="class-workspace__panel">
          <form className="class-workspace__material-form" onSubmit={handleAddMaterial}>
            <h2>Add course material</h2>
            <p className="class-workspace__hint">
              Upload lecture notes, slides text, or readings — Scotty uses these for quizzes and
              flashcards.
            </p>
            <input
              value={materialTitle}
              onChange={(e) => setMaterialTitle(e.target.value)}
              placeholder="Title (e.g. Week 6 — Recursion)"
            />
            <textarea
              value={materialContent}
              onChange={(e) => setMaterialContent(e.target.value)}
              placeholder="Paste material content…"
              rows={5}
            />
            <div className="class-workspace__upload-row">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                className="class-workspace__file-input"
                onChange={handleMaterialFile}
              />
              <button
                type="button"
                className="class-workspace__ghost-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsingFile}
              >
                {parsingFile ? "Reading…" : "Upload file"}
              </button>
            </div>
            <button type="submit" className="class-workspace__primary-btn tartan-btn" disabled={addingMaterial}>
              {addingMaterial ? "Adding…" : "Add material"}
            </button>
          </form>

          <div className="class-workspace__material-list">
            {(courseContext?.materials ?? []).length === 0 ? (
              <p className="class-workspace__muted">No materials yet.</p>
            ) : (
              courseContext.materials.map((item) => (
                <article key={item.id} className="class-workspace__material-card">
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.content.slice(0, 120)}{item.content.length > 120 ? "…" : ""}</p>
                  </div>
                  <button
                    type="button"
                    className="class-workspace__danger-btn"
                    onClick={() => handleDeleteMaterial(item.id)}
                  >
                    Remove
                  </button>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "study" && (
        <div className="class-workspace__panel class-workspace__panel--study">
          <section className="class-workspace__study-toolbar" aria-label="Study controls">
            <div className="class-workspace__activity-btns">
              {ACTIVITIES.map((activity) => (
                <button
                  key={activity.id}
                  type="button"
                  className={`class-workspace__activity-btn${
                    tutorActivity === activity.id ? " class-workspace__activity-btn--active" : ""
                  }`}
                  onClick={() => onTutorActivityChange(activity.id)}
                >
                  {activity.label}
                </button>
              ))}
            </div>
            <div className="class-workspace__toolbar-row">
              <input
                className="class-workspace__topic-input"
                value={lectureTopic}
                onChange={(e) => onLectureTopicChange(e.target.value)}
                placeholder="Topic (e.g. Week 6 — Recursion)"
              />
              <button
                type="button"
                className="class-workspace__primary-btn tartan-btn"
                onClick={handleStartActivity}
                disabled={isLoading}
              >
                {isLoading ? "Generating…" : `Start ${activeActivityLabel}`}
              </button>
            </div>
            {materialError && tab === "study" && (
              <p className="class-workspace__inline-error">{materialError}</p>
            )}
          </section>

          <div className="class-workspace__study-body">
            <section
              className={`class-workspace__study-output${
                outputIsEmpty ? " class-workspace__study-output--empty" : ""
              }`}
              aria-label="Study content"
            >
              {outputIsEmpty && (
                <div className="class-workspace__study-empty">
                  <p className="class-workspace__study-empty-title">Ready to study</p>
                  <p className="class-workspace__study-empty-text">
                    Choose quiz, flashcards, or whiteboard above, enter a topic, and start.
                  </p>
                  <p className="class-workspace__study-empty-meta">
                    {courseContext?.materials?.length ?? 0} material
                    {(courseContext?.materials?.length ?? 0) === 1 ? "" : "s"} loaded for this class
                  </p>
                </div>
              )}

              {isLoading && !hasStudyOutput && !showFallbackInCanvas && (
                <div className="class-workspace__study-empty">
                  <p className="class-workspace__study-empty-title">Scotty is preparing your session…</p>
                </div>
              )}

              {showFallbackInCanvas && (
                <div className="class-workspace__fallback-card">
                  <h2 className="class-workspace__output-title">
                    {activeActivityLabel} · {lectureTopic || "Study session"}
                  </h2>
                  <p className="class-workspace__fallback-note">
                    Could not format this as an interactive quiz. Try starting again, or read the
                    response below.
                  </p>
                  <div className="class-workspace__fallback-content">
                    <MessageContent content={studyMessage.content} />
                  </div>
                </div>
              )}

              {tutorActivity === "flashcards" && flashcards.length > 0 && (
                <div className="class-workspace__flashcard">
                  <button
                    type="button"
                    className="class-workspace__flashcard-inner"
                    onClick={() => setFlashcardFlipped((f) => !f)}
                  >
                    <p className="class-workspace__flashcard-label">
                      {flashcardFlipped ? "Back" : "Front"} · tap to flip
                    </p>
                    <p className="class-workspace__flashcard-text">
                      {flashcardFlipped ? flashcards[flashcardIndex].back : flashcards[flashcardIndex].front}
                    </p>
                  </button>
                  <div className="class-workspace__flashcard-nav">
                    <button
                      type="button"
                      className="class-workspace__ghost-btn"
                      disabled={flashcardIndex === 0}
                      onClick={() => {
                        setFlashcardIndex((i) => i - 1);
                        setFlashcardFlipped(false);
                      }}
                    >
                      Prev
                    </button>
                    <span>
                      {flashcardIndex + 1} / {flashcards.length}
                    </span>
                    <button
                      type="button"
                      className="class-workspace__ghost-btn"
                      disabled={flashcardIndex >= flashcards.length - 1}
                      onClick={() => {
                        setFlashcardIndex((i) => i + 1);
                        setFlashcardFlipped(false);
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {tutorActivity === "quiz" && quizQuestions.length > 0 && (
                <QuizPlayer
                  questions={quizQuestions}
                  title={`Quiz · ${lectureTopic || "Study session"}`}
                />
              )}

              {tutorActivity === "whiteboard" && whiteboardClusters.length > 0 && (
                <div className="class-workspace__whiteboard-card">
                  <h2 className="class-workspace__output-title">Whiteboard · {lectureTopic || "Brainstorm"}</h2>
                  <div className="class-workspace__whiteboard">
                    {whiteboardClusters.map((cluster) => (
                      <div key={cluster.title} className="class-workspace__cluster">
                        <h3>{cluster.title}</h3>
                        <ul>
                          {cluster.bullets.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <aside className="class-workspace__study-chat" aria-label="Follow-up chat">
              <div className="class-workspace__chat-header">
                <div className="class-workspace__chat-header-row">
                  <div>
                    <h2 className="class-workspace__chat-title">Follow-up with Scotty</h2>
                    <p className="class-workspace__chat-subtitle">
                      Ask questions, request hints, or go deeper on the topic
                    </p>
                  </div>
                  {!isDesktop && onToggleMute && (
                    <button
                      type="button"
                      className={`class-workspace__mute-btn${isMuted ? " class-workspace__mute-btn--active" : ""}`}
                      aria-label={isMuted ? "Unmute persona" : "Mute persona"}
                      aria-pressed={isMuted}
                      onClick={onToggleMute}
                    >
                      <VolumeIcon muted={isMuted} />
                    </button>
                  )}
                </div>
              </div>
              <div className="class-workspace__messages">
                {chatMessages.length === 0 && !isLoading && (
                  <p className="class-workspace__chat-placeholder">
                    Start a session above, then ask follow-up questions here.
                  </p>
                )}
                {chatMessages.map((message, index) => (
                  <div
                    key={message.id ?? index}
                    className={`class-workspace__msg class-workspace__msg--${message.role}`}
                  >
                    <span className="class-workspace__msg-role">
                      {message.role === "user" ? "You" : "Scotty"}
                    </span>
                    <MessageContent content={message.content} />
                  </div>
                ))}
                {isLoading && <p className="class-workspace__chat-loading">Scotty is thinking…</p>}
              </div>
              <div className="class-workspace__chat-input">
                <PersonaMicControls
                  listening={listening}
                  isLoading={isLoading}
                  isSpeaking={isSpeaking}
                  micLabel={micLabel}
                  onMicClick={handleMicClick}
                  onSend={sendTutorMessage}
                  voiceModeRef={voiceModeRef}
                  placeholder="Ask a follow-up question…"
                />
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClassWorkspace;
