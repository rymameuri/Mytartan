import { getUserStorageKey } from "./userStorage";

const SIDEBAR_COLLAPSED_KEY = "mytartan-sidebar-collapsed";

export function readSidebarCollapsed(userId) {
  try {
    return localStorage.getItem(getUserStorageKey(SIDEBAR_COLLAPSED_KEY, userId)) === "true";
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(collapsed, userId) {
  try {
    localStorage.setItem(
      getUserStorageKey(SIDEBAR_COLLAPSED_KEY, userId),
      String(collapsed)
    );
  } catch {
    /* ignore */
  }
}
