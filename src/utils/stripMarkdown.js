/**
 * Remove common markdown emphasis markers from chat text for display and speech.
 */
export function stripMarkdownFormatting(text) {
  if (!text || typeof text !== "string") return "";

  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1");
}
