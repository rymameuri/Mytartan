/**
 * Saved answers for when the live model cannot be reached.
 * Wording is copied from data/key-facts.json so a demo does not invent figures.
 */

export const DEMO_ANSWERS = [
  {
    id: "tafawq-gpa",
    test: (text) => /tafawq/i.test(text) && /gpa|grade/i.test(text),
    answer: "TAFAWQ merit scholarship requires a cumulative GPA of 4.0.",
    source: "Financial Aid and Scholarship page",
    verified: "2026-05-07",
  },
  {
    id: "tafawq-fee",
    test: (text) => /tafawq/i.test(text) && /fee|cost|qar|pay/i.test(text),
    answer: "TAFAWQ scholarship application fee is QAR 183 (50 USD), paid upon application submission.",
    source: "Financial Aid and Scholarship page",
    verified: "2026-05-07",
  },
  {
    id: "tamaiyuz-gpa",
    test: (text) => /tamaiyuz/i.test(text) && /gpa|grade/i.test(text),
    answer: "TAMAIYUZ scholarship requires a cumulative GPA of 3.8 or higher.",
    source: "Financial Aid and Scholarship page",
    verified: "2026-05-07",
  },
  {
    id: "tamaiyuz-window",
    test: (text) => /tamaiyuz/i.test(text) && /when|deadline|date|open|window/i.test(text),
    answer: "TAMAIYUZ scholarship application cycle is open from 15 May 2026 until 5 June 2026.",
    source: "Financial Aid and Scholarship page",
    verified: "2026-05-07",
  },
  {
    id: "overload",
    test: (text) => /overload/i.test(text),
    answer:
      "Students may register for a course overload of up to 12 units with academic advisor approval. Overloads above 12 units require advisor approval and an S3 maximum-units adjustment (available no earlier than the Saturday after Registration Week).",
    source: "Course Overload page",
    verified: "2026-03-24",
  },
  {
    id: "cross-limit",
    test: (text) => /cross[-\s]?reg/i.test(text) && /how many|one course|limit|per semester/i.test(text),
    answer: "CMU-Q students may cross-register for one course per semester at another Education City university.",
    source: "Cross Registration page",
    verified: "2026-05-31",
  },
  {
    id: "cross-deadline",
    test: (text) => /cross[-\s]?reg/i.test(text) && /deadline|when|fall/i.test(text),
    answer: "Fall 2026 Education City cross-registration forms are accepted starting July 1, 2026. The submission deadline is August 1, 2026.",
    source: "Cross Registration page",
    verified: "2026-05-31",
  },
  {
    id: "housing",
    test: (text) => /housing|residence hall|dorm/i.test(text) && /how much|cost|fee|qar|semester/i.test(text),
    answer: "QF residence hall room costs QAR 10,100 per semester (or QAR 646 per week for Winter/Summer terms).",
    source: "QF Student Housing page",
    verified: "2026-06-24",
  },
  {
    id: "wifi",
    test: (text) => /wi-?fi|cmuq-secure|eduroam/i.test(text),
    answer:
      "CMU-Q Wi-Fi networks: CMUQ-SECURE (Andrew ID, preferred for affiliates), eduroam (visiting institution affiliates using AndrewID@andrew.cmu.edu), and CMUQ-GUEST (visitors; SMS PIN authentication, expires within 24 hours).",
    source: "Connect to WiFi page",
    verified: "2026-06-24",
  },
  {
    id: "caps",
    test: (text) => /caps|counseling|mental health/i.test(text) && /free|confidential|cost/i.test(text),
    answer:
      "CaPS-Q provides free, confidential mental health support to all CMU-Q students including individual therapy, crisis intervention, and walk-in sessions for urgent needs.",
    source: "CaPS-Q Services page",
    verified: "2026-06-24",
  },
];

export function matchDemoAnswer(question) {
  const text = String(question || "");
  return DEMO_ANSWERS.find((item) => item.test(text)) || null;
}

export function formatDemoReply(item) {
  return `${item.answer}\n\nVerified fact from the ${item.source}, checked ${item.verified}. The live model didn't answer, so this is the saved fact and not a generated reply.`;
}

export function assistantUnavailableMessage() {
  return "I can't reach the assistant service right now. Try a verified demo question, such as the TAFAWQ GPA requirement, campus Wi-Fi, or the course overload limit. Those still have a saved answer.";
}
