#!/usr/bin/env node
/**
 * Generate public/samples/sample-syllabus.pdf for Course Tutor demos.
 * Run: node scripts/generate_sample_syllabus_pdf.js
 */

const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const SAMPLE_TEXT = `CMU-Q — 15-112 Fundamentals of Programming
Spring 2026 | Dr. Sample Faculty

COURSE DESCRIPTION
An introduction to programming using Python. Students learn problem decomposition,
data structures, and algorithmic thinking through weekly labs and assignments.

LEARNING OBJECTIVES
- Design programs using functions and modular decomposition
- Use lists, dictionaries, and strings effectively
- Implement recursive solutions and analyze base/recursive cases
- Trace code execution and debug logical errors

WEEKLY SCHEDULE
Week 1: Variables, expressions, and functions
Week 2: Conditionals and loops
Week 3: Strings and file I/O
Week 4: Lists and list comprehensions
Week 5: Dictionaries and sets
Week 6: Recursion — factorial, Fibonacci, tree traversal intro
Week 7: Object-oriented programming basics
Week 8: Midterm review (covers weeks 1–7)

MIDTERM (Week 8)
Covers: functions, loops, lists, dictionaries, basic recursion, debugging.
Format: written + short coding problems. No external resources allowed.`;

async function main() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const lineHeight = fontSize * 1.4;
  const margin = 50;
  const pageWidth = 612;
  const maxWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([612, 792]);
  let y = 792 - margin;

  function wrapLine(text) {
    const words = text.split(" ");
    const lines = [];
    let current = "";

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      const width = font.widthOfTextAtSize(next, fontSize);
      if (width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  for (const paragraph of SAMPLE_TEXT.split("\n")) {
    const lines = paragraph.trim() ? wrapLine(paragraph.trim()) : [""];
    for (const line of lines) {
      if (y < margin + lineHeight) {
        page = pdfDoc.addPage([612, 792]);
        y = 792 - margin;
      }
      if (line) {
        page.drawText(line, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
      }
      y -= lineHeight;
    }
    y -= lineHeight * 0.4;
  }

  const outDir = path.join(__dirname, "..", "public", "samples");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "sample-syllabus.pdf");
  fs.writeFileSync(outPath, await pdfDoc.save());
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
