const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
const MAX_BINARY_FILE_BYTES = 10 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set(["txt", "md", "csv"]);
const DOCX_EXTENSIONS = new Set(["docx"]);
const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

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

function isDocxFile(file, extension) {
  return DOCX_EXTENSIONS.has(extension) || DOCX_MIME_TYPES.has(file.type);
}

/**
 * Extract syllabus text from an uploaded file (.txt, .md, .csv, .pdf, or .docx).
 */
export async function extractSyllabusText(file) {
  const extension = getExtension(file.name);
  const isPdf = extension === "pdf" || file.type === "application/pdf";

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

  if (file.size > MAX_TEXT_FILE_BYTES) {
    throw new Error(
      `File is too large. Please use a file under ${formatSizeLimit(MAX_TEXT_FILE_BYTES)} or paste the text instead.`
    );
  }

  if (!TEXT_EXTENSIONS.has(extension)) {
    throw new Error("Unsupported file type. Use .txt, .md, .csv, .pdf, or .docx.");
  }

  return readTextFile(file);
}

export { MAX_BINARY_FILE_BYTES, MAX_TEXT_FILE_BYTES };
