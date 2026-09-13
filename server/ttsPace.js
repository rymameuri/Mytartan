const SENTENCE_BREAK = '<break time="0.4s"/>';

function cleanSpokenPacing(text) {
  return String(text || "")
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

/** Insert a short ElevenLabs break between sentences. Multilingual v2 reads this as a breath, not silence. */
function paceTtsText(text) {
  const cleaned = cleanSpokenPacing(text);
  if (!cleaned) return "";
  return cleaned
    .replace(/\s*<break\s+time="[^"]*"\s*\/>\s*/gi, " ")
    .replace(/([.!?])\s+(?=[A-Z0-9“"'])/g, `$1 ${SENTENCE_BREAK} `)
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = { SENTENCE_BREAK, cleanSpokenPacing, paceTtsText };
