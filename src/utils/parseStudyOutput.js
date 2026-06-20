import { stripMarkdownFormatting } from "./stripMarkdown";

export function parseFlashcards(text) {
  if (!text) return [];
  const cards = [];
  const pattern = /Front:\s*(.+?)\s*Back:\s*(.+?)(?=Front:|$)/gis;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    cards.push({ front: match[1].trim(), back: match[2].trim() });
  }
  return cards;
}

export function parseWhiteboardClusters(text) {
  if (!text) return [];
  const clusters = [];
  const sections = text.split(/Cluster:\s*/i).slice(1);
  for (const section of sections) {
    const [titleLine, ...rest] = section.split("\n");
    const title = titleLine.trim();
    const bullets = rest
      .join("\n")
      .split("\n")
      .map((line) => line.replace(/^[-•]\s*/, "").trim())
      .filter(Boolean);
    if (title) clusters.push({ title, bullets });
  }
  return clusters;
}

/** Normalize messy LLM quiz text into line-oriented blocks. */
export function normalizeQuizText(text) {
  if (!text?.trim()) return "";

  let normalized = stripMarkdownFormatting(text)
    .replace(/\r\n/g, "\n")
    .replace(/^(?:Here'?s|Sure|Alright)[^\n]*\n+/i, "")
    .trim();

  // Collapse runs of spaces but keep newlines
  normalized = normalized.replace(/[^\S\n]+/g, " ");

  // Ensure breaks before numbered questions (including mid-paragraph blobs)
  normalized = normalized.replace(/(?:^|\n|\s)(\d+)[.)]\s+/g, "\n$1. ");

  // Ensure breaks before options and answer markers
  normalized = normalized.replace(/\s+([A-D])[.)]\s+/g, "\n$1) ");
  normalized = normalized.replace(/\s+(?:Correct|Answer):\s*/gi, "\nCorrect: ");
  normalized = normalized.replace(/\s+Explanation:\s*/gi, "\nExplanation: ");

  return normalized.trim();
}

export function parseQuizQuestions(text) {
  if (!text?.trim()) return [];

  const normalized = normalizeQuizText(text);
  const questions = [];
  const blocks = normalized.split(/\n(?=\d+[.)]\s)/).filter((b) => /^\d+[.)]/.test(b.trim()));

  for (const block of blocks) {
    const numMatch = block.match(/^(\d+)[.)]\s*/);
    if (!numMatch) continue;

    const number = numMatch[1];
    const afterNum = block.slice(numMatch[0].length);
    const optStart = afterNum.search(/(?:^|\n)[A-D][.)]\s/);
    if (optStart === -1) continue;

    const questionText = afterNum.slice(0, optStart).trim().replace(/\s+/g, " ");
    const rest = afterNum.slice(optStart);

    const optionParts = rest.split(/(?=^[A-D][.)]\s)/m).filter((s) => /^[A-D][.)]/.test(s.trim()));
    const options = [];

    for (const optPart of optionParts) {
      const m = optPart.match(/^([A-D])[.)]\s*([\s\S]*?)(?=^[A-D][.)]\s|^(?:Correct|Answer):|Explanation:|$)/im);
      if (!m) continue;
      const optText = m[2]
        .trim()
        .replace(/\s*(?:Correct|Answer):\s*[A-D].*$/i, "")
        .replace(/\s*Explanation:.*$/is, "")
        .replace(/\s+/g, " ")
        .trim();
      if (optText) {
        options.push({ id: m[1].toUpperCase(), text: optText });
      }
    }

    const correctMatch = block.match(/(?:Correct|Answer):\s*([A-D])/i);
    const correct = correctMatch?.[1]?.toUpperCase() ?? null;

    const explanationMatch = block.match(/Explanation:\s*(.+?)(?:\n\d+[.)]|\s*\d+[.)]\s|$)/is);
    const explanation = explanationMatch?.[1]?.trim().replace(/\s+/g, " ") ?? "";

    if (options.length >= 2 && questionText) {
      questions.push({
        number,
        text: questionText,
        options,
        correct,
        explanation,
      });
    }
  }

  return questions;
}
