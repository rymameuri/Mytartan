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

const TUTOR_BASE_PROMPT = `You are acting as the student's personal course tutor for this session.

Your job is to help the student understand their course material — not to do their work for them.

TUTORING RULES:
- Use the student's syllabus, uploaded materials, and notes as your primary reference.
- Guide with questions and hints. Ask what they already know before explaining.
- Break problems and concepts into small steps. Check understanding along the way.
- Do NOT give full homework, quiz, or exam answers. Help them reach the answer themselves.
- When relevant, point to syllabus sections (weeks, units, readings) so the student knows where to study.
- If a question is outside the course scope, say so clearly.
- Never open with filler like "Great question!" Be warm but get to the point fast.

VISIBLE CONTENT RULES (Studio panel — flashcards, quiz, whiteboard):
- Never read content verbatim that the student can already see on screen — not flashcard fronts/backs, quiz questions and choices, or whiteboard node text.
- When the student asks for help on a specific item, explain the concept behind it the way a professor lecturing would: context, a brief example, and a different framing than what is already shown — not a restatement of the visible text.
- Default to brief responses when simply acknowledging that content was generated; only go into lecture depth when the student actually asks for help.`;

const CONVERSATIONAL_TUTORING = `

CONVERSATION MODE (student is talking with you — NOT generating Studio content):
- You know their course materials deeply. Teach by synthesizing ideas, not by reciting notes, lists, flashcards, or whiteboard bullets verbatim.
- Guide with questions, short explanations, and connections between concepts. Help them think, not memorize lines.
- If they are studying flashcards or a whiteboard in the Studio panel, coach them through it — ask what they think, give hints, clarify misconceptions. Never read card text or cluster bullets aloud word-for-word.
- When helping with a specific Studio item, teach the underlying learning objective with a fresh example grounded in their syllabus. End with a Socratic check-in question.
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

function formatStudioItemContextBlock(studioItemContext) {
  if (!studioItemContext || typeof studioItemContext !== "object") return "";

  const lines = ["STUDIO ITEM HELP (student can see this item on screen — teach the concept, do not quote it):"];
  if (studioItemContext.activity) lines.push(`Activity: ${studioItemContext.activity}`);
  if (studioItemContext.itemLabel) lines.push(`Item: ${studioItemContext.itemLabel}`);
  if (studioItemContext.concept) {
    lines.push(`Learning objective: ${studioItemContext.concept}`);
  }
  if (studioItemContext.clusterTitle) {
    lines.push(`Cluster theme: ${studioItemContext.clusterTitle}`);
  }

  const detailLines = [];
  if (studioItemContext.term) detailLines.push(`Visible prompt (do not repeat): ${studioItemContext.term}`);
  if (studioItemContext.answer) detailLines.push(`Visible answer (do not repeat): ${studioItemContext.answer}`);
  if (studioItemContext.questionText) {
    detailLines.push(`Visible question (do not repeat): ${studioItemContext.questionText}`);
  }
  if (studioItemContext.explanation) {
    detailLines.push(`Reference explanation (paraphrase only): ${studioItemContext.explanation}`);
  }
  if (Array.isArray(studioItemContext.bullets) && studioItemContext.bullets.length) {
    detailLines.push(
      `Cluster bullets (do not read aloud): ${studioItemContext.bullets.slice(0, 5).join("; ")}`
    );
  }

  if (detailLines.length) {
    lines.push("", "Item details for your grounding only:", ...detailLines);
  }

  lines.push(
    "",
    "Explain the underlying concept with a different example or framing. End with a Socratic question."
  );

  return lines.join("\n");
}

function formatSourceItemContextBlock(sourceItemContext) {
  if (!sourceItemContext || typeof sourceItemContext !== "object") return "";

  const lines = [
    "STUDENT SOURCE FOCUS — the student is asking about specific course material:",
    `Source: ${sourceItemContext.title || "Untitled source"}`,
  ];

  if (sourceItemContext.excerpt?.trim()) {
    lines.push(
      "",
      `Highlighted excerpt (explain this clearly in plain English — do not just repeat it):`,
      `"${sourceItemContext.excerpt.trim()}"`
    );
  } else {
    lines.push("", "The student wants help understanding this entire source.");
  }

  lines.push(
    "",
    "Teach the underlying concept with a concrete example when helpful. Keep tone encouraging and end with a brief check-in question."
  );

  return lines.join("\n");
}

function buildTutorSystemPrompt(
  courseContext,
  {
    tutorActivity = null,
    lectureTopic = "",
    studioGeneration = false,
    speechMode = null,
    studioItemContext = null,
    sourceItemContext = null,
  } = {}
) {
  const contextBlock = formatCourseContextBlock(courseContext);
  const topic = lectureTopic?.trim() || "the selected topic";
  const isLectureHelp =
    speechMode === "lecture" || Boolean(studioItemContext && !studioGeneration);

  let prompt = TUTOR_BASE_PROMPT;

  if (studioGeneration && tutorActivity && ACTIVITY_PROMPTS[tutorActivity]) {
    prompt += ACTIVITY_PROMPTS[tutorActivity](topic);
  } else {
    prompt += CONVERSATIONAL_TUTORING;
  }

  if (isLectureHelp) {
    const itemBlock = formatStudioItemContextBlock(studioItemContext);
    if (itemBlock) {
      prompt += `\n\n${itemBlock}`;
    } else {
      prompt +=
        "\n\nThe student is asking for help with something visible in the Studio panel. Teach the underlying concept without repeating the on-screen text. End with a Socratic check-in question.";
    }
  }

  if (sourceItemContext) {
    const sourceBlock = formatSourceItemContextBlock(sourceItemContext);
    if (sourceBlock) {
      prompt += `\n\n${sourceBlock}`;
    }
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
  formatStudioItemContextBlock,
  formatSourceItemContextBlock,
  MAX_SYLLABUS_CHARS,
};
