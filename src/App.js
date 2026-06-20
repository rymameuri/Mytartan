import { useEffect, useRef, useState, useCallback } from "react";
import LandingPage from "./components/LandingPage";
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
import { buildTutorWelcomeMessage } from "./utils/tutorWelcome";
import { refreshCourse } from "./utils/courseApi";
import { stripMarkdownFormatting } from "./utils/stripMarkdown";
import { readSidebarCollapsed, writeSidebarCollapsed } from "./utils/sidebarPreference";
import "./App.css";

const API_BASE = process.env.REACT_APP_API_URL || "";
const DESKTOP_BREAKPOINT = 900;

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

function App() {
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
  } = useConversations();

  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState("qa");
  const [courseContext, setCourseContext] = useState(null);
  const [savedCourseId, setSavedCourseId] = useState(null);
  const [tutorScreen, setTutorScreen] = useState(null);
  const [tutorActivity, setTutorActivity] = useState("quiz");
  const [lectureTopic, setLectureTopic] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [tutorListening, setTutorListening] = useState(false);
  const [view, setView] = useState("landing");
  const [chatSessionKey, setChatSessionKey] = useState(0);
  const [tutorSpeechText, setTutorSpeechText] = useState("");
  const voiceModeRef = useRef(false);
  const avatarRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isDesktop = useIsDesktop();
  const { isSpeaking, speak, stop } = usePersonaSpeech(avatarRef);
  const { isMuted, toggleMute } = useMutedPreference(stop);

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
    (text) => speak(stripMarkdownFormatting(text)),
    [speak]
  );

  const showPersona = mode === "qa" || (mode === "tutor" && !tutorScreen);
  const showTutorPersonaRail = isDesktop && mode === "tutor" && tutorScreen === "dashboard";

  useAutoSpeakReply({
    enabled: mode === "qa" || (mode === "tutor" && tutorScreen === "workspace"),
    isLoading,
    lastReply,
    speechText: mode === "tutor" ? tutorSpeechText : "",
    voiceModeRef,
    speak: speakFormatted,
    chatSessionKey,
  });

  function closeMenu() {
    setMenuOpen(false);
  }

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      writeSidebarCollapsed(next);
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

  function handleEnterApp() {
    resetChatSession();
    newChat();
    setMessages([]);
    setMode("qa");
    setTutorScreen(null);
    setCourseContext(null);
    setSavedCourseId(null);
    setLectureTopic("");
    setTutorSpeechText("");
    setView("app");
  }

  function handleNewChat() {
    resetChatSession();
    const draft = newChat();
    setMessages(draft.messages);
    setMode(draft.mode);
    setTutorScreen(null);
    setCourseContext(null);
    setSavedCourseId(null);
    closeMenu();
  }

  function handleStartTutor() {
    newChat();
    enterTutorDashboard();
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
        : await refreshCourse(courseRef.id);
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
    setMode(selected.mode);
    setCourseContext(selected.courseContext ?? null);
    setSavedCourseId(selected.savedCourseId ?? null);
    setTutorScreen(selected.mode === "tutor" && selected.savedCourseId ? "workspace" : selected.mode === "tutor" ? "dashboard" : null);
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
      .map((m) => `${m.role === "user" ? "You" : "MyTartan"}: ${m.content}`)
      .join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      alert("Chat copied to clipboard!");
    });
  }

  function handleDownload() {
    if (!messages.length) return;
    const text = messages
      .map((m) => `${m.role === "user" ? "You" : "MyTartan"}: ${m.content}`)
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
    let gotTokens = false;
    let pendingSpeech = "";

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
    }

    try {
      const response = await fetch(`${API_BASE}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

          if (event.type === "confidence") {
            confidence = event.confidence;
          } else if (event.type === "token") {
            gotTokens = true;
            reply += event.text;
            setMessages([
              ...updatedMessages,
              { role: "assistant", content: reply, confidence, streaming: true, ...assistantExtras },
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
            role: "assistant",
            content: stripMarkdownFormatting(reply),
            confidence,
            streaming: false,
            ...assistantExtras,
          },
        ]);
      }

      if (activeMode === "tutor" && gotTokens && reply.trim() && !readMutedPreference()) {
        const speech = resolveTutorSpeech({
          pendingSpeech,
          reply,
          isStudioGeneration,
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
              role: "assistant",
              content: reply,
              confidence,
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

  if (view === "landing") {
    return <LandingPage onStart={handleEnterApp} />;
  }

  const tutorAvatarState =
    tutorScreen === "workspace"
      ? isSpeaking
        ? "speaking"
        : tutorListening
          ? "listening"
          : "idle"
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
      }${mode === "tutor" ? " app-shell--tutor" : ""}`}
    >
      {mode !== "tutor" && <ScottyPattern />}
      <SideMenu
        isOpen={menuOpen || isDesktop}
        isPersistent={isDesktop}
        collapsed={isDesktop && sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
        onClose={closeMenu}
        onNewChat={handleNewChat}
        onStartTutor={handleStartTutor}
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
        }${mode === "tutor" && tutorScreen === "workspace" ? " app-main--tutor-workspace" : ""}`}
      >
        <div className="app-main__content">
          {mode === "tutor" && tutorScreen === "dashboard" && (
            <CourseTutorDashboard onOpenClass={handleOpenClass} onBackToQa={handleBackToQa} />
          )}

          {mode === "tutor" && tutorScreen === "workspace" && savedCourseId && courseContext && (
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
              stopSpeech={stop}
              isMuted={isMuted}
              onToggleMute={toggleMute}
              chatSessionKey={chatSessionKey}
              onListeningChange={setTutorListening}
              tutorActivity={tutorActivity}
              onTutorActivityChange={setTutorActivity}
              lectureTopic={lectureTopic}
              onLectureTopicChange={setLectureTopic}
              avatarRef={avatarRef}
              avatarState={tutorAvatarState}
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
              onSwitchMode={handleSwitchMode}
              isDesktop={isDesktop}
              isSpeaking={isSpeaking}
              stopSpeech={stop}
              isMuted={isMuted}
              onToggleMute={toggleMute}
              voiceModeRef={voiceModeRef}
              avatarRef={avatarRef}
            />
          )}
        </div>

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

export default App;
