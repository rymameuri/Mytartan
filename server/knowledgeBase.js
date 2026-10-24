const fs = require("fs");
const path = require("path");
const axios = require("axios");

axios.defaults.proxy = false;

const KB_ROOT = path.join(__dirname, "..", "knowledge-base");
const SYNONYMS_PATH = path.join(__dirname, "..", "data", "synonyms.json");
const KEY_FACTS_PATH = path.join(__dirname, "..", "data", "key-facts.json");

const HAIKU_MODEL = "claude-haiku-20240307";
const RERANK_CANDIDATE_COUNT = 6;
const RERANK_FALLBACK_COUNT = 4;
const RERANK_CHUNK_CHARS = 400;

let documents = [];
let synonyms = {};
let idfIndex = {};
let retrievalStatus = {
  documentCount: 0,
  activeMethod: "tfidf+rerank",
  lastQuery: {
    usedQueryRewriting: false,
    usedReranking: false,
    rawQuery: null,
    retrievalQuery: null,
  },
};

// ─── Document Parsing & Chunking ─────────────────────────────────────────────

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;

function chunkText(text) {
  if (text.length <= CHUNK_SIZE) return [text];

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + CHUNK_SIZE;

    if (end < text.length) {
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
    if (chunk.length > 50) chunks.push(chunk);
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

function loadSynonyms() {
  synonyms = {};
  if (!fs.existsSync(SYNONYMS_PATH)) return;

  try {
    const raw = JSON.parse(fs.readFileSync(SYNONYMS_PATH, "utf8"));
    for (const [key, value] of Object.entries(raw)) {
      if (key.startsWith("_")) continue;
      synonyms[key.toLowerCase()] = value;
    }
  } catch (err) {
    console.warn("[knowledgeBase] Failed to load synonyms.json:", err.message);
  }
}

function buildIdfIndex() {
  const docFreq = new Map();
  const totalDocs = documents.length;

  for (const doc of documents) {
    const terms = new Set(tokenize(getDocSearchText(doc)));
    for (const term of terms) {
      docFreq.set(term, (docFreq.get(term) || 0) + 1);
    }
  }

  idfIndex = {};
  for (const [term, df] of docFreq.entries()) {
    idfIndex[term] = Math.log((totalDocs + 1) / (df + 1)) + 1;
  }
}

function loadKnowledgeBase() {
  documents = [];
  loadSynonyms();

  if (!fs.existsSync(KB_ROOT)) {
    retrievalStatus.documentCount = 0;
    buildIdfIndex();
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
        documents.push(...parseDocument(content, relativePath));
      }
    }
  }

  walk(KB_ROOT);
  buildIdfIndex();
  retrievalStatus.documentCount = documents.length;
  return documents.length;
}

function getRetrievalStatus() {
  return { ...retrievalStatus };
}

function recordLastQuery({ rawQuery, retrievalQuery, usedQueryRewriting, usedReranking }) {
  retrievalStatus.lastQuery = {
    usedQueryRewriting: Boolean(usedQueryRewriting),
    usedReranking: Boolean(usedReranking),
    rawQuery: rawQuery ?? null,
    retrievalQuery: retrievalQuery ?? null,
  };
}

// ─── Query understanding ────────────────────────────────────────────────────

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "was", "one", "our", "out",
  "how", "what", "when", "where", "who", "why", "does", "did", "has", "have", "this", "that",
  "with", "from", "about", "your", "into", "they", "them", "will", "would", "could", "should",
  "there", "their", "than", "then", "also", "just", "only", "very", "some", "any", "each",
  "much", "many", "more", "most", "other", "such", "being", "been", "were", "are", "is", "am",
  "be", "do", "get", "may", "might", "must", "shall", "take", "use", "using", "tell", "know",
]);

function tokenizeForScoring(text) {
  return tokenize(text).filter((word) => !STOP_WORDS.has(word));
}

/**
 * Append canonical CMU-Q expansions from data/synonyms.json without replacing slang.
 */
function expandQuery(rawQuery) {
  let q = rawQuery.toLowerCase().trim();
  const expansions = [];

  const phraseKeys = Object.keys(synonyms)
    .filter((key) => key.includes(" "))
    .sort((a, b) => b.length - a.length);

  for (const phrase of phraseKeys) {
    if (q.includes(phrase)) {
      expansions.push(synonyms[phrase]);
    }
  }

  for (const token of q.split(/\s+/)) {
    const cleaned = token.replace(/[^a-z0-9-]/g, "");
    const singular = cleaned.endsWith("s") ? cleaned.slice(0, -1) : "";
    const canonical = (cleaned && synonyms[cleaned] && cleaned) || (singular && synonyms[singular] && singular);
    if (canonical) expansions.push(synonyms[canonical]);
  }

  if (expansions.length) {
    q = `${q} ${expansions.join(" ")}`;
  }

  return q;
}

const FOLLOW_UP_PATTERNS = [
  /\b(it|that|those|them|they|this|there|one|same|else)\b/i,
  /^what about\b/i,
  /^how about\b/i,
  /^and (the|that|those|what)\b/i,
];

function looksLikeFollowUp(rawQuery) {
  const q = rawQuery.trim();
  const wordCount = q.split(/\s+/).filter(Boolean).length;
  if (wordCount > 12) return false;
  return FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(q));
}

function isStandaloneQuestion(rawQuery) {
  const q = rawQuery.trim();
  const words = q.split(/\s+/).filter(Boolean);

  if (words.length >= 8 && /\?$/.test(q)) return true;
  if (words.length >= 10) return true;
  if (
    /^(how|what|when|where|who|why|can|could|do|does|did|is|are|will|should|explain|describe|tell me)\b/i.test(q) &&
    words.length >= 5 &&
    !looksLikeFollowUp(q)
  ) {
    return true;
  }

  return false;
}

function formatRecentMessages(recentMessages) {
  return (recentMessages || [])
    .filter((m) => m?.content?.trim() && (m.role === "user" || m.role === "assistant"))
    .slice(-4)
    .map((m) => `${m.role}: ${m.content.trim()}`)
    .join("\n");
}

function getAiGatewayBaseUrl() {
  return process.env.AI_GATEWAY_BASE_URL?.trim().replace(/\/$/, "") || "";
}

function getAnthropicApiKey() {
  return process.env.ANTHROPIC_API_KEY?.trim() || "";
}

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY?.trim() || "";
}

function resolveGatewayModelId(model) {
  if (model.startsWith("claude-")) {
    return `us.anthropic.${model}`;
  }
  return model;
}

function getAiModel() {
  const model = process.env.AI_MODEL?.trim() || "claude-haiku-4-5-20251001-v1:0";
  if (getAiGatewayBaseUrl()) {
    return resolveGatewayModelId(model);
  }
  return model;
}

function isConfiguredKey(value) {
  if (!value) return false;
  const trimmed = value.trim().toLowerCase();
  if (["", "your_key", "your-key", "your_api_key", "changeme", "placeholder"].includes(trimmed)) {
    return false;
  }
  return value.trim().length >= 10;
}

function hasRetrievalAiKey() {
  if (process.env.AI_PROVIDER?.trim().toLowerCase() === "huggingface" ||
      process.env.AI_PROVIDER?.trim().toLowerCase() === "hf") {
    const hfKey =
      process.env.HUGGINGFACE_API_KEY?.trim() ||
      process.env.HF_TOKEN?.trim() ||
      process.env.HUGGINGFACE_HUB_TOKEN?.trim();
    return isConfiguredKey(hfKey);
  }
  if (getAiGatewayBaseUrl() && isConfiguredKey(getClaudeApiKey())) return true;
  return isConfiguredKey(getAnthropicApiKey());
}

function getHuggingfaceModelForRetrieval() {
  return (
    process.env.HUGGINGFACE_MODEL?.trim() ||
    process.env.HF_MODEL?.trim() ||
    "deepseek-ai/DeepSeek-V4-Flash-0731"
  );
}

function getHuggingfaceRouterBaseUrlForRetrieval() {
  return (
    process.env.HUGGINGFACE_ROUTER_BASE_URL?.trim() ||
    process.env.HF_ROUTER_BASE_URL?.trim() ||
    "https://router.huggingface.co/v1"
  ).replace(/\/$/, "");
}

function getHuggingfaceApiKeyForRetrieval() {
  return (
    process.env.HUGGINGFACE_API_KEY?.trim() ||
    process.env.HF_TOKEN?.trim() ||
    process.env.HUGGINGFACE_HUB_TOKEN?.trim() ||
    ""
  );
}

async function callHaiku(systemPrompt, userContent, { maxTokens = 256 } = {}) {
  if (!hasRetrievalAiKey()) {
    throw new Error("No AI API key configured for retrieval");
  }

  const aiProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (aiProvider === "huggingface" || aiProvider === "hf") {
    const response = await axios.post(
      `${getHuggingfaceRouterBaseUrlForRetrieval()}/chat/completions`,
      {
        model: getHuggingfaceModelForRetrieval(),
        max_tokens: maxTokens,
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${getHuggingfaceApiKeyForRetrieval()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.choices[0].message.content.trim();
  }

  if (getAiGatewayBaseUrl()) {
    const response = await axios.post(
      `${getAiGatewayBaseUrl()}/v1/chat/completions`,
      {
        model: getAiModel(),
        max_tokens: maxTokens,
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${getClaudeApiKey()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.choices[0].message.content.trim();
  }

  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: HAIKU_MODEL,
      max_tokens: maxTokens,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    },
    {
      headers: {
        "x-api-key": getAnthropicApiKey(),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
    }
  );

  return response.data.content[0].text.trim();
}

/**
 * Rewrite short follow-up questions into standalone retrieval queries using recent chat.
 */
async function rewriteQueryWithHistory(rawQuery, recentMessages = []) {
  if (!rawQuery?.trim()) return rawQuery;
  if (isStandaloneQuestion(rawQuery)) return rawQuery;
  if (!looksLikeFollowUp(rawQuery)) return rawQuery;
  if (!hasRetrievalAiKey()) return rawQuery;

  const history = formatRecentMessages(recentMessages);
  if (!history) return rawQuery;

  const systemPrompt =
    "You rewrite follow-up questions into standalone search queries for a CMU-Q student knowledge base. " +
    "Use the recent conversation for context. Output ONLY the rewritten question with no preamble.";

  const userContent =
    `Recent conversation:\n${history}\n\nLatest user message: ${rawQuery.trim()}\n\nStandalone question:`;

  try {
    const rewritten = await callHaiku(systemPrompt, userContent, { maxTokens: 120 });
    return rewritten.replace(/^["']|["']$/g, "").trim() || rawQuery;
  } catch (err) {
    console.warn("[knowledgeBase] Query rewrite failed:", err.message);
    return rawQuery;
  }
}

// ─── Fuzzy typo correction ────────────────────────────────────────────────────

function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

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
    method: "custom",
  };
}

const CMU_VOCABULARY = [
  "major", "majors", "minor", "minors", "degree", "degrees", "program", "programs",
  "concentration", "registration", "register", "enroll", "enrollment",
  "stuco", "scholarship", "scholarships", "financial", "aid",
  "certificate", "certificates", "overload", "calendar", "handbook",
  "accommodation", "advisor", "advising", "cross-registration",
  "courses", "course", "class", "classes", "schedule", "semester",
  "spring", "fall", "grades", "transcript", "tuition", "fees",
  "housing", "dining", "campus", "library", "clinic", "health",
  "internship", "research", "career", "graduate", "undergraduate",
  "syllabus", "assignment", "exam", "final", "midterm", "gpa",
  "department", "faculty", "professor", "office", "hours", "nui",
  "tafawq", "tamaiyuz", "fafsa", "heygen", "doha", "qatar",
  "forms", "petition", "waiver", "prerequisite", "credit", "units",
  "orientation", "graduation", "diploma", "commencement",
  "deadline", "deadlines", "building", "buildings",
  "wifi", "vpn", "duo", "printing", "gpu", "canvas", "crashplan",
  "eduroam", "handshake", "vmock", "counseling", "therapy", "papercut",
  "anyconnect", "chatgpt", "copilot", "backup", "phishing", "slurm",
  "deepnet", "caps", "residence", "dorm", "immigration", "visa",
  "supplemental", "tutoring", "honors", "thesis", "scholar",
];

function hasContentKeywords(query) {
  if (!query || typeof query !== "string") return false;
  const lower = query.toLowerCase();
  return CMU_VOCABULARY.some((token) => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/-/g, "[\\s-]");
    return new RegExp(`\\b${escaped}\\b`, "i").test(lower);
  });
}

const SOUND_CORRECTIONS = {
  mesure: "major",
  measure: "major",
  mayor: "major",
  majeure: "major",
  stucco: "stuco",
  stu: "stuco",
  "financial aide": "financial aid",
  "financial eight": "financial aid",
  "add drop": "registration",
  adviser: "advisor",
  "micro course": "micro-courses",
  "student hand book": "student handbook",
  "wi fi": "wifi",
  "w fi": "wifi",
  "two fa": "2fa",
  "duo mobile": "duo",
  papercut: "printing",
};

function fuzzyCorrectTokens(tokens) {
  return tokens.map((token) => {
    if (token.length < 4) return token;
    if (CMU_VOCABULARY.includes(token)) return token;

    let bestWord = token;
    let bestDist = Infinity;
    for (const vocab of CMU_VOCABULARY) {
      if (Math.abs(vocab.length - token.length) > 3) continue;
      const d = editDistance(token, vocab);
      if (d < bestDist) {
        bestDist = d;
        bestWord = vocab;
      }
    }

    const maxAllowed = Math.max(1, Math.floor(token.length / 3));
    return bestDist <= maxAllowed ? bestWord : token;
  });
}

function normalizeQuery(query) {
  let q = query.toLowerCase().trim();
  for (const [wrong, right] of Object.entries(SOUND_CORRECTIONS)) {
    q = q.replace(new RegExp(`\\b${wrong.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), right);
  }
  const tokens = tokenize(q);
  return fuzzyCorrectTokens(tokens).join(" ");
}

function prepareQueryTokens(rawQuery) {
  const expanded = expandQuery(rawQuery);
  const normalized = normalizeQuery(expanded);
  return {
    expandedQuery: expanded,
    normalizedQuery: normalized,
    queryTokens: [...new Set(tokenizeForScoring(normalized))],
  };
}

// ─── TF-IDF retrieval ─────────────────────────────────────────────────────────

function getDocSearchText(doc) {
  return `${doc.topic} ${doc.section} ${doc.body} ${doc.file}`.toLowerCase();
}

function getFirstLine(doc) {
  return doc.body.split("\n")[0]?.toLowerCase() || "";
}

function isScheduleQuery(queryLower) {
  return /\b(schedule|course|courses|section|units|spring|fall|semester|class|classes|register)\b/.test(
    queryLower
  );
}

function isCrossRegistrationQuery(queryLower) {
  return /\b(cross|education city|\bec\b|host school|other universit|georgetown|northwestern|tamuq|vcuq)\b/.test(
    queryLower
  );
}

function isCalendarDateQuery(queryLower) {
  return /\b(calendar|deadline|deadlines|dates|when does|start date|semester start|important dates|academic dates)\b/.test(
    queryLower
  );
}

function fileStemMatchesToken(fileLower, token) {
  const stem = fileLower.replace(/\.txt$/, "").split("/").pop() || "";
  return stem.includes(token);
}

function tokenMatches(haystack, token) {
  if (!token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (token.length <= 3) {
    return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
  }
  if (haystack.includes(token)) return true;
  // Plural/singular, but only on a whole word so "physics" does not hit "physical".
  if (token.length > 4 && token.endsWith("s") && new RegExp(`\\b${token.slice(0, -1)}\\b`, "i").test(haystack)) {
    return true;
  }
  if (token.length > 4 && !token.endsWith("s") && new RegExp(`\\b${escaped}s\\b`, "i").test(haystack)) {
    return true;
  }
  return false;
}

const PHRASE_SYNONYM_SKIP = new Set([
  "gpa", "qpa", "major", "majors", "deadline", "dates", "calendar", "register", "enroll",
]);

function collectQueryPhrases(rawQuery) {
  const phrases = new Set();
  const originalTokens = tokenizeForScoring(normalizeQuery(rawQuery));
  for (let i = 0; i < originalTokens.length - 1; i += 1) {
    const phrase = `${originalTokens[i]} ${originalTokens[i + 1]}`;
    if (phrase.length >= 8) phrases.add(phrase);
  }

  const expanded = expandQuery(rawQuery).toLowerCase();
  for (const [key, value] of Object.entries(synonyms)) {
    if (PHRASE_SYNONYM_SKIP.has(key) || !expanded.includes(key)) continue;
    const phrase = String(value).toLowerCase().trim();
    if (phrase.includes(" ")) phrases.add(phrase);
  }
  return [...phrases];
}

function scoreDocumentTfidf(doc, queryTokens, queryLower, queryPhrases = []) {
  const haystack = getDocSearchText(doc);
  const firstLine = getFirstLine(doc);
  const topicLower = doc.topic.toLowerCase();
  const sectionLower = doc.section.toLowerCase();
  const fileLower = doc.file.toLowerCase();

  if (doc.file.includes("schedule-of-classes") && !isScheduleQuery(queryLower)) {
    return 0;
  }
  if (
    doc.file.includes("schedule-of-classes") &&
    isCalendarDateQuery(queryLower) &&
    !/\b(course list|schedule of classes|section|instructor|units)\b/.test(queryLower)
  ) {
    return 0;
  }
  if (doc.file.includes("cross-registration") && !isCrossRegistrationQuery(queryLower)) {
    return 0;
  }

  const docTokens = tokenize(haystack);
  const tfMap = {};
  for (const term of docTokens) {
    tfMap[term] = (tfMap[term] || 0) + 1;
  }

  let score = 0;
  let matchedTerms = 0;

  for (const token of queryTokens) {
    if (!tokenMatches(haystack, token)) continue;

    matchedTerms += 1;
    const idf = idfIndex[token] ?? 1;
    let termScore = idf;

    if (tokenMatches(topicLower, token) || tokenMatches(sectionLower, token)) {
      termScore *= 4;
    }
    if (tokenMatches(firstLine, token)) {
      termScore *= 2.5;
    }
    if (tokenMatches(fileLower, token)) {
      termScore *= 2;
    }
    if (fileStemMatchesToken(fileLower, token)) {
      termScore *= 2.5;
    }

    const tf = tfMap[token] || 1;
    termScore *= 1 + Math.log1p(tf - 1) * 0.15;

    score += termScore;
  }

  if (!matchedTerms) return 0;

  let phraseHits = 0;
  for (const phrase of queryPhrases) {
    if (!phrase) continue;
    if (topicLower.includes(phrase)) phraseHits += 3;
    else if (haystack.includes(phrase)) phraseHits += 1;
  }
  if (phraseHits) score += 90 * phraseHits;

  if (queryLower.length > 3 && haystack.includes(queryLower)) {
    score += 6;
  }

  if (doc.file.endsWith("life-at-cmu-q.txt") && !/\b(campus life|life at|student life|living|housing|dorm|dining)\b/.test(queryLower)) {
    score *= 0.35;
  }
  if (
    doc.file.includes("final-examinations") &&
    !/\b(final|exam|examination|graduate)\b/.test(queryLower)
  ) {
    score *= 0.25;
  }
  if (doc.file.endsWith("student-handbook.txt") && /\b(integrity|conduct|policy|policies|rules)\b/.test(queryLower)) {
    score *= 1.4;
  }
  if (/\bintegrity\b/.test(queryLower) && /statement-on-academic-integrity|student-handbook/.test(fileLower)) {
    score += 140;
  }
  if (/\b(tafawq|tamaiyuz)\b/.test(queryLower) && /academic-calendar|calendars-schedules/.test(fileLower)) {
    score *= 0.35;
  }
  if (
    isCalendarDateQuery(queryLower) &&
    !/\b(tafawq|tamaiyuz|scholarship|housing|visa|tuition|overload|minor|stuco|wifi|print)\b/.test(queryLower) &&
    /academic-calendar|calendars-schedules/.test(fileLower)
  ) {
    score += 160;
  }

  return score;
}

function rankDocuments(retrievalQuery) {
  const { normalizedQuery, queryTokens } = prepareQueryTokens(retrievalQuery);
  const queryPhrases = collectQueryPhrases(retrievalQuery);

  return documents
    .map((doc) => ({
      doc,
      score: scoreDocumentTfidf(doc, queryTokens, normalizedQuery, queryPhrases),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
}

function parseIndexArray(text, maxIndex) {
  const match = text.match(/\[[\d,\s]+\]/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return null;

    const indices = [];
    for (const value of parsed) {
      const index = Number(value);
      if (!Number.isInteger(index) || index < 0 || index > maxIndex) continue;
      if (!indices.includes(index)) indices.push(index);
      if (indices.length >= 5) break;
    }

    return indices.length ? indices : null;
  } catch {
    return null;
  }
}

async function rerankCandidates(question, candidates) {
  if (!candidates.length) return { ranked: [], usedReranking: false };
  if (!hasRetrievalAiKey()) {
    return { ranked: candidates.slice(0, RERANK_FALLBACK_COUNT), usedReranking: false };
  }

  const chunkLines = candidates
    .map(
      (entry, index) =>
        `[${index}] Topic: ${entry.doc.topic}\n${entry.doc.body.slice(0, RERANK_CHUNK_CHARS)}`
    )
    .join("\n\n");

  const systemPrompt =
    "You rerank knowledge base excerpts for a CMU-Q student question. " +
    "Return ONLY a JSON array of 3 to 5 chunk indices (0-based), most relevant first. " +
    'Example: [2, 0, 4]. Include only chunks that help answer the question.';

  const userContent = `Question: ${question}\n\nChunks:\n${chunkLines}`;

  try {
    const response = await callHaiku(systemPrompt, userContent, { maxTokens: 80 });
    const indices = parseIndexArray(response, candidates.length - 1);
    if (!indices?.length) {
      return { ranked: candidates.slice(0, RERANK_FALLBACK_COUNT), usedReranking: false };
    }

    const ranked = indices.map((index) => candidates[index]).filter(Boolean);
    return { ranked, usedReranking: true };
  } catch (err) {
    console.warn("[knowledgeBase] Reranking failed:", err.message);
    return { ranked: candidates.slice(0, RERANK_FALLBACK_COUNT), usedReranking: false };
  }
}

function packDocuments(rankedEntries, { limit, maxChars, maxDocChars, method }) {
  const selected = [];
  let chars = 0;
  const seenFiles = new Set();

  function take(maxCopies) {
    for (const { doc, score } of rankedEntries) {
      if (selected.length >= limit || chars >= maxChars) return;
      const copies = selected.filter((item) => item.file === doc.file).length;
      if (copies >= maxCopies) continue;
      selected.push({
        ...doc,
        body: doc.body.slice(0, maxDocChars),
        score,
        method,
      });
      seenFiles.add(doc.file);
      chars += Math.min(doc.body.length, maxDocChars);
    }
  }

  take(1);
  if (selected.length < limit) take(2);
  return selected;
}

function queryAnchorTokens(query) {
  return tokenizeForScoring(normalizeQuery(expandQuery(query))).filter(
    (token) => token.length >= 6 && !GENERIC_FACT_TOKENS.has(token)
  );
}

function docCoversAnchors(doc, anchors) {
  if (!anchors.length) return true;
  const haystack = getDocSearchText(doc);
  return anchors.some((token) => tokenMatches(haystack, token));
}

function keepCoveringDocs(query, ranked) {
  const anchors = queryAnchorTokens(query);
  if (!anchors.length) return ranked;
  return ranked.filter(({ doc }) => docCoversAnchors(doc, anchors));
}

function shouldRerankCandidates(ranked) {
  if (!ranked || ranked.length < 2) return false;
  const top = ranked[0];
  const topScore = top.score || 0;
  const topFile = top.doc?.file;
  const rival = ranked.find((entry, index) => index > 0 && entry.doc?.file !== topFile);
  if (!rival) return false;
  const second = rival.score || 0;
  if (topScore >= 80 && second > 0 && topScore >= second * 1.85) return false;
  return true;
}

function retrieveRelevantDocsSync(query, { limit = 3, maxChars = 5000, maxDocChars = 600 } = {}) {
  if (!query?.trim()) return [];
  if (isProfessorNuiQuery(query)) return [getProfessorNuiDoc()];
  if (!documents.length) return [];

  const ranked = keepCoveringDocs(query, rankDocuments(query));
  return packDocuments(ranked, {
    limit,
    maxChars,
    maxDocChars,
    method: "tfidf",
  });
}

/** TF-IDF retrieval with synonym expansion and fuzzy correction (no LLM steps). */
function retrieveRelevantDocs(query, options = {}) {
  const docs = retrieveRelevantDocsSync(query, options);
  recordLastQuery({
    rawQuery: query,
    retrievalQuery: query,
    usedQueryRewriting: false,
    usedReranking: false,
  });
  return docs;
}

async function retrieveRelevantDocsAsync(
  query,
  { limit = 4, maxChars = 6500, maxDocChars = 900, recentMessages = [] } = {}
) {
  if (!query?.trim()) {
    recordLastQuery({ rawQuery: query, retrievalQuery: query, usedQueryRewriting: false, usedReranking: false });
    return [];
  }

  if (isProfessorNuiQuery(query)) {
    recordLastQuery({ rawQuery: query, retrievalQuery: query, usedQueryRewriting: false, usedReranking: false });
    return [getProfessorNuiDoc()];
  }

  if (!documents.length) {
    recordLastQuery({ rawQuery: query, retrievalQuery: query, usedQueryRewriting: false, usedReranking: false });
    return [];
  }

  const rewrittenQuery = await rewriteQueryWithHistory(query, recentMessages);
  const usedQueryRewriting = rewrittenQuery.trim() !== query.trim();
  const retrievalQuery = rewrittenQuery;

  const ranked = keepCoveringDocs(retrievalQuery, rankDocuments(retrievalQuery));
  if (!ranked.length) {
    recordLastQuery({ rawQuery: query, retrievalQuery, usedQueryRewriting, usedReranking: false });
    return [];
  }

  let finalRanked = ranked;
  let usedReranking = false;
  if (shouldRerankCandidates(ranked)) {
    const candidates = ranked.slice(0, RERANK_CANDIDATE_COUNT);
    const result = await rerankCandidates(retrievalQuery, candidates);
    finalRanked = result.ranked.length ? result.ranked : ranked.slice(0, RERANK_FALLBACK_COUNT);
    usedReranking = result.usedReranking;
  }

  const docs = packDocuments(finalRanked, {
    limit,
    maxChars,
    maxDocChars,
    method: usedReranking ? "tfidf+rerank" : "tfidf",
  });

  recordLastQuery({ rawQuery: query, retrievalQuery, usedQueryRewriting, usedReranking });
  return docs;
}

// ─── Student profile context ──────────────────────────────────────────────────

function buildStudentContext(profile) {
  if (!profile?.onboardingComplete) return "";

  const major = profile.major?.trim();
  const graduationDate = profile.graduationDate?.trim();
  const learningStyle = profile.learningStyle?.trim();
  const intendedUse = profile.intendedUse?.trim();

  if (!major || !graduationDate || !learningStyle || !intendedUse) {
    return "";
  }

  return (
    `You are speaking with a CMU-Q student majoring in ${major}, expected to graduate in ${graduationDate}. ` +
    `Their preferred learning style is ${learningStyle}. They primarily use this assistant for ${intendedUse}. ` +
    "Tailor your tone, the depth of explanation, and which features you suggest accordingly. " +
    "If learningStyle is visual, favor suggesting whiteboard brainstorms and flashcards in Tutor mode. " +
    "If intendedUse mentions navigation, proactively offer to show the campus map when location questions come up."
  );
}

function buildContextBlock(docs) {
  if (!docs.length) return "";

  return docs
    .map((doc) => `[Source: myCMU-Q — ${doc.topic} (${doc.file})]\n${doc.body}`)
    .join("\n\n");
}

let keyFactsCache = null;

function loadKeyFacts() {
  if (keyFactsCache) return keyFactsCache;

  keyFactsCache = [];
  if (!fs.existsSync(KEY_FACTS_PATH)) return keyFactsCache;

  try {
    const raw = JSON.parse(fs.readFileSync(KEY_FACTS_PATH, "utf8"));
    keyFactsCache = raw.filter((entry) => entry?.id && entry?.topic && entry?.value);
  } catch (err) {
    console.warn("[knowledgeBase] Failed to load key-facts.json:", err.message);
  }

  return keyFactsCache;
}

const GENERIC_FACT_TOKENS = new Set([
  "course", "courses", "student", "students", "fee", "fees", "cost", "campus",
  "program", "programs", "semester", "credit", "credits", "service", "services",
  "contact", "support", "application", "grant", "based", "need", "requirement",
  "requirements", "registration", "deadline", "deadlines", "date", "dates",
  "week", "unit", "units", "limit", "hall", "network", "names", "connect",
  "setup", "address", "phone", "email", "free", "confidential", "gpa", "qpa",
  "financial", "aid", "per", "amount", "payment", "grade", "point", "average",
  "hours", "hour", "time", "labs",
]);

function factMatchScore(topic, queryTokens) {
  const topicTokens = tokenizeForScoring(topic);
  let distinctive = 0;
  for (const token of topicTokens) {
    if (!queryTokens.includes(token)) continue;
    if (!GENERIC_FACT_TOKENS.has(token) && token.length >= 5) {
      distinctive += token.length;
    }
  }
  return distinctive;
}

/**
 * Match query keywords against structured key-facts.json topic fields.
 * A single generic word (fee, course, gpa) is not enough — that was pulling
 * unrelated dollar amounts into the prompt.
 */
function checkKeyFacts(query) {
  const facts = loadKeyFacts();
  if (!query?.trim() || !facts.length) return [];

  const queryTokens = tokenizeForScoring(normalizeQuery(expandQuery(query)));
  const scored = facts
    .map((fact) => ({ fact, distinctive: factMatchScore(fact.topic, queryTokens) }))
    .filter((entry) => entry.distinctive > 0);

  if (!scored.length) return [];
  const best = Math.max(...scored.map((entry) => entry.distinctive));
  return scored
    .filter((entry) => entry.distinctive >= best * 0.8)
    .map((entry) => entry.fact);
}

function buildKeyFactsBlock(facts) {
  if (!facts.length) return "";

  const blocks = facts.map(
    (fact) =>
      `[AUTHORITATIVE KEY FACT — ${fact.id}]\n` +
      `Topic: ${fact.topic}\n` +
      `Value: ${fact.value}\n` +
      `Last verified: ${fact.lastVerified}\n` +
      `Source: ${fact.source}\n` +
      `(This is a structured authoritative fact — prefer this exact value over any conflicting prose excerpt.)`
  );

  return (
    "AUTHORITATIVE STRUCTURED KEY FACTS (use these exact values when they apply; they override conflicting knowledge-base prose on the same topic):\n\n" +
    blocks.join("\n\n")
  );
}

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

  const method = docs[0].method || "tfidf";
  const topScore = docs[0].score ?? 0;

  // Map absolute TF-IDF score to a 0–95% band (weak tangential matches ~15–35, solid ~50+, strong ~90+).
  const WEAK_SCORE = 20;
  const STRONG_SCORE = 120;
  let scorePercent;
  if (topScore <= 0) {
    scorePercent = 0;
  } else if (topScore < WEAK_SCORE) {
    scorePercent = Math.round(15 + (topScore / WEAK_SCORE) * 20);
  } else {
    scorePercent = Math.round(
      Math.min(95, 35 + ((topScore - WEAK_SCORE) / (STRONG_SCORE - WEAK_SCORE)) * 60)
    );
  }

  const sourceCount = docs.length;
  const sourceLabel = sourceCount === 1 ? "source" : "sources";
  const topics = [];
  for (const doc of docs) {
    if (doc.topic && !topics.includes(doc.topic)) topics.push(doc.topic);
    if (topics.length >= 3) break;
  }
  const topicNote = topics.length ? `: ${topics.join(", ")}` : "";

  return {
    score: scorePercent,
    sourceCount,
    method,
    message: `Scotty is ${scorePercent}% confident in this answer based on ${sourceCount} ${sourceLabel}${topicNote}`,
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
  expandQuery,
  rewriteQueryWithHistory,
  buildStudentContext,
  buildContextBlock,
  buildKeyFactsBlock,
  checkKeyFacts,
  computeConfidence,
  shouldRerankCandidates,
  getRetrievalStatus,
  isProfessorNuiQuery,
  getProfessorNuiReply: () => PROFESSOR_NUI_REPLY,
  hasContentKeywords,
};
