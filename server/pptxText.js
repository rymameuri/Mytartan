const zlib = require("zlib");

function u16(buffer, offset) {
  return buffer.readUInt16LE(offset);
}

function u32(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function decodeXmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractATexts(xml) {
  const texts = [];
  const re = /<a:t\b[^>]*>([^<]*)<\/a:t>/g;
  let match;
  while ((match = re.exec(xml)) !== null) {
    const piece = decodeXmlEntities(match[1]).trim();
    if (piece) texts.push(piece);
  }
  return texts.join(" ").replace(/\s+/g, " ").trim();
}

function listZipEntries(buffer) {
  const entries = [];
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const signature = u32(buffer, offset);
    if (signature === 0x02014b50 || signature === 0x06054b50) break;
    if (signature !== 0x04034b50) break;

    const flags = u16(buffer, offset + 6);
    const method = u16(buffer, offset + 8);
    const compSize = u32(buffer, offset + 18);
    const nameLen = u16(buffer, offset + 26);
    const extraLen = u16(buffer, offset + 28);
    const nameStart = offset + 30;
    const name = buffer.slice(nameStart, nameStart + nameLen).toString("utf8");
    const dataStart = nameStart + nameLen + extraLen;

    if (flags & 0x8) break;

    const compressed = buffer.slice(dataStart, dataStart + compSize);
    let data = compressed;
    if (method === 8) {
      data = zlib.inflateRawSync(compressed);
    } else if (method !== 0) {
      offset = dataStart + compSize;
      continue;
    }

    entries.push({ name, data });
    offset = dataStart + compSize;
  }
  return entries;
}

function extractPptxTextFromBuffer(buffer) {
  const entries = listZipEntries(buffer);
  const slides = entries
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const pages = slides
    .map((slide) => extractATexts(slide.data.toString("utf8")))
    .filter(Boolean);

  const text = pages.join("\n\n").trim();
  if (!text) {
    throw new Error("No readable text found in PowerPoint");
  }
  return text;
}

module.exports = {
  extractPptxTextFromBuffer,
  listZipEntries,
};
