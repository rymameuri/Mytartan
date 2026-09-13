const URL_PATTERN = /https?:\/\/[^\s<>"'()]+/gi;

export const CHAT_LINK_CUE = "Check the chat for the link.";
export const CHAT_LINKS_CUE = "Check the chat for the links.";

export function findUrls(text) {
  if (!text || typeof text !== "string") return [];
  return text.match(URL_PATTERN) || [];
}

export function linkLabelForUrl(href) {
  if (!href) return "";
  try {
    const url = new URL(href);
    if (
      url.hostname.includes("sites.google.com") &&
      url.pathname.includes("mycmuq-student-affairs")
    ) {
      return "myCMU-Q Student Affairs";
    }
  } catch {
    return href;
  }
  return href;
}

/**
 * Shape chat text so TTS can breathe: clause dashes become sentence stops,
 * not commas. Keep hyphenated words like CMU-Q.
 */
export function flattenSpeechPauses(text) {
  if (!text || typeof text !== "string") return "";

  return text
    .replace(/(\d+)\s*[–—]\s*(\d+)/g, "$1 to $2")
    .replace(/\u2026/g, ".")
    .replace(/\.{3,}/g, ".")
    .replace(/\s*[—–]\s*/g, ". ")
    .replace(/\s+--\s+/g, ". ")
    .replace(/[ \t]*;[ \t]*/g, ". ")
    .replace(/([A-Za-z])\s*:\s+([A-Za-z])/g, "$1, $2")
    .replace(/([.!?])\s+([a-z])/g, (_, mark, letter) => `${mark} ${letter.toUpperCase()}`)
    .replace(/([.!?]){2,}/g, "$1")
    .replace(/(,\s*){2,}/g, ", ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Turn chat text into something that can be spoken aloud.
 * URLs stay in the chat bubble; speech just points people there.
 */
export function toSpokenText(text) {
  if (!text || typeof text !== "string") return "";

  const urls = findUrls(text);
  if (!urls.length) {
    return flattenSpeechPauses(text.replace(/\s+/g, " ").trim());
  }

  let spoken = text
    .replace(/\(\s*https?:\/\/[^\s<>"'()]+\s*\)/gi, "")
    .replace(/https?:\/\/[^\s<>"'()]+/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  const cue = urls.length > 1 ? CHAT_LINKS_CUE : CHAT_LINK_CUE;
  if (!spoken) {
    return cue;
  }
  if (!/check the chat for the links?/i.test(spoken)) {
    spoken = `${spoken.replace(/[.,;:]+$/, "")}. ${cue}`;
  }

  return flattenSpeechPauses(spoken);
}
