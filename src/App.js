import { useEffect, useState } from "react";
import ChatInterface from "./components/ChatInterface";
import MapNavigator from "./components/MapNavigator";
import ScottyMascot from "./components/ScottyMascot";
import SideMenu from "./components/SideMenu";
import { DownloadIcon, MenuIcon, ScottyLogoIcon, ShareIcon } from "./components/Icons";
import { useConversations } from "./hooks/useConversations";
import "./App.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001";
const DESKTOP_BREAKPOINT = 900;

const MODES = [
  { id: "qa", label: "Q&A" },
  { id: "campus", label: "Campus Guide" },
  { id: "chat", label: "Chat" },
  { id: "tutor", label: "Tutor" },
];

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`).matches
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
  const isDesktop = useIsDesktop();

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

  function openMenu() {
    setMenuOpen(true);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  function handleNewChat() {
    const draft = newChat();
    setMessages(draft.messages);
    setMode(draft.mode);
    closeMenu();
  }

  function handleSelectConversation(id) {
    const selected = selectConversation(id);
    setMessages(selected.messages);
    setMode(selected.mode);
    closeMenu();
  }

  function handleDeleteConversation(id) {
    const wasActive = deleteConversation(id);
    if (wasActive) {
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

  async function handleSend(text, overrideMode) {
    const activeMode = overrideMode ?? mode;
    const userMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages, mode: activeMode }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to get a response");
      }

      const reply = data.reply;
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err.message || "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={`app-shell${isDesktop ? " app-shell--with-sidebar" : ""}`}>
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

      <div className="app-main">
        <div className="app-card">
          <header className="app-topbar">
            {isDesktop ? (
              <div className="app-topbar__spacer" aria-hidden="true" />
            ) : (
              <button
                type="button"
                className="icon-btn icon-btn--menu"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                onClick={openMenu}
              >
                <MenuIcon />
              </button>
            )}

            <div className="app-topbar__center">
              <div className="app-brand">
                <ScottyLogoIcon />
                <span className="app-brand__title">Tartan Scotty</span>
              </div>

              <nav className="mode-nav" role="tablist" aria-label="Chat mode">
                {MODES.map(({ id, label }, index) => (
                  <span key={id} className="mode-nav__item">
                    {index > 0 && <span className="mode-nav__divider" aria-hidden="true" />}
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === id}
                      className={`mode-nav__tab${mode === id ? " mode-nav__tab--active" : ""}`}
                      onClick={() => setMode(id)}
                    >
                      {label}
                    </button>
                  </span>
                ))}
              </nav>
            </div>

            <div className="app-topbar__actions">
              <button type="button" className="icon-btn" aria-label="Share">
                <ShareIcon />
              </button>
              <button type="button" className="icon-btn" aria-label="Download">
                <DownloadIcon />
              </button>
            </div>
          </header>

          {mode === "campus" ? (
            <MapNavigator />
          ) : (
            <ChatInterface
              messages={messages}
              onSend={handleSend}
              isLoading={isLoading}
              showHero={messages.length === 0 && !isLoading}
              mascot={<ScottyMascot className="hero__mascot-img" />}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
