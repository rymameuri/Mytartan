const LECTURE_HELP_PATTERNS = [
  /\bexplain\s+(?:this|that|it)\b/i,
  /\bi\s+don'?t\s+(?:get|understand)\b/i,
  /\bhelp\s+(?:me\s+)?(?:with|on)\b/i,
  /\bgo\s+over\b/i,
  /\bwalk\s+me\s+through\b/i,
  /\bcan\s+you\s+(?:explain|clarify)\b/i,
  /\bwhat\s+does\s+this\s+(?:mean|one)\b/i,
  /\bquestion\s+\d+\b/i,
  /\bcard\s+\d+\b/i,
  /\bthis\s+(?:card|question|cluster|bullet)\b/i,
];

export function looksLikeStudioLectureRequest(text) {
  if (!text?.trim()) return false;
  return LECTURE_HELP_PATTERNS.some((pattern) => pattern.test(text));
}

function summarizeConcept(text, maxWords = 12) {
  if (!text?.trim()) return "";
  const words = text.trim().replace(/\s+/g, " ").split(" ");
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")}…`;
}

function parseQuestionIndex(text, total) {
  const match = text.match(/\bquestion\s+(\d+)\b/i);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  if (!Number.isFinite(index) || index < 0 || index >= total) return null;
  return index;
}

function parseCardIndex(text, total) {
  const match = text.match(/\bcard\s+(\d+)\b/i);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  if (!Number.isFinite(index) || index < 0 || index >= total) return null;
  return index;
}

export function buildFlashcardItemContext({ flashcards, index, topic }) {
  const card = flashcards[index];
  if (!card) return null;
  return {
    activity: "flashcards",
    itemType: "flashcard",
    itemIndex: index,
    itemLabel: `Flashcard ${index + 1} of ${flashcards.length}`,
    concept: summarizeConcept(card.front),
    term: card.front,
    answer: card.back,
    topic: topic?.trim() || "",
  };
}

export function buildQuizItemContext({ questions, index, topic }) {
  const question = questions[index];
  if (!question) return null;
  return {
    activity: "quiz",
    itemType: "quiz_question",
    itemIndex: index,
    itemLabel: `Quiz question ${index + 1} of ${questions.length}`,
    concept: summarizeConcept(question.text),
    questionText: question.text,
    correctOption: question.correct,
    explanation: question.explanation ?? "",
    topic: topic?.trim() || "",
  };
}

export function buildWhiteboardItemContext({ clusters, clusterIndex, topic }) {
  const cluster = clusters[clusterIndex];
  if (!cluster) return null;
  return {
    activity: "whiteboard",
    itemType: "whiteboard_cluster",
    itemIndex: clusterIndex,
    itemLabel: `Whiteboard cluster ${clusterIndex + 1} of ${clusters.length}`,
    concept: summarizeConcept(cluster.title),
    clusterTitle: cluster.title,
    bullets: cluster.bullets,
    topic: topic?.trim() || "",
  };
}

export function resolveStudioItemContext({
  text = "",
  tutorActivity,
  flashcards = [],
  quizQuestions = [],
  whiteboardClusters = [],
  flashcardIndex = 0,
  quizIndex = 0,
  clusterIndex = 0,
  topic = "",
}) {
  if (tutorActivity === "flashcards" && flashcards.length > 0) {
    const index = parseCardIndex(text, flashcards.length) ?? flashcardIndex;
    return buildFlashcardItemContext({ flashcards, index, topic });
  }

  if (tutorActivity === "quiz" && quizQuestions.length > 0) {
    const index = parseQuestionIndex(text, quizQuestions.length) ?? quizIndex;
    return buildQuizItemContext({ questions: quizQuestions, index, topic });
  }

  if (tutorActivity === "whiteboard" && whiteboardClusters.length > 0) {
    return buildWhiteboardItemContext({
      clusters: whiteboardClusters,
      clusterIndex,
      topic,
    });
  }

  return null;
}

export function buildLectureHelpMessage(studioItemContext) {
  if (!studioItemContext) return "Help me understand this.";
  if (studioItemContext.itemType === "flashcard") {
    return `Help me understand ${studioItemContext.itemLabel.toLowerCase()}.`;
  }
  if (studioItemContext.itemType === "quiz_question") {
    return `Help me with ${studioItemContext.itemLabel.toLowerCase()}.`;
  }
  if (studioItemContext.itemType === "whiteboard_cluster") {
    return `Can you explain the "${studioItemContext.clusterTitle}" cluster on the whiteboard?`;
  }
  return "Help me understand this.";
}
