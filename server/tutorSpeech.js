const MAX_REPLY_SNIPPET = 2500;

const SPEECH_MODES = {
  introduction: "introduction",
  lecture: "lecture",
};

const ACTIVITY_SPEECH_HINTS = {
  quiz: "Tell them the quiz is ready in Studio. Invite them to try each question first, then ask you for hints — do not read any question or answer aloud.",
  flashcards:
    "Tell them flashcards are ready in Studio. Encourage them to quiz themselves and ask you when stuck — never read card terms or answers aloud.",
  whiteboard:
    "Tell them the idea map is in Studio. Invite them to explore the clusters and share what connections they notice — do not read bullet lists aloud.",
};

function normalizeSpeechMode({ speechMode, studioGeneration = false } = {}) {
  if (speechMode === SPEECH_MODES.introduction || speechMode === SPEECH_MODES.lecture) {
    return speechMode;
  }
  if (studioGeneration) return SPEECH_MODES.introduction;
  return null;
}

function buildIntroductionPrompt({ tutorActivity, lectureTopic, courseName }) {
  const topic = lectureTopic?.trim() || "this topic";
  const course = courseName?.trim() || "your course";
  const activityHint = ACTIVITY_SPEECH_HINTS[tutorActivity] || ACTIVITY_SPEECH_HINTS.whiteboard;

  return `You write ONLY what Scotty says out loud immediately after preparing a Studio learning tool for a student.
Speech mode: INTRODUCTION — the student can already see the full content in the Studio panel.

RULES:
- 1–2 short sentences, max 35 words total
- Summarize what was made (quiz, flashcards, or whiteboard map) and invite engagement
- Sound warm, confident, conversational — like a tutor handing off materials
- ${activityHint}
- Plain English. No markdown. No lists. No "Great question!"
- Never quote, list, or read flashcard text, quiz questions, choices, or whiteboard bullets

Context: ${course}, topic "${topic}".`;
}

function buildLectureSpeechPrompt({
  tutorActivity,
  lectureTopic,
  courseName,
  studioItemContext = null,
  courseContextBlock = "",
}) {
  const topic = lectureTopic?.trim() || studioItemContext?.topic?.trim() || "this topic";
  const course = courseName?.trim() || "your course";
  const itemBlock = formatStudioItemContextForSpeech(studioItemContext);

  return `You write ONLY the spoken words Scotty (a CMU-Q course tutor) says out loud to a student.
Speech mode: LECTURE — the student asked for help with a specific Studio item they can already see on screen.

RULES:
- 3–5 short sentences, max 75 words total
- The student can see the flashcard, quiz question, or whiteboard node — NEVER repeat its exact wording
- Teach the underlying concept with context and a brief example, like a professor at a whiteboard
- Use a different example or framing than what is shown on screen
- End with one Socratic check-in question that nudges the student to articulate the idea in their own words
- Plain English only. No markdown, no lists, no "Great question!", no Scottish slang
- Do NOT read the on-screen tutoring response verbatim — distill it into natural speech

Context: ${course}, topic "${topic}".
${itemBlock ? `\nSTUDIO ITEM (for grounding — do not quote aloud):\n${itemBlock}` : ""}
${courseContextBlock ? `\nCOURSE MATERIALS (stay grounded in the syllabus):\n${courseContextBlock}` : ""}`;
}

function formatStudioItemContextForSpeech(studioItemContext) {
  if (!studioItemContext || typeof studioItemContext !== "object") return "";

  const lines = [];
  if (studioItemContext.activity) lines.push(`Activity: ${studioItemContext.activity}`);
  if (studioItemContext.itemLabel) lines.push(`Item: ${studioItemContext.itemLabel}`);
  if (studioItemContext.concept) lines.push(`Learning objective: ${studioItemContext.concept}`);
  if (studioItemContext.clusterTitle) lines.push(`Cluster theme: ${studioItemContext.clusterTitle}`);
  if (Number.isFinite(studioItemContext.itemIndex)) {
    lines.push(`Item index: ${studioItemContext.itemIndex + 1}`);
  }
  return lines.join("\n");
}

function buildSpeechSystemPrompt({ tutorActivity, lectureTopic, courseName }) {
  const topic = lectureTopic?.trim() || "this topic";
  const course = courseName?.trim() || "your course";
  const activityHint = ACTIVITY_SPEECH_HINTS[tutorActivity] || "Guide them through the material like a supportive tutor.";

  return `You write ONLY the spoken words Scotty (a CMU-Q course tutor) says out loud to a student.
This is NOT shown on screen — it is voice-only. Sound like a real teacher talking to one student.

RULES:
- 2–4 short sentences, max 55 words total
- Warm, encouraging, conversational — never read lists, flashcards, or quiz items aloud
- Teach and orient: name the topic, highlight one key idea, invite the student to engage
- ${activityHint}
- Plain English only. No markdown, no "Great question!", no Scottish slang
- Do NOT repeat the full tutoring response verbatim

Context: ${course}, topic "${topic}".`;
}

function buildLectureSpeechUserPrompt({ userQuery, reply, studioItemContext }) {
  const itemNote = formatStudioItemContextForSpeech(studioItemContext);
  return `Student asked: ${userQuery || "(help with a Studio item)"}

On-screen tutoring response (do NOT read this aloud — teach the concept naturally):
${truncate(reply, MAX_REPLY_SNIPPET)}
${itemNote ? `\nStudio item context:\n${itemNote}` : ""}

Write what Scotty says out loud (lecture mode — concept teaching + Socratic question at the end):`;
}

function buildSpeechUserPrompt({ userQuery, reply }) {
  return `Student asked: ${userQuery || "(follow-up)"}

Tutoring response shown on screen (do NOT read this aloud — react to it naturally):
${truncate(reply, MAX_REPLY_SNIPPET)}

Write what Scotty says out loud:`;
}

function truncate(text, max) {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function fallbackIntroductionScript({ tutorActivity, lectureTopic, courseName }) {
  const topic = lectureTopic?.trim() || "this topic";

  if (tutorActivity === "flashcards") {
    return `I put together some flashcards on ${topic} — take a look and tell me if any of them trip you up.`;
  }
  if (tutorActivity === "quiz") {
    return `I've built a quiz on ${topic} in Studio. Work through it at your own pace, and ask me when you want a hint.`;
  }
  if (tutorActivity === "whiteboard") {
    return `I've mapped the big ideas for ${topic} on the whiteboard. Scan the clusters and tell me what you'd explore first.`;
  }
  return `Your study materials on ${topic} are ready in Studio — dive in and let me know where you'd like help.`;
}

function fallbackLectureScript({ lectureTopic, studioItemContext }) {
  const topic = lectureTopic?.trim() || studioItemContext?.topic?.trim() || "this topic";
  const concept = studioItemContext?.concept?.trim();
  if (concept) {
    return `Let's unpack ${concept} — it's really about how the pieces fit together in ${topic}. Can you walk me through what you think is happening here in your own words?`;
  }
  return `Let's work through this ${topic} idea together — I'll explain the concept behind what you're looking at. What part feels unclear so far?`;
}

function fallbackSpeechScript({ tutorActivity, lectureTopic, courseName }) {
  return fallbackIntroductionScript({ tutorActivity, lectureTopic, courseName });
}

function cleanSpeechScript(text, { strict = false } = {}) {
  if (!text || typeof text !== "string") return "";
  const cleaned = text
    .replace(/\*\*/g, "")
    .replace(/[`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/(?:Front|Back|Term|Answer|Cluster)\s*:/i.test(cleaned)) return "";
  if (strict && cleaned.split(/\s+/).length > 90) {
    return `${cleaned.split(/\s+/).slice(0, 75).join(" ")}…`;
  }
  return cleaned;
}

async function generateTutorSpeechScript(
  getChatReply,
  {
    reply,
    userQuery,
    tutorActivity = null,
    lectureTopic = "",
    courseName = "",
    studioGeneration = false,
    speechMode = null,
    studioItemContext = null,
    courseContextBlock = "",
  },
  aiOptions
) {
  const mode = normalizeSpeechMode({ speechMode, studioGeneration });

  if (mode === SPEECH_MODES.introduction) {
    try {
      const systemPrompt = buildIntroductionPrompt({
        tutorActivity,
        lectureTopic,
        courseName,
      });
      const script = await getChatReply(
        systemPrompt,
        [{ role: "user", content: "Write Scotty's brief introduction for the student." }],
        { ...aiOptions, maxTokens: 80, temperature: 0.65 }
      );
      const cleaned = cleanSpeechScript(script, { strict: true });
      if (cleaned) return cleaned;
    } catch (err) {
      console.warn("[tutorSpeech] Could not generate introduction script:", err.message);
    }
    return fallbackIntroductionScript({ tutorActivity, lectureTopic, courseName });
  }

  if (mode === SPEECH_MODES.lecture) {
    if (!reply?.trim()) {
      return fallbackLectureScript({ lectureTopic, studioItemContext });
    }

    try {
      const systemPrompt = buildLectureSpeechPrompt({
        tutorActivity,
        lectureTopic,
        courseName,
        studioItemContext,
        courseContextBlock,
      });
      const messages = [
        {
          role: "user",
          content: buildLectureSpeechUserPrompt({ userQuery, reply, studioItemContext }),
        },
      ];
      const script = await getChatReply(systemPrompt, messages, {
        ...aiOptions,
        maxTokens: 180,
        temperature: 0.7,
      });
      const cleaned = cleanSpeechScript(script);
      if (cleaned) return cleaned;
    } catch (err) {
      console.warn("[tutorSpeech] Could not generate lecture script:", err.message);
    }
    return fallbackLectureScript({ lectureTopic, studioItemContext });
  }

  if (!reply?.trim()) return "";

  if (
    /(?:Front|Back|Term|Answer|Cluster)\s*:/i.test(reply) ||
    (/\d+[.)]\s/.test(reply) && /Correct:/i.test(reply))
  ) {
    return fallbackIntroductionScript({ tutorActivity, lectureTopic, courseName });
  }

  try {
    const systemPrompt = buildSpeechSystemPrompt({ tutorActivity, lectureTopic, courseName });
    const messages = [
      {
        role: "user",
        content: buildSpeechUserPrompt({ userQuery, reply }),
      },
    ];
    const script = await getChatReply(systemPrompt, messages, {
      ...aiOptions,
      maxTokens: 120,
      temperature: 0.7,
    });
    const cleaned = cleanSpeechScript(script);
    if (cleaned) return cleaned;
  } catch (err) {
    console.warn("[tutorSpeech] Could not generate speech script:", err.message);
  }

  return fallbackSpeechScript({ tutorActivity, lectureTopic, courseName });
}

module.exports = {
  SPEECH_MODES,
  buildSpeechSystemPrompt,
  buildSpeechUserPrompt,
  buildIntroductionPrompt,
  buildStudioOrientationPrompt: buildIntroductionPrompt,
  buildLectureSpeechPrompt,
  fallbackSpeechScript,
  fallbackIntroductionScript,
  fallbackLectureScript,
  generateTutorSpeechScript,
  cleanSpeechScript,
  normalizeSpeechMode,
};
