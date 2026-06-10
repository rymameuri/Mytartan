const fs = require("fs");
const path = require("path");
const axios = require("axios");

const KB_ROOT = path.join(__dirname, "..", "knowledge-base");

// Embedding model — free on HuggingFace, optimized for semantic similarity
const EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const EMBEDDING_API = `https://api-inference.huggingface.co/models/${EMBEDDING_MODEL}`;
const MIN_SIMILARITY = 0.2; // minimum cosine similarity score to include a result

let documents = [];

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
    embedding: null,
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
        walk(fullPath, relativePath);
      } else if (entry.name.endsWith(".txt")) {
        const content = fs.readFileSync(fullPath, "utf8");
        // parseDocument now returns an array of chunks
        documents.push(...parseDocument(content, relativePath));
      }
    }
  }

  walk(KB_ROOT);
  return documents.length;
}

// ─── Semantic Embeddings ──────────────────────────────────────────────────────

function isPlaceholderKey(key) {
  const placeholders = new Set(["", "your_key", "your-key", "your_api_key", "changeme", "placeholder"]);
  if (!key || typeof key !== "string") return true;
  const trimmed = key.trim().toLowerCase();
  return placeholders.has(trimmed) || trimmed.length < 10;
}

/**
 * Cosine similarity between two vectors.
 * Returns a score from -1 (opposite) to 1 (identical).
 */
function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Call the HuggingFace embedding API.
 * Returns an array of vectors (one per input text).
 */
async function fetchEmbeddings(texts, apiKey) {
  const response = await axios.post(
    EMBEDDING_API,
    { inputs: texts },
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 30000,
    }
  );
  return response.data;
}

/**
 * Pre-compute embeddings for all KB documents at server startup.
 * Runs in the background — the server stays fast.
 */
async function initializeEmbeddings() {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (isPlaceholderKey(apiKey)) {
    console.log("KB: No HuggingFace key — using keyword retrieval");
    return false;
  }

  try {
    console.log(`KB: Generating semantic embeddings for ${documents.length} documents...`);

    // Process in small batches to stay within API limits
    const BATCH_SIZE = 8;
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      // Combine topic + first 500 chars of body for a rich embedding
      const texts = batch.map((doc) => `${doc.topic}. ${doc.body.slice(0, 500)}`);

      const vectors = await fetchEmbeddings(texts, apiKey);

      for (let j = 0; j < batch.length; j++) {
        documents[i + j].embedding = Array.isArray(vectors[j]) ? vectors[j] : null;
      }
    }

    const embedded = documents.filter((d) => d.embedding).length;
    console.log(`KB: Semantic embeddings ready ✓ (${embedded}/${documents.length} docs)`);
    return true;
  } catch (err) {
    console.warn("KB: Embedding init failed — using keyword fallback:", err.message);
    return false;
  }
}

// ─── Keyword Retrieval (fallback) ─────────────────────────────────────────────

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
  "department", "faculty", "professor", "office", "hours",
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

function scoreDocument(doc, queryTokens, queryLower) {
  const haystack = `${doc.topic} ${doc.body} ${doc.file}`.toLowerCase();
  let score = 0;

  if (doc.file.includes("schedule-of-classes") && !isScheduleQuery(queryLower)) {
    return 0;
  }

  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 1;
    if (doc.topic.toLowerCase().includes(token)) score += 4;
    if (doc.file.toLowerCase().includes(token)) score += 3;
  }

  if (haystack.includes(queryLower)) score += 8;

  return score;
}

/** Synchronous keyword-based retrieval. Used as fallback and in tests. */
function retrieveRelevantDocs(query, { limit = 3, maxChars = 5000, maxDocChars = 600 } = {}) {
  if (!documents.length || !query?.trim()) {
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

  for (const { doc } of ranked) {
    if (selected.length >= limit || chars >= maxChars) break;
    selected.push({ ...doc, body: doc.body.slice(0, maxDocChars) });
    chars += Math.min(doc.body.length, maxDocChars);
  }

  return selected;
}

// ─── Semantic Retrieval (primary) ─────────────────────────────────────────────

/**
 * Async retrieval using semantic embeddings + cosine similarity.
 * Falls back to keyword retrieval if embeddings aren't available.
 */
async function retrieveRelevantDocsAsync(query, { limit = 3, maxDocChars = 600 } = {}) {
  if (!query?.trim()) return [];
  query = normalizeQuery(query);

  const apiKey = process.env.HUGGINGFACE_API_KEY;
  const embeddingsAvailable = documents.some((d) => d.embedding);

  // Use semantic search if embeddings are loaded
  if (embeddingsAvailable && !isPlaceholderKey(apiKey)) {
    try {
      const vectors = await fetchEmbeddings([query], apiKey);
      const queryVector = vectors[0];

      const scored = documents
        .filter((doc) => doc.embedding)
        .map((doc) => ({ doc, score: cosineSimilarity(queryVector, doc.embedding) }))
        .filter(({ score }) => score > MIN_SIMILARITY)
        .sort((a, b) => b.score - a.score);

      if (scored.length > 0) {
        console.log(
          `KB: Semantic retrieval — top match: "${scored[0].doc.topic}" (score: ${scored[0].score.toFixed(3)})`
        );
        return scored
          .slice(0, limit)
          .map(({ doc }) => ({ ...doc, body: doc.body.slice(0, maxDocChars) }));
      }
    } catch (err) {
      console.warn("KB: Semantic retrieval error — falling back to keywords:", err.message);
    }
  }

  // Fall back to keyword retrieval
  return retrieveRelevantDocs(query, { limit, maxDocChars });
}

// ─── Context Block ────────────────────────────────────────────────────────────

function buildContextBlock(docs) {
  if (!docs.length) return "";

  return docs
    .map((doc) => `[Source: scotty.qatar.cmu.edu — ${doc.topic} (${doc.file})]\n${doc.body}`)
    .join("\n\n");
}

module.exports = {
  loadKnowledgeBase,
  initializeEmbeddings,
  retrieveRelevantDocs,
  retrieveRelevantDocsAsync,
  buildContextBlock,
};
