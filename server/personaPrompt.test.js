const { buildPersonaPrompt, resolvePersonaMode } = require("./personaPrompt");

describe("personaPrompt", () => {
  test("resolvePersonaMode maps app modes correctly", () => {
    expect(resolvePersonaMode("qa")).toBe("qa");
    expect(resolvePersonaMode("campus")).toBe("qa");
    expect(resolvePersonaMode("chat")).toBe("general");
    expect(resolvePersonaMode("tutor")).toBe("tutor");
  });

  test("buildPersonaPrompt includes core identity and tone rules", () => {
    const prompt = buildPersonaPrompt("qa");
    expect(prompt).toMatch(/You are Scotty/i);
    expect(prompt).toMatch(/cartoon dog mascot/i);
    expect(prompt).toMatch(/Avoid sarcasm/i);
    expect(prompt).toMatch(/financial aid/i);
    expect(prompt).toMatch(/VISUAL IDENTITY AND ANIMATION/i);
  });

  test("buildPersonaPrompt includes mode-specific guidance", () => {
    expect(buildPersonaPrompt("qa")).toMatch(/campus map/i);
    expect(buildPersonaPrompt("tutor")).toMatch(/Socratic/i);
    expect(buildPersonaPrompt("general")).toMatch(/most playful/i);
  });

  test("buildPersonaPrompt includes grounding rules", () => {
    const prompt = buildPersonaPrompt("qa");
    expect(prompt).toMatch(/GROUNDING RULES/i);
    expect(prompt).toMatch(/Only answer using the provided context/i);
    expect(prompt).toMatch(/name the source briefly/i);
    expect(prompt).toMatch(/admissions decisions/i);
  });

  test("buildPersonaPrompt includes few-shot examples", () => {
    const prompt = buildPersonaPrompt("tutor");
    expect(prompt).toMatch(/Playful casual:/);
    expect(prompt).toMatch(/Casual greeting:/);
    expect(prompt).toMatch(/Just chatting:/);
    expect(prompt).toMatch(/Serious financial aid:/);
    expect(prompt).toMatch(/Socratic tutor:/);
  });

  test("tone rules tell Scotty not to hedge every reply", () => {
    const prompt = buildPersonaPrompt("qa");
    expect(prompt).toMatch(/last resort/i);
    expect(prompt).toMatch(/Never stack I-don't-knows/i);
    expect(prompt).toMatch(/zero help-desk energy/i);
    expect(prompt).toMatch(/Never use em dashes/i);
  });

  test("small-talk persona prompt skips knowledge-base grounding", () => {
    const prompt = buildPersonaPrompt("qa", { smallTalk: true });
    expect(prompt).toMatch(/You are Scotty/i);
    expect(prompt).toMatch(/SMALL TALK/i);
    expect(prompt).not.toMatch(/Only answer using the provided context/i);
    expect(prompt).not.toMatch(/must tell the user you do not have/i);
  });

  test("buildPersonaPrompt falls back to qa for unknown modes", () => {
    expect(buildPersonaPrompt("unknown")).toMatch(/MODE — Q&A/i);
  });
});
