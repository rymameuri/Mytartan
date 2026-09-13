const {
  normalizeMajor,
  yearBandFromGraduationDate,
  selectContacts,
  formatReferralBlock,
  buildUnknownFactReply,
  buildSupportiveReferralReply,
  loadContactMap,
} = require("./contactMap");

const NOW = new Date("2026-09-13T12:00:00Z");

const CS_EMAIL = "rdriley@andrew.cmu.edu";
const CS_ESCALATION = "greis@andrew.cmu.edu";
const IS_EMAIL = "hbouamor@andrew.cmu.edu";
const IS_ESCALATION = "caoun@andrew.cmu.edu";
const BA_EMAIL = "aindaco@andrew.cmu.edu";
const CAPS_EMAIL = "atorinab@andrew.cmu.edu";
const FRESHMAN_EMAIL = "ddourado@andrew.cmu.edu";
const ARC_EMAIL = "mariamma@andrew.cmu.edu";
const AID_EMAIL = "srian@andrew.cmu.edu";
const EMERGENCY_AID_EMAIL = "drehal@andrew.cmu.edu";
const ENROLLMENT_EMAIL = "jfn@andrew.cmu.edu";
const CAMPUS_EMAIL = "nabdelha@andrew.cmu.edu";

const DIRECTORY_EMAILS = [
  CS_EMAIL,
  CS_ESCALATION,
  IS_EMAIL,
  IS_ESCALATION,
  BA_EMAIL,
  "mfarooqi@andrew.cmu.edu",
  "jfn@andrew.cmu.edu",
  "qatareducationform@andrew.cmu.edu",
  AID_EMAIL,
  EMERGENCY_AID_EMAIL,
  FRESHMAN_EMAIL,
  ARC_EMAIL,
  CAPS_EMAIL,
  "nabdelha@andrew.cmu.edu",
  "mohammem@andrew.cmu.edu",
  "meredit2@andrew.cmu.edu",
];

function emailsOf(contacts) {
  return contacts.map((contact) => contact.email).filter(Boolean);
}

function countDirectoryHits(text) {
  const lower = String(text).toLowerCase();
  return DIRECTORY_EMAILS.filter((email) => lower.includes(email.toLowerCase())).length;
}

describe("normalizeMajor", () => {
  test("maps onboarding labels and short codes", () => {
    expect(normalizeMajor("Computer Science")).toBe("cs");
    expect(normalizeMajor("CS")).toBe("cs");
    expect(normalizeMajor("Information Systems")).toBe("is");
    expect(normalizeMajor("IS")).toBe("is");
    expect(normalizeMajor("Business Administration")).toBe("ba");
    expect(normalizeMajor("Biological Sciences")).toBe("bio");
    expect(normalizeMajor("Chemistry")).toBe("general");
    expect(normalizeMajor("")).toBe("general");
  });
});

describe("yearBandFromGraduationDate", () => {
  test("treats May 2030 as freshman in Sept 2026", () => {
    expect(yearBandFromGraduationDate("May 2030", NOW)).toBe("freshman");
  });

  test("maps remaining class years from graduation year", () => {
    expect(yearBandFromGraduationDate("May 2029", NOW)).toBe("sophomore");
    expect(yearBandFromGraduationDate("May 2028", NOW)).toBe("junior");
    expect(yearBandFromGraduationDate("May 2027", NOW)).toBe("senior");
  });

  test("returns unknown without a year", () => {
    expect(yearBandFromGraduationDate("", NOW)).toBe("unknown");
    expect(yearBandFromGraduationDate(null, NOW)).toBe("unknown");
  });
});

describe("selectContacts", () => {
  test("CS unknown academic gets CS people, not IS or counseling", () => {
    const contacts = selectContacts({
      profile: { major: "Computer Science", graduationDate: "May 2027" },
      topic: "academics",
      now: NOW,
    });

    const emails = emailsOf(contacts);
    expect(contacts.length).toBeGreaterThan(0);
    expect(contacts.length).toBeLessThanOrEqual(3);
    expect(emails).toContain(CS_EMAIL);
    expect(emails).not.toContain(IS_EMAIL);
    expect(emails).not.toContain(IS_ESCALATION);
    expect(emails).not.toContain(BA_EMAIL);
    expect(emails).not.toContain(CAPS_EMAIL);
    expect(emails).not.toContain(AID_EMAIL);
  });

  test("IS unknown academic gets IS people, not CS", () => {
    const contacts = selectContacts({
      profile: { major: "Information Systems", graduationDate: "May 2028" },
      topic: "academics",
      now: NOW,
    });

    const emails = emailsOf(contacts);
    expect(emails).toContain(IS_EMAIL);
    expect(emails).not.toContain(CS_EMAIL);
    expect(emails).not.toContain(CS_ESCALATION);
    expect(emails).not.toContain(CAPS_EMAIL);
    expect(contacts.length).toBeLessThanOrEqual(3);
  });

  test("freshman academics include first-year academic success", () => {
    const contacts = selectContacts({
      profile: { major: "Computer Science", graduationDate: "May 2030" },
      topic: "academics",
      now: NOW,
    });

    const emails = emailsOf(contacts);
    expect(emails).toContain(CS_EMAIL);
    expect(emails).toContain(FRESHMAN_EMAIL);
    expect(emails).not.toContain(IS_EMAIL);
  });

  test("seniors do not get freshman-only academic success", () => {
    const contacts = selectContacts({
      profile: { major: "Computer Science", graduationDate: "May 2027" },
      topic: "academics",
      now: NOW,
    });

    expect(emailsOf(contacts)).not.toContain(FRESHMAN_EMAIL);
  });

  test("mental health returns counseling only", () => {
    const contacts = selectContacts({
      profile: { major: "Computer Science", graduationDate: "May 2030" },
      topic: "mental_health",
      now: NOW,
    });

    const emails = emailsOf(contacts);
    expect(emails).toEqual([CAPS_EMAIL]);
    expect(contacts).toHaveLength(1);
  });

  test("financial aid is office-based, not major-based", () => {
    const cs = emailsOf(selectContacts({
      profile: { major: "Computer Science" },
      topic: "financial_aid",
      now: NOW,
    }));
    const is = emailsOf(selectContacts({
      profile: { major: "Information Systems" },
      topic: "financial_aid",
      now: NOW,
    }));

    expect(cs).toContain(AID_EMAIL);
    expect(is).toContain(AID_EMAIL);
    expect(cs).not.toContain(CS_EMAIL);
    expect(is).not.toContain(IS_EMAIL);
    expect(cs.length).toBeLessThanOrEqual(3);
  });

  test("BA unknown academic gets BA people, not CS or IS", () => {
    const emails = emailsOf(selectContacts({
      profile: { major: "Business Administration", graduationDate: "May 2028" },
      topic: "academics",
      now: NOW,
    }));
    expect(emails).toContain(BA_EMAIL);
    expect(emails).not.toContain(CS_EMAIL);
    expect(emails).not.toContain(IS_EMAIL);
    expect(emails).not.toContain(CAPS_EMAIL);
  });

  test("freshman registration includes enrollment and first-year success, not area heads", () => {
    const emails = emailsOf(selectContacts({
      profile: { major: "Computer Science", graduationDate: "May 2030" },
      topic: "registration",
      now: NOW,
    }));
    expect(emails).toContain(ENROLLMENT_EMAIL);
    expect(emails).toContain(FRESHMAN_EMAIL);
    expect(emails).not.toContain(CS_EMAIL);
    expect(emails).not.toContain(IS_EMAIL);
    expect(emails).not.toContain(CAPS_EMAIL);
  });

  test("midterm academic-support mix is ARC, not CaPS or other majors", () => {
    const emails = emailsOf(selectContacts({
      profile: { major: "Computer Science", graduationDate: "May 2030" },
      topic: "academic_support",
      now: NOW,
    }));
    expect(emails).toContain(ARC_EMAIL);
    expect(emails).toContain(FRESHMAN_EMAIL);
    expect(emails).not.toContain(CAPS_EMAIL);
    expect(emails).not.toContain(CS_EMAIL);
    expect(emails).not.toContain(IS_EMAIL);
  });

  test("campus life does not dump academic offices", () => {
    const emails = emailsOf(selectContacts({
      profile: { major: "Computer Science", graduationDate: "May 2030" },
      topic: "campus_life",
      now: NOW,
    }));
    expect(emails).toContain(CAMPUS_EMAIL);
    expect(emails).not.toContain(CS_EMAIL);
    expect(emails).not.toContain(IS_EMAIL);
    expect(emails).not.toContain(BA_EMAIL);
    expect(emails).not.toContain(CAPS_EMAIL);
    expect(emails).not.toContain(AID_EMAIL);
    expect(emails.length).toBeLessThanOrEqual(3);
  });

  test("does not invent contacts missing from the map", () => {
    const pool = loadContactMap();
    for (const contact of pool) {
      expect(contact.email).toMatch(/@/);
      expect(contact.source).toMatch(/^knowledge-base\//);
    }
  });
});

describe("referral copy", () => {
  test("unknown academic reply names only the selected contacts", () => {
    const contacts = selectContacts({
      profile: { major: "Computer Science", graduationDate: "May 2030" },
      topic: "academics",
      now: NOW,
    });
    const reply = buildUnknownFactReply(contacts);

    expect(reply).toMatch(/don't have the official answer/i);
    expect(reply).toMatch(/rdriley@andrew\.cmu\.edu/);
    expect(reply).not.toMatch(/hbouamor@/);
    expect(reply).not.toMatch(/atorinab@/);
    expect(countDirectoryHits(reply)).toBeLessThanOrEqual(3);
    expect(countDirectoryHits(reply)).toBeGreaterThan(0);
  });

  test("unknown academic reply does not dump the full directory", () => {
    const contacts = selectContacts({
      profile: { major: "Information Systems" },
      topic: "academics",
      now: NOW,
    });
    const reply = buildUnknownFactReply(contacts);
    expect(countDirectoryHits(reply)).toBeLessThanOrEqual(3);
    expect(countDirectoryHits(reply)).toBeLessThan(DIRECTORY_EMAILS.length / 2);
    expect(reply).not.toMatch(/mycmuq-student-affairs/i);
  });

  test("empty selection stays conversational without a directory", () => {
    const reply = buildUnknownFactReply([]);
    expect(reply).toMatch(/don't have the official answer/i);
    expect(countDirectoryHits(reply)).toBe(0);
  });

  test("mental-health copy is supportive and names CaPS only", () => {
    const contacts = selectContacts({ topic: "mental_health" });
    const reply = buildSupportiveReferralReply(contacts);
    expect(reply).toMatch(/I'm here with you/);
    expect(reply).toMatch(/not a counselor/i);
    expect(reply).toMatch(/atorinab@andrew\.cmu\.edu/);
    expect(reply).not.toMatch(/rdriley@/);
    expect(reply).not.toMatch(/diagnos/i);
  });

  test("persona referral block includes only injected contacts", () => {
    const csBlock = formatReferralBlock(selectContacts({
      profile: { major: "CS" },
      topic: "academics",
      now: NOW,
    }));
    expect(csBlock).toMatch(/TAILORED REFERRALS/);
    expect(csBlock).toMatch(/rdriley@andrew\.cmu\.edu/);
    expect(csBlock).not.toMatch(/hbouamor@/);
    expect(csBlock).not.toMatch(/atorinab@/);

    const isBlock = formatReferralBlock(selectContacts({
      profile: { major: "IS" },
      topic: "academics",
      now: NOW,
    }));
    expect(isBlock).toMatch(/hbouamor@andrew\.cmu\.edu/);
    expect(isBlock).not.toMatch(/rdriley@/);
  });
});
