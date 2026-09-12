#!/usr/bin/env node
/**
 * Quick tone sanity check for Scotty's persona across chat modes.
 *
 * Sends one casual, one serious, and tutor samples (including Studio
 * introduction/lecture speech modes) and prints responses for demo prep.
 *
 * Usage: node scripts/test-tone.js
 * Requires AI_GATEWAY_BASE_URL + CLAUDE_API_KEY or ANTHROPIC_API_KEY in server/.env
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "server", ".env") });

const { loadKnowledgeBase, retrieveRelevantDocsAsync } = require("../server/knowledgeBase");
const { buildTutorSystemPrompt } = require("../server/tutorPrompt");
const { generateTutorSpeechScript } = require("../server/tutorSpeech");
const {
  buildSystemPrompt,
  getChatReply,
  hasAiKey,
  isSmallTalk,
  LOW_CONFIDENCE_REPLY,
} = require("../server/server");

const TUTOR_COURSE_CONTEXT = {
  courseName: "Fundamentals of Programming",
  courseCode: "15-112",
  instructor: "Dr. Sample Faculty",
  semester: "Spring 2026",
  syllabusText:
    "Week 6: Recursion — factorial, Fibonacci, base cases, recursive steps, tracing calls.",
};

const MOCK_FLASHCARD_REPLY = `Term: What is the base case in recursion?
Answer: The simplest input where the function returns directly without calling itself.

Term: Why do we need a base case?
Answer: Without it, recursive calls never stop and the program overflows the stack.`;

const MOCK_QUIZ_QUESTION =
  "What happens when a recursive function has no base case?";
const MOCK_QUIZ_CHOICES = [
  "It runs faster",
  "It causes a stack overflow",
  "It returns zero",
  "It compiles with a warning",
];

const SAMPLES = [
  {
    label: "casual — general chat",
    mode: "chat",
    query: "Hey Scotty, anything fun going on around campus this week?",
    smallTalk: false,
  },
  {
    label: "serious — financial aid (qa)",
    mode: "qa",
    query: "I'm really stressed about my financial aid. Who should I talk to if my scholarship requirements change?",
    retrieveKb: true,
  },
  {
    label: "academic — recursion homework (tutor)",
    mode: "tutor",
    query: "Can you just give me the answer to question 3 on the recursion homework?",
    courseContext: TUTOR_COURSE_CONTEXT,
  },
];

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function containsAny(text, phrases) {
  const lower = text.toLowerCase();
  return phrases.some((phrase) => lower.includes(phrase.toLowerCase()));
}

function endsWithQuestion(text) {
  return /\?\s*$/.test(text.trim());
}

async function runTutorSpeechSample({ label, options, reply, checks }) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Sample: ${label}`);

  const script = await generateTutorSpeechScript(getChatReply, options, {
    maxTokens: 180,
    temperature: 0.3,
  });

  console.log(`\nScotty (speech):\n${script.trim()}\n`);

  for (const check of checks) {
    const pass = check.test(script);
    console.log(`${pass ? "PASS" : "FAIL"} — ${check.name}`);
    if (!pass) process.exitCode = 1;
  }
}

async function runTutorLectureChatSample() {
  const label = "tutor lecture — help with flashcard (chat reply)";
  const studioItemContext = {
    activity: "flashcards",
    itemType: "flashcard",
    itemIndex: 0,
    itemLabel: "Flashcard 1 of 2",
    concept: "base case in recursion",
    term: "What is the base case in recursion?",
    answer: "The simplest input where the function returns directly without calling itself.",
    topic: "Recursion",
  };

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Sample: ${label}`);

  const systemPrompt = buildTutorSystemPrompt(TUTOR_COURSE_CONTEXT, {
    tutorActivity: "flashcards",
    lectureTopic: "Recursion",
    speechMode: "lecture",
    studioItemContext,
  });

  const reply = await getChatReply(
    systemPrompt,
    [{ role: "user", content: "Help me understand this flashcard." }],
    { maxTokens: 220, temperature: 0.3 }
  );

  console.log(`\nScotty (chat):\n${reply.trim()}\n`);

  const checks = [
    {
      name: "does not quote flashcard term verbatim",
      test: (text) => !text.includes("What is the base case in recursion?"),
    },
    {
      name: "does not quote flashcard answer verbatim",
      test: (text) =>
        !text.includes(
          "The simplest input where the function returns directly without calling itself."
        ),
    },
    {
      name: "ends with a question back to the student",
      test: endsWithQuestion,
    },
    {
      name: "teaches recursion concept (mentions base case or stopping)",
      test: (text) => /base case|stop|recursive/i.test(text),
    },
  ];

  for (const check of checks) {
    const pass = check.test(reply);
    console.log(`${pass ? "PASS" : "FAIL"} — ${check.name}`);
    if (!pass) process.exitCode = 1;
  }
}

async function runSample(sample) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Sample: ${sample.label}`);
  console.log(`Mode:   ${sample.mode}`);
  console.log(`Query:  ${sample.query}`);

  const docs = sample.retrieveKb
    ? await retrieveRelevantDocsAsync(sample.query, { limit: 2 })
    : [];

  const systemPrompt = buildSystemPrompt(sample.mode, docs, {
    smallTalk: Boolean(sample.smallTalk),
    courseContext: sample.courseContext || null,
  });

  const reply = await getChatReply(
    systemPrompt,
    [{ role: "user", content: sample.query }],
    { maxTokens: 220, temperature: 0.3 }
  );

  console.log(`\nScotty:\n${reply.trim()}\n`);
}

async function runSmallTalkRegressionChecks() {
  console.log(`\n${"=".repeat(60)}`);
  console.log("Small talk regression (hallucination guardrail bypass)");

  const smallTalkCases = ["how are you", "hello how are you", "how's it going", "thanks", "good morning"];
  for (const query of smallTalkCases) {
    const classified = isSmallTalk(query);
    console.log(`\nQuery: ${query}`);
    console.log(`isSmallTalk: ${classified ? "yes" : "no"}`);
    const pass = classified === true;
    console.log(`${pass ? "PASS" : "FAIL"} — classified as small talk`);
    if (!pass) process.exitCode = 1;
  }

  const campusCases = ["deadlines?", "financial aid?"];
  for (const query of campusCases) {
    const classified = isSmallTalk(query);
    console.log(`\nQuery: ${query}`);
    console.log(`isSmallTalk: ${classified ? "yes" : "no"}`);
    const pass = classified === false;
    console.log(`${pass ? "PASS" : "FAIL"} — not classified as small talk`);
    if (!pass) process.exitCode = 1;
  }

  const apiBase = process.env.TEST_API_BASE || "http://localhost:3001";
  const unanswerableQuery = "heygen xyzzy quuxington";

  for (const query of smallTalkCases) {
    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: query }],
          mode: "chat",
        }),
      });
      const data = await res.json();
      const pass =
        res.ok &&
        data.reply !== LOW_CONFIDENCE_REPLY &&
        !/don't have that information/i.test(data.reply || "") &&
        !/not confident I have accurate information/i.test(data.reply || "");
      console.log(`\nAPI "${query}": ${pass ? "PASS" : "FAIL"} — no KB fallback`);
      if (!pass) process.exitCode = 1;
    } catch (err) {
      console.log(`\nAPI "${query}": SKIP — server not reachable (${err.message})`);
    }
  }

  try {
    const res = await fetch(`${apiBase}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: unanswerableQuery }],
        mode: "qa",
      }),
    });
    const data = await res.json();
    const pass =
      res.ok && /don't have that one|not totally sure I have this right/i.test(
        data.reply || ""
      );
    console.log(`\nAPI unanswerable campus query: ${pass ? "PASS" : "FAIL"} — fallback triggered`);
    if (!pass) process.exitCode = 1;
  } catch (err) {
    console.log(`\nAPI unanswerable campus query: SKIP — server not reachable (${err.message})`);
  }
}

async function main() {
  const docCount = loadKnowledgeBase();
  console.log("Scotty persona tone test");
  console.log(`Knowledge base: ${docCount} chunks loaded`);

  if (!hasAiKey()) {
    console.error(
      "\nNo AI API key configured. Add AI_GATEWAY_BASE_URL + CLAUDE_API_KEY, or ANTHROPIC_API_KEY, in server/.env"
    );
    process.exit(1);
  }

  for (const sample of SAMPLES) {
    await runSample(sample);
  }

  await runSmallTalkRegressionChecks();

  await runTutorSpeechSample({
    label: "tutor introduction — flashcards generated (speech)",
    options: {
      reply: MOCK_FLASHCARD_REPLY,
      userQuery: "Give me flashcards on Recursion",
      tutorActivity: "flashcards",
      lectureTopic: "Recursion",
      courseName: TUTOR_COURSE_CONTEXT.courseName,
      speechMode: "introduction",
    },
    checks: [
      {
        name: "introduction is brief (≤ 45 words)",
        test: (text) => wordCount(text) <= 45,
      },
      {
        name: "does not read flashcard term aloud",
        test: (text) => !containsAny(text, ["base case in recursion", "Term:", "Answer:"]),
      },
      {
        name: "invites student engagement",
        test: (text) => /flashcard|look|try|tell me|ask/i.test(text),
      },
    ],
  });

  await runTutorSpeechSample({
    label: "tutor lecture — help with quiz question (speech)",
    options: {
      reply:
        "Think of the base case as the emergency brake on a recursive train — without it, calls keep stacking until the stack overflows. For factorial, n=0 or n=1 is where you stop. Can you name a base case for Fibonacci?",
      userQuery: "Help me with question 2",
      tutorActivity: "quiz",
      lectureTopic: "Recursion",
      courseName: TUTOR_COURSE_CONTEXT.courseName,
      speechMode: "lecture",
      studioItemContext: {
        activity: "quiz",
        itemType: "quiz_question",
        itemIndex: 1,
        itemLabel: "Quiz question 2 of 5",
        concept: "missing base case in recursion",
        questionText: MOCK_QUIZ_QUESTION,
        topic: "Recursion",
      },
      courseContextBlock: TUTOR_COURSE_CONTEXT.syllabusText,
    },
    checks: [
      {
        name: "does not read quiz question verbatim",
        test: (text) => !text.includes(MOCK_QUIZ_QUESTION),
      },
      {
        name: "does not list quiz choices",
        test: (text) => !containsAny(text, MOCK_QUIZ_CHOICES),
      },
      {
        name: "ends with a Socratic question",
        test: endsWithQuestion,
      },
    ],
  });

  await runTutorLectureChatSample();

  console.log(`${"─".repeat(60)}`);
  console.log("Done. Scan replies for tone; tutor speech checks are marked PASS/FAIL above.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
