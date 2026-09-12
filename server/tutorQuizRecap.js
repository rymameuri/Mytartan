function formatQuizResultsSummary(results = []) {
  return results
    .map((item, index) => {
      const status = item.isCorrect ? "Correct" : "Incorrect";
      const picked = item.selectedText?.trim() || "(no answer)";
      const answer = item.correctText?.trim() || item.correct || "";
      const lines = [
        `${index + 1}. ${item.question}`,
        `Student chose: ${picked} (${status})`,
        `Correct answer: ${answer}`,
      ];
      if (item.explanation?.trim()) {
        lines.push(`Explanation: ${item.explanation.trim()}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function buildQuizRecapSystemPrompt({ lectureTopic, courseName }) {
  const topic = lectureTopic?.trim() || "this topic";
  const course = courseName?.trim() || "your course";

  return `You are Tartan Scotty, a CMU-Q course tutor. The student just finished a quiz in Studio on "${topic}" for ${course}.

Write TWO sections separated by exactly this delimiter on its own line:
---SPEECH---

SECTION 1 (before the delimiter): A written recap for the chat panel.
- 3–5 short paragraphs in plain English
- State their score and what it suggests about their understanding
- Name specific concepts they got right and where they struggled
- Give 1–2 concrete study suggestions tied to the missed questions
- Warm and encouraging, not generic praise
- No markdown, no bullet lists, no "Great job!"

SECTION 2 (after the delimiter): What Scotty says out loud.
- 3–4 short sentences, max 65 words total
- Conversational voice-only recap. Highlight score, one strength, one gap, one next step
- Do NOT read every question aloud
- Plain English only. No em dashes or ellipses.`;
}

function buildQuizRecapUserPrompt({ quizResults, lectureTopic }) {
  const { score, total, results = [] } = quizResults;
  const pct = total ? Math.round((score / total) * 100) : 0;
  const topic = lectureTopic?.trim() || "this topic";

  return `Topic: ${topic}
Score: ${score} / ${total} (${pct}%)

Question-by-question results:
${formatQuizResultsSummary(results)}

Write the chat recap, then ---SPEECH---, then the spoken script.`;
}

function parseQuizRecapResponse(text) {
  if (!text?.trim()) return { analysis: "", speech: "" };

  const parts = text.split(/\n---SPEECH---\n/i);
  if (parts.length >= 2) {
    return {
      analysis: parts[0].trim(),
      speech: parts.slice(1).join("\n---SPEECH---\n").trim(),
    };
  }

  const trimmed = text.trim();
  return { analysis: trimmed, speech: trimmed };
}

function fallbackQuizRecap({ quizResults, lectureTopic, courseName } = {}) {
  const { score = 0, total = 0, results = [] } = quizResults ?? {};
  const pct = total ? Math.round((score / total) * 100) : 0;
  const topic = lectureTopic?.trim() || "this topic";
  const course = courseName?.trim() || "your course";
  const missed = results.filter((item) => !item.isCorrect);

  let tone;
  if (pct >= 80) {
    tone = "You have a solid grasp of the core ideas.";
  } else if (pct >= 50) {
    tone = "You are on the right track, with a few concepts still worth revisiting.";
  } else {
    tone = "This quiz shows where to focus next. That is exactly what practice is for.";
  }

  const analysis = [
    `You scored ${score} out of ${total} (${pct}%) on the ${topic} quiz for ${course}. ${tone}`,
    missed.length
      ? `Review the ${missed.length} question${missed.length === 1 ? "" : "s"} you missed and read each explanation in the review panel. Try connecting those ideas back to your course materials.`
      : "You answered every question correctly. Try explaining one idea out loud to make sure you can teach it, not just recognize it.",
    "When you are ready, retake the quiz or ask me to walk through any question you want to understand more deeply.",
  ].join("\n\n");

  let speech = `You finished the quiz with ${score} out of ${total}. `;
  if (pct >= 80) {
    speech += "Nice work. You clearly understand most of this material.";
  } else if (pct >= 50) {
    speech += "Good effort. Let's tighten up the ideas you missed.";
  } else {
    speech += "Don't worry. Let's review the tricky parts together.";
  }
  if (missed.length) {
    speech += ` Focus on the ${missed.length} question${missed.length === 1 ? "" : "s"} you missed, then we can go deeper.`;
  } else {
    speech += " Ask me if you want to stretch into harder applications.";
  }

  return { analysis, speech };
}

function cleanAnalysisText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\*\*/g, "")
    .replace(/[`#]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanSpeechText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\*\*/g, "")
    .replace(/[`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function generateQuizRecap(
  getChatReply,
  { quizResults, lectureTopic = "", courseName = "" },
  aiOptions
) {
  if (!quizResults?.total) {
    return fallbackQuizRecap({ quizResults, lectureTopic, courseName });
  }

  try {
    const systemPrompt = buildQuizRecapSystemPrompt({ lectureTopic, courseName });
    const messages = [
      {
        role: "user",
        content: buildQuizRecapUserPrompt({ quizResults, lectureTopic }),
      },
    ];
    const raw = await getChatReply(systemPrompt, messages, {
      ...aiOptions,
      maxTokens: 450,
      temperature: 0.65,
    });
    const { analysis, speech } = parseQuizRecapResponse(raw);
    const fallback = fallbackQuizRecap({ quizResults, lectureTopic, courseName });
    const cleanedAnalysis = cleanAnalysisText(analysis) || fallback.analysis;
    const cleanedSpeech = cleanSpeechText(speech) || fallback.speech;
    return { analysis: cleanedAnalysis, speech: cleanedSpeech };
  } catch (err) {
    console.warn("[tutorQuizRecap] Could not generate quiz recap:", err.message);
    return fallbackQuizRecap({ quizResults, lectureTopic, courseName });
  }
}

module.exports = {
  buildQuizRecapSystemPrompt,
  buildQuizRecapUserPrompt,
  formatQuizResultsSummary,
  parseQuizRecapResponse,
  fallbackQuizRecap,
  generateQuizRecap,
};
