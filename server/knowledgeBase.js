const fs = require("fs");
const path = require("path");

const KB_ROOT = path.join(__dirname, "..", "knowledge-base");

let documents = [];

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

  return { file: relativePath, topic, section, body };
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
        documents.push(parseDocument(content, relativePath));
      }
    }
  }

  walk(KB_ROOT);
  return documents.length;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

const ALIASES = {
  stuco: ["student college", "student taught", "student-taught"],
  registration: ["register", "enroll", "enrollment"],
  minor: ["minors"],
  scholarship: ["financial aid", "tafawq", "tamaiyuz", "fafsa"],
  cross: ["cross-registration", "cross registration", "education city"],
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

function retrieveRelevantDocs(query, { limit = 2, maxChars = 5000, maxDocChars = 2500 } = {}) {
  if (!documents.length || !query?.trim()) {
    return [];
  }

  const queryLower = query.toLowerCase().trim();
  const queryTokens = expandQueryTokens(tokenize(query));

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

function buildContextBlock(docs) {
  if (!docs.length) return "";

  return docs
    .map((doc) => `[Source: scotty.qatar.cmu.edu — ${doc.topic} (${doc.file})]\n${doc.body}`)
    .join("\n\n");
}

module.exports = {
  loadKnowledgeBase,
  retrieveRelevantDocs,
  buildContextBlock,
};
