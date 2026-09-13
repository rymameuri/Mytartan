const FILLER_TOKEN = /\b(um+|uh+|er+|ahh*|hmm+|huh+|mhm+|mm+)\b/gi;
const YAWN = /\[?\*?yawn(?:ing|ed)?\*?\]?|\byawn(?:ed|ing)?\b/gi;
const LEADING_FILLER = /^(yeah|yep|ok|okay|so|well|like|i mean|you know)[,.\s]+/i;

const ASR_FIXES = [
  [/stew[\s-]?co\b/gi, "stuco"],
  [/stewko\b/gi, "stuco"],
  [/stucco\b/gi, "stuco"],
  [/\bstu co\b/gi, "stuco"],
  [/stellar\b/gi, "stellic"],
  [/stelic\b/gi, "stellic"],
  [/stelick\b/gi, "stellic"],
  [/caps[\s-]?(cue|queue|q)\b/gi, "caps-q"],
  [/\bthe caps\b/gi, "caps-q"],
  [/financial aide\b/gi, "financial aid"],
  [/financial eight\b/gi, "financial aid"],
  [/see em you(?:\s+queue|\s+q)?\b/gi, "cmu-q"],
  [/my see em you\b/gi, "cmu-q"],
  [/andrew i[\s-]?d\b/gi, "andrew id"],
  [/add[\s-]drop\b/gi, "add drop"],
  [/bits and bites\b/gi, "bits and bites"],
  [/education city\b/gi, "education city"],
  [/i can not\b/gi, "i cannot"],
];

function looksMessy(text) {
  const raw = String(text || "");
  return (
    /\b(um+|uh+|er+|ahh*|hmm+|huh+|mhm+|mm+)\b/i.test(raw) ||
    /yawn/i.test(raw) ||
    /(.)\1{3,}/.test(raw) ||
    /\b(stew\s?co|stellar|stelic|caps cue|caps queue)\b/i.test(raw)
  );
}

function stripFiller(text) {
  let out = String(text || "")
    .replace(YAWN, " ")
    .replace(FILLER_TOKEN, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (let i = 0; i < 3; i += 1) {
    const next = out.replace(LEADING_FILLER, "").trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

function applyAsrFixes(text) {
  let out = text;
  for (const [pattern, replacement] of ASR_FIXES) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/\s+/g, " ").trim();
}

function normalizeUtterance(text) {
  const original = String(text || "").replace(/\s+/g, " ").trim();
  if (!original) return { original: "", normalized: "", messy: false };
  const messy = looksMessy(original);
  let normalized = stripFiller(original);
  normalized = applyAsrFixes(normalized);
  if (!normalized) normalized = original;
  return { original, normalized, messy };
}

const REWRITE_PROMPT = `Clean this student's messy spoken or typed message for campus search.
Keep their meaning. Remove filler, yawns, and obvious speech-to-text errors.
Map CMU-Q slang when obvious (StuCo, Stellic, CaPS-Q, add/drop).
Do not add offices, emails, policies, or facts they did not ask about.
Reply with only the cleaned sentence.`;

async function rewriteUtterance(text, generateReply) {
  const { original, normalized, messy } = normalizeUtterance(text);
  if (!messy || typeof generateReply !== "function" || original.length < 12) {
    return { original, normalized, messy, rewritten: false };
  }
  try {
    const cleaned = await generateReply(REWRITE_PROMPT, [
      { role: "user", content: original },
    ]);
    const rewritten = String(cleaned || "").replace(/\s+/g, " ").trim();
    if (!rewritten || rewritten.length > original.length * 2) {
      return { original, normalized, messy, rewritten: false };
    }
    return { original, normalized: rewritten, messy, rewritten: true };
  } catch {
    return { original, normalized, messy, rewritten: false };
  }
}

module.exports = {
  looksMessy,
  stripFiller,
  applyAsrFixes,
  normalizeUtterance,
  rewriteUtterance,
  REWRITE_PROMPT,
};
