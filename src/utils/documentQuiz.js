import { parseQuizQuestions } from "./parseStudyOutput";

const MIN_SENTENCE = 24;
const MAX_SENTENCE = 240;

/** Rules for any future LLM quiz JSON generator — also used as a comment for extractive quizzes. */
export const QUIZ_GENERATION_RULES = `
Ignore citations, affiliations, publisher lines, copyright, running headers/footers, DOI/ISBN, Elsevier/Springer, and university address blocks.
Prefer conceptual claims from the paper body.
Never use a proper-noun address or bibliographic string as a correct option.
`.trim();

const JUNK_PUBLISHER =
  /\b(elsevier|springer|wiley|copyright|all rights reserved|doi:?\s*\d|isbn|issn|corresponding author|received\s+\d|accepted\s+\d|©)\b/i;
const JUNK_AFFILIATION =
  /\b(royal holloway|egham|university of london|dept\.|department of|[A-Z]{2,}\s+Inc\.?)\b/i;
const CLAIM_VERB =
  /\b(is|are|was|were|be|been|being|means|refers|argues|suggests|shows|describes|defines|treats|becomes|occurs|located|because|when|that|how|why)\b/i;

export function isBibliographicJunk(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return true;
  if (JUNK_PUBLISHER.test(raw)) return true;
  if (/\b(19|20)\d{2}\b/.test(raw) && /\b(elsevier|inc\.|ltd\.?|press)\b/i.test(raw)) return true;
  if (JUNK_AFFILIATION.test(raw) && !CLAIM_VERB.test(raw)) return true;
  const claim = CLAIM_VERB.test(raw);
  if (!claim && /,\s*.+,\s*/.test(raw) && /\b(university|college|uk|usa|united kingdom|department)\b/i.test(raw)) {
    return true;
  }
  if (!claim && (raw.match(/,/g) || []).length >= 3) return true;
  const words = raw.split(/\s+/);
  const capped = words.filter((word) => /^[A-Z]/.test(word.replace(/^[^A-Za-z]+/, ""))).length;
  if (!claim && words.length >= 5 && capped / words.length >= 0.65) return true;
  return false;
}

export function isConceptualClaim(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (raw.length < MIN_SENTENCE || isBibliographicJunk(raw)) return false;
  return CLAIM_VERB.test(raw);
}

function clip(text, max = 120) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

function sentencesFrom(text) {
  const raw = String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .flatMap((line) => {
      const cleaned = line.replace(/^[-*•#>\d.)\s]+/, "").trim();
      if (!cleaned) return [];
      return cleaned.split(/(?<=[.!?])\s+(?=[A-Z0-9“"])/);
    })
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => {
      if (sentence.length < MIN_SENTENCE || sentence.length > MAX_SENTENCE) return false;
      if (!/[A-Za-z]/.test(sentence)) return false;
      return !isBibliographicJunk(sentence);
    });

  const unique = [];
  const seen = new Set();
  for (const sentence of raw) {
    const key = sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(sentence);
  }
  return unique;
}

function stemFor(index) {
  const variants = [
    "According to your notes, which statement is accurate?",
    "Which of these matches your material?",
    "What do your notes say here?",
  ];
  return variants[index % variants.length];
}

function rotate(items, shift) {
  if (items.length === 0) return [];
  const n = ((shift % items.length) + items.length) % items.length;
  return items.slice(n).concat(items.slice(0, n));
}

/**
 * Build multiple-choice questions from the student's uploaded text only.
 * Never invents campus policy.
 */
export function generateQuizFromSource(text, { count = 5, sourceName = "your notes" } = {}) {
  const parsed = filterQuizQuestions(parseQuizQuestions(text));
  if (parsed.length >= 2) {
    return {
      title: `Quiz · ${sourceName}`,
      sourceName,
      questions: parsed.slice(0, Math.max(count, 2)),
    };
  }

  const extracted = sentencesFrom(text);
  const conceptual = extracted.filter(isConceptualClaim);
  const sentences = conceptual.length >= 2 ? conceptual : extracted;
  if (sentences.length < 2) {
    return {
      title: `Quiz · ${sourceName}`,
      sourceName,
      questions: [],
      error: "not_enough_text",
    };
  }

  const questions = [];
  for (let i = 0; i < sentences.length && questions.length < count; i += 1) {
    const correct = sentences[i];
    const others = sentences.filter((_, index) => index !== i);
    if (others.length < 1) continue;

    const distractorCount = Math.min(3, others.length);
    const distractors = others.slice(0, distractorCount).map((item) => clip(item));
    const correctText = clip(correct);
    const optionTexts = rotate([correctText, ...distractors], i);
    const letters = ["A", "B", "C", "D"].slice(0, optionTexts.length);
    const correctId = letters[optionTexts.indexOf(correctText)];

    const built = {
      number: String(questions.length + 1),
      text: stemFor(i),
      options: optionTexts.map((optionText, index) => ({
        id: letters[index],
        text: optionText,
      })),
      correct: correctId,
      explanation: correct,
    };
    if (filterQuizQuestions([built]).length) {
      questions.push(built);
    }
  }

  return {
    title: `Quiz · ${sourceName}`,
    sourceName,
    questions,
    error: questions.length ? undefined : "not_enough_text",
  };
}

export function filterQuizQuestions(questions = []) {
  return questions
    .map((question) => {
      const options = (question.options || []).filter((option) => !isBibliographicJunk(option.text));
      const correct = options.find((option) => option.id === question.correct);
      if (!correct || options.length < 2) return null;
      if (isBibliographicJunk(question.explanation) || isBibliographicJunk(correct.text)) return null;
      return { ...question, options };
    })
    .filter(Boolean);
}

export function answersGroundedInSource(questions, sourceText) {
  const haystack = String(sourceText || "").replace(/\s+/g, " ").toLowerCase();
  return questions.every((question) => {
    const correct = question.options.find((option) => option.id === question.correct);
    const snippet = String(correct?.text || "")
      .replace(/…$/u, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (!snippet) return false;
    const probe = snippet.slice(0, Math.min(40, snippet.length));
    return haystack.includes(probe);
  });
}
