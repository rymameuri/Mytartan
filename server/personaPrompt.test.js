const { buildPersonaPrompt, buildPersonaStudentBlock, resolvePersonaMode } = require("./personaPrompt");

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
    expect(prompt).toMatch(/2 to 5 sentences/i);
    expect(prompt).toMatch(/Never paste knowledge-base excerpts/i);
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
    expect(prompt).toMatch(/Asked for a joke:/);
    expect(prompt).toMatch(/Tiny lift, not a set:/);
    expect(prompt).toMatch(/Serious financial aid:/);
    expect(prompt).toMatch(/Socratic tutor:/);
    expect(prompt).toMatch(/Quiet study spot:/);
    expect(prompt).toMatch(/Library study rooms 1153 and 1155/i);
    expect(prompt).toMatch(/Do not mention study abroad/i);
  });

  test("qa mode covers hangout and campus facts without promoting tutor", () => {
    const prompt = buildPersonaPrompt("qa");
    expect(prompt).toMatch(/one Scotty students text/i);
    expect(prompt).toMatch(/campus map/i);
    expect(prompt).toMatch(/Never mention Course Tutor/i);
    expect(prompt).not.toMatch(/suggest Tutor mode/i);
  });

  test("humor rules forbid dad jokes and forced sets", () => {
    const prompt = buildPersonaPrompt("qa");
    expect(prompt).toMatch(/PERSONA — HUMOR/);
    expect(prompt).toMatch(/rare and earned/i);
    expect(prompt).toMatch(/why-did-the-chicken/i);
    expect(prompt).toMatch(/Never dump a set/i);
    expect(prompt).toMatch(/If they did not ask for a joke/i);
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
    expect(prompt).toMatch(/not a comedian/i);
    expect(prompt).toMatch(/short beats/i);
    expect(prompt).toMatch(/one thought per sentence/i);
    expect(prompt).toMatch(/voice can breathe/i);
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

  test("THIS STUDENT block uses preferred name, major, year, and onboarding cues", () => {
    const block = buildPersonaStudentBlock({
      onboardingComplete: true,
      preferredName: "Rym",
      major: "Computer Science",
      graduationDate: "May 2028",
      intendedUse: "Someone to talk to",
      learningStyle: "Talking it through",
    });
    expect(block).toMatch(/THIS STUDENT/);
    expect(block).toMatch(/Call them Rym/);
    expect(block).toMatch(/Computer Science/);
    expect(block).toMatch(/May 2028/);
    expect(block).toMatch(/Someone to talk to/);
    expect(block).toMatch(/Talking it through/);
  });

  test("buildPersonaPrompt injects the student block after onboarding", () => {
    const prompt = buildPersonaPrompt("qa", {
      profile: {
        onboardingComplete: true,
        preferredName: "Rym",
        major: "Information Systems",
      },
    });
    expect(prompt).toMatch(/Call them Rym/);
    expect(prompt).toMatch(/Information Systems/);
  });

  test("small-talk prompt still includes the student name", () => {
    const prompt = buildPersonaPrompt("qa", {
      smallTalk: true,
      profile: {
        onboardingComplete: true,
        preferredName: "Rym",
        major: "Computer Science",
      },
    });
    expect(prompt).toMatch(/Call them Rym/);
    expect(prompt).toMatch(/SMALL TALK/);
  });

  test("first-place voice is a trusted classmate, not a brochure", () => {
    const prompt = buildPersonaPrompt("qa");
    expect(prompt).toMatch(/FIRST PLACE THEY'D GO/);
    expect(prompt).toMatch(/trusted classmate/i);
    expect(prompt).toMatch(/one concrete next step/i);
    expect(prompt).toMatch(/Never invent policy/);
  });
});
