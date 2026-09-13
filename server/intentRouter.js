const { hasContentKeywords } = require("./knowledgeBase");

const MENTAL_HEALTH_PATTERN =
  /\b(suicid|self[- ]harm|kill myself|want to die|hurting myself|mental health|struggling mentally|really struggling|counseling|therapist|therapy|caps-?q?|depress(?:ed|ion)|panic attack)\b/i;

const EMOTIONAL_PATTERN =
  /\b(stressed|overwhelmed|lonely|alone|anxious|can't sleep|cannot sleep|falling behind|i'?m so done|burned out|exhausted|sad|not okay|no one to (?:talk|hang))\b/i;

const TUTOR_PATTERN =
  /\b(explain|help me understand|walk me through|homework|teach me|what does .+ mean|how does .+ work)\b/i;

const CAMPUS_LIFE_PATTERN =
  /\b(tonight|bored|hang out|what to do|events?|club fair|food trucks?)\b/i;

const FINANCIAL_PATTERN =
  /\b(financial aid|scholarship|tuition|fafsa|grant|emergency loan)\b/i;

const REGISTRATION_PATTERN =
  /\b(register|registration|add\/drop|add drop|enrollment|stellic|waitlist)\b/i;

const CAREER_PATTERN =
  /\b(resume|internship|handshake|career|job search|cover letter)\b/i;

const INTERNATIONAL_PATTERN =
  /\b(visa|immigration|housing|qf housing|residence permit)\b/i;

function classifyIntent(query, appMode = "qa") {
  const text = String(query || "").trim();

  if (appMode === "tutor") {
    return { role: "teacher", topic: "academics", intent: "tutor" };
  }

  if (MENTAL_HEALTH_PATTERN.test(text)) {
    return { role: "emotional_support", topic: "mental_health", intent: "emotional_support" };
  }

  if (FINANCIAL_PATTERN.test(text)) {
    return { role: "campus_assistant", topic: "financial_aid", intent: "academic_fact" };
  }

  if (REGISTRATION_PATTERN.test(text)) {
    return { role: "campus_assistant", topic: "registration", intent: "academic_fact" };
  }

  if (CAREER_PATTERN.test(text)) {
    return { role: "campus_assistant", topic: "career", intent: "campus_life" };
  }

  if (INTERNATIONAL_PATTERN.test(text)) {
    return { role: "campus_assistant", topic: "international", intent: "academic_fact" };
  }

  if (hasContentKeywords(text)) {
    return { role: "campus_assistant", topic: "academics", intent: "academic_fact" };
  }

  if (TUTOR_PATTERN.test(text)) {
    return { role: "teacher", topic: "academics", intent: "tutor" };
  }

  if (CAMPUS_LIFE_PATTERN.test(text)) {
    return { role: "campus_assistant", topic: "campus_life", intent: "campus_life" };
  }

  if (EMOTIONAL_PATTERN.test(text)) {
    return { role: "emotional_support", topic: "academics", intent: "emotional_support" };
  }

  return { role: "campus_assistant", topic: "general", intent: "campus_life" };
}

function shouldSelectReferrals(intent) {
  if (!intent) return false;
  if (intent.topic === "mental_health") return true;
  if (intent.role === "emotional_support") return false;
  if (intent.intent === "tutor") return false;
  return true;
}

module.exports = {
  classifyIntent,
  shouldSelectReferrals,
};
