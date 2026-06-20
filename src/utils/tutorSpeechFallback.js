export function tutorSpeechFallback({ tutorActivity, lectureTopic, courseName } = {}) {
  const topic = lectureTopic?.trim() || "this topic";
  const course = courseName?.trim() || "your course";

  if (tutorActivity === "flashcards") {
    return `I've put together flashcards on ${topic} from ${course}. Flip through them and say each answer out loud. Tell me which ones trip you up.`;
  }
  if (tutorActivity === "quiz") {
    return `Here's a quiz on ${topic}. Try each question before peeking at your notes. When you're stuck, ask me and we'll work through it together.`;
  }
  if (tutorActivity === "whiteboard") {
    return `Let's map out ${topic} on the whiteboard. Look at the clusters and see how the ideas connect. What stands out to you first?`;
  }
  return `Let's dig into ${topic} together. Read what I've prepared, then tell me what you'd like to go deeper on.`;
}

export function briefSpeechFromReply(reply) {
  if (!reply?.trim()) return "";
  const sentence = reply.trim().split(/\n+/)[0].replace(/\s+/g, " ");
  if (sentence.length <= 200) return sentence;
  return `${sentence.slice(0, 197)}…`;
}
