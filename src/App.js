import { useEffect, useRef, useState } from "react";
import LandingPage from "./components/LandingPage";
import MapNavigator from "./components/MapNavigator";
import PersonaView from "./components/PersonaView";
import SideMenu from "./components/SideMenu";
import ScottyPattern from "./components/ScottyPattern";
import { useConversations } from "./hooks/useConversations";
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
    activeConversation,
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

  const [messages, setMessages] = useState(() => activeConversation?.messages ?? []);
  const [mode, setMode] = useState(() => activeConversation?.mode ?? "qa");
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState("landing");
  const [chatSessionKey, setChatSessionKey] = useState(0);
  const voiceModeRef = useRef(false);
  const avatarRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isDesktop = useIsDesktop();

  const lastReply =
    [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";

  useEffect(() => {
    if (!menuOpen || isDesktop) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen, isDesktop]);

  useEffect(() => {
    persistCurrent(messages, mode);
  }, [messages, mode, persistCurrent]);

  function closeMenu() {
    setMenuOpen(false);
  }

  function resetChatSession() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    avatarRef.current?.stop?.();
    window.speechSynthesis?.cancel();
    setIsLoading(false);
    setChatSessionKey((key) => key + 1);
  }

  function handleNewChat() {
    resetChatSession();
    const draft = newChat();
    setMessages(draft.messages);
    setMode(draft.mode);
    closeMenu();
  }

  function handleSelectConversation(id) {
    resetChatSession();
    const selected = selectConversation(id);
    setMessages(selected.messages);
    setMode(selected.mode);
    closeMenu();
  }

  function handleDeleteConversation(id) {
    const wasActive = deleteConversation(id);
    if (wasActive) {
      resetChatSession();
      setMessages([]);
      setMode("qa");
    }
  }

  function handleMoveToProject(conversationId, projectId) {
    moveConversationToProject(conversationId, projectId);
  }

  function handleSelectPrompt(prompt) {
    closeMenu();
    setMode("qa");
    handleSend(prompt, "qa");
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

  async function handleSend(text, overrideMode) {
    const activeMode = overrideMode ?? mode;
    const userMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setMessages(updatedMessages);
    setIsLoading(true);

    let reply = "";
    let confidence = null;
    let gotTokens = false;

    try {
      const response = await fetch(`${API_BASE}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages, mode: activeMode }),
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
            setIsLoading(false);
            setMessages([
              ...updatedMessages,
              { role: "assistant", content: reply, confidence, streaming: true },
            ]);
          } else if (event.type === "error") {
            throw new Error(event.error || "Failed to get a response");
          }
        }
      }

      if (gotTokens) {
        setMessages([
          ...updatedMessages,
          { role: "assistant", content: reply, confidence, streaming: false },
        ]);
      }
    } catch (err) {
      if (err.name === "AbortError") {
        if (gotTokens) {
          setMessages([
            ...updatedMessages,
            { role: "assistant", content: reply, confidence, streaming: false },
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
        },
      ]);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
    }
  }

  function handleStopGeneration() {
    abortControllerRef.current?.abort();
    avatarRef.current?.stop?.();
    window.speechSynthesis?.cancel();
    setIsLoading(false);
  }

  if (view === "landing") {
    return <LandingPage onStart={() => setView("app")} />;
  }

  return (
    <div className={`app-shell${isDesktop ? " app-shell--with-sidebar" : ""}`}>
      <ScottyPattern />
      <SideMenu
        isOpen={menuOpen || isDesktop}
        isPersistent={isDesktop}
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

      <div className="app-main app-main--unified">
        {mode === "campus" ? (
          <MapNavigator />
        ) : (
          <PersonaView
            chatSessionKey={chatSessionKey}
            messages={messages}
            isLoading={isLoading}
            onSend={handleSend}
            onStop={handleStopGeneration}
            onShare={handleShare}
            onDownload={handleDownload}
            onOpenMenu={() => setMenuOpen(true)}
            isDesktop={isDesktop}
            lastReply={lastReply}
            voiceModeRef={voiceModeRef}
            avatarRef={avatarRef}
          />
        )}
      </div>
    </div>
  );
}

export default App;
