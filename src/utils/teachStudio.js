const QUIZ_RE =
  /\b(quiz me|quiz on|test me|give me (a |some )?quiz|practice questions|multiple[-\s]?choice)\b/i;
const MAP_RE =
  /\b(white\s*board|mind[-\s]?map|mindmap|map this out|draw (this|it) out|sketch this)\b/i;
const STRUGGLE_RE =
  /\b(i don'?t (?:understand|get)|i do not understand|i'?m (?:so )?stuck|confused (?:about|by)|struggling with|can'?t wrap my head|this doesn'?t make sense|lost on)\b/i;
const EXPLAIN_THIS_RE = /\b(explain this|walk me through this|go over this)\b/i;

const CELEBRATE = ["Yes — that's the one.", "Nice catch.", "Exactly. You had that."];

export function extractConcept(text) {
  const raw = String(text || "").trim();
  const match = raw.match(
    /(?:whiteboard|white board|mind[-\s]?map|mindmap|explain|teach me|help me with|confused about|confused by|struggling with|stuck on|lost on|don'?t understand|do not understand|quiz me on|quiz on)\s+(.+)$/i
  );
  if (!match) return "";
  const concept = match[1]
    .replace(/^(this|that|it)\b[\s,.]*/i, "")
    .replace(/[.?!]+$/, "")
    .trim();
  if (!concept || /^(this|that|it|please|on this)$/i.test(concept)) return "";
  return concept;
}

export function detectTeachIntent(text, { hasSource = false } = {}) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  if (QUIZ_RE.test(raw)) {
    return { kind: "quiz", concept: extractConcept(raw) };
  }
  if (MAP_RE.test(raw)) {
    return { kind: "mindmap", concept: extractConcept(raw), struggle: false };
  }
  if (STRUGGLE_RE.test(raw)) {
    return { kind: "mindmap", concept: extractConcept(raw), struggle: true };
  }
  if (hasSource && EXPLAIN_THIS_RE.test(raw)) {
    return { kind: "mindmap", concept: extractConcept(raw), struggle: false };
  }
  return null;
}

export function celebrateReaction(index = 0) {
  return CELEBRATE[((index % CELEBRATE.length) + CELEBRATE.length) % CELEBRATE.length];
}

export function teachReaction(question) {
  const explanation = String(question?.explanation || "").trim();
  if (explanation && explanation.length <= 280) {
    return `Not quite. ${explanation}`;
  }
  const correct = question?.options?.find((option) => option.id === question.correct);
  if (correct?.text) {
    return `Not quite. Your notes point to: ${correct.text}`;
  }
  return "Not quite. Let's look at that idea again, then continue.";
}

export const IMAGE_HINT =
  "I can't read text from that image yet. Paste the notes or upload a PDF, PPTX, or Word file. Quizzes stay on your material — not campus policy.";

export const ATTACH_HINT =
  "Attach a PDF, PPTX, Word, or text file from your notes — I quiz you on your material, not campus policy.";
