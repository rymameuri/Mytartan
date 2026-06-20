const MAX_REPLY_SNippet = 2500;

const ACTIVITY_SPEECH_HINTS = {
  quiz: "Tell them the quiz is ready in Studio. Invite them to try each question first, then ask you for hints — do not read any question or answer aloud.",
  flashcards:
    "Tell them flashcards are ready in Studio. Encourage them to quiz themselves and ask you when stuck — never read card terms or answers aloud.",
  whiteboard:
    "Tell them the idea map is in Studio. Invite them to explore the clusters and share what connections they notice — do not read bullet lists aloud.",
};

function buildStudioOrientationPrompt({ tutorActivity, lectureTopic, courseName }) {
  const topic = lectureTopic?.trim() || "this topic";
  const course = courseName?.trim() || "your course";
  const activityHint = ACTIVITY_SPEECH_HINTS[tutorActivity] || ACTIVITY_SPEECH_HINTS.whiteboard;

  return `You write ONLY what Scotty says out loud after preparing a Studio learning tool for a student.
The full content is visible in the Studio panel — your job is to ORIENT and COACH, not present or read the material.

RULES:
- 2–3 short sentences, max 50 words
- Sound like a tutor who already knows the material — warm, confident, conversational
- ${activityHint}
- Plain English. No markdown. No lists. No "Great question!"
- Never quote flashcard text, quiz questions, or whiteboard bullets

Context: ${course}, topic "${topic}".`;
}

function truncate(text, max) {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
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

function buildSpeechUserPrompt({ userQuery, reply }) {
  return `Student asked: ${userQuery || "(follow-up)"}

Tutoring response shown on screen (do NOT read this aloud — react to it naturally):
${truncate(reply, MAX_REPLY_SNippet)}

Write what Scotty says out loud:`;
}

function fallbackSpeechScript({ tutorActivity, lectureTopic, courseName }) {
  const topic = lectureTopic?.trim() || "this topic";
  const course = courseName?.trim() || "your course";

  if (tutorActivity === "flashcards") {
    return `Your flashcards on ${topic} are ready in Studio. Try each one from memory first — when something's fuzzy, flip it and then ask me to walk you through the idea.`;
  }
  if (tutorActivity === "quiz") {
    return `I've built a quiz on ${topic} in Studio. Work through it at your own pace, and ask me when you want a hint or a deeper explanation.`;
  }
  if (tutorActivity === "whiteboard") {
    return `I've mapped the big ideas for ${topic} on the whiteboard in Studio. Scan the clusters, pick one that interests you, and tell me what you'd explore first.`;
  }
  return `Let's dig into ${topic} together. Tell me what you'd like to understand better and we'll work through it step by step.`;
}

function cleanSpeechScript(text) {
  if (!text || typeof text !== "string") return "";
  const cleaned = text
    .replace(/\*\*/g, "")
    .replace(/[`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/(?:Front|Back|Term|Answer|Cluster)\s*:/i.test(cleaned)) return "";
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
  },
  aiOptions
) {
  if (studioGeneration) {
    try {
      const systemPrompt = buildStudioOrientationPrompt({
        tutorActivity,
        lectureTopic,
        courseName,
      });
      const script = await getChatReply(
        systemPrompt,
        [{ role: "user", content: "Write Scotty's spoken orientation for the student." }],
        { ...aiOptions, maxTokens: 100, temperature: 0.65 }
      );
      const cleaned = cleanSpeechScript(script);
      if (cleaned) return cleaned;
    } catch (err) {
      console.warn("[tutorSpeech] Could not generate studio orientation:", err.message);
    }
    return fallbackSpeechScript({ tutorActivity, lectureTopic, courseName });
  }

  if (!reply?.trim()) return "";

  if (
    /(?:Front|Back|Term|Answer|Cluster)\s*:/i.test(reply) ||
    (/\d+[.)]\s/.test(reply) && /Correct:/i.test(reply))
  ) {
    return fallbackSpeechScript({ tutorActivity, lectureTopic, courseName });
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
  buildSpeechSystemPrompt,
  buildSpeechUserPrompt,
  buildStudioOrientationPrompt,
  fallbackSpeechScript,
  generateTutorSpeechScript,
  cleanSpeechScript,
};
