import { useEffect, useRef, useState, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginSignup from "./components/Auth/LoginSignup";
import OnboardingFlow from "./components/Onboarding/OnboardingFlow";
import PersonaView from "./components/PersonaView";
import SideMenu from "./components/SideMenu";
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
import { extractStudyDocuments } from "./utils/extractSyllabusText";
import { generateQuizFromSource } from "./utils/documentQuiz";
import { buildMindMapFromConcept } from "./utils/mindMap";
import { detectSheetKind, generateStudySheet } from "./utils/studySheet";
import {
  ATTACH_HINT,
  SHEET_ATTACH_HINT,
  celebrateReaction,
  detectTeachIntent,
  teachReaction,
} from "./utils/teachStudio";
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
  const [teachStudio, setTeachStudio] = useState(null);
  const [documentSource, setDocumentSource] = useState(null);
  const voiceModeRef = useRef(false);
  const avatarRef = useRef(null);
  const abortControllerRef = useRef(null);
  const documentSourceRef = useRef(null);
  const isDesktop = useIsDesktop();
  const { isSpeaking, isPreparingSpeech, speak, stop, caption, voiceStatus, retryVoice } = usePersonaSpeech(avatarRef, userId);
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

  const prevMindStepRef = useRef(0);
  useEffect(() => {
    if (teachStudio?.kind !== "mindmap") {
      prevMindStepRef.current = 0;
      return;
    }
    if (teachStudio.step === prevMindStepRef.current) return;
    prevMindStepRef.current = teachStudio.step;
    if (teachStudio.step > 0 && teachStudio.reaction?.text && !readMutedPreference(userId)) {
      speakFormatted(teachStudio.reaction.text);
    }
  }, [teachStudio, speakFormatted, userId]);

  const prevSheetStepRef = useRef(0);
  useEffect(() => {
    if (teachStudio?.kind !== "sheet") {
      prevSheetStepRef.current = 0;
      return;
    }
    if (teachStudio.step === prevSheetStepRef.current) return;
    prevSheetStepRef.current = teachStudio.step;
    if (teachStudio.step > 0 && teachStudio.reaction?.text && !readMutedPreference(userId)) {
      speakFormatted(teachStudio.reaction.text);
    }
  }, [teachStudio, speakFormatted, userId]);


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

  function resetTeachSession() {
    setTeachStudio(null);
    setDocumentSource(null);
    documentSourceRef.current = null;
  }

  function resetChatSession() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    stop();
    setTutorListening(false);
    setIsLoading(false);
    setChatSessionKey((key) => key + 1);
    resetTeachSession();
  }

  function appendStudioMessages(userText, assistantText) {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userText },
      { role: "assistant", content: assistantText, studio: true },
    ]);
    setIsLoading(false);
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

  function rebuildSheetStudio(source, { kind, density, seed, userContent }) {
    const sheet = generateStudySheet(source.text, {
      sourceName: source.name,
      major: user?.profile?.major,
      kind,
      density,
      seed,
    });
    if (!sheet.sections.length) return null;
    return {
      kind: "sheet",
      title: sheet.title,
      sourceName: source.name,
      sourceText: source.text,
      sheetKind: sheet.kind,
      density: sheet.density,
      seed,
      sheet,
      step: 0,
      reaction: { type: "teach", text: sheet.sections[0]?.narration || "I'll lay this out like a CMU one-pager." },
      userContent,
    };
  }

  const handleMindMapStep = useCallback((next) => {
    setTeachStudio((current) => {
      if (!current || current.kind !== "mindmap") return current;
      const last = Math.max((current.map?.steps?.length ?? 1) - 1, 0);
      const step = Math.min(Math.max(next, 0), last);
      if (step === current.step) return current;
      return {
        ...current,
        step,
        reaction: { type: "teach", text: current.map.steps[step]?.narration || "" },
      };
    });
  }, []);

  const handleSheetStep = useCallback((next) => {
    setTeachStudio((current) => {
      if (!current || current.kind !== "sheet") return current;
      const last = Math.max((current.sheet?.sections?.length ?? 1) - 1, 0);
      const step = Math.min(Math.max(next, 0), last);
      if (step === current.step) return current;
      return {
        ...current,
        step,
        reaction: { type: "teach", text: current.sheet.sections[step]?.narration || "" },
      };
    });
  }, []);

  function handleSheetDensity(density) {
    const source = documentSourceRef.current;
    setTeachStudio((current) => {
      if (!current || current.kind !== "sheet" || !source?.text) return current;
      const next = rebuildSheetStudio(source, {
        kind: current.sheetKind || current.sheet?.kind,
        density,
        seed: current.seed || 0,
        userContent: current.userContent,
      });
      return next || current;
    });
  }

  function handleSheetRegenerate() {
    const source = documentSourceRef.current;
    setTeachStudio((current) => {
      if (!current || current.kind !== "sheet" || !source?.text) return current;
      const next = rebuildSheetStudio(source, {
        kind: current.sheetKind || current.sheet?.kind,
        density: current.density || "dense",
        seed: (current.seed || 0) + 1,
        userContent: current.userContent,
      });
      return next || current;
    });
  }

  function handleQuizAnswer({ correct, question, index }) {
    const text = correct ? celebrateReaction(index) : teachReaction(question);
    setTeachStudio((current) =>
      current ? { ...current, reaction: { type: correct ? "celebrate" : "teach", text } } : current
    );
    if (!readMutedPreference(userId)) {
      speakFormatted(text);
    }
  }

  function handleDocumentQuizComplete(results) {
    const recap = `Finished the quiz from your notes: ${results.score}/${results.total}. Ask to retry or whiteboard something you missed.`;
    setTeachStudio((current) =>
      current
        ? { ...current, reaction: { type: "celebrate", text: `${results.score} out of ${results.total}. Solid work.` } }
        : current
    );
    setMessages((prev) => [...prev, { role: "assistant", content: recap, studio: true }]);
    if (!readMutedPreference(userId)) {
      speakFormatted(`That's ${results.score} out of ${results.total} from your notes.`);
    }
  }

  async function tryOpenTeachStudio(text, files = []) {
    const intent = detectTeachIntent(text, { hasSource: Boolean(documentSourceRef.current || files.length) });
    const emptyAsk = !String(text || "").trim();
    if (!intent && !(emptyAsk && files.length) && !files.length) {
      return false;
    }

    let source = documentSourceRef.current;
    let warnings = [];

    if (files.length) {
      setIsLoading(true);
      try {
        const extracted = await extractStudyDocuments(files);
        warnings = extracted.warnings;
        if (extracted.text) {
          source = { name: extracted.names.join(", "), text: extracted.text };
          documentSourceRef.current = source;
          setDocumentSource(source);
        }
      } catch (err) {
        warnings.push(err.message || "Could not read that file.");
      } finally {
        setIsLoading(false);
      }
    }

    const wantQuiz = intent?.kind === "quiz" || (emptyAsk && files.length > 0);
    const wantMap = intent?.kind === "mindmap";
    const wantSheet = intent?.kind === "sheet";

    if (!wantQuiz && !wantMap && !wantSheet) {
      if (warnings.length && emptyAsk) {
        appendStudioMessages(
          files.map((file) => file.name).join(", ") || "Uploaded a file",
          warnings.join(" ")
        );
        return true;
      }
      return false;
    }

    const userContent =
      String(text || "").trim() ||
      (wantQuiz
        ? `Quiz me on ${files.map((file) => file.name).join(", ") || source?.name || "this"}`
        : wantSheet
          ? `Cheat sheet from ${files.map((file) => file.name).join(", ") || source?.name || "this"}`
          : `Whiteboard ${intent?.concept || source?.name || "this"}`);

    if (wantQuiz) {
      if (!source?.text) {
        appendStudioMessages(userContent, warnings[0] || ATTACH_HINT);
        return true;
      }
      const quiz = generateQuizFromSource(source.text, { sourceName: source.name, count: 5 });
      if (!quiz.questions.length) {
        appendStudioMessages(
          userContent,
          "I couldn't pull enough statements from that file to quiz you. Try a notes PDF or paste a few paragraphs."
        );
        return true;
      }
      appendStudioMessages(
        userContent,
        `Quiz from your notes (${source.name}) — one question at a time. This is your material, not campus policy.`
      );
      setTeachStudio({
        kind: "quiz",
        title: quiz.title,
        sourceName: source.name,
        questions: quiz.questions,
        reaction: { type: "teach", text: "Whenever you're ready — pick an answer." },
      });
      return true;
    }

    if (wantSheet) {
      if (!source?.text) {
        appendStudioMessages(userContent, warnings[0] || SHEET_ATTACH_HINT);
        return true;
      }
      const sheetKind = detectSheetKind(text);
      const studio = rebuildSheetStudio(source, {
        kind: sheetKind,
        density: "dense",
        seed: 0,
        userContent,
      });
      if (!studio) {
        appendStudioMessages(
          userContent,
          "I couldn't pull a tight sheet from that file. Try a lecture PDF or PPTX with a few full sentences."
        );
        return true;
      }
      appendStudioMessages(
        userContent,
        `A ${studio.sheet.kind === "cheatsheet" ? "cheat sheet" : studio.sheet.kind.replace("-", " ")} from your notes — ${studio.sheet.courseLabel} style. I'll reveal it section by section. Not an official past paper.`
      );
      setTeachStudio(studio);
      return true;
    }

    const map = buildMindMapFromConcept(intent?.concept, {
      sourceText: source?.text || "",
      sourceName: source?.name || "",
      struggle: Boolean(intent?.struggle),
    });
    appendStudioMessages(
      userContent,
      intent?.struggle
        ? "This one's sticky — I'll walk it on the board, one piece at a time."
        : `I'll map ${map.title} beside us. Watch the board as we go.`
    );
    setTeachStudio({
      kind: "mindmap",
      title: map.title,
      map,
      step: 0,
      reaction: { type: "teach", text: map.steps[0]?.narration || "" },
    });
    return true;
  }

  async function handleSend(text, overrideMode, options = {}) {
    armSpeechSynthesis();
    const activeMode = overrideMode ?? mode;
    if (activeMode !== "tutor") {
      const handled = await tryOpenTeachStudio(text, options.files || []);
      if (handled) return;
    }
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
        const spokenReply = stripMarkdownFormatting(reply);
        setMessages([
          ...updatedMessages,
          {
            id: assistantMessageId,
            role: "assistant",
            content: spokenReply,
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
              voiceStatus={voiceStatus}
              onRetryVoice={retryVoice}
              profile={user?.profile}
              teachStudio={teachStudio}
              documentSource={documentSource}
              onCloseStudio={() => setTeachStudio(null)}
              onQuizAnswer={handleQuizAnswer}
              onDocumentQuizComplete={handleDocumentQuizComplete}
              onMindMapStep={handleMindMapStep}
              onSheetStep={handleSheetStep}
              onSheetDensity={handleSheetDensity}
              onSheetRegenerate={handleSheetRegenerate}
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
