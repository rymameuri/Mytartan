import {
  LEGACY_CONVERSATIONS_KEY,
  MIGRATION_DONE_KEY,
  getConversationsStorageKey,
  isConversationsStoreEmpty,
  migrateAnonymousConversations,
} from "./useConversations";

const sampleStore = {
  conversations: [{ id: "1", title: "Hello", messages: [], updatedAt: 1 }],
  projects: [],
  activeConversationId: "1",
};

describe("conversation storage migration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("getConversationsStorageKey uses legacy key when userId is null", () => {
    expect(getConversationsStorageKey(null)).toBe(LEGACY_CONVERSATIONS_KEY);
    expect(getConversationsStorageKey(undefined)).toBe(LEGACY_CONVERSATIONS_KEY);
  });

  test("getConversationsStorageKey namespaces by user id", () => {
    expect(getConversationsStorageKey("user-abc")).toBe("mytartan_conversations_user-abc");
  });

  test("migrateAnonymousConversations copies legacy data to first login account", () => {
    localStorage.setItem(LEGACY_CONVERSATIONS_KEY, JSON.stringify(sampleStore));

    migrateAnonymousConversations("user-1");

    const userKey = getConversationsStorageKey("user-1");
    expect(JSON.parse(localStorage.getItem(userKey))).toEqual(sampleStore);
    expect(localStorage.getItem(MIGRATION_DONE_KEY)).toBe("true");
    expect(localStorage.getItem(LEGACY_CONVERSATIONS_KEY)).toBeTruthy();
  });

  test("migrateAnonymousConversations does not run twice for a second account", () => {
    localStorage.setItem(LEGACY_CONVERSATIONS_KEY, JSON.stringify(sampleStore));

    migrateAnonymousConversations("user-1");
    migrateAnonymousConversations("user-2");

    expect(localStorage.getItem(getConversationsStorageKey("user-2"))).toBeNull();
  });

  test("migrateAnonymousConversations skips when user key already has data", () => {
    localStorage.setItem(LEGACY_CONVERSATIONS_KEY, JSON.stringify(sampleStore));
    localStorage.setItem(
      getConversationsStorageKey("user-1"),
      JSON.stringify({ conversations: [{ id: "existing" }], projects: [], activeConversationId: null })
    );

    migrateAnonymousConversations("user-1");

    expect(localStorage.getItem(MIGRATION_DONE_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(getConversationsStorageKey("user-1"))).conversations[0].id).toBe(
      "existing"
    );
  });

  test("isConversationsStoreEmpty treats missing and empty stores as empty", () => {
    expect(isConversationsStoreEmpty(null)).toBe(true);
    expect(
      isConversationsStoreEmpty(
        JSON.stringify({ conversations: [], projects: [], activeConversationId: null })
      )
    ).toBe(true);
    expect(isConversationsStoreEmpty(JSON.stringify(sampleStore))).toBe(false);
  });
});
