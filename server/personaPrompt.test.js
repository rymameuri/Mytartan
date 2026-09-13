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
    expect(prompt).toMatch(/Lonely \/ company:/);
    expect(prompt).toMatch(/Overwhelm \/ midterms:/);
    expect(prompt).toMatch(/Homesick \/ rough night:/);
    expect(prompt).toMatch(/First week lost:/);
    expect(prompt).toMatch(/Bored tonight:/);
    expect(prompt).toMatch(/Serious financial aid:/);
    expect(prompt).toMatch(/Socratic tutor:/);
  });

  test("qa mode covers hangout and campus facts without promoting tutor", () => {
    const prompt = buildPersonaPrompt("qa");
    expect(prompt).toMatch(/one Scotty students text/i);
    expect(prompt).toMatch(/campus map/i);
    expect(prompt).toMatch(/Never mention Course Tutor/i);
    expect(prompt).not.toMatch(/suggest Tutor mode/i);
  });

  test("comfort rules listen first and avoid therapist cosplay", () => {
    const prompt = buildPersonaPrompt("qa");
    expect(prompt).toMatch(/COMFORT AND COMPANY/i);
    expect(prompt).toMatch(/Do not play therapist/i);
    expect(prompt).toMatch(/Do not dump crisis hotlines/i);
    expect(prompt).toMatch(/I don't know what to do tonight/i);
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

  test("injects role + CS academic referrals without the rest of the directory", () => {
    const { selectContacts, formatReferralBlock } = require("./contactMap");
    const referrals = formatReferralBlock(selectContacts({
      profile: { major: "Computer Science" },
      topic: "academics",
      now: new Date("2026-09-13"),
    }));
    const prompt = buildPersonaPrompt("qa", { role: "campus_assistant", referrals });
    expect(prompt).toMatch(/ROLE — CAMPUS ASSISTANT/);
    expect(prompt).toMatch(/rdriley@andrew\.cmu\.edu/);
    expect(prompt).not.toMatch(/hbouamor@/);
    expect(prompt).not.toMatch(/atorinab@/);
    expect(prompt).toMatch(/Never dump a list of offices/);
  });

  test("injects IS academic referrals, not CS emails", () => {
    const { selectContacts, formatReferralBlock } = require("./contactMap");
    const referrals = formatReferralBlock(selectContacts({
      profile: { major: "Information Systems" },
      topic: "academics",
      now: new Date("2026-09-13"),
    }));
    const prompt = buildPersonaPrompt("qa", { role: "campus_assistant", referrals });
    expect(prompt).toMatch(/hbouamor@andrew\.cmu\.edu/);
    expect(prompt).not.toMatch(/rdriley@/);
  });

  test("mental-health role names CaPS and forbids fake therapy", () => {
    const { selectContacts, formatReferralBlock } = require("./contactMap");
    const referrals = formatReferralBlock(selectContacts({ topic: "mental_health" }));
    const prompt = buildPersonaPrompt("qa", { role: "emotional_support", referrals });
    expect(prompt).toMatch(/ROLE — EMOTIONAL SUPPORT/);
    expect(prompt).toMatch(/not a licensed therapist/i);
    expect(prompt).toMatch(/Do not diagnose/);
    expect(prompt).toMatch(/atorinab@andrew\.cmu\.edu/);
    expect(prompt).not.toMatch(/rdriley@/);
    expect(prompt).not.toMatch(/hbouamor@/);
  });

  test("teacher role stays Socratic", () => {
    const prompt = buildPersonaPrompt("qa", { role: "teacher" });
    expect(prompt).toMatch(/ROLE — TEACHER/);
    expect(prompt).toMatch(/Socratic/);
  });

  test("first-place voice is a trusted classmate, not a brochure", () => {
    const prompt = buildPersonaPrompt("qa");
    expect(prompt).toMatch(/FIRST PLACE THEY'D GO/);
    expect(prompt).toMatch(/trusted classmate/i);
    expect(prompt).toMatch(/one concrete next step/i);
    expect(prompt).toMatch(/Never invent policy/);
  });
});
