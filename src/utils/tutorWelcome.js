export function buildTutorWelcomeMessage(courseContext) {
  const name = courseContext?.courseName?.trim() || "your course";
  const code = courseContext?.courseCode?.trim();
  const label = code ? `${name} (${code})` : name;

  return (
    `I'm ready to tutor you in ${label}. ` +
    `Ask me to explain concepts, walk through practice problems step by step, or help you study for exams. ` +
    `I'll guide you with hints and questions rather than giving away answers — that's how you'll actually learn it. ` +
    `What topic should we start with?`
  );
}
