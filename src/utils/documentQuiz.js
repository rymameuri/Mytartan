import { parseQuizQuestions } from "./parseStudyOutput";
import {
  isBibliographicJunk,
  isConceptualClaim,
  sentencesFromSource,
} from "./sourceTextFilters";

export {
  isBibliographicJunk,
  isConceptualClaim,
  QUIZ_GENERATION_RULES,
} from "./sourceTextFilters";

function clip(text, max = 120) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
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

  const extracted = sentencesFromSource(text);
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
