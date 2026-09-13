import { resolveCourseFlavor } from "./courseFlavor";

const KINDS = new Set(["cheatsheet", "study-guide", "formula-sheet", "exam-review"]);

const KIND_TITLES = {
  cheatsheet: "Cheat sheet",
  "study-guide": "Study guide",
  "formula-sheet": "Formula sheet",
  "exam-review": "Exam review",
};

export function detectSheetKind(text) {
  const raw = String(text || "");
  if (/\bformula\s*sheet\b/i.test(raw)) return "formula-sheet";
  if (/\bexam review\b|\breview sheet\b/i.test(raw)) return "exam-review";
  if (/\bstudy\s*guide\b/i.test(raw)) return "study-guide";
  return "cheatsheet";
}

function clip(text, max) {
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
    .filter((sentence) => sentence.length >= 20 && sentence.length <= 240)
    .filter((sentence) => /[A-Za-z]/.test(sentence))
    .filter((sentence) => !/\.(txt|md|pdf|pptx|docx)$/i.test(sentence));

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

function rotate(items, shift) {
  if (!items.length) return [];
  const n = ((shift % items.length) + items.length) % items.length;
  return items.slice(n).concat(items.slice(0, n));
}

function pick(sentences, test, limit, fallback) {
  const matched = sentences.filter(test);
  const pool = matched.length ? matched : fallback || sentences;
  return pool.slice(0, limit);
}

function formulaish(sentence) {
  return /[=≈→≤≥]|O\(|\b(formula|rate|sum|equals|identity)\b/i.test(sentence);
}

function definitionish(sentence) {
  return /\b(is|are|means|defined as|consists of|refers to)\b/i.test(sentence);
}

function trapish(sentence) {
  return /\b(not|unless|except|only|must|never|edge|base case|error|off-by|mutat|forget|avoid)\b/i.test(
    sentence
  );
}

/**
 * Structured cheat sheet from the student's notes. Never claims official past papers.
 */
export function normalizeStudySheet(raw = {}) {
  const kind = KINDS.has(raw.kind) ? raw.kind : "cheatsheet";
  const title = String(raw.title || KIND_TITLES[kind]).trim() || KIND_TITLES[kind];
  const sections = (Array.isArray(raw.sections) ? raw.sections : [])
    .map((section, index) => {
      const items = (section?.items || [])
        .map((item) => ({
          lead: clip(item?.lead || "", 48),
          body: clip(item?.body || "", 220),
        }))
        .filter((item) => item.body);
      if (!items.length) return null;
      return {
        id: String(section?.id || `s${index}`),
        kicker: String(section?.kicker || "").trim(),
        title: String(section?.title || `Section ${index + 1}`).trim(),
        items,
        narration: String(section?.narration || "").trim(),
      };
    })
    .filter(Boolean);

  return {
    kind,
    title,
    sourceName: String(raw.sourceName || "your notes").trim(),
    courseLabel: String(raw.courseLabel || "CMU-Q").trim(),
    courseCode: String(raw.courseCode || "").trim(),
    density: raw.density === "gentle" ? "gentle" : "dense",
    disclaimer:
      String(raw.disclaimer || "").trim() ||
      "From your notes — a study aid, not an official past paper.",
    emphasis: String(raw.emphasis || "").trim(),
    sections,
    footerNote:
      String(raw.footerNote || "").trim() ||
      "Exam-style cues are practice prompts from this material. They are not official CMU exams.",
  };
}

export function generateStudySheet(
  sourceText,
  { sourceName = "your notes", major = "", kind, density = "dense", seed = 0 } = {}
) {
  const resolvedKind = KINDS.has(kind) ? kind : detectSheetKind(kind);
  const flavor = resolveCourseFlavor({ sourceText, sourceName, major });
  const sentences = rotate(sentencesFrom(sourceText), seed);
  const limit = density === "gentle" ? 3 : 5;

  if (sentences.length < 2) {
    return normalizeStudySheet({
      kind: resolvedKind,
      title: `${KIND_TITLES[resolvedKind]} · ${sourceName}`,
      sourceName,
      courseLabel: flavor.label,
      courseCode: flavor.code,
      density,
      sections: [],
      emphasis: flavor.emphasis,
    });
  }

  const defLimit = resolvedKind === "formula-sheet" ? 2 : limit;
  const formulaLimit = resolvedKind === "formula-sheet" ? limit : 2;
  const cueLimit = resolvedKind === "exam-review" ? limit : Math.max(2, limit - 1);

  const definitions = pick(sentences, definitionish, defLimit, sentences).map((body, index) => ({
    lead: index === 0 ? "Core" : "Also",
    body,
  }));

  const formulas = pick(sentences, formulaish, formulaLimit, []).map((body) => ({
    lead: "Hold",
    body,
  }));

  const noteTraps = pick(sentences, trapish, Math.max(2, limit - 1), []);
  const flavorTraps = flavor.traps.slice(0, density === "gentle" ? 1 : 2);
  const gotchas = [
    ...noteTraps.map((body) => ({ lead: "From notes", body })),
    ...flavorTraps.map((body) => ({ lead: `${flavor.label} ding`, body })),
  ].slice(0, limit);

  const cueSource = sentences.slice(0, cueLimit);
  const cues = cueSource.map((body) => ({
    lead: flavor.cueLead,
    body: `Be ready to explain or trace: ${clip(body, 140)}`,
  }));

  const sections = [];
  if (resolvedKind === "formula-sheet" && formulas.length) {
    sections.push({
      id: "formulas",
      kicker: "Hold these",
      title: "Identities & relations",
      items: formulas,
      narration: "Pin the relations first. If you cannot write it without the slide, it is not on the sheet yet.",
    });
  }

  sections.push({
    id: "defs",
    kicker: "Be exact",
    title: "Key definitions",
    items: definitions,
    narration: `Definitions first — ${flavor.emphasis}`,
  });

  if (resolvedKind !== "formula-sheet" || gotchas.length) {
    sections.push({
      id: "gotchas",
      kicker: "Where points vanish",
      title: "Gotchas TAs ding",
      items: gotchas,
      narration: "This is the unglamorous part. CMU exams live here.",
    });
  }

  sections.push({
    id: "cues",
    kicker: "Practice, not a past paper",
    title: resolvedKind === "exam-review" ? "Exam-style cues" : "What a hard exam would poke",
    items: cues,
    narration: "These cues are from your material. Not official CMU exams.",
  });

  return normalizeStudySheet({
    kind: resolvedKind,
    title: `${KIND_TITLES[resolvedKind]} · ${flavor.code || flavor.label}`,
    sourceName,
    courseLabel: flavor.label,
    courseCode: flavor.code,
    density,
    emphasis: flavor.emphasis,
    disclaimer: `From ${sourceName} — a ${KIND_TITLES[resolvedKind].toLowerCase()} in ${flavor.label} style. Not an official past paper.`,
    sections,
  });
}

export function sheetToPlainText(sheet) {
  const normalized = normalizeStudySheet(sheet);
  const lines = [
    normalized.title,
    normalized.disclaimer,
    normalized.emphasis,
    "",
  ];
  for (const section of normalized.sections) {
    lines.push(`${section.title.toUpperCase()}`);
    for (const item of section.items) {
      lines.push(`- ${item.lead ? `${item.lead}: ` : ""}${item.body}`);
    }
    lines.push("");
  }
  lines.push(normalized.footerNote);
  return lines.filter((line) => line !== undefined).join("\n");
}

export function visibleSheetSections(sheet, step = 0) {
  const normalized = normalizeStudySheet(sheet);
  const last = Math.min(Math.max(step, 0), Math.max(normalized.sections.length - 1, 0));
  return {
    ...normalized,
    visibleSections: normalized.sections.slice(0, last + 1),
    currentStep: last,
    narration: normalized.sections[last]?.narration || "",
  };
}
