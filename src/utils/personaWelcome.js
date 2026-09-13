export function personaWelcomeCaption(profile = {}) {
  const safe = profile || {};
  const name = String(safe.preferredName || "").trim();
  const major = String(safe.major || "").trim();
  if (name && major) {
    return `Hey ${name} — ${major}, right? What's going on?`;
  }
  if (name) {
    return `Hey ${name}. What's going on?`;
  }
  return "What's going on?";
}
