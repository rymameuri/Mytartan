import { decodeUtf8, extractATexts, listZipEntries } from "./zipEntries";

const SLIDE_RE = /^ppt\/slides\/slide\d+\.xml$/i;

export async function extractPptxTextFromBuffer(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const entries = await listZipEntries(bytes);
  const slides = entries
    .filter((entry) => SLIDE_RE.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const pages = slides
    .map((slide) => extractATexts(decodeUtf8(slide.data)))
    .filter(Boolean);

  const text = pages.join("\n\n").trim();
  if (!text) {
    throw new Error("No readable text found in PowerPoint. Try a PDF or paste the notes.");
  }
  return text;
}
