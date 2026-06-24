/**
 * Topic suggestions stay aligned with knowledge-base/ content.
 */

import fs from "fs";
import path from "path";
import { TOPIC_SUGGESTIONS, getAllTopicPrompts } from "./topicSuggestions";

const KB_ROOT = path.join(process.cwd(), "knowledge-base");

describe("topicSuggestions", () => {
  test("every section has at least one item", () => {
    expect(TOPIC_SUGGESTIONS.length).toBeGreaterThanOrEqual(4);
    for (const section of TOPIC_SUGGESTIONS) {
      expect(section.title).toBeTruthy();
      expect(section.items.length).toBeGreaterThan(0);
    }
  });

  test("every item has label and prompt", () => {
    for (const section of TOPIC_SUGGESTIONS) {
      for (const item of section.items) {
        expect(item.label.trim()).toBeTruthy();
        expect(item.prompt.trim()).toBeTruthy();
        expect(item.prompt.endsWith("?")).toBe(true);
      }
    }
  });

  test("kbPath entries point to existing knowledge-base files", () => {
    const missing = [];
    for (const section of TOPIC_SUGGESTIONS) {
      for (const item of section.items) {
        if (!item.kbPath) continue;
        const fullPath = path.join(KB_ROOT, item.kbPath);
        if (!fs.existsSync(fullPath)) {
          missing.push(item.kbPath);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  test("prompts are unique", () => {
    const prompts = getAllTopicPrompts();
    expect(new Set(prompts).size).toBe(prompts.length);
  });
});
