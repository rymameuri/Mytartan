export const MIN_SENTENCE = 24;
export const MAX_SENTENCE = 240;

/** Shared rules for quiz, mind-map, and any LLM JSON generator over paper text. */
export const SOURCE_CONTENT_RULES = `
Ignore citations, affiliations, publisher lines, copyright, running headers/footers, DOI/ISBN, Elsevier/Springer, and university address blocks.
Prefer conceptual claims from the paper body.
Never use a proper-noun address or bibliographic string as a label, option, or title.
`.trim();

export const QUIZ_GENERATION_RULES = `
${SOURCE_CONTENT_RULES}
Never use a proper-noun address or bibliographic string as a correct option.
`.trim();

export const MINDMAP_GENERATION_RULES = `
${SOURCE_CONTENT_RULES}
Prefer short concept labels (Location, Locale, Sense of place, Meaning), not raw sentence dumps or publisher lines.
The center node must be a real topic title from the material, never "this idea".
`.trim();

const JUNK_PUBLISHER =
  /\b(elsevier|springer|wiley|copyright|all rights reserved|doi:?\s*\d|isbn|issn|corresponding author|received\s+\d|accepted\s+\d|©)\b/i;
const JUNK_AFFILIATION =
  /\b(royal holloway|egham|university of london|dept\.|department of|[A-Z]{2,}\s+Inc\.?)\b/i;
const CLAIM_VERB =
  /\b(is|are|was|were|be|been|being|means|refers|argues|suggests|shows|describes|defines|treats|becomes|grows|comes|involves|creates|occurs|located|because|when|that|how|why)\b/i;

export const WEAK_TOPIC =
  /^(this idea|this|that|it|idea|topic|notes|untitled|concept|the paper)$/i;

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

export function sentencesFromSource(text, { min = MIN_SENTENCE, max = MAX_SENTENCE } = {}) {
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
      if (sentence.length < min || sentence.length > max) return false;
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

export function titleCasePhrase(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word, index) => {
      if (index > 0 && /^(of|and|or|the|a|an|in|on|to)$/i.test(word)) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export function isUsableTopic(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw || WEAK_TOPIC.test(raw)) return false;
  if (isBibliographicJunk(raw)) return false;
  if (raw.length < 2 || raw.length > 48) return false;
  return true;
}
