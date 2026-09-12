import { useEffect, useRef, useState } from "react";
import {
  ChatIcon,
  ChevronIcon,
  CloseIcon,
  FolderIcon,
  MoreIcon,
  PlusIcon,
  TrashIcon,
} from "./Icons";
import ProjectModal from "./ProjectModal";
import { useAuth } from "../context/AuthContext";
import { TOPIC_SUGGESTIONS } from "../data/topicSuggestions";
import "./SideMenu.css";

function ConversationItem({
  conversation,
  isActive,
  projects,
  onSelect,
  onDelete,
  onMoveToProject,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <li className="side-menu__conv-item">
      <button
        type="button"
        className={`side-menu__conv-btn${isActive ? " side-menu__conv-btn--active" : ""}`}
        onClick={() => onSelect(conversation.id)}
        title={conversation.title}
      >
        <ChatIcon />
        <span className="side-menu__conv-title">{conversation.title}</span>
      </button>

      <div className="side-menu__conv-actions" ref={menuRef}>
        <button
          type="button"
          className="side-menu__conv-menu-btn"
          aria-label="Conversation options"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((open) => !open);
          }}
        >
          <MoreIcon />
        </button>

        {menuOpen && (
          <div className="side-menu__dropdown">
            {projects.length > 0 && (
              <div className="side-menu__dropdown-group">
                <span className="side-menu__dropdown-label">Move to project</span>
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className="side-menu__dropdown-item"
                    onClick={() => {
                      onMoveToProject(conversation.id, project.id);
                      setMenuOpen(false);
                    }}
                  >
                    <FolderIcon />
                    {project.name}
                  </button>
                ))}
              </div>
            )}
            {conversation.projectId && (
              <button
                type="button"
                className="side-menu__dropdown-item"
                onClick={() => {
                  onMoveToProject(conversation.id, null);
                  setMenuOpen(false);
                }}
              >
                Remove from project
              </button>
            )}
            <button
              type="button"
              className="side-menu__dropdown-item side-menu__dropdown-item--danger"
              onClick={() => {
                onDelete(conversation.id);
                setMenuOpen(false);
              }}
            >
              <TrashIcon />
              Delete
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function ProjectSection({
  project,
  conversations,
  activeConversationId,
  isExpanded,
  onToggle,
  onDelete,
  onSelectConversation,
  onDeleteConversation,
  onMoveToProject,
  onRequestRename,
  allProjects,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="side-menu__project">
      <div className="side-menu__project-header">
        <button type="button" className="side-menu__project-toggle" onClick={onToggle}>
          <ChevronIcon direction={isExpanded ? "down" : "right"} />
          <FolderIcon />
          <span className="side-menu__project-name">{project.name}</span>
          <span className="side-menu__project-count">{conversations.length}</span>
        </button>

        <div className="side-menu__conv-actions" ref={menuRef}>
          <button
            type="button"
            className="side-menu__conv-menu-btn"
            aria-label="Project options"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((open) => !open);
            }}
          >
            <MoreIcon />
          </button>

          {menuOpen && (
            <div className="side-menu__dropdown">
              <button
                type="button"
                className="side-menu__dropdown-item"
                onClick={() => {
                  onRequestRename(project);
                  setMenuOpen(false);
                }}
              >
                Rename
              </button>
              <button
                type="button"
                className="side-menu__dropdown-item side-menu__dropdown-item--danger"
                onClick={() => {
                  onDelete(project.id);
                  setMenuOpen(false);
                }}
              >
                <TrashIcon />
                Delete project
              </button>
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        conversations.length > 0 ? (
          <ul className="side-menu__conv-list side-menu__conv-list--nested">
            {conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                projects={allProjects.filter((p) => p.id !== project.id)}
                onSelect={onSelectConversation}
                onDelete={onDeleteConversation}
                onMoveToProject={onMoveToProject}
              />
            ))}
          </ul>
        ) : (
          <p className="side-menu__project-empty">No chats yet — move one here with ⋯</p>
        )
      )}
    </div>
  );
}

function SideMenu({
  isOpen,
  isPersistent,
  collapsed = false,
  onToggleCollapsed,
  onClose,
  onNewChat,
  onSelectPrompt,
  onSelectConversation,
  onDeleteConversation,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onMoveToProject,
  activeConversationId,
  ungroupedConversations,
  projects,
  getProjectConversations,
}) {
  const { user, logout } = useAuth();
  const [topicsExpanded, setTopicsExpanded] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState(() => new Set());
  const [projectModal, setProjectModal] = useState(null);

  useEffect(() => {
    if (projects.length === 0) return;
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      projects.forEach((p) => next.add(p.id));
      return next;
    });
  }, [projects]);

  function toggleProject(projectId) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function openCreateProjectModal() {
    setProjectModal({ mode: "create" });
  }

  function openRenameProjectModal(project) {
    setProjectModal({ mode: "rename", projectId: project.id, initialName: project.name });
  }

  function handleProjectModalSubmit(name) {
    if (projectModal?.mode === "create") {
      const project = onCreateProject(name);
      if (project) {
        setExpandedProjects((prev) => new Set([...prev, project.id]));
      }
    } else if (projectModal?.mode === "rename") {
      onRenameProject(projectModal.projectId, name);
    }
    setProjectModal(null);
  }

  const sidebar = (
    <aside
      className={`side-menu${isPersistent ? " side-menu--persistent" : ""}${
        collapsed ? " side-menu--collapsed" : ""
      }`}
      role={isPersistent ? "navigation" : "dialog"}
      aria-label="Chat history"
    >
      <div className="side-menu__header">
        {!collapsed && <h2 className="side-menu__title">MyTartan</h2>}
        <div className="side-menu__header-actions">
          {isPersistent && onToggleCollapsed && (
            <button
              type="button"
              className="icon-btn side-menu__collapse-btn"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={onToggleCollapsed}
            >
              <ChevronIcon direction={collapsed ? "right" : "left"} />
            </button>
          )}
          {!isPersistent && (
            <button type="button" className="icon-btn" aria-label="Close menu" onClick={onClose}>
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        className="side-menu__new-chat"
        onClick={onNewChat}
        title="New chat"
      >
        <PlusIcon />
        <span className="side-menu__btn-label">New chat</span>
      </button>

      <div className="side-menu__scroll">
        {projects.length > 0 && (
          <div className="side-menu__section">
            <div className="side-menu__section-header">
              <h3 className="side-menu__section-title">Projects</h3>
              <button
                type="button"
                className="side-menu__section-action"
                aria-label="New project"
                onClick={openCreateProjectModal}
              >
                <PlusIcon />
              </button>
            </div>

            {projects.map((project) => (
              <ProjectSection
                key={project.id}
                project={project}
                conversations={getProjectConversations(project.id)}
                activeConversationId={activeConversationId}
                isExpanded={expandedProjects.has(project.id)}
                onToggle={() => toggleProject(project.id)}
                onDelete={onDeleteProject}
                onSelectConversation={onSelectConversation}
                onDeleteConversation={onDeleteConversation}
                onMoveToProject={onMoveToProject}
                onRequestRename={openRenameProjectModal}
                allProjects={projects}
              />
            ))}
          </div>
        )}

        {projects.length === 0 && (
          <button type="button" className="side-menu__new-project" onClick={openCreateProjectModal}>
            <FolderIcon />
            New project
          </button>
        )}

        {ungroupedConversations.length > 0 && (
          <div className="side-menu__section">
            <h3 className="side-menu__section-title">Recent</h3>
            <ul className="side-menu__conv-list">
              {ungroupedConversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  projects={projects}
                  onSelect={onSelectConversation}
                  onDelete={onDeleteConversation}
                  onMoveToProject={onMoveToProject}
                />
              ))}
            </ul>
          </div>
        )}

        <div className="side-menu__section">
          <button
            type="button"
            className="side-menu__topics-toggle"
            aria-expanded={topicsExpanded}
            onClick={() => setTopicsExpanded((v) => !v)}
          >
            <ChevronIcon direction={topicsExpanded ? "down" : "right"} />
            <span>Topic suggestions</span>
          </button>

          {topicsExpanded &&
            TOPIC_SUGGESTIONS.map((section) => (
              <div key={section.title} className="side-menu__topic-group">
                <h4 className="side-menu__topic-group-title">{section.title}</h4>
                <ul className="side-menu__list">
                  {section.items.map((item) => (
                    <li key={item.label}>
                      <button
                        type="button"
                        className="side-menu__item"
                        onClick={() => onSelectPrompt(item.prompt)}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </div>

      {!collapsed && (
        <div className="side-menu__profile">
          <div className="side-menu__profile-info">
            <span className="side-menu__profile-email">{user?.email}</span>
            {user?.profile?.major && (
              <span className="side-menu__profile-major">{user.profile.major}</span>
            )}
          </div>
          <button type="button" className="side-menu__logout" onClick={logout}>
            Log out
          </button>
        </div>
      )}

      {!collapsed && (
        <p className="side-menu__footer">
          Info sourced from{" "}
          <a
            href="https://sites.google.com/andrew.cmu.edu/mycmuq-student-affairs/home"
            target="_blank"
            rel="noopener noreferrer"
          >
            myCMU-Q Student Affairs
          </a>
          <br />
          Made by Rym A. Ameuri · rameuri
        </p>
      )}
    </aside>
  );

  const modal = projectModal && (
    <ProjectModal
      title={projectModal.mode === "create" ? "New project" : "Rename project"}
      label="Project name"
      initialValue={projectModal.initialName ?? ""}
      submitLabel={projectModal.mode === "create" ? "Create" : "Save"}
      onSubmit={handleProjectModalSubmit}
      onClose={() => setProjectModal(null)}
    />
  );

  if (isPersistent) {
    return (
      <>
        {sidebar}
        {modal}
      </>
    );
  }

  if (!isOpen) return modal || null;

  return (
    <>
      <button
        type="button"
        className="side-menu__backdrop"
        aria-label="Close menu"
        onClick={onClose}
      />
      {sidebar}
      {modal}
    </>
  );
}

export default SideMenu;
