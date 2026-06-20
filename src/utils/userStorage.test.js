import { getUserStorageKey } from "./userStorage";

describe("getUserStorageKey", () => {
  test("returns base key when userId is null or undefined", () => {
    expect(getUserStorageKey("mytartan-persona-muted", null)).toBe("mytartan-persona-muted");
    expect(getUserStorageKey("mytartan-persona-muted", undefined)).toBe("mytartan-persona-muted");
  });

  test("namespaces key by user id", () => {
    expect(getUserStorageKey("mytartan-persona-muted", "user-42")).toBe(
      "mytartan-persona-muted_user-42"
    );
  });
});
