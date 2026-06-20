const fs = require("fs");
const path = require("path");

const KB_ROOT = path.join(__dirname, "..", "knowledge-base");

let documents = [];
let retrievalStatus = {
  documentCount: 0,
  activeMethod: "keyword",
};

// ─── Document Parsing & Chunking ─────────────────────────────────────────────

const CHUNK_SIZE = 500;    // characters per chunk
const CHUNK_OVERLAP = 100; // overlap between chunks so context isn't lost at boundaries

/**
 * Split a body of text into overlapping chunks.
 * Splits on paragraph/sentence boundaries where possible.
 */
function chunkText(text) {
  if (text.length <= CHUNK_SIZE) return [text];

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + CHUNK_SIZE;

    if (end < text.length) {
      // Try to break at a paragraph boundary first
      const paraBreak = text.lastIndexOf("\n\n", end);
      const lineBreak = text.lastIndexOf("\n", end);
      const sentenceBreak = Math.max(
        text.lastIndexOf(". ", end),
        text.lastIndexOf("? ", end),
        text.lastIndexOf("! ", end)
      );

      if (paraBreak > start + CHUNK_SIZE / 2) {
        end = paraBreak;
      } else if (sentenceBreak > start + CHUNK_SIZE / 2) {
        end = sentenceBreak + 1;
      } else if (lineBreak > start + CHUNK_SIZE / 2) {
        end = lineBreak;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk); // skip tiny fragments
    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }

  return chunks;
}

function parseDocument(content, relativePath) {
  const lines = content.split("\n");
  const dividerIndex = lines.findIndex((line) => line.trim() === "---");
  const headerLines = dividerIndex >= 0 ? lines.slice(0, dividerIndex) : lines.slice(0, 8);

  let topic = "";
  let section = "";
  for (const line of headerLines) {
    if (line.startsWith("TOPIC:")) topic = line.slice(6).trim();
    if (line.startsWith("SECTION:")) section = line.slice(8).trim();
  }

  const body =
    dividerIndex >= 0 ? lines.slice(dividerIndex + 1).join("\n").trim() : content.trim();

  // Split into chunks and return one document per chunk
  const chunks = chunkText(body);
  return chunks.map((chunk, i) => ({
    file: relativePath,
    topic,
    section,
    body: chunk,
    chunkIndex: i,
    totalChunks: chunks.length,
  }));
}

function loadKnowledgeBase() {
  documents = [];

  if (!fs.existsSync(KB_ROOT)) {
    return 0;
  }

  function walk(dir, prefix = "") {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        if (entry.name === "user-courses") continue;
        walk(fullPath, relativePath);
      } else if (entry.name.endsWith(".txt")) {
        const content = fs.readFileSync(fullPath, "utf8");
        // parseDocument now returns an array of chunks
        documents.push(...parseDocument(content, relativePath));
      }
    }
  }

  walk(KB_ROOT);
  retrievalStatus.documentCount = documents.length;
  return documents.length;
}

function getRetrievalStatus() {
  return {
    ...retrievalStatus,
    activeMethod: "keyword",
  };
}

// ─── Keyword Retrieval ────────────────────────────────────────────────────────

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

// ─── Fuzzy typo correction ────────────────────────────────────────────────────

/**
 * Levenshtein edit distance between two strings.
 * Used to find the closest known CMU-Q term for a misspelled token.
 */
function editDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// All meaningful CMU-Q terms the retrieval system understands.
// Short words (≤3 chars) are excluded to avoid false corrections.
const PROFESSOR_NUI_REPLY =
  "Professor Nui? Where do I even begin! She is nothing short of extraordinary — a true force of nature at CMU-Q. Her brilliance lights up every room she enters, and her passion for teaching is the kind that changes lives. Students don't just learn from Professor Nui; they are transformed by her wisdom, her warmth, and her relentless dedication to excellence. She is respected by faculty, beloved by students, and admired by everyone who has ever witnessed her in action. CMU-Q is profoundly fortunate to have her. She is not merely a professor — she is legendary.";

const PROFESSOR_NUI_QUERY_PATTERNS = [
  /\b(professor|prof\.?)\s+nui\b/i,
  /\b(professor|prof\.?)\s+n\b/i,
  /\bwho\s+(is|was)\s+(professor\s+|prof\.?\s+)?nui\b/i,
  /\bwho\s+(is|was)\s+(professor\s+|prof\.?\s+)?n\b/i,
  /\b(tell\s+me\s+about|know\s+about|about)\s+(professor\s+|prof\.?\s+)?nui\b/i,
  /\b(tell\s+me\s+about|know\s+about|about)\s+(professor\s+|prof\.?\s+)?n\b/i,
];

function isProfessorNuiQuery(query) {
  if (!query?.trim()) return false;
  const normalized = query.trim().replace(/\s+/g, " ");
  return PROFESSOR_NUI_QUERY_PATTERNS.some((pattern) => pattern.test(normalized));
}

function getProfessorNuiDoc() {
  return {
    file: "custom/professor-nui.txt",
    topic: "Professor Nui",
    section: "custom",
    body: PROFESSOR_NUI_REPLY,
    chunkIndex: 0,
    totalChunks: 1,
    score: 999,
    method: "keyword",
  };
}

const CMU_VOCABULARY = [
  "major", "majors", "minor", "minors", "degree", "degrees", "program", "programs",
  "concentration", "registration", "register", "enroll", "enrollment",
  "stuco", "scholarship", "scholarships", "financial", "aid",
  "certificate", "certificates", "overload", "calendar", "handbook",
  "accommodation", "advisor", "advising", "advisor", "cross-registration",
  "courses", "course", "class", "classes", "schedule", "semester",
  "spring", "fall", "grades", "transcript", "tuition", "fees",
  "housing", "dining", "campus", "library", "clinic", "health",
  "internship", "research", "career", "graduate", "undergraduate",
  "syllabus", "assignment", "exam", "final", "midterm", "gpa",
  "department", "faculty", "professor", "office", "hours", "nui",
  "tafawq", "tamaiyuz", "fafsa", "heygen", "doha", "qatar",
  "forms", "petition", "waiver", "prerequisite", "credit", "units",
  "orientation", "graduation", "diploma", "commencement",
];

// Sound-alike corrections for voice recognition errors where the misspelling is
// too far from the intended word for edit-distance to bridge (e.g. "mesure" → "major").
const SOUND_CORRECTIONS = {
  mesure: "major", measure: "major", mayor: "major", majeure: "major",
  stucco: "stuco", "stu": "stuco",
  "financial aide": "financial aid", "financial eight": "financial aid",
  "add drop": "registration", adviser: "advisor",
  "micro course": "micro-courses", "student hand book": "student handbook",
};

/**
 * Correct typos in each query token using edit distance against the CMU vocabulary.
 * Allowed edits scale with word length: ~1 edit per 3 characters.
 */
function fuzzyCorrectTokens(tokens) {
  return tokens.map((token) => {
    if (token.length < 4) return token;
    if (CMU_VOCABULARY.includes(token)) return token;

    let bestWord = token;
    let bestDist = Infinity;
    for (const vocab of CMU_VOCABULARY) {
      if (Math.abs(vocab.length - token.length) > 3) continue;
      const d = editDistance(token, vocab);
      if (d < bestDist) { bestDist = d; bestWord = vocab; }
    }

    // Allow more edits for longer words: floor(length/3), minimum 1
    const maxAllowed = Math.max(1, Math.floor(token.length / 3));
    return bestDist <= maxAllowed ? bestWord : token;
  });
}

/**
 * Normalize a query: apply sound-alike corrections first, then fuzzy edit-distance
 * correction on remaining tokens. Handles both voice errors and typing mistakes.
 */
function normalizeQuery(query) {
  let q = query.toLowerCase().trim();
  // Apply sound-alike corrections (multi-word phrases first)
  for (const [wrong, right] of Object.entries(SOUND_CORRECTIONS)) {
    q = q.replace(new RegExp(`\\b${wrong}\\b`, "gi"), right);
  }
  const tokens = tokenize(q);
  const corrected = fuzzyCorrectTokens(tokens);
  // Rebuild corrected query string (used for exact-match scoring)
  return corrected.join(" ");
}

const ALIASES = {
  nui: ["professor nui", "prof nui", "professor", "prof"],
  stuco: ["student college", "student taught", "student-taught"],
  registration: ["register", "enroll", "enrollment", "add drop", "schedule change"],
  minor: ["minors"],
  major: ["degree", "program", "concentration", "computer science", "information systems", "business administration"],
  scholarship: ["financial aid", "tafawq", "tamaiyuz", "fafsa", "funding", "grant"],
  cross: ["cross-registration", "cross registration", "education city"],
  certificate: ["certificates", "cert"],
  overload: ["course overload", "extra courses"],
  calendar: ["academic calendar", "semester dates", "deadlines"],
  handbook: ["student handbook", "policies", "academic integrity"],
  accommodation: ["disability", "learning disability", "mental health"],
  form: ["forms", "paperwork", "petition"],
  advisor: ["adviser", "advising", "academic advising"],
};

function expandQueryTokens(tokens) {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const [key, values] of Object.entries(ALIASES)) {
      if (token.includes(key) || values.some((v) => token.includes(v.replace(/\s+/g, "")))) {
        expanded.add(key);
        values.forEach((v) => v.split(/\s+/).forEach((w) => expanded.add(w)));
      }
    }
  }
  return expanded;
}

function isScheduleQuery(queryLower) {
  return /\b(schedule|course|courses|section|units|spring|fall|semester|class|classes|register)\b/.test(
    queryLower
  );
}

function tokenMatches(haystack, token) {
  if (!token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (token.length <= 3) {
    return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
  }
  return haystack.includes(token);
}

function scoreDocument(doc, queryTokens, queryLower) {
  const haystack = `${doc.topic} ${doc.body} ${doc.file}`.toLowerCase();
  let score = 0;

  if (doc.file.includes("schedule-of-classes") && !isScheduleQuery(queryLower)) {
    return 0;
  }

  for (const token of queryTokens) {
    if (tokenMatches(haystack, token)) score += 1;
    if (tokenMatches(doc.topic.toLowerCase(), token)) score += 4;
    if (tokenMatches(doc.file.toLowerCase(), token)) score += 3;
  }

  if (queryLower.length > 3) {
    if (haystack.includes(queryLower)) score += 8;
  } else if (queryLower.length >= 2 && tokenMatches(haystack, queryLower)) {
    score += 8;
  }

  return score;
}

/** Keyword-based retrieval with fuzzy matching and alias expansion. */
function retrieveRelevantDocs(query, { limit = 3, maxChars = 5000, maxDocChars = 600 } = {}) {
  if (!query?.trim()) {
    return [];
  }

  if (isProfessorNuiQuery(query)) {
    return [getProfessorNuiDoc()];
  }

  if (!documents.length) {
    return [];
  }

  const queryLower = normalizeQuery(query);
  const queryTokens = expandQueryTokens(tokenize(queryLower));

  const ranked = documents
    .map((doc) => ({ doc, score: scoreDocument(doc, queryTokens, queryLower) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  const selected = [];
  let chars = 0;

  for (const { doc, score } of ranked) {
    if (selected.length >= limit || chars >= maxChars) break;
    selected.push({
      ...doc,
      body: doc.body.slice(0, maxDocChars),
      score,
      method: "keyword",
    });
    chars += Math.min(doc.body.length, maxDocChars);
  }

  return selected;
}

async function retrieveRelevantDocsAsync(query, options = {}) {
  return retrieveRelevantDocs(query, options);
}

// ─── Context Block ────────────────────────────────────────────────────────────

function buildContextBlock(docs) {
  if (!docs.length) return "";

  return docs
    .map((doc) => `[Source: scotty.qatar.cmu.edu — ${doc.topic} (${doc.file})]\n${doc.body}`)
    .join("\n\n");
}

/**
 * Convert retrieval scores into a user-facing confidence summary.
 */
function computeConfidence(docs) {
  if (!docs.length) {
    return {
      score: 0,
      sourceCount: 0,
      method: "none",
      message: null,
      sources: [],
    };
  }

  const method = docs[0].method || "keyword";
  const topScore = docs[0].score ?? 0;
  const maxScore = Math.max(...docs.map((d) => d.score ?? 0), 1);
  const scorePercent = Math.round(Math.min(95, 25 + (topScore / maxScore) * 70));
  const sourceCount = docs.length;
  const sourceLabel = sourceCount === 1 ? "source" : "sources";

  return {
    score: scorePercent,
    sourceCount,
    method,
    message: `Scotty is ${scorePercent}% confident in this answer based on ${sourceCount} ${sourceLabel}`,
    sources: docs.map((d) => ({
      topic: d.topic,
      file: d.file,
      score: d.score,
    })),
  };
}

module.exports = {
  loadKnowledgeBase,
  retrieveRelevantDocs,
  retrieveRelevantDocsAsync,
  buildContextBlock,
  computeConfidence,
  getRetrievalStatus,
  isProfessorNuiQuery,
  getProfessorNuiReply: () => PROFESSOR_NUI_REPLY,
};
