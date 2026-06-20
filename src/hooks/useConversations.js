import { useCallback, useEffect, useRef, useState } from "react";

/** Legacy anonymous key used before per-account storage. */
export const LEGACY_CONVERSATIONS_KEY = "tartan-scotty-conversations";
export const MIGRATION_DONE_KEY = "mytartan_migration_done";

export function getConversationsStorageKey(userId) {
  if (userId == null) return LEGACY_CONVERSATIONS_KEY;
  return `mytartan_conversations_${userId}`;
}

export function isConversationsStoreEmpty(raw) {
  if (!raw) return true;
  try {
    const parsed = JSON.parse(raw);
    const hasConversations =
      Array.isArray(parsed.conversations) && parsed.conversations.length > 0;
    const hasProjects = Array.isArray(parsed.projects) && parsed.projects.length > 0;
    return !hasConversations && !hasProjects;
  } catch {
    return true;
  }
}

export function migrateAnonymousConversations(userId) {
  if (userId == null) return;
  try {
    if (localStorage.getItem(MIGRATION_DONE_KEY) === "true") return;

    const legacyRaw = localStorage.getItem(LEGACY_CONVERSATIONS_KEY);
    if (!legacyRaw || isConversationsStoreEmpty(legacyRaw)) return;

    const userKey = getConversationsStorageKey(userId);
    const userRaw = localStorage.getItem(userKey);
    if (!isConversationsStoreEmpty(userRaw)) return;

    localStorage.setItem(userKey, legacyRaw);
    localStorage.setItem(MIGRATION_DONE_KEY, "true");
  } catch {
    /* ignore quota / parse errors */
  }
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function deriveTitle(messages) {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New chat";
  const text = first.content.trim();
  return text.length > 42 ? `${text.slice(0, 42)}…` : text;
}

function loadFromStorage(userId) {
  try {
    const raw = localStorage.getItem(getConversationsStorageKey(userId));
    if (!raw) return { conversations: [], projects: [], activeConversationId: null };
    const parsed = JSON.parse(raw);
    return {
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      activeConversationId: parsed.activeConversationId ?? null,
    };
  } catch {
    return { conversations: [], projects: [], activeConversationId: null };
  }
}

export function useConversations(userId) {
  const [store, setStore] = useState(() => loadFromStorage(userId));
  const skipNextPersist = useRef(false);

  useEffect(() => {
    skipNextPersist.current = true;
    setStore(loadFromStorage(userId));
  }, [userId]);

  useEffect(() => {
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    localStorage.setItem(getConversationsStorageKey(userId), JSON.stringify(store));
  }, [store, userId]);

  const activeConversation = store.conversations.find(
    (c) => c.id === store.activeConversationId
  );

  const persistCurrent = useCallback((messages, mode, courseContext = null, savedCourseId = null) => {
    setStore((prev) => {
      if (messages.length === 0 && !prev.activeConversationId) return prev;

      const now = Date.now();
      const title =
        mode === "tutor" && courseContext?.courseName
          ? `Tutor: ${courseContext.courseName}`
          : deriveTitle(messages);

      if (!prev.activeConversationId) {
        const id = generateId();
        const conversation = {
          id,
          title,
          mode,
          messages,
          courseContext,
          savedCourseId,
          projectId: null,
          createdAt: now,
          updatedAt: now,
        };
        return {
          ...prev,
          activeConversationId: id,
          conversations: [conversation, ...prev.conversations],
        };
      }

      return {
        ...prev,
        conversations: prev.conversations.map((c) =>
          c.id === prev.activeConversationId
            ? { ...c, title, mode, messages, courseContext, savedCourseId, updatedAt: now }
            : c
        ),
      };
    });
  }, []);

  const newChat = useCallback(() => {
    setStore((prev) => ({ ...prev, activeConversationId: null }));
    return { messages: [], mode: "qa" };
  }, []);

  const selectConversation = useCallback((id) => {
    setStore((prev) => ({ ...prev, activeConversationId: id }));
    const conv = store.conversations.find((c) => c.id === id);
    return conv
      ? {
          messages: conv.messages,
          mode: conv.mode,
          courseContext: conv.courseContext ?? null,
          savedCourseId: conv.savedCourseId ?? null,
        }
      : { messages: [], mode: "qa", courseContext: null, savedCourseId: null };
  }, [store.conversations]);

  const deleteConversation = useCallback((id) => {
    setStore((prev) => ({
      ...prev,
      activeConversationId:
        prev.activeConversationId === id ? null : prev.activeConversationId,
      conversations: prev.conversations.filter((c) => c.id !== id),
    }));
    return id === store.activeConversationId;
  }, [store.activeConversationId]);

  const createProject = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const project = { id: generateId(), name: trimmed, createdAt: Date.now() };
    setStore((prev) => ({
      ...prev,
      projects: [...prev.projects, project],
    }));
    return project;
  }, []);

  const renameProject = useCallback((id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStore((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
    }));
  }, []);

  const deleteProject = useCallback((id) => {
    setStore((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => p.id !== id),
      conversations: prev.conversations.map((c) =>
        c.projectId === id ? { ...c, projectId: null } : c
      ),
    }));
  }, []);

  const moveConversationToProject = useCallback((conversationId, projectId) => {
    setStore((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId ? { ...c, projectId, updatedAt: Date.now() } : c
      ),
    }));
  }, []);

  const ungroupedConversations = store.conversations
    .filter((c) => !c.projectId)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const getProjectConversations = useCallback(
    (projectId) =>
      store.conversations
        .filter((c) => c.projectId === projectId)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [store.conversations]
  );

  return {
    conversations: store.conversations,
    projects: store.projects,
    activeConversationId: store.activeConversationId,
    activeConversation,
    ungroupedConversations,
    getProjectConversations,
    persistCurrent,
    newChat,
    selectConversation,
    deleteConversation,
    createProject,
    renameProject,
    deleteProject,
    moveConversationToProject,
  };
}
