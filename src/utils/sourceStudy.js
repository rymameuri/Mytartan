export function previewSnippet(text, maxLength = 90) {
  if (!text?.trim()) return "";
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

export function getSourceTypeLabel(material) {
  const externalId = material?.externalItemId ?? "";
  if (externalId.startsWith("canvas:file:")) return "File";
  if (externalId.startsWith("canvas:page:")) return "Page";
  if (externalId.startsWith("canvas:assignment:")) return "Assignment";
  if (externalId.startsWith("canvas:skip:")) return "Note";
  return "Note";
}

export function buildSourceItemContext({ materialId, title, excerpt }) {
  if (!title?.trim()) return null;
  return {
    materialId: materialId ?? null,
    title: title.trim(),
    excerpt: excerpt?.trim() || null,
  };
}

export function buildSourceHelpMessage({ title, excerpt }) {
  if (excerpt?.trim()) {
    return `Explain this passage from "${title}": "${excerpt.trim()}"`;
  }
  return `Help me understand "${title}".`;
}

export function buildSyllabusSource() {
  return { id: "__syllabus__", title: "Syllabus", isSyllabus: true };
}
