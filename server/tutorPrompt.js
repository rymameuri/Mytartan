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

const ACTIVITY_PROMPTS = {
  quiz: (topic) => `
ACTIVITY: Quiz
The student wants a multiple-choice quiz on: "${topic}"
Generate exactly 5 multiple-choice questions based ONLY on their course materials.

IMPORTANT: Output ONLY the quiz. No introduction, no preamble, no tutoring commentary.
Start immediately with question 1.

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
ACTIVITY: Flashcards
The student wants flashcards on: "${topic}"
Generate 8 flashcards from their course materials.
Format each EXACTLY like this (plain text, no markdown):
Front: [question or term]
Back: [answer or definition]`,

  whiteboard: (topic) => `
ACTIVITY: Whiteboard brainstorm
The student wants to brainstorm: "${topic}"
Organize ideas into 3-5 clusters from their course materials.
Format each cluster EXACTLY like this:
Cluster: [theme name]
- [idea one]
- [idea two]
End with one guiding question to keep the student thinking.`,
};

function buildTutorSystemPrompt(courseContext, { tutorActivity = null, lectureTopic = "" } = {}) {
  const contextBlock = formatCourseContextBlock(courseContext);
  const topic = lectureTopic?.trim() || "the selected topic";

  let prompt = TUTOR_BASE_PROMPT;

  if (tutorActivity && ACTIVITY_PROMPTS[tutorActivity]) {
    prompt += ACTIVITY_PROMPTS[tutorActivity](topic);
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
