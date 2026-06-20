const MAX_REPLY_SNippet = 2500;

const ACTIVITY_SPEECH_HINTS = {
  quiz: "Invite them to work through the quiz questions and offer to explain any they find tricky.",
  flashcards: "Encourage them to flip through the flashcards and test themselves out loud.",
  whiteboard: "Walk them through the brainstorm clusters and ask what connection surprises them most.",
};

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
    return `I've put together flashcards on ${topic} from ${course}. Flip through them and say each answer out loud — that's how you'll remember it. Tell me which ones trip you up.`;
  }
  if (tutorActivity === "quiz") {
    return `Here's a quiz on ${topic}. Try each question before peeking at your notes. When you're stuck, ask me and we'll work through it together.`;
  }
  if (tutorActivity === "whiteboard") {
    return `Let's map out ${topic} on the whiteboard. Look at the clusters and see how the ideas connect. What stands out to you first?`;
  }
  return `Let's dig into ${topic} together. Read what I've prepared, then tell me what you'd like to go deeper on.`;
}

function cleanSpeechScript(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\*\*/g, "")
    .replace(/[`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function generateTutorSpeechScript(
  getChatReply,
  {
    reply,
    userQuery,
    tutorActivity = null,
    lectureTopic = "",
    courseName = "",
  },
  aiOptions
) {
  if (!reply?.trim()) return "";

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
  fallbackSpeechScript,
  generateTutorSpeechScript,
  cleanSpeechScript,
};
