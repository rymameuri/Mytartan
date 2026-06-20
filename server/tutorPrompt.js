const MAX_SYLLABUS_CHARS = 12000;
const MAX_NOTES_CHARS = 2000;
const MAX_MATERIAL_CHARS = 3000;

function truncate(text, max) {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}\n\n[…truncated for length]`;
}

function formatCourseContextBlock(courseContext) {
  if (!courseContext) return "";

  const lines = [];
  if (courseContext.courseName) lines.push(`Course: ${courseContext.courseName}`);
  if (courseContext.courseCode) lines.push(`Course code: ${courseContext.courseCode}`);
  if (courseContext.instructor) lines.push(`Instructor: ${courseContext.instructor}`);
  if (courseContext.semester) lines.push(`Semester: ${courseContext.semester}`);

  const details = [];
  if (courseContext.syllabusText?.trim()) {
    details.push(
      `SYLLABUS:\n${truncate(courseContext.syllabusText, MAX_SYLLABUS_CHARS)}`
    );
  }
  if (courseContext.additionalNotes?.trim()) {
    details.push(
      `ADDITIONAL COURSE NOTES:\n${truncate(courseContext.additionalNotes, MAX_NOTES_CHARS)}`
    );
  }

  const materials = (courseContext.materials ?? []).filter((item) => item?.content?.trim());
  if (materials.length) {
    const materialBlocks = materials.map(
      (item) => `[${item.title}]\n${truncate(item.content, MAX_MATERIAL_CHARS)}`
    );
    details.push(`COURSE MATERIALS:\n${materialBlocks.join("\n\n")}`);
  }

  const approvedContributions = (courseContext.contributions ?? []).filter(
    (entry) => entry?.content?.trim()
  );
  if (approvedContributions.length) {
    const contributionLines = approvedContributions
      .slice(-20)
      .map((entry) => `- Student: ${entry.content.trim()}`);
    details.push(`STUDENT QUESTIONS & NOTES (from prior sessions):\n${contributionLines.join("\n")}`);
  }

  if (!lines.length && !details.length) return "";

  return [
    lines.length ? lines.join("\n") : null,
    details.length ? details.join("\n\n") : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const TUTOR_BASE_PROMPT = `You are Tartan Scotty, CMU-Q's student assistant acting as a personal course tutor.

Your job is to help the student understand their course material — not to do their work for them.

TUTORING RULES:
- Use the student's syllabus, uploaded materials, and notes as your primary reference.
- Guide with questions and hints. Ask what they already know before explaining.
- Break problems and concepts into small steps. Check understanding along the way.
- Do NOT give full homework, quiz, or exam answers. Help them reach the answer themselves.
- When relevant, point to syllabus sections (weeks, units, readings) so the student knows where to study.
- If a question is outside the course scope, say so clearly.
- Speak in clear, natural English. No Scottish dialect or mascot slang.
- Never open with filler like "Great question!" Be warm but get to the point fast.
- Do NOT use markdown formatting — no asterisks, bold, italics, or backticks. Write plain text only.`;

const CONVERSATIONAL_TUTORING = `

CONVERSATION MODE (student is talking with you — NOT generating Studio content):
- You know their course materials deeply. Teach by synthesizing ideas, not by reciting notes, lists, flashcards, or whiteboard bullets verbatim.
- Guide with questions, short explanations, and connections between concepts. Help them think, not memorize lines.
- If they are studying flashcards or a whiteboard in the Studio panel, coach them through it — ask what they think, give hints, clarify misconceptions. Never read card text or cluster bullets aloud word-for-word.
- Keep replies focused: usually 2–5 sentences unless they ask for more detail.`;

const STUDIO_OUTPUT_RULES = `

STUDIO OUTPUT RULES (this response populates a Studio panel — the student reads/interacts there):
- Output ONLY the structured artifact below. No introduction, no wrap-up, no "Here are your flashcards" or similar.
- Do NOT tutor conversationally in this message — just produce clean structured data from course materials.
- Start immediately with the first structured item.`;

const ACTIVITY_PROMPTS = {
  quiz: (topic) => `
ACTIVITY: Quiz (Studio panel)
Topic: "${topic}"
Generate exactly 5 multiple-choice questions based ONLY on their course materials.
${STUDIO_OUTPUT_RULES}

Format each question EXACTLY like this (plain text, no markdown):

1. [question text]
A) [option]
B) [option]
C) [option]
D) [option]
Correct: [A, B, C, or D]
Explanation: [one short sentence why the answer is correct]

Rules:
- Every question must have exactly 4 options (A through D)
- Include Correct and Explanation for each question
- Do NOT reveal answers in the question text
- Vary difficulty; one clear correct answer per question
- Put each question, option, Correct, and Explanation on its own line`,

  flashcards: (topic) => `
ACTIVITY: Flashcards (Studio panel)
Topic: "${topic}"
Generate 8 flashcards from their course materials.
${STUDIO_OUTPUT_RULES}

Format each card EXACTLY like this (plain text, no markdown — labels are for parsing only, not shown to the student):
Term: [question, concept, or prompt]
Answer: [concise answer or definition]

Rules:
- One term and one answer per card
- Answers should be short (1–3 sentences max)
- Cover the most important ideas for the topic
- No numbering, no "Front/Back" labels`,

  whiteboard: (topic) => `
ACTIVITY: Whiteboard brainstorm (Studio panel)
Topic: "${topic}"
Organize ideas into 3–5 clusters from their course materials.
${STUDIO_OUTPUT_RULES}

Format each cluster EXACTLY like this:
Cluster: [theme name]
- [idea one]
- [idea two]

After all clusters, add exactly one line:
Guiding question: [one open question to spark deeper thinking]

Rules:
- Clusters are visual groupings in the Studio — not an essay
- Use concise bullet phrases, not full paragraphs
- No introduction before the first Cluster:`,
};

function buildTutorSystemPrompt(
  courseContext,
  { tutorActivity = null, lectureTopic = "", studioGeneration = false } = {}
) {
  const contextBlock = formatCourseContextBlock(courseContext);
  const topic = lectureTopic?.trim() || "the selected topic";

  let prompt = TUTOR_BASE_PROMPT;

  if (studioGeneration && tutorActivity && ACTIVITY_PROMPTS[tutorActivity]) {
    prompt += ACTIVITY_PROMPTS[tutorActivity](topic);
  } else {
    prompt += CONVERSATIONAL_TUTORING;
  }

  if (!contextBlock) {
    return `${prompt}

No syllabus has been provided yet. Ask the student to share their course name and syllabus topics, or answer general study-strategy questions until they provide more detail.`;
  }

  return `${prompt}

STUDENT'S COURSE MATERIALS (use this as your tutoring context):
${contextBlock}`;
}

function buildTutorWelcome(courseContext) {
  const name = courseContext?.courseName?.trim() || "your course";
  const code = courseContext?.courseCode?.trim();
  const label = code ? `${name} (${code})` : name;

  return (
    `Welcome to your ${label} workspace. ` +
    `Add lecture notes and readings under Materials, then try Quiz, Flashcards, or Whiteboard brainstorm for any topic. ` +
    `What would you like to study first?`
  );
}

function hasValidCourseContext(courseContext) {
  if (!courseContext || typeof courseContext !== "object") return false;
  const hasName = Boolean(courseContext.courseName?.trim());
  const hasSyllabus = Boolean(courseContext.syllabusText?.trim());
  return hasName && hasSyllabus;
}

module.exports = {
  buildTutorSystemPrompt,
  buildTutorWelcome,
  hasValidCourseContext,
  formatCourseContextBlock,
  MAX_SYLLABUS_CHARS,
};
