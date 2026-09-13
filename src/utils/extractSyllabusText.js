const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
const MAX_BINARY_FILE_BYTES = 10 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set(["txt", "md", "csv"]);
const DOCX_EXTENSIONS = new Set(["docx"]);
const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const PPTX_EXTENSIONS = new Set(["pptx"]);
const PPTX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "heic", "heif"]);

export function isImageFile(file, extension = getExtension(file?.name)) {
  return IMAGE_EXTENSIONS.has(extension) || String(file?.type || "").startsWith("image/");
}

function isPptxFile(file, extension) {
  return PPTX_EXTENSIONS.has(extension) || PPTX_MIME_TYPES.has(file.type);
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsText(file);
  });
}

async function fileToArrayBuffer(file) {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }
  return new Response(file).arrayBuffer();
}

function formatSizeLimit(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${bytes / (1024 * 1024)} MB`;
  }
  return `${bytes / 1024} KB`;
}

function getExtension(fileName) {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

async function extractPdfText(file) {
  const pdfjsLib = await import("pdfjs-dist");

  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await fileToArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) pages.push(pageText);
  }

  const text = pages.join("\n\n").trim();
  if (!text) {
    throw new Error("No readable text found in PDF. Try pasting the syllabus instead.");
  }
  return text;
}

async function extractDocxText(file) {
  const mammoth = await import("mammoth");
  const arrayBuffer = await fileToArrayBuffer(file);
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value.trim();

  if (!text) {
    throw new Error("No readable text found in Word document. Try pasting the syllabus instead.");
  }

  return text;
}

async function extractPptxFile(file) {
  const { extractPptxTextFromBuffer } = await import("./pptxText");
  const arrayBuffer = await fileToArrayBuffer(file);
  return extractPptxTextFromBuffer(arrayBuffer);
}

function isDocxFile(file, extension) {
  return DOCX_EXTENSIONS.has(extension) || DOCX_MIME_TYPES.has(file.type);
}

/**
 * Extract study text from an uploaded file (.txt, .md, .csv, .pdf, .docx, or .pptx).
 */
export async function extractSyllabusText(file) {
  const extension = getExtension(file.name);
  const isPdf = extension === "pdf" || file.type === "application/pdf";

  if (isImageFile(file, extension)) {
    throw new Error(
      "Can't read text from that image. Paste the notes or upload a PDF, PPTX, or Word file."
    );
  }

  if (isPdf) {
    if (file.size > MAX_BINARY_FILE_BYTES) {
      throw new Error(
        `PDF is too large. Please use a file under ${formatSizeLimit(MAX_BINARY_FILE_BYTES)} or paste the text instead.`
      );
    }
    return extractPdfText(file);
  }

  if (isDocxFile(file, extension)) {
    if (file.size > MAX_BINARY_FILE_BYTES) {
      throw new Error(
        `Word file is too large. Please use a file under ${formatSizeLimit(MAX_BINARY_FILE_BYTES)} or paste the text instead.`
      );
    }
    return extractDocxText(file);
  }

  if (isPptxFile(file, extension)) {
    if (file.size > MAX_BINARY_FILE_BYTES) {
      throw new Error(
        `PowerPoint file is too large. Please use a file under ${formatSizeLimit(MAX_BINARY_FILE_BYTES)} or paste the text instead.`
      );
    }
    return extractPptxFile(file);
  }

  if (file.size > MAX_TEXT_FILE_BYTES) {
    throw new Error(
      `File is too large. Please use a file under ${formatSizeLimit(MAX_TEXT_FILE_BYTES)} or paste the text instead.`
    );
  }

  if (!TEXT_EXTENSIONS.has(extension)) {
    throw new Error("Unsupported file type. Use .txt, .md, .csv, .pdf, .docx, or .pptx.");
  }

  return readTextFile(file);
}

export async function extractStudyDocuments(files = []) {
  const parts = [];
  const warnings = [];

  for (const file of files) {
    try {
      const text = await extractSyllabusText(file);
      if (text?.trim()) {
        parts.push({ name: file.name, text: text.trim() });
      }
    } catch (err) {
      warnings.push(err.message || `Could not read ${file.name}`);
    }
  }

  return {
    text: parts.map((part) => part.text).join("\n\n\n"),
    names: parts.map((part) => part.name),
    warnings,
  };
}

export { MAX_BINARY_FILE_BYTES, MAX_TEXT_FILE_BYTES };
