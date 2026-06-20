export function getUserStorageKey(baseKey, userId) {
  if (userId == null) return baseKey;
  return `${baseKey}_${userId}`;
}
