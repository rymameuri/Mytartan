/**
 * Pedagogical flavor for CMU-Q courses — emphasis and TA-style traps,
 * not official past papers. Codes/majors come from existing campus copy
 * (degree programs, sample 15-112/15-213) plus filename/text hints.
 */

const DEFAULT_FLAVOR = {
  id: "cmu-generic",
  code: "",
  label: "CMU-Q",
  emphasis: "Hard exams poke edge cases. Be precise; half-remembered vibes lose points.",
  traps: [
    "A definition that is almost right but misses the boundary condition",
    "Skipping the justification a TA would mark, even if the answer is right",
    "Treating a special case as if it were the general rule",
  ],
  cueLead: "If a hard exam poked this",
};

const FLAVORS = [
  {
    id: "15-112",
    codes: ["15-112"],
    aliases: ["fundamentals of programming"],
    majors: ["computer science", "artificial intelligence"],
    topicHints: ["recursion", "python", "autograder", "helper function"],
    label: "15-112",
    emphasis: "Autograder plus written traces. Style, helpers, and base cases are real points.",
    traps: [
      "Missing or unreachable base case; recursing on the same input",
      "Off-by-one on range() or slices; mutating a list while you walk it",
      "No helper function / messy style when the writeup asked for both",
    ],
    cueLead: "15-112-style check",
  },
  {
    id: "15-213",
    codes: ["15-213", "18-213"],
    aliases: ["computer systems", "intro to computer systems"],
    majors: ["computer science"],
    topicHints: ["pointer", "stack", "heap", "cache", "bits"],
    label: "15-213",
    emphasis: "Bits, addresses, and what the machine actually does — not the story you hoped.",
    traps: [
      "Endianness or signed vs unsigned mix-ups",
      "Stack vs heap lifetime; pointer vs the value it points to",
      "Off-by-one in byte counts and alignment",
    ],
    cueLead: "Systems-style check",
  },
  {
    id: "cs",
    codes: [],
    aliases: [],
    majors: ["computer science", "artificial intelligence"],
    topicHints: [],
    label: "CS",
    emphasis: "Invariants first. If you cannot state the precondition, the solution is not ready.",
    traps: [
      "An algorithm that works on the happy path and dies on empty / one-element input",
      "Confusing specification with implementation",
    ],
    cueLead: "CS-style check",
  },
  {
    id: "is",
    codes: ["67-272", "67-250"],
    aliases: ["information systems"],
    majors: ["information systems"],
    topicHints: ["requirement", "stakeholder", "process model", "use case"],
    label: "IS",
    emphasis: "Requirements and tradeoffs, not a tool demo. Name who is affected.",
    traps: [
      "A solution that ignores a stakeholder constraint from the brief",
      "Mixing as-is process with the to-be design",
    ],
    cueLead: "IS-style check",
  },
  {
    id: "ba",
    codes: ["70-122", "70-257"],
    aliases: ["business administration"],
    majors: ["business administration"],
    topicHints: ["assumption", "model", "margin", "elasticity"],
    label: "BA",
    emphasis: "State assumptions. A number without a unit or a decision is incomplete.",
    traps: [
      "A model answer that never names the assumption that would flip it",
      "Confusing correlation language with a causal claim",
    ],
    cueLead: "BA-style check",
  },
];

function blobOf({ sourceText, sourceName, major }) {
  return `${sourceName || ""} ${sourceText || ""} ${major || ""}`.toLowerCase();
}

function scoreFlavor(flavor, { blob, code, major }) {
  let score = 0;
  if (code && flavor.codes.includes(code)) score += 8;
  if (major && flavor.majors.includes(major)) score += 3;
  for (const alias of flavor.aliases) {
    if (alias && blob.includes(alias)) score += 4;
  }
  for (const hint of flavor.topicHints) {
    if (hint && blob.includes(hint)) score += 1;
  }
  return score;
}

export function extractCourseCode(text) {
  const match = String(text || "").match(/\b(\d{2}-\d{3})\b/);
  return match ? match[1] : "";
}

export function resolveCourseFlavor({ sourceText = "", sourceName = "", major = "" } = {}) {
  const blob = blobOf({ sourceText, sourceName, major });
  const code = extractCourseCode(`${sourceName} ${sourceText}`);
  const majorNorm = String(major || "").trim().toLowerCase();

  let best = DEFAULT_FLAVOR;
  let bestScore = 0;
  for (const flavor of FLAVORS) {
    const score = scoreFlavor(flavor, { blob, code, major: majorNorm });
    if (score > bestScore) {
      best = flavor;
      bestScore = score;
    }
  }

  if (bestScore === 0) return { ...DEFAULT_FLAVOR, code };
  return {
    ...best,
    code: code || best.codes[0] || "",
  };
}

export { DEFAULT_FLAVOR };
