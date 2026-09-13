const fs = require("fs");
const path = require("path");

const DEFAULT_MAP_PATH = path.join(__dirname, "..", "knowledge-base", "contacts", "contact-map.json");
const DEFAULT_LIMIT = 3;

const MAJOR_ALIASES = [
  { id: "cs", pattern: /\b(cs|computer science|artificial intelligence|\bai\b)\b/i },
  { id: "is", pattern: /\b(is|information systems)\b/i },
  { id: "ba", pattern: /\b(ba|business administration|business)\b/i },
  { id: "bio", pattern: /\b(bio|biological sciences|biology)\b/i },
];

let cachedMap = null;

function loadContactMap(filePath = DEFAULT_MAP_PATH) {
  if (filePath === DEFAULT_MAP_PATH && cachedMap) return cachedMap;
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  const contacts = Array.isArray(parsed.contacts) ? parsed.contacts : [];
  if (filePath === DEFAULT_MAP_PATH) cachedMap = contacts;
  return contacts;
}

function resetContactMapCache() {
  cachedMap = null;
}

function normalizeMajor(major) {
  const text = String(major || "").trim();
  if (!text) return "general";
  if (/^cs$/i.test(text)) return "cs";
  if (/^is$/i.test(text)) return "is";
  if (/^ba$/i.test(text)) return "ba";
  for (const alias of MAJOR_ALIASES) {
    if (alias.pattern.test(text)) return alias.id;
  }
  return "general";
}

function yearBandFromGraduationDate(graduationDate, now = new Date()) {
  if (!graduationDate) return "unknown";
  const match = String(graduationDate).match(/(20\d{2})/);
  if (!match) return "unknown";
  const gradYear = Number(match[1]);
  const academicStartYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const yearsOut = gradYear - academicStartYear;
  if (yearsOut >= 4) return "freshman";
  if (yearsOut === 3) return "sophomore";
  if (yearsOut === 2) return "junior";
  if (yearsOut === 1) return "senior";
  return "unknown";
}

function matchesStudent(contact, major, yearBand) {
  const majors = contact.majors?.length ? contact.majors : ["any"];
  const majorOk = majors.includes("any") || majors.includes(major);
  if (!majorOk) return false;

  const years = contact.yearBands?.length ? contact.yearBands : ["any"];
  if (years.includes("any")) return true;
  return yearBand !== "unknown" && years.includes(yearBand);
}

function scoreContact(contact, major, yearBand) {
  const majors = contact.majors?.length ? contact.majors : ["any"];
  let score = contact.priority || 0;
  if (major !== "general" && majors.includes(major)) score += 20;
  if (majors.includes("any")) score += 4;
  if (yearBand !== "unknown" && (contact.yearBands || []).includes(yearBand)) score += 8;
  return score;
}

function selectContacts({
  profile = {},
  topic,
  limit = DEFAULT_LIMIT,
  now = new Date(),
  contacts,
} = {}) {
  const pool = contacts || loadContactMap();
  const major = normalizeMajor(profile.major);
  const yearBand = yearBandFromGraduationDate(profile.graduationDate, now);
  const topicKey = topic || "academics";

  const matches = pool
    .filter((contact) => (contact.topics || []).includes(topicKey))
    .filter((contact) => matchesStudent(contact, major, yearBand))
    .map((contact) => ({
      contact,
      score: scoreContact(contact, major, yearBand),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || (b.contact.priority || 0) - (a.contact.priority || 0))
    .map((row) => row.contact);

  const majorSpecific = matches.filter((contact) => (contact.majors || []).includes(major));
  const ranked = major !== "general" && majorSpecific.length
    ? [...majorSpecific, ...matches.filter((contact) => !(contact.majors || []).includes(major))]
    : matches;

  return ranked.slice(0, Math.max(1, Math.min(limit, DEFAULT_LIMIT)));
}

function formatReferralBlock(contacts) {
  if (!contacts?.length) return "";
  const lines = contacts.map((contact) => {
    const email = contact.email ? ` — ${contact.email}` : "";
    const when = contact.when ? ` (${contact.when})` : "";
    return `- ${contact.name}, ${contact.role}${email}${when}`;
  });
  return [
    "PERSONA — TAILORED REFERRALS",
    "Use ONLY these people if you need to refer the student. Do not invent emails, phones, or extra offices. Do not list a directory.",
    ...lines,
  ].join("\n");
}

function formatContactLine(contact) {
  if (contact.email) {
    return `${contact.name} (${contact.role}) at ${contact.email}`;
  }
  return `${contact.name} (${contact.role})`;
}

function buildUnknownFactReply(contacts = []) {
  if (!contacts.length) {
    return "I don't have the official answer for that one. Your advisor or the Education Office would. What are you trying to get done?";
  }
  const chosen = contacts.slice(0, DEFAULT_LIMIT);
  const first = formatContactLine(chosen[0]);
  if (chosen.length === 1) {
    return `I don't have the official answer for that one. ${first} is the right person to ask.`;
  }
  const rest = chosen.slice(1).map(formatContactLine).join(", or ");
  return `I don't have the official answer for that one. Start with ${first}. If you need a second stop, ${rest}.`;
}

function buildSupportiveReferralReply(contacts = []) {
  if (!contacts.length) {
    return "I'm here with you. This sounds heavy, and you don't have to carry it alone. If you want a real person on campus, Student Affairs can point you to counseling. We can also just stay in this chat.";
  }
  const first = formatContactLine(contacts[0]);
  return `I'm here with you. I'm not a counselor, but ${first} is. You can email them when you're ready. We can also just stay in this chat.`;
}

function buildAcademicSupportReply(contacts = []) {
  if (!contacts.length) {
    return "That's a lot. You don't have to solve the whole week tonight. Which exam is first, and we'll pick one 45-minute block.";
  }
  const first = formatContactLine(contacts[0]);
  return `That's a lot. You don't have to solve the whole week tonight. If you want a campus person after we pick the first exam, start with ${first}. Not a pile of offices.`;
}

module.exports = {
  loadContactMap,
  resetContactMapCache,
  normalizeMajor,
  yearBandFromGraduationDate,
  selectContacts,
  formatReferralBlock,
  buildUnknownFactReply,
  buildSupportiveReferralReply,
  buildAcademicSupportReply,
};
