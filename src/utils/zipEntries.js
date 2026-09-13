export function decodeUtf8(bytes) {
  if (typeof TextDecoder === "function") {
    return new TextDecoder("utf-8").decode(bytes);
  }
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function u16(view, offset) {
  return view.getUint16(offset, true);
}

function u32(view, offset) {
  return view.getUint32(offset, true);
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "function") {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw new Error("Could not decompress this file in this browser.");
}

/**
 * Read local-file ZIP entries (stored or deflate). Stops at the central directory.
 * Skips entries that use a data descriptor (bit 3) without sizes in the local header.
 */
export async function listZipEntries(uint8) {
  const bytes = uint8 instanceof Uint8Array ? uint8 : new Uint8Array(uint8);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = [];
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const signature = u32(view, offset);
    if (signature === 0x02014b50 || signature === 0x06054b50) break;
    if (signature !== 0x04034b50) break;

    const flags = u16(view, offset + 6);
    const method = u16(view, offset + 8);
    const compSize = u32(view, offset + 18);
    const nameLen = u16(view, offset + 26);
    const extraLen = u16(view, offset + 28);
    const nameStart = offset + 30;
    const name = decodeUtf8(bytes.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;

    if (flags & 0x8) {
      break;
    }

    const compressed = bytes.subarray(dataStart, dataStart + compSize);
    let data = compressed;
    if (method === 8) {
      data = await inflateRaw(compressed);
    } else if (method !== 0) {
      offset = dataStart + compSize;
      continue;
    }

    entries.push({ name, data });
    offset = dataStart + compSize;
  }

  return entries;
}

export function decodeXmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function extractATexts(xml) {
  const texts = [];
  const re = /<a:t\b[^>]*>([^<]*)<\/a:t>/g;
  let match;
  while ((match = re.exec(xml)) !== null) {
    const piece = decodeXmlEntities(match[1]).trim();
    if (piece) texts.push(piece);
  }
  return texts.join(" ").replace(/\s+/g, " ").trim();
}
