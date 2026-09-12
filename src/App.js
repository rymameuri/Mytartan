import { useEffect, useRef, useState, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginSignup from "./components/Auth/LoginSignup";
import OnboardingFlow from "./components/Onboarding/OnboardingFlow";
import PersonaView from "./components/PersonaView";
import SideMenu from "./components/SideMenu";
import ScottyPattern from "./components/ScottyPattern";
import ScottyPersonaStage from "./components/ScottyPersonaStage";
import CourseTutorDashboard from "./components/CourseTutorDashboard";
import ClassWorkspace from "./components/ClassWorkspace";
import { useConversations } from "./hooks/useConversations";
import {
  usePersonaSpeech,
  useAutoSpeakReply,
  readMutedPreference,
  armSpeechSynthesis,
} from "./hooks/usePersonaSpeech";
import {
  resolveTutorSpeech,
  isStructuredStudioContent,
} from "./utils/tutorSpeechFallback";
import { useMutedPreference } from "./hooks/useMutedPreference";
import { useCanvasConnection } from "./hooks/useCanvasConnection";
import SettingsModal from "./components/SettingsModal";
import FacialAlignTool from "./components/FacialAlignTool";
import { buildTutorWelcomeMessage } from "./utils/tutorWelcome";
import { refreshCourse } from "./utils/courseApi";
import { stripMarkdownFormatting } from "./utils/stripMarkdown";
import { toSpokenText } from "./utils/spokenText";
import { readSidebarCollapsed, writeSidebarCollapsed } from "./utils/sidebarPreference";
import { COURSE_TUTOR_ENABLED } from "./config/features";
import "./App.css";

const API_BASE = process.env.REACT_APP_API_URL || "";
const DESKTOP_BREAKPOINT = 900;

function useFacialAlignMode() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("facialAlign");
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    function handleChange(event) {
      setIsDesktop(event.matches);
    }
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  return isDesktop;
}

function AppRoutes() {
  const { token, user } = useAuth();

  if (!token) {
    return <LoginSignup />;
  }

  if (!user?.profile?.onboardingComplete) {
    return <OnboardingFlow />;
  }

  return <AppShell />;
}

function AppShell() {
  const { user, token } = useAuth();
  const userId = user?.id;

  const {
    activeConversationId,
    ungroupedConversations,
    projects,
    getProjectConversations,
    persistCurrent,
    newChat,
    selectConversation,
    deleteConversation,
    createProject,
    renameProject,
    deleteProject,
    moveConversationToProject,
  } = useConversations(userId);

  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState("qa");
  const [courseContext, setCourseContext] = useState(null);
  const [savedCourseId, setSavedCourseId] = useState(null);
  const [tutorScreen, setTutorScreen] = useState(null);
  const [tutorActivity, setTutorActivity] = useState("quiz");
  const [lectureTopic, setLectureTopic] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readSidebarCollapsed(userId));
  const [tutorListening, setTutorListening] = useState(false);
  const [chatSessionKey, setChatSessionKey] = useState(0);
  const [tutorSpeechText, setTutorSpeechText] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const voiceModeRef = useRef(false);
  const avatarRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isDesktop = useIsDesktop();
  const { isSpeaking, isPreparingSpeech, speak, stop, caption } = usePersonaSpeech(avatarRef);
  const { isMuted, toggleMute } = useMutedPreference(stop, userId);
  const canvasConnection = useCanvasConnection(userId, token);

  useEffect(() => {
    setSidebarCollapsed(readSidebarCollapsed(userId));
  }, [userId]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastReply =
    lastAssistant?.studio || isStructuredStudioContent(lastAssistant?.content)
      ? ""
      : lastAssistant?.content ?? "";

  useEffect(() => {
    if (!menuOpen || isDesktop) return;
    function handleKeyDown(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen, isDesktop]);

  useEffect(() => {
    persistCurrent(messages, mode, courseContext, savedCourseId);
  }, [messages, mode, courseContext, savedCourseId, persistCurrent]);

  const speakFormatted = useCallback(
    (text) => speak(toSpokenText(stripMarkdownFormatting(text))),
    [speak]
  );

  const showPersona = !COURSE_TUTOR_ENABLED || mode === "qa" || (mode === "tutor" && !tutorScreen);
  const showTutorPersonaRail =
    COURSE_TUTOR_ENABLED && isDesktop && mode === "tutor" && tutorScreen === "dashboard";

  useAutoSpeakReply({
    enabled: mode === "qa" || (mode === "tutor" && tutorScreen === "workspace"),
    isLoading,
    lastReply,
    speechText: mode === "tutor" ? tutorSpeechText : "",
    voiceModeRef,
    speak: speakFormatted,
    chatSessionKey,
    userId,
  });

  function closeMenu() {
    setMenuOpen(false);
  }

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      writeSidebarCollapsed(next, userId);
      return next;
    });
  }

  function resetChatSession() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    stop();
    setTutorListening(false);
    setIsLoading(false);
    setChatSessionKey((key) => key + 1);
  }

  function enterTutorDashboard() {
    resetChatSession();
    setMode("tutor");
    setTutorScreen("dashboard");
    setMessages([]);
    setCourseContext(null);
    setSavedCourseId(null);
    setLectureTopic("");
  }

  function handleNewChat() {
    resetChatSession();
    const draft = newChat();
    setMessages(draft.messages);
    setMode(COURSE_TUTOR_ENABLED ? draft.mode : "qa");
    setTutorScreen(null);
    setCourseContext(null);
    setSavedCourseId(null);
    closeMenu();
  }

  async function handleOpenClass(courseRef) {
    resetChatSession();
    setMode("tutor");
    setTutorScreen("workspace");
    setMessages([]);
    setLectureTopic("");

    try {
      const course = courseRef.syllabusText
        ? courseRef
        : await refreshCourse(courseRef.id, token);
      setCourseContext(course);
      setSavedCourseId(course.id);
      setMessages([
        {
          role: "assistant",
          content: buildTutorWelcomeMessage(course),
        },
      ]);
    } catch (err) {
      setMessages([
        {
          role: "assistant",
          content: `Could not load class: ${err.message}`,
        },
      ]);
    }
    closeMenu();
  }

  function handleBackToDashboard() {
    resetChatSession();
    setTutorScreen("dashboard");
    setMessages([]);
    setCourseContext(null);
    setSavedCourseId(null);
  }

  function handleSelectConversation(id) {
    resetChatSession();
    const selected = selectConversation(id);
    setMessages(selected.messages);
    const nextMode = COURSE_TUTOR_ENABLED ? selected.mode : "qa";
    setMode(nextMode);
    setCourseContext(COURSE_TUTOR_ENABLED ? selected.courseContext ?? null : null);
    setSavedCourseId(COURSE_TUTOR_ENABLED ? selected.savedCourseId ?? null : null);
    setTutorScreen(
      COURSE_TUTOR_ENABLED && selected.mode === "tutor" && selected.savedCourseId
        ? "workspace"
        : COURSE_TUTOR_ENABLED && selected.mode === "tutor"
          ? "dashboard"
          : null
    );
    closeMenu();
  }

  function handleDeleteConversation(id) {
    const wasActive = deleteConversation(id);
    if (wasActive) {
      resetChatSession();
      setMessages([]);
      setMode("qa");
      setTutorScreen(null);
      setCourseContext(null);
      setSavedCourseId(null);
    }
  }

  function handleMoveToProject(conversationId, projectId) {
    moveConversationToProject(conversationId, projectId);
  }

  function handleSelectPrompt(prompt) {
    closeMenu();
    setMode("qa");
    setTutorScreen(null);
    handleSend(prompt, "qa");
  }

  function handleSwitchMode(nextMode) {
    if (!COURSE_TUTOR_ENABLED && nextMode === "tutor") return;
    if (nextMode === mode) return;
    resetChatSession();
    setMode(nextMode);
    if (nextMode === "tutor") {
      enterTutorDashboard();
    } else {
      setTutorScreen(null);
      setMessages([]);
      setCourseContext(null);
      setSavedCourseId(null);
    }
  }

  function handleBackToQa() {
    resetChatSession();
    setMode("qa");
    setTutorScreen(null);
    setMessages([]);
    setCourseContext(null);
    setSavedCourseId(null);
  }

  function handleShare() {
    if (!messages.length) return;
    const text = messages
      .map((m) => `${m.role === "user" ? "You" : "Scotty"}: ${m.content}`)
      .join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      alert("Chat copied to clipboard!");
    });
  }

  function handleDownload() {
    if (!messages.length) return;
    const text = messages
      .map((m) => `${m.role === "user" ? "You" : "Scotty"}: ${m.content}`)
      .join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mytartan-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSend(text, overrideMode, options = {}) {
    armSpeechSynthesis();
    const activeMode = overrideMode ?? mode;
    const isStudioGeneration = Boolean(options.studioGeneration);
    const speechMode = options.speechMode ?? (isStudioGeneration ? "introduction" : null);
    const userMessage = {
      role: "user",
      content: text,
      ...(isStudioGeneration ? { studio: true } : {}),
    };
    const updatedMessages = [...messages, userMessage];
    const assistantExtras = isStudioGeneration ? { studio: true } : {};

    setTutorSpeechText("");
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setMessages(updatedMessages);
    setIsLoading(true);

    let reply = "";
    let confidence = null;
    let feedbackContext = null;
    let gotTokens = false;
    let pendingSpeech = "";
    const assistantMessageId = crypto.randomUUID();

    const requestBody = {
      messages: updatedMessages,
      mode: activeMode,
    };

    if (activeMode === "tutor" && (options.courseContext ?? courseContext)) {
      requestBody.courseContext = options.courseContext ?? courseContext;
      requestBody.lectureTopic = options.lectureTopic ?? lectureTopic;
      if (options.studioGeneration) {
        requestBody.studioGeneration = true;
        requestBody.tutorActivity = options.tutorActivity ?? tutorActivity;
      }
      if (speechMode) {
        requestBody.speechMode = speechMode;
      }
      if (options.tutorActivity ?? tutorActivity) {
        requestBody.tutorActivity = options.tutorActivity ?? tutorActivity;
      }
      if (options.studioItemContext) {
        requestBody.studioItemContext = options.studioItemContext;
      }
      if (options.sourceItemContext) {
        requestBody.sourceItemContext = options.sourceItemContext;
      }
    }

    try {
      const response = await fetch(`${API_BASE}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to get a response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (event.type === "metadata") {
            confidence = event.confidence ?? confidence;
            feedbackContext = {
              mode: event.mode ?? activeMode,
              userQuery: event.userQuery ?? text,
              confidence: event.confidence ?? null,
              keyFacts: event.keyFacts ?? [],
            };
          } else if (event.type === "confidence") {
            confidence = event.confidence;
            feedbackContext = {
              ...(feedbackContext ?? { mode: activeMode, userQuery: text, keyFacts: [] }),
              confidence: event.confidence,
            };
          } else if (event.type === "token") {
            gotTokens = true;
            reply += event.text;
            setMessages([
              ...updatedMessages,
              {
                id: assistantMessageId,
                role: "assistant",
                content: reply,
                confidence,
                feedbackContext,
                streaming: true,
                ...assistantExtras,
              },
            ]);
          } else if (event.type === "speech") {
            pendingSpeech = event.text;
          } else if (event.type === "error") {
            throw new Error(event.error || "Failed to get a response");
          }
        }
      }

      if (gotTokens) {
        setMessages([
          ...updatedMessages,
          {
            id: assistantMessageId,
            role: "assistant",
            content: stripMarkdownFormatting(reply),
            confidence,
            feedbackContext: feedbackContext ?? {
              mode: activeMode,
              userQuery: text,
              confidence,
              keyFacts: [],
            },
            streaming: false,
            ...assistantExtras,
          },
        ]);
      }

      if (activeMode === "tutor" && gotTokens && reply.trim() && !readMutedPreference(userId)) {
        const speech = resolveTutorSpeech({
          pendingSpeech,
          reply,
          isStudioGeneration,
          speechMode,
          tutorActivity: options.tutorActivity ?? tutorActivity,
          lectureTopic: options.lectureTopic ?? lectureTopic,
          courseName: (options.courseContext ?? courseContext)?.courseName,
        });
        voiceModeRef.current = false;
        setTutorSpeechText(speech);
      }
    } catch (err) {
      if (err.name === "AbortError") {
        if (gotTokens) {
          setMessages([
            ...updatedMessages,
            {
              id: assistantMessageId,
              role: "assistant",
              content: reply,
              confidence,
              feedbackContext,
              streaming: false,
              ...assistantExtras,
            },
          ]);
        }
        return;
      }

      const isNetworkError =
        err.message === "Failed to fetch" || err.name === "TypeError";
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: isNetworkError
            ? "Can't reach the AI server. Open a terminal in the project folder and run: npm run server"
            : err.message || "Sorry, something went wrong. Please try again.",
          ...assistantExtras,
        },
      ]);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
    }
  }

  async function handleQuizComplete(quizResults) {
    if (mode !== "tutor" || tutorScreen !== "workspace" || !courseContext) return;

    armSpeechSynthesis();
    setTutorSpeechText("");
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userNote = {
      role: "user",
      content: `I finished the quiz (${quizResults.score}/${quizResults.total}).`,
    };
    setMessages((prev) => [...prev, userNote]);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/tutor/quiz-recap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizResults,
          lectureTopic,
          courseContext,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to analyze quiz results");
      }

      const { analysis, speech } = await response.json();
      const recapText = analysis?.trim() || speech?.trim() || "Nice work finishing the quiz.";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: stripMarkdownFormatting(recapText) },
      ]);

      if (!readMutedPreference(userId)) {
        voiceModeRef.current = false;
        setTutorSpeechText(speech?.trim() || recapText);
      }
    } catch (err) {
      if (err.name === "AbortError") return;

      const isNetworkError =
        err.message === "Failed to fetch" || err.name === "TypeError";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: isNetworkError
            ? "Can't reach the AI server to recap your quiz. Make sure the server is running."
            : err.message || "Sorry, I could not analyze your quiz right now.",
        },
      ]);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
    }
  }

  const tutorAvatarState =
    tutorScreen === "workspace"
      ? isSpeaking
        ? "speaking"
        : tutorListening
          ? "listening"
          : isLoading || isPreparingSpeech
            ? "thinking"
            : "idle"
      : isSpeaking
        ? "speaking"
        : isLoading || isPreparingSpeech
          ? "thinking"
          : "idle";

  let personaSubtitle = "Course Tutor";
  let personaHint = "";
  if (tutorScreen === "dashboard") {
    personaHint = "Create a class or open one to start studying";
  } else if (tutorScreen === "workspace" && courseContext) {
    personaSubtitle = courseContext.courseName || "Course Tutor";
    personaHint = "Add materials and study with quiz, flashcards, or whiteboard";
  }

  return (
    <div
      className={`app-shell${isDesktop ? " app-shell--with-sidebar" : ""}${
        sidebarCollapsed ? " app-shell--sidebar-collapsed" : ""
      }${COURSE_TUTOR_ENABLED && mode === "tutor" ? " app-shell--tutor" : ""}`}
    >
      {!(COURSE_TUTOR_ENABLED && mode === "tutor") && <ScottyPattern />}
      <SideMenu
        isOpen={menuOpen || isDesktop}
        isPersistent={isDesktop}
        collapsed={isDesktop && sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
        onClose={closeMenu}
        onNewChat={handleNewChat}
        onSelectPrompt={handleSelectPrompt}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onCreateProject={createProject}
        onRenameProject={renameProject}
        onDeleteProject={deleteProject}
        onMoveToProject={handleMoveToProject}
        activeConversationId={activeConversationId}
        ungroupedConversations={ungroupedConversations}
        projects={projects}
        getProjectConversations={getProjectConversations}
      />

      <div
        className={`app-main app-main--unified${
          showTutorPersonaRail ? " app-main--with-persona" : ""
        }${COURSE_TUTOR_ENABLED && mode === "tutor" && tutorScreen === "workspace" ? " app-main--tutor-workspace" : ""}`}
      >
        <div className="app-main__content">
          {COURSE_TUTOR_ENABLED && mode === "tutor" && tutorScreen === "dashboard" && (
            <CourseTutorDashboard
              onOpenClass={handleOpenClass}
              onBackToQa={handleBackToQa}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          )}

          {COURSE_TUTOR_ENABLED && mode === "tutor" && tutorScreen === "workspace" && savedCourseId && courseContext && (
            <ClassWorkspace
              courseId={savedCourseId}
              courseContext={courseContext}
              onCourseUpdate={setCourseContext}
              onBack={handleBackToDashboard}
              messages={messages}
              isLoading={isLoading}
              onSend={handleSend}
              onOpenMenu={() => setMenuOpen(true)}
              isDesktop={isDesktop}
              voiceModeRef={voiceModeRef}
              isSpeaking={isSpeaking}
              isPreparingSpeech={isPreparingSpeech}
              stopSpeech={stop}
              isMuted={isMuted}
              onToggleMute={toggleMute}
              chatSessionKey={chatSessionKey}
              onListeningChange={setTutorListening}
              tutorActivity={tutorActivity}
              onTutorActivityChange={setTutorActivity}
              lectureTopic={lectureTopic}
              onLectureTopicChange={setLectureTopic}
              onQuizComplete={handleQuizComplete}
              avatarRef={avatarRef}
              avatarState={tutorAvatarState}
              speechCaption={caption}
            />
          )}

          {showPersona && (
            <PersonaView
              chatSessionKey={chatSessionKey}
              messages={messages}
              isLoading={isLoading}
              mode={mode}
              courseContext={courseContext}
              onSend={handleSend}
              onShare={handleShare}
              onDownload={handleDownload}
              onOpenMenu={() => setMenuOpen(true)}
              onSwitchMode={COURSE_TUTOR_ENABLED ? handleSwitchMode : undefined}
              isDesktop={isDesktop}
              isSpeaking={isSpeaking}
              isPreparingSpeech={isPreparingSpeech}
              stopSpeech={stop}
              isMuted={isMuted}
              onToggleMute={toggleMute}
              onOpenSettings={() => setSettingsOpen(true)}
              voiceModeRef={voiceModeRef}
              avatarRef={avatarRef}
              speechCaption={caption}
            />
          )}
        </div>

        {settingsOpen && (
          <SettingsModal
            onClose={() => setSettingsOpen(false)}
            canvasConnection={canvasConnection}
          />
        )}

        {showTutorPersonaRail && (
          <ScottyPersonaStage
            rail
            avatarRef={avatarRef}
            avatarState={tutorAvatarState}
            subtitle={personaSubtitle}
            hint={personaHint}
            isMuted={isMuted}
            onToggleMute={toggleMute}
          />
        )}

      </div>
    </div>
  );
}

function App() {
  if (useFacialAlignMode()) {
    return <FacialAlignTool />;
  }

  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
