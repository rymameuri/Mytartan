import { toSpokenText, flattenSpeechPauses, linkLabelForUrl, CHAT_LINK_CUE } from "./spokenText";

const STUDENT_AFFAIRS =
  "https://sites.google.com/andrew.cmu.edu/mycmuq-student-affairs/home";

test("leaves ordinary speech unchanged", () => {
  expect(toSpokenText("I'm good! What's going on?")).toBe("I'm good! What's going on?");
});

test("turns clause dashes into sentence stops so speech can breathe", () => {
  expect(flattenSpeechPauses("Hey — Scotty here. What's up?")).toBe(
    "Hey. Scotty here. What's up?"
  );
  expect(flattenSpeechPauses("Yeah — club fair Thursday...")).toBe(
    "Yeah. Club fair Thursday."
  );
  expect(toSpokenText("I hear you — this matters.")).toBe("I hear you. This matters.");
  expect(toSpokenText("CMU-Q need-based aid")).toBe("CMU-Q need-based aid");
  expect(toSpokenText("Weeks 1–2 cover loops")).toBe("Weeks 1 to 2 cover loops");
});

test("replaces a URL with a chat cue", () => {
  const spoken = toSpokenText(
    `Hmm, I don't have that one. Best bet is the myCMU-Q Student Affairs site.\n${STUDENT_AFFAIRS}`
  );
  expect(spoken).toMatch(/check the chat for the link/i);
  expect(spoken).not.toMatch(/https?:\/\//);
  expect(spoken).not.toMatch(/sites\.google\.com/);
  expect(spoken).toBe(
    `Hmm, I don't have that one. Best bet is the myCMU-Q Student Affairs site. ${CHAT_LINK_CUE}`
  );
});

test("does not double the cue when the reply already mentions it", () => {
  const spoken = toSpokenText(`Check the chat for the link.\n${STUDENT_AFFAIRS}`);
  expect(spoken.match(/check the chat for the link/gi)).toHaveLength(1);
});

test("uses the plural cue for multiple links", () => {
  const spoken = toSpokenText(`See https://example.com/a and https://example.com/b`);
  expect(spoken).toMatch(/check the chat for the links/i);
  expect(spoken).not.toMatch(/https?:\/\//);
});

test("strips parenthetical URLs from the old fallback wording", () => {
  const spoken = toSpokenText(
    `I don't have that information in my knowledge base right now. Please check the myCMU-Q Student Affairs site (${STUDENT_AFFAIRS}).`
  );
  expect(spoken).not.toMatch(/https?:\/\//);
  expect(spoken).toMatch(/check the chat for the link/i);
  expect(spoken).not.toMatch(/\(\s*\)/);
});

test("a URL-only reply just points at the chat", () => {
  expect(toSpokenText(STUDENT_AFFAIRS)).toBe(CHAT_LINK_CUE);
});

test("labels the Student Affairs URL for chat", () => {
  expect(linkLabelForUrl(STUDENT_AFFAIRS)).toBe("myCMU-Q Student Affairs");
  expect(linkLabelForUrl("https://example.com/help")).toBe("https://example.com/help");
});
