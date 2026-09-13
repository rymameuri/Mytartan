const { extractTextFromBuffer } = require("./textExtraction");
const { extractPptxTextFromBuffer } = require("./pptxText");

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeStoredZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = Buffer.from(file.name, "utf8");
    const data = Buffer.from(file.content, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30 + nameBytes.length + data.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    nameBytes.copy(local, 30);
    data.copy(local, 30 + nameBytes.length);
    locals.push(local);
    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt32LE(offset, 42);
    nameBytes.copy(central, 46);
    centrals.push(central);
    offset += local.length;
  }
  const centralDir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDir, end]);
}

describe("textExtraction", () => {
  test("extracts plain text files", async () => {
    const result = await extractTextFromBuffer(Buffer.from("Hello syllabus"), "notes.txt");
    expect(result.text).toBe("Hello syllabus");
  });

  test("skips unsupported extensions", async () => {
    const result = await extractTextFromBuffer(Buffer.from("data"), "notes.doc");
    expect(result.skipReason).toMatch(/Unsupported file type/i);
  });

  test("explains that images need pasted text or a document", async () => {
    const result = await extractTextFromBuffer(Buffer.from("data"), "photo.png", {
      mimeType: "image/png",
    });
    expect(result.skipReason).toMatch(/image/i);
  });

  test("extracts PPTX slide text", async () => {
    const buffer = makeStoredZip([
      {
        name: "ppt/slides/slide1.xml",
        content: "<p:sld><a:t>Recursion</a:t><a:t>needs a base case</a:t></p:sld>",
      },
    ]);
    const text = extractPptxTextFromBuffer(buffer);
    expect(text).toMatch(/Recursion/);
    const result = await extractTextFromBuffer(buffer, "notes.pptx");
    expect(result.text).toMatch(/base case/i);
  });

  test("skips empty text files", async () => {
    const result = await extractTextFromBuffer(Buffer.from("   "), "empty.md");
    expect(result.skipReason).toMatch(/Empty text file/i);
  });
});
