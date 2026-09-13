const mammoth = require("mammoth");
const { extractPptxTextFromBuffer } = require("./pptxText");

const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
const MAX_BINARY_FILE_BYTES = 10 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set(["txt", "md", "csv"]);

function formatSizeLimit(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${bytes / (1024 * 1024)} MB`;
  }
  return `${bytes / 1024} KB`;
}

function getExtension(fileName) {
  const parts = String(fileName ?? "").toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

async function extractPdfText(buffer) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

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
    throw new Error("No readable text found in PDF");
  }
  return text;
}

async function extractDocxText(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();
  if (!text) {
    throw new Error("No readable text found in Word document");
  }
  return text;
}

/**
 * Extract text from a downloaded file buffer.
 * Returns { text } on success or { skipReason } when unsupported/skipped.
 */
async function extractTextFromBuffer(buffer, fileName, { mimeType } = {}) {
  const extension = getExtension(fileName);
  const size = buffer.length;
  const isPdf = extension === "pdf" || mimeType === "application/pdf";
  const isDocx =
    extension === "docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isPptx =
    extension === "pptx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  const isImage =
    ["png", "jpg", "jpeg", "gif", "webp", "heic", "heif"].includes(extension) ||
    String(mimeType || "").startsWith("image/");

  if (isPdf) {
    if (size > MAX_BINARY_FILE_BYTES) {
      return {
        skipReason: `PDF too large (max ${formatSizeLimit(MAX_BINARY_FILE_BYTES)})`,
      };
    }
    try {
      return { text: await extractPdfText(buffer) };
    } catch (err) {
      return { skipReason: err.message || "Could not extract PDF text" };
    }
  }

  if (isDocx) {
    if (size > MAX_BINARY_FILE_BYTES) {
      return {
        skipReason: `Word file too large (max ${formatSizeLimit(MAX_BINARY_FILE_BYTES)})`,
      };
    }
    try {
      return { text: await extractDocxText(buffer) };
    } catch (err) {
      return { skipReason: err.message || "Could not extract DOCX text" };
    }
  }

  if (isPptx) {
    if (size > MAX_BINARY_FILE_BYTES) {
      return {
        skipReason: `PowerPoint file too large (max ${formatSizeLimit(MAX_BINARY_FILE_BYTES)})`,
      };
    }
    try {
      return { text: extractPptxTextFromBuffer(buffer) };
    } catch (err) {
      return { skipReason: err.message || "Could not extract PPTX text" };
    }
  }

  if (isImage) {
    return {
      skipReason:
        "Can't read text from images. Paste the notes or upload a PDF, PPTX, or Word file.",
    };
  }

  if (size > MAX_TEXT_FILE_BYTES) {
    return {
      skipReason: `Text file too large (max ${formatSizeLimit(MAX_TEXT_FILE_BYTES)})`,
    };
  }

  if (!TEXT_EXTENSIONS.has(extension)) {
    return { skipReason: `Unsupported file type: .${extension || "unknown"}` };
  }

  const text = buffer.toString("utf8").trim();
  if (!text) {
    return { skipReason: "Empty text file" };
  }
  return { text };
}

module.exports = {
  MAX_BINARY_FILE_BYTES,
  MAX_TEXT_FILE_BYTES,
  extractTextFromBuffer,
  getExtension,
};
