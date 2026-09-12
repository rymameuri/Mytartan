import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { extractSyllabusText } from "../utils/extractSyllabusText";
import { useAuth } from "../context/AuthContext";
import { useMicInput } from "../hooks/useMicInput";
import { usePaneResize } from "../hooks/usePaneResize";
import { useAvatarZoom } from "../hooks/useAvatarZoom";
import {
  refreshCourse,
  addCourseMaterial,
  deleteCourseMaterial,
} from "../utils/courseApi";
import {
  parseFlashcards,
  parseQuizQuestions,
  parseWhiteboardClusters,
  parseWhiteboardGuidingQuestion,
} from "../utils/parseStudyOutput";
import {
  buildLectureHelpMessage,
  looksLikeStudioLectureRequest,
  resolveStudioItemContext,
} from "../utils/studioLecture";
import {
  previewSnippet,
  getSourceTypeLabel,
  buildSourceItemContext,
  buildSourceHelpMessage,
  buildSyllabusSource,
} from "../utils/sourceStudy";
import MessageContent from "./MessageContent";
import MessageFeedback from "./MessageFeedback";
import QuizPlayer from "./QuizPlayer";
import PersonaMicControls from "./PersonaMicControls";
import PersonaCaption from "./PersonaCaption";
import ScottyHeadbandFrame from "./ScottyHeadbandFrame";
import ScottyAvatar from "./ScottyAvatar";
import SourceReader from "./SourceReader";
import {
  QuizIcon,
  FlashcardsIcon,
  WhiteboardIcon,
  SourcesIcon,
  StudioIcon,
  PanelCollapseIcon,
  PlusIcon,
  MenuIcon,
  VolumeIcon,
  ScottyLogoIcon,
} from "./Icons";
import "./ClassWorkspace.css";
import "./SourceReader.css";
import "./PersonaView.css";
import "./ChatInterface.css";

const ACCEPTED_FILE_TYPES = ".txt,.md,.csv,.pdf,.docx";

const STUDIO_TOOLS = [
  {
    id: "quiz",
    label: "Quiz",
    description: "Multiple-choice questions from your sources",
    Icon: QuizIcon,
    prompt: (topic) => `Give me a quiz on ${topic}`,
  },
  {
    id: "flashcards",
    label: "Flashcards",
    description: "Flip cards to review key concepts",
    Icon: FlashcardsIcon,
    prompt: (topic) => `Give me flashcards on ${topic}`,
  },
  {
    id: "whiteboard",
    label: "Whiteboard Brainstorm",
    description: "Organized clusters of ideas and connections",
    Icon: WhiteboardIcon,
    prompt: (topic) => `Let's brainstorm ${topic} on the whiteboard`,
  },
];

function buildSuggestedQuestions(courseContext, selectedMaterials) {
  const questions = [];
  const materials = selectedMaterials.length
    ? selectedMaterials
    : courseContext?.materials ?? [];

  materials.slice(0, 2).forEach((item) => {
    questions.push(`What are the main ideas in "${item.title}"?`);
    if (questions.length < 3) {
      questions.push(`Help me understand "${item.title}"`);
    }
  });

  if (questions.length < 3 && courseContext?.courseName) {
    questions.push(`What should I focus on for ${courseContext.courseName}?`);
  }

  return questions.slice(0, 3);
}

function buildScopedCourseContext(courseContext, selectedIds, allMaterials) {
  if (!courseContext) return courseContext;
  const selected = allMaterials.filter((m) => selectedIds.has(m.id));
  return {
    ...courseContext,
    materials: selected.length ? selected : allMaterials,
  };
}

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
  isPreparingSpeech = false,
  stopSpeech,
  isMuted = false,
  onToggleMute,
  chatSessionKey = 0,
  onListeningChange,
  tutorActivity,
  onTutorActivityChange,
  lectureTopic,
  onLectureTopicChange,
  onQuizComplete,
  avatarRef,
  avatarState = "idle",
  speechCaption = "",
}) {
  const { token } = useAuth();
  const [selectedMaterialIds, setSelectedMaterialIds] = useState(() => new Set());
  const [showAddSource, setShowAddSource] = useState(false);
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialContent, setMaterialContent] = useState("");
  const [materialError, setMaterialError] = useState("");
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [studioCollapsed, setStudioCollapsed] = useState(false);
  const [mobilePane, setMobilePane] = useState("chat");
  const [studioView, setStudioView] = useState("cards");
  const [generatingActivityId, setGeneratingActivityId] = useState(null);
  const [studioError, setStudioError] = useState("");
  const [interactionMode, setInteractionMode] = useState("chat");
  const [activeReaderSource, setActiveReaderSource] = useState(null);
  const fileInputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const workspaceRef = useRef(null);
  const { widths: paneWidths, startDrag: startPaneDrag } = usePaneResize(workspaceRef);
  const { avatarStyle } = useAvatarZoom();

  const allMaterials = useMemo(
    () => courseContext?.materials ?? [],
    [courseContext?.materials]
  );

  useEffect(() => {
    if (allMaterials.length === 0) {
      setSelectedMaterialIds(new Set());
      return;
    }
    setSelectedMaterialIds((prev) => {
      const valid = new Set(allMaterials.map((m) => m.id));
      const next = new Set([...prev].filter((id) => valid.has(id)));
      if (next.size === 0) {
        return new Set(allMaterials.map((m) => m.id));
      }
      return next;
    });
  }, [allMaterials]);

  const selectedMaterials = allMaterials.filter((m) => selectedMaterialIds.has(m.id));
  const scopedContext = useMemo(
    () => buildScopedCourseContext(courseContext, selectedMaterialIds, allMaterials),
    [courseContext, selectedMaterialIds, allMaterials]
  );

  const hasSyllabus = Boolean(courseContext?.syllabusText?.trim());
  const syllabusSource = useMemo(() => {
    if (!hasSyllabus) return null;
    return {
      ...buildSyllabusSource(),
      content: courseContext.syllabusText,
    };
  }, [hasSyllabus, courseContext?.syllabusText]);

  const openMaterialReader = useCallback((material) => {
    setActiveReaderSource({
      id: material.id,
      title: material.title,
      content: material.content ?? "",
      externalItemId: material.externalItemId,
    });
  }, []);

  const openSyllabusReader = useCallback(() => {
    if (!syllabusSource) return;
    setActiveReaderSource(syllabusSource);
  }, [syllabusSource]);

  const requestSourceHelp = useCallback(
    ({ materialId, title, excerpt }) => {
      const sourceItemContext = buildSourceItemContext({ materialId, title, excerpt });
      const message = buildSourceHelpMessage({ title, excerpt });

      let contextForAsk = scopedContext;
      if (materialId && materialId !== "__syllabus__") {
        const material = allMaterials.find((m) => m.id === materialId);
        if (material) {
          contextForAsk = {
            ...courseContext,
            materials: [material],
          };
        }
      }

      setInteractionMode("chat");
      if (!isDesktop) setMobilePane("chat");
      setActiveReaderSource(null);
      onSend(message, "tutor", {
        lectureTopic: lectureTopic.trim() || title,
        courseContext: contextForAsk,
        tutorActivity,
        sourceItemContext,
      });
    },
    [
      onSend,
      lectureTopic,
      scopedContext,
      tutorActivity,
      allMaterials,
      courseContext,
      isDesktop,
    ]
  );

  const handleQuizComplete = useCallback(
    (results) => {
      setInteractionMode("chat");
      onQuizComplete?.(results);
    },
    [onQuizComplete]
  );

  const studyExchange = useMemo(() => {
    let userIndex = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].studio && messages[i].role === "user") {
        userIndex = i;
        break;
      }
    }
    if (userIndex === -1) {
      return { user: null, assistant: null };
    }
    const assistant =
      messages.slice(userIndex + 1).find((message) => message.role === "assistant" && message.studio) ??
      messages.slice(userIndex + 1).find((message) => message.role === "assistant") ??
      null;
    return { user: messages[userIndex], assistant };
  }, [messages]);

  const studyMessage = studyExchange.assistant;
  const studyUserMessage = studyExchange.user;

  const studyContent = studyMessage?.content ?? "";
  const flashcards = parseFlashcards(studyContent);
  const quizQuestions = parseQuizQuestions(studyContent);
  const whiteboardClusters = parseWhiteboardClusters(studyContent);
  const whiteboardGuidingQuestion = parseWhiteboardGuidingQuestion(studyContent);

  const hasStudyOutput =
    flashcards.length > 0 || quizQuestions.length > 0 || whiteboardClusters.length > 0;

  const sendTutorMessage = useCallback(
    (text) => {
      const topic = lectureTopic.trim();
      const baseOptions = {
        lectureTopic: topic,
        courseContext: scopedContext,
        tutorActivity,
      };

      if (hasStudyOutput && looksLikeStudioLectureRequest(text)) {
        const studioItemContext = resolveStudioItemContext({
          text,
          tutorActivity,
          flashcards,
          quizQuestions,
          whiteboardClusters,
          flashcardIndex,
          quizIndex,
          topic,
        });
        return onSend(text, "tutor", {
          ...baseOptions,
          speechMode: "lecture",
          studioItemContext,
        });
      }

      return onSend(text, "tutor", baseOptions);
    },
    [
      onSend,
      lectureTopic,
      scopedContext,
      tutorActivity,
      hasStudyOutput,
      flashcards,
      quizQuestions,
      whiteboardClusters,
      flashcardIndex,
      quizIndex,
    ]
  );

  const requestStudioLecture = useCallback(
    (studioItemContext) => {
      if (!studioItemContext) return;
      const topic =
        lectureTopic.trim() ||
        (courseContext?.courseName?.trim()
          ? `${courseContext.courseName.trim()} review`
          : "key course topics");
      setInteractionMode("persona");
      if (!isDesktop) setMobilePane("chat");
      onSend(buildLectureHelpMessage(studioItemContext), "tutor", {
        lectureTopic: topic,
        courseContext: scopedContext,
        tutorActivity,
        speechMode: "lecture",
        studioItemContext,
      });
    },
    [onSend, lectureTopic, scopedContext, tutorActivity, isDesktop, courseContext?.courseName]
  );

  const handleVoiceResult = useCallback(
    (transcript) => {
      stopSpeech?.();
      voiceModeRef.current = true;
      sendTutorMessage(transcript);
    },
    [stopSpeech, voiceModeRef, sendTutorMessage]
  );

  const { listening, isFinalizing, toggle: toggleMic, stop: stopMic } = useMicInput({
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
    if (isLoading || isPreparingSpeech || isFinalizing) return;
    if (isSpeaking) {
      stopSpeech?.();
      return;
    }
    toggleMic();
  }, [isLoading, isPreparingSpeech, isFinalizing, isSpeaking, stopSpeech, toggleMic]);

  const hasUserMessages = messages.some(
    (message) => message.role === "user" && !message.studio
  );

  const showFallbackInStudio =
    Boolean(studyMessage?.content) &&
    !hasStudyOutput &&
    !isLoading &&
    Boolean(studyUserMessage);

  const chatMessages = messages.filter((message, index) => {
    if (message.studio) {
      return false;
    }
    if (index === 0 && message.role === "assistant") {
      return false;
    }
    return true;
  });

  const isStudioLoading = Boolean(isLoading && generatingActivityId);

  const showChatHistory = interactionMode === "chat" && hasUserMessages;
  const showPersonaStage = interactionMode === "persona" || !hasUserMessages;

  const suggestedQuestions = buildSuggestedQuestions(courseContext, selectedMaterials);
  const showSuggestions =
    !isLoading &&
    !isPreparingSpeech &&
    !isFinalizing &&
    suggestedQuestions.length > 0 &&
    (interactionMode === "persona" ? !isSpeaking : !hasUserMessages);
  const resolvedAvatarState = listening
    ? "listening"
    : isSpeaking
      ? "speaking"
      : isLoading || isPreparingSpeech || isFinalizing
        ? "thinking"
        : avatarState || "idle";

  const micLabel = isLoading || isPreparingSpeech || isFinalizing
    ? "Thinking…"
    : listening
      ? "Tap when you're done"
      : isSpeaking
        ? "Tap to stop"
        : "Tap the mic";

  useEffect(() => {
    if (!showChatHistory) return undefined;
    const el = messagesContainerRef.current;
    if (!el) return undefined;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [chatMessages, isLoading, showChatHistory]);

  const activeTool = STUDIO_TOOLS.find((t) => t.id === tutorActivity) ?? STUDIO_TOOLS[0];

  useEffect(() => {
    setFlashcardIndex(0);
    setFlashcardFlipped(false);
  }, [studyContent, tutorActivity]);

  useEffect(() => {
    if (hasStudyOutput || showFallbackInStudio || generatingActivityId || isStudioLoading) {
      setStudioView("output");
    }
  }, [hasStudyOutput, showFallbackInStudio, generatingActivityId, isStudioLoading]);

  useEffect(() => {
    if (!isLoading) {
      setGeneratingActivityId(null);
    }
  }, [isLoading]);

  function toggleMaterialSelection(materialId) {
    setSelectedMaterialIds((prev) => {
      const next = new Set(prev);
      if (next.has(materialId)) {
        next.delete(materialId);
      } else {
        next.add(materialId);
      }
      return next;
    });
  }

  function selectAllMaterials() {
    setSelectedMaterialIds(new Set(allMaterials.map((m) => m.id)));
  }

  function deselectAllMaterials() {
    setSelectedMaterialIds(new Set());
  }

  async function handleAddMaterial(event) {
    event.preventDefault();
    if (!materialTitle.trim() || !materialContent.trim()) {
      setMaterialError("Title and content are required");
      return;
    }
    setAddingMaterial(true);
    setMaterialError("");
    try {
      const updated = await addCourseMaterial(
        courseId,
        {
          title: materialTitle.trim(),
          content: materialContent.trim(),
        },
        token
      );
      onCourseUpdate(updated);
      setMaterialTitle("");
      setMaterialContent("");
      setShowAddSource(false);
    } catch (err) {
      setMaterialError(err.message || "Could not add source");
    } finally {
      setAddingMaterial(false);
    }
  }

  async function handleDeleteMaterial(materialId) {
    try {
      const updated = await deleteCourseMaterial(courseId, materialId, token);
      onCourseUpdate(updated);
    } catch (err) {
      setMaterialError(err.message || "Could not delete source");
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

  function resolveStudioTopic() {
    const trimmed = lectureTopic.trim();
    if (trimmed) return trimmed;
    if (courseContext?.courseName?.trim()) {
      return `${courseContext.courseName.trim()} review`;
    }
    return "key course topics";
  }

  function handleGenerate(activityId) {
    const topic = resolveStudioTopic();
    const hasContext =
      Boolean(courseContext?.syllabusText?.trim()) ||
      scopedContext?.materials?.length > 0;

    if (!hasContext) {
      const message = "Add a syllabus or at least one source before generating.";
      setStudioError(message);
      setMaterialError(message);
      if (!isDesktop) setMobilePane("sources");
      return;
    }

    if (!lectureTopic.trim()) {
      onLectureTopicChange(topic);
    }

    setMaterialError("");
    setStudioError("");
    setGeneratingActivityId(activityId);
    onTutorActivityChange(activityId);
    setStudioView("output");
    if (!isDesktop) setMobilePane("studio");

    const tool = STUDIO_TOOLS.find((t) => t.id === activityId);
    onSend(tool.prompt(topic), "tutor", {
      tutorActivity: activityId,
      lectureTopic: topic,
      courseContext: scopedContext,
      studioGeneration: true,
      speechMode: "introduction",
    });
  }

  async function handleRefreshCourse() {
    try {
      const updated = await refreshCourse(courseId, token);
      onCourseUpdate(updated);
    } catch (err) {
      setMaterialError(err.message || "Could not refresh class");
    }
  }

  const classLabel = courseContext?.courseCode
    ? `${courseContext.courseName} (${courseContext.courseCode})`
    : courseContext?.courseName;

  const sourceCountLabel =
    allMaterials.length === 0
      ? "No sources loaded"
      : selectedMaterialIds.size === 0
        ? "No sources selected"
        : `Using ${selectedMaterialIds.size} of ${allMaterials.length} source${allMaterials.length === 1 ? "" : "s"}`;

  const workspaceGridColumns = `${
    sourcesCollapsed ? "var(--ws-pane-rail)" : `${paneWidths.sources}px`
  } minmax(280px, 1fr) ${
    studioCollapsed ? "var(--ws-pane-rail)" : `${paneWidths.studio}px`
  }`;

  function renderStudyOutput() {
    if (isStudioLoading && !hasStudyOutput) {
      const loadingTool =
        STUDIO_TOOLS.find((t) => t.id === (generatingActivityId || tutorActivity)) ??
        activeTool;
      return (
        <div className="ws-studio__loading">
          <p>Scotty is generating your {loadingTool.label.toLowerCase()}…</p>
        </div>
      );
    }

    if (showFallbackInStudio) {
      return (
        <div className="ws-studio__output">
          <h3 className="ws-studio__output-title">
            {activeTool.label} · {lectureTopic || "Study session"}
          </h3>
          <p className="ws-studio__fallback-note">
            Could not format this as an interactive session. Read the response below.
          </p>
          <div className="ws-studio__fallback-content">
            <MessageContent content={studyMessage.content} />
          </div>
        </div>
      );
    }

    if (tutorActivity === "flashcards" && flashcards.length > 0) {
      return (
        <div className="ws-studio__output">
          <h3 className="ws-studio__output-title">Flashcards · {lectureTopic || "Review"}</h3>
          <div className="ws-flashcard">
            <button
              type="button"
              className="ws-flashcard__inner"
              onClick={() => setFlashcardFlipped((f) => !f)}
              aria-label={flashcardFlipped ? "Show question" : "Show answer"}
            >
              {!flashcardFlipped && (
                <p className="ws-flashcard__hint">Tap to reveal</p>
              )}
              <p className="ws-flashcard__text">
                {flashcardFlipped
                  ? flashcards[flashcardIndex].back
                  : flashcards[flashcardIndex].front}
              </p>
            </button>
            <div className="ws-flashcard__nav">
              <button
                type="button"
                className="btn-secondary"
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
                className="btn-secondary"
                disabled={flashcardIndex >= flashcards.length - 1}
                onClick={() => {
                  setFlashcardIndex((i) => i + 1);
                  setFlashcardFlipped(false);
                }}
              >
                Next
              </button>
            </div>
            <button
              type="button"
              className="ws-studio__help-btn"
              disabled={isLoading}
              onClick={() =>
                requestStudioLecture(
                  resolveStudioItemContext({
                    tutorActivity: "flashcards",
                    flashcards,
                    flashcardIndex,
                    topic: lectureTopic.trim() || resolveStudioTopic(),
                  })
                )
              }
            >
              Help with this card
            </button>
          </div>
        </div>
      );
    }

    if (tutorActivity === "quiz" && quizQuestions.length > 0) {
      return (
        <div className="ws-studio__output">
          <QuizPlayer
            questions={quizQuestions}
            title={`Quiz · ${lectureTopic || "Study session"}`}
            onComplete={handleQuizComplete}
            onQuestionChange={setQuizIndex}
            onHelp={(index) =>
              requestStudioLecture(
                resolveStudioItemContext({
                  tutorActivity: "quiz",
                  quizQuestions,
                  quizIndex: index,
                  topic: lectureTopic.trim() || resolveStudioTopic(),
                })
              )
            }
            helpDisabled={isLoading}
          />
        </div>
      );
    }

    if (tutorActivity === "whiteboard" && whiteboardClusters.length > 0) {
      return (
        <div className="ws-studio__output">
          <h3 className="ws-studio__output-title">
            Whiteboard · {lectureTopic || "Brainstorm"}
          </h3>
          <div className="ws-whiteboard">
            {whiteboardClusters.map((cluster, clusterIndex) => (
              <div key={cluster.title} className="ws-whiteboard__cluster">
                <div className="ws-whiteboard__cluster-header">
                  <h4>{cluster.title}</h4>
                  <button
                    type="button"
                    className="ws-studio__help-btn ws-studio__help-btn--inline"
                    disabled={isLoading}
                    onClick={() =>
                      requestStudioLecture(
                        resolveStudioItemContext({
                          tutorActivity: "whiteboard",
                          whiteboardClusters,
                          clusterIndex,
                          topic: lectureTopic.trim() || resolveStudioTopic(),
                        })
                      )
                    }
                  >
                    Help with this
                  </button>
                </div>
                <ul>
                  {cluster.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {whiteboardGuidingQuestion && (
            <p className="ws-whiteboard__guiding">
              <span className="ws-whiteboard__guiding-label">Think about:</span>{" "}
              {whiteboardGuidingQuestion}
            </p>
          )}
        </div>
      );
    }

    if (studyUserMessage) {
      return (
        <div className="ws-studio__output">
          <h3 className="ws-studio__output-title">{activeTool.label}</h3>
          <p className="ws-studio__fallback-note">
            {studyMessage?.content
              ? "Could not format this as an interactive session. Read the response below."
              : "Generation did not return content. Try again or adjust your topic and sources."}
          </p>
          {studyMessage?.content && (
            <div className="ws-studio__fallback-content">
              <MessageContent content={studyMessage.content} />
            </div>
          )}
        </div>
      );
    }

    return null;
  }

  return (
    <div
      ref={workspaceRef}
      className="ws"
      style={{ gridTemplateColumns: workspaceGridColumns }}
    >
      <div className="ws__accent-logo" aria-hidden="true">
        <ScottyLogoIcon />
      </div>

      {isDesktop && !sourcesCollapsed && (
        <div
          className="ws-resize-handle ws-resize-handle--sources"
          style={{ left: paneWidths.sources }}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sources panel"
          onPointerDown={(event) => startPaneDrag("sources", event)}
        />
      )}

      {isDesktop && !studioCollapsed && (
        <div
          className="ws-resize-handle ws-resize-handle--studio"
          style={{ right: paneWidths.studio }}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize studio panel"
          onPointerDown={(event) => startPaneDrag("studio", event)}
        />
      )}

      {/* ── Sources pane ── */}
      <aside
        className={`ws-pane ws-pane--sources${
          sourcesCollapsed ? " ws-pane--collapsed" : ""
        }${!isDesktop && mobilePane !== "sources" ? " ws-pane--hidden-mobile" : ""}`}
        aria-label="Sources"
      >
        <div className="ws-pane__header">
          {!sourcesCollapsed && <h2 className="ws-pane__title">Sources</h2>}
          <div className="ws-pane__header-actions">
            {isDesktop && (
              <button
                type="button"
                className="ws-pane__collapse-btn"
                aria-label={sourcesCollapsed ? "Expand sources" : "Collapse sources"}
                onClick={() => setSourcesCollapsed((c) => !c)}
              >
                <PanelCollapseIcon direction={sourcesCollapsed ? "right" : "left"} />
              </button>
            )}
          </div>
        </div>

        {!sourcesCollapsed &&
          (activeReaderSource ? (
            <SourceReader
              source={activeReaderSource}
              onClose={() => setActiveReaderSource(null)}
              onAskScotty={requestSourceHelp}
            />
          ) : (
            <>
            <div className="ws-sources__actions">
              <button
                type="button"
                className="tartan-btn ws-sources__add-btn"
                onClick={() => setShowAddSource((s) => !s)}
              >
                <PlusIcon /> Add source
              </button>
            </div>

            {allMaterials.length > 0 && (
              <div className="ws-sources__bulk">
                <button type="button" className="ws-link-btn" onClick={selectAllMaterials}>
                  Select all
                </button>
                <span className="ws-sources__bulk-sep">·</span>
                <button type="button" className="ws-link-btn" onClick={deselectAllMaterials}>
                  Deselect all
                </button>
              </div>
            )}

            {showAddSource && (
              <form className="ws-sources__form" onSubmit={handleAddMaterial}>
                <input
                  value={materialTitle}
                  onChange={(e) => setMaterialTitle(e.target.value)}
                  placeholder="Title (e.g. Week 6 — Recursion)"
                />
                <textarea
                  value={materialContent}
                  onChange={(e) => setMaterialContent(e.target.value)}
                  placeholder="Paste material content…"
                  rows={4}
                />
                <div className="ws-sources__upload-row">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    className="ws-sources__file-input"
                    onChange={handleMaterialFile}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={parsingFile}
                  >
                    {parsingFile ? "Reading…" : "Upload file"}
                  </button>
                </div>
                <button type="submit" className="tartan-btn" disabled={addingMaterial}>
                  {addingMaterial ? "Adding…" : "Add source"}
                </button>
              </form>
            )}

            {materialError && mobilePane === "sources" && (
              <p className="ws-error">{materialError}</p>
            )}

            <div className="ws-sources__list">
              {!hasSyllabus && allMaterials.length === 0 ? (
                <p className="ws-sources__empty">No sources yet. Add lecture notes or readings.</p>
              ) : (
                <>
                  {syllabusSource && (
                    <div className="ws-source-card ws-source-card--syllabus">
                      <button
                        type="button"
                        className="ws-source-card__body"
                        onClick={openSyllabusReader}
                      >
                        <span className="ws-source-card__type">Syllabus · Pinned</span>
                        <span className="ws-source-card__name">{syllabusSource.title}</span>
                        <span className="ws-source-card__preview">
                          {previewSnippet(courseContext.syllabusText)}
                        </span>
                      </button>
                      <div className="ws-source-card__footer">
                        <button
                          type="button"
                          className="ws-source-card__open"
                          onClick={openSyllabusReader}
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  )}
                  {allMaterials.map((item) => (
                    <div key={item.id} className="ws-source-card">
                      <div className="ws-source-card__top">
                        <input
                          type="checkbox"
                          className="ws-source-card__checkbox"
                          checked={selectedMaterialIds.has(item.id)}
                          onChange={() => toggleMaterialSelection(item.id)}
                          aria-label={`Include ${item.title} in chat context`}
                        />
                        <button
                          type="button"
                          className="ws-source-card__body"
                          onClick={() => openMaterialReader(item)}
                        >
                          <span className="ws-source-card__type">{getSourceTypeLabel(item)}</span>
                          <span className="ws-source-card__name">{item.title}</span>
                          {item.content?.trim() && (
                            <span className="ws-source-card__preview">
                              {previewSnippet(item.content)}
                            </span>
                          )}
                        </button>
                      </div>
                      <div className="ws-source-card__footer">
                        <button
                          type="button"
                          className="ws-source-card__open"
                          onClick={() => openMaterialReader(item)}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="btn-secondary ws-source-card__delete"
                          aria-label={`Delete ${item.title}`}
                          onClick={() => handleDeleteMaterial(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
            </>
          ))}

        {sourcesCollapsed && (
          <button
            type="button"
            className="ws-pane__rail-btn"
            aria-label="Expand sources"
            onClick={() => setSourcesCollapsed(false)}
          >
            <SourcesIcon />
          </button>
        )}
      </aside>

      {/* ── Chat pane (center) ── */}
      <main
        className={`ws-pane ws-pane--chat${
          interactionMode === "persona" ? " ws-pane--persona-mode" : ""
        }${!isDesktop && mobilePane !== "chat" ? " ws-pane--hidden-mobile" : ""}`}
        aria-label="Chat"
      >
        <div className="pv__overlay ws-chat__overlay" aria-hidden="true" />

        <header className="ws-chat__header">
          {!isDesktop && (
            <button type="button" className="pv-icon-btn" onClick={onOpenMenu} aria-label="Menu">
              <MenuIcon />
            </button>
          )}
          <div className="ws-chat__heading">
            <button type="button" className="ws-chat__back-link" onClick={onBack}>
              ← All classes
            </button>
            <h1 className="ws-chat__title">{classLabel}</h1>
            {courseContext?.instructor && (
              <p className="ws-chat__meta">{courseContext.instructor}</p>
            )}
          </div>
          <div className="ws-chat__header-actions">
            {onToggleMute && (
              <button
                type="button"
                className={`pv-icon-btn${isMuted ? " pv-icon-btn--active" : ""}`}
                aria-label={isMuted ? "Unmute Scotty" : "Mute Scotty"}
                aria-pressed={isMuted}
                onClick={onToggleMute}
              >
                <VolumeIcon muted={isMuted} />
              </button>
            )}
            <button type="button" className="ws-chat__ghost-btn" onClick={handleRefreshCourse}>
              Refresh
            </button>
          </div>
        </header>

        <div
          className={`pv-body${
            showChatHistory ? " pv-body--chat" : " pv-body--idle"
          }`}
        >
          {showChatHistory && (
            <div className="pv-messages-wrap">
              <div
                className="pv-messages message-history"
                ref={messagesContainerRef}
                role="log"
                aria-live="polite"
              >
                {chatMessages.map((message, index) => {
                  const isUser = message.role === "user";
                  return (
                    <div
                      key={message.id ?? index}
                      className={`msg-row${isUser ? " msg-row--user" : " msg-row--assistant"}`}
                    >
                      <div
                        className={`msg-bubble msg-bubble--on-pattern${
                          isUser ? " msg-bubble--user" : " msg-bubble--assistant"
                        }`}
                      >
                        <MessageContent content={message.content} />
                        {!isUser && !message.streaming && !message.studio && (
                          <MessageFeedback
                            messageId={message.id ?? `cw-${index}`}
                            reply={message.content}
                            feedbackContext={message.feedbackContext ?? { mode: "tutor" }}
                            disabled={isLoading}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
                {isLoading && !isStudioLoading && (
                  <div className="msg-row msg-row--assistant">
                    <div
                      className="msg-bubble msg-bubble--assistant msg-bubble--on-pattern typing-indicator"
                      aria-label="thinking"
                    >
                      <span className="typing-label">thinking</span>
                      <span className="typing-dot typing-dot--on-pattern" />
                      <span className="typing-dot typing-dot--on-pattern" />
                      <span className="typing-dot typing-dot--on-pattern" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className={`pv-stage${interactionMode === "persona" ? " pv-stage--persona-main" : ""}`}>
            <div
              className={`pv-avatar-frame pv-avatar-frame--${resolvedAvatarState}`}
              style={avatarStyle}
            >
              <ScottyHeadbandFrame avatarState={resolvedAvatarState}>
                <ScottyAvatar ref={avatarRef} persona avatarState={resolvedAvatarState} />
              </ScottyHeadbandFrame>
            </div>

            {showPersonaStage && (
              <div className="pv-identity">
                <p className="pv-identity__name brand-display">Scotty</p>
                <p className="pv-identity__role">
                  <span className="pv-identity__dot" />
                  Course Tutor
                </p>
              </div>
            )}

            {isSpeaking && speechCaption ? (
              <PersonaCaption text={speechCaption} />
            ) : (
              interactionMode === "persona" &&
              !isSpeaking &&
              (isLoading || isPreparingSpeech || isFinalizing) &&
              !isStudioLoading && <PersonaCaption text="thinking" typing />
            )}

            {showPersonaStage &&
              !isLoading &&
              !isPreparingSpeech &&
              !isFinalizing &&
              !isSpeaking && (
              <p className="pv-idle-hint">
                Ask Scotty about your sources
              </p>
            )}

            {showSuggestions && (
              <div className="ws-chat__suggestions">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="ws-suggestion-chip"
                    onClick={() => sendTutorMessage(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <footer className="pv-footer ws-chat__footer">
          <p className="ws-chat__scope">{sourceCountLabel}</p>
          <PersonaMicControls
            listening={listening}
            isLoading={isLoading || isPreparingSpeech || isFinalizing}
            isSpeaking={isSpeaking}
            micLabel={micLabel}
            onMicClick={handleMicClick}
            onSend={sendTutorMessage}
            voiceModeRef={voiceModeRef}
            placeholder="or type here"
          />
        </footer>
      </main>

      {/* ── Studio pane ── */}
      <aside
        className={`ws-pane ws-pane--studio${
          studioCollapsed ? " ws-pane--collapsed" : ""
        }${!isDesktop && mobilePane !== "studio" ? " ws-pane--hidden-mobile" : ""}`}
        aria-label="Studio"
      >
        <div className="ws-pane__header">
          {!studioCollapsed && <h2 className="ws-pane__title">Studio</h2>}
          <div className="ws-pane__header-actions">
            {studioView === "output" && !studioCollapsed && (
              <button
                type="button"
                className="ws-link-btn"
                onClick={() => setStudioView("cards")}
              >
                ← Tools
              </button>
            )}
            {isDesktop && (
              <button
                type="button"
                className="ws-pane__collapse-btn"
                aria-label={studioCollapsed ? "Expand studio" : "Collapse studio"}
                onClick={() => setStudioCollapsed((c) => !c)}
              >
                <PanelCollapseIcon direction={studioCollapsed ? "left" : "right"} />
              </button>
            )}
          </div>
        </div>

        {!studioCollapsed && (
          <>
            {studioView === "cards" ? (
              <div className="ws-studio__cards">
                <label className="ws-studio__topic">
                  <span className="ws-studio__topic-label">Topic for all tools</span>
                  <input
                    value={lectureTopic}
                    onChange={(e) => {
                      onLectureTopicChange(e.target.value);
                      setStudioError("");
                      setMaterialError("");
                    }}
                    placeholder="e.g. Week 6 — Recursion"
                  />
                </label>

                {(studioError || materialError) && (
                  <p className="ws-error ws-studio__error" role="alert">
                    {studioError || materialError}
                  </p>
                )}

                {STUDIO_TOOLS.map((tool) => (
                  <article key={tool.id} className="ws-studio__card">
                    <div className="ws-studio__card-icon">
                      <tool.Icon />
                    </div>
                    <div className="ws-studio__card-body">
                      <h3 className="ws-studio__card-title">{tool.label}</h3>
                      <p className="ws-studio__card-desc">{tool.description}</p>
                    </div>
                    <button
                      type="button"
                      className="tartan-btn ws-studio__generate"
                      disabled={Boolean(isLoading && generatingActivityId)}
                      onClick={() => handleGenerate(tool.id)}
                    >
                      {generatingActivityId === tool.id || (isLoading && tutorActivity === tool.id)
                        ? "Generating…"
                        : "Generate"}
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="ws-studio__result">
                {renderStudyOutput() || (
                  <div className="ws-studio__loading">
                    <p>Pick a tool and tap Generate to create study content from your sources.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {studioCollapsed && (
          <button
            type="button"
            className="ws-pane__rail-btn"
            aria-label="Expand studio"
            onClick={() => setStudioCollapsed(false)}
          >
            <StudioIcon />
          </button>
        )}
      </aside>

      {/* Mobile pane switcher */}
      {!isDesktop && (
        <nav className="ws-mobile-nav" aria-label="Workspace panes">
          <button
            type="button"
            className={`ws-mobile-nav__btn${mobilePane === "sources" ? " ws-mobile-nav__btn--active" : ""}`}
            onClick={() => setMobilePane("sources")}
          >
            <SourcesIcon />
            <span>Sources</span>
          </button>
          <button
            type="button"
            className={`ws-mobile-nav__btn${mobilePane === "chat" ? " ws-mobile-nav__btn--active" : ""}`}
            onClick={() => setMobilePane("chat")}
          >
            Chat
          </button>
          <button
            type="button"
            className={`ws-mobile-nav__btn${mobilePane === "studio" ? " ws-mobile-nav__btn--active" : ""}`}
            onClick={() => setMobilePane("studio")}
          >
            <StudioIcon />
            <span>Studio</span>
          </button>
        </nav>
      )}

    </div>
  );
}

export default ClassWorkspace;
