export function tutorSpeechFallback({ tutorActivity, lectureTopic, courseName } = {}) {
  const topic = lectureTopic?.trim() || "this topic";

  if (tutorActivity === "flashcards") {
    return `I put together some flashcards on ${topic}. Take a look and tell me if any of them trip you up.`;
  }
  if (tutorActivity === "quiz") {
    return `I've built a quiz on ${topic} in Studio. Work through it at your own pace, and ask me when you want a hint.`;
  }
  if (tutorActivity === "whiteboard") {
    return `I've mapped the big ideas for ${topic} on the whiteboard. Scan the clusters and tell me what you'd explore first.`;
  }
  return `Let's dig into ${topic} together. Tell me what you'd like to understand better and we'll work through it step by step.`;
}

/** True when text is primarily Studio structured output (flashcards, quiz, whiteboard). */
export function isStructuredStudioContent(text) {
  if (!text?.trim()) return false;
  const lines = text
    .trim()
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return false;

  const structuredLines = lines.filter((line) =>
    /^(?:Front|Back|Term|Answer|Cluster|Guiding question|\d+[.)]|[A-D][.)])/i.test(line)
  );

  if (structuredLines.length >= 2) return true;
  if (lines.length === 1 && structuredLines.length === 1) return true;
  if (structuredLines.length > 0 && structuredLines.length / lines.length >= 0.6) {
    return true;
  }
  return false;
}

export function briefSpeechFromReply(reply) {
  if (!reply?.trim()) return "";
  const lines = reply
    .trim()
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const conversational = lines.find(
    (line) =>
      !/^(?:Front|Back|Term|Answer|Cluster|Guiding question|\d+[.)]|[A-D][.)])/i.test(
        line
      )
  );

  const sentence = (conversational ?? "").replace(/\s+/g, " ");
  if (!sentence) return "";
  if (sentence.length <= 200) return sentence;
  return `${sentence.slice(0, 197)}…`;
}

export function resolveTutorSpeech({
  pendingSpeech = "",
  reply = "",
  isStudioGeneration = false,
  speechMode = null,
  tutorActivity = null,
  lectureTopic = "",
  courseName = "",
} = {}) {
  const fallback = () =>
    tutorSpeechFallback({ tutorActivity, lectureTopic, courseName });

  const mode = speechMode || (isStudioGeneration ? "introduction" : null);

  if (mode === "introduction") {
    const candidate = pendingSpeech.trim();
    if (candidate && !isStructuredStudioContent(candidate)) return candidate;
    return fallback();
  }

  if (mode === "lecture") {
    const candidate = pendingSpeech.trim();
    if (candidate && !isStructuredStudioContent(candidate)) return candidate;
    const fromReply = briefSpeechFromReply(reply);
    if (fromReply) return fromReply;
    return fallback();
  }

  const candidate = pendingSpeech.trim();
  if (candidate && !isStructuredStudioContent(candidate)) return candidate;

  const fromReply = briefSpeechFromReply(reply);
  if (fromReply) return fromReply;

  return fallback();
}
