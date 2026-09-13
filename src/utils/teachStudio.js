import { generateQuizFromSource } from "./documentQuiz";

const QUIZ_RE =
  /\b(?:(?:create|make|generate|build|start|write|draft)(?:\s+me)?(?:\s+a|\s+some)?\s+quiz|(?:can\s+you|could\s+you|please)\s+(?:create|make|generate|build|give\s+me)\s+(?:a\s+|some\s+)?quiz|give\s+me(?:\s+a|\s+some)?\s+quiz|quiz\s+me|quiz\s+on|quiz\s+(?:this|that|it|these|those)|a\s+quiz\s+(?:for|from|on|about)|test\s+me|practice\s+questions|multiple[-\s]?choice)\b/i;
const SHEET_RE =
  /\b(cheat\s*sheet|study\s*guide|formula\s*sheet|exam review|cram sheet|one[- ]pager|condense|study sheet|(?:create|make|generate|build)\s+(?:a\s+|me\s+a\s+)?(?:cheat\s*sheet|study\s*guide))\b/i;
const MAP_RE =
  /\b(white\s*board|mind[-\s]?map|mindmap|map this out|draw (this|it) out|sketch this|(?:create|make|generate|build)\s+(?:a\s+|me\s+an?\s+)?(?:white\s*board|mind[-\s]?map))\b/i;
const STRUGGLE_RE =
  /\b(i don'?t (?:understand|get)|i do not understand|i'?m (?:so )?stuck|confused (?:about|by)|struggling with|can'?t wrap my head|this doesn'?t make sense|lost on)\b/i;
const EXPLAIN_THIS_RE = /\b(explain this|walk me through this|go over this)\b/i;
const SOURCE_QUIZ_RE =
  /\b(?:quiz\s+me|quiz\s+(?:this|that|it|these|those)|a\s+quiz)\b/i;
const SOURCE_MAP_RE =
  /\b(?:whiteboard|white\s*board|mind[-\s]?map|mindmap)\s+(?:this|that|it|these|those)\b/i;
const SOURCE_SHEET_RE =
  /\b(?:cheat\s*sheet|study\s*guide|formula\s*sheet)\s+(?:for|from|of|on)\s+(?:this|that|it|these|those)\b/i;

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

  if (QUIZ_RE.test(raw) || (hasSource && SOURCE_QUIZ_RE.test(raw))) {
    return { kind: "quiz", concept: extractConcept(raw) };
  }
  if (SHEET_RE.test(raw) || (hasSource && SOURCE_SHEET_RE.test(raw))) {
    return { kind: "sheet", concept: extractConcept(raw) };
  }
  if (MAP_RE.test(raw) || (hasSource && SOURCE_MAP_RE.test(raw))) {
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

/**
 * Whether a composer send should open a teach studio instead of chatting.
 * Returns true when notes are ready (or files are attached) and the ask is a study action.
 */
export function tryOpenTeachStudio(text, { source = null, files = [], hasSource = false } = {}) {
  const fileCount = Array.isArray(files) ? files.length : 0;
  const sourceReady = Boolean(source?.text) || hasSource || fileCount > 0;
  const intent = detectTeachIntent(text, { hasSource: sourceReady });
  const emptyAsk = !String(text || "").trim();
  const wantQuiz = intent?.kind === "quiz" || (emptyAsk && fileCount > 0);
  if (!wantQuiz && intent?.kind !== "mindmap" && intent?.kind !== "sheet") {
    return false;
  }

  if (wantQuiz && source?.text) {
    const quiz = generateQuizFromSource(source.text, { sourceName: source.name, count: 5 });
    if (!quiz.questions.length) return true;
    return {
      opened: true,
      kind: "quiz",
      studio: {
        kind: "quiz",
        title: quiz.title,
        sourceName: source.name,
        questions: quiz.questions,
        reaction: { type: "teach", text: "Whenever you're ready — pick an answer." },
      },
    };
  }

  return true;
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

export const SHEET_ATTACH_HINT =
  "Attach your slides or notes first — I'll build a CMU-style one-pager from your material, not a fake past paper.";
