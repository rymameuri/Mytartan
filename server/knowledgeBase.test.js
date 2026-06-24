/**
 * Tests for knowledgeBase.js
 *
 * Run with: npm test -- --testPathPattern=knowledgeBase
 */

const {
  loadKnowledgeBase,
  retrieveRelevantDocs,
  buildStudentContext,
  buildContextBlock,
  buildKeyFactsBlock,
  checkKeyFacts,
  computeConfidence,
} = require("./knowledgeBase");

// Load the real knowledge base before all tests
beforeAll(() => {
  const count = loadKnowledgeBase();
  expect(count).toBeGreaterThan(0); // fails fast if KB files are missing
});

// ─── loadKnowledgeBase ────────────────────────────────────────────────────────

describe("loadKnowledgeBase", () => {
  test("loads more than 0 documents", () => {
    const count = loadKnowledgeBase();
    expect(count).toBeGreaterThan(0);
  });
});

// ─── retrieveRelevantDocs ─────────────────────────────────────────────────────

describe("retrieveRelevantDocs", () => {
  test("returns empty array for empty query", () => {
    const results = retrieveRelevantDocs("");
    expect(results).toEqual([]);
  });

  test("returns empty array for null query", () => {
    const results = retrieveRelevantDocs(null);
    expect(results).toEqual([]);
  });

  test("returns empty array for whitespace-only query", () => {
    const results = retrieveRelevantDocs("   ");
    expect(results).toEqual([]);
  });

  test("returns empty array for completely irrelevant gibberish", () => {
    const results = retrieveRelevantDocs("xyzzy frobble quuxington");
    expect(results).toEqual([]);
  });

  test("returns empty array for short greetings that are not CMU-Q topics", () => {
    expect(retrieveRelevantDocs("hi")).toEqual([]);
    expect(retrieveRelevantDocs("hey")).toEqual([]);
  });

  test("returns results for a real CMU-Q question about registration", () => {
    const results = retrieveRelevantDocs("How do I register for courses?");
    expect(results.length).toBeGreaterThan(0);
  });

  test("returns results for a question about minors", () => {
    const results = retrieveRelevantDocs("How do I declare a minor?");
    expect(results.length).toBeGreaterThan(0);
    const topics = results.map((r) => r.topic.toLowerCase());
    expect(topics.some((t) => t.includes("minor"))).toBe(true);
  });

  test("returns results for a question about Professor Nui", () => {
    const results = retrieveRelevantDocs("Who is Professor Nui?");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].topic).toMatch(/Professor Nui/i);
    expect(results[0].body).toMatch(/extraordinary|legendary/i);
  });

  test("returns results for shorthand Professor N questions", () => {
    const results = retrieveRelevantDocs("Who is Professor N?");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].topic).toMatch(/Professor Nui/i);
    expect(results[0].body).toMatch(/extraordinary|legendary/i);
  });

  test("each result has topic, body, file, score, and method fields", () => {
    const results = retrieveRelevantDocs("registration");
    expect(results.length).toBeGreaterThan(0);
    for (const doc of results) {
      expect(doc).toHaveProperty("topic");
      expect(doc).toHaveProperty("body");
      expect(doc).toHaveProperty("file");
      expect(doc).toHaveProperty("score");
      expect(doc).toHaveProperty("method", "tfidf");
      expect(doc.score).toBeGreaterThan(0);
    }
  });

  test("respects the limit option", () => {
    const results = retrieveRelevantDocs("course registration minors schedule", { limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });
});

// ─── myCMU-Q portal retrieval (deep sub-pages) ───────────────────────────────

describe("retrieveRelevantDocs — myCMU-Q portal content", () => {
  function expectRelevant(results, { topicPattern, filePattern }) {
    expect(results.length).toBeGreaterThan(0);
    const topics = results.map((r) => r.topic.toLowerCase()).join(" ");
    const files = results.map((r) => r.file.toLowerCase()).join(" ");
    if (topicPattern) {
      expect(topics).toMatch(topicPattern);
    }
    if (filePattern) {
      expect(files).toMatch(filePattern);
    }
  }

  test("WiFi setup question retrieves connect-to-wifi content", () => {
    const results = retrieveRelevantDocs("How do I connect to CMUQ-SECURE wifi?");
    expectRelevant(results, { topicPattern: /wifi|network/i, filePattern: /connect-to-wifi|network-services/ });
  });

  test("VPN question retrieves vpn setup guide", () => {
    const results = retrieveRelevantDocs("How do I set up VPN with AnyConnect?");
    expectRelevant(results, { topicPattern: /vpn/i, filePattern: /vpn-setup-guide|network-services/ });
  });

  test("2FA question retrieves two-factor authentication page", () => {
    const results = retrieveRelevantDocs("How do I register for Duo 2FA?");
    expectRelevant(results, { topicPattern: /two.factor|2fa|authentication/i, filePattern: /two-factor-authentication/ });
  });

  test("printing question retrieves campus printing content", () => {
    const results = retrieveRelevantDocs("Where can I print on campus and release jobs?");
    expectRelevant(results, { topicPattern: /print/i, filePattern: /printing-services|campusprinting/ });
  });

  test("GPU question retrieves gpu resources guide", () => {
    const results = retrieveRelevantDocs("How do I access GPU resources for research?");
    expectRelevant(results, { topicPattern: /gpu|research/i, filePattern: /gpu-resources-guide|research-support/ });
  });

  test("CaPS-Q question retrieves counseling services", () => {
    const results = retrieveRelevantDocs("Is counseling free at CaPS-Q?");
    expectRelevant(results, { topicPattern: /caps|counseling|mental health/i, filePattern: /caps-q/ });
  });

  test("QF housing question retrieves housing page", () => {
    const results = retrieveRelevantDocs("How much is QF student housing per semester?");
    expectRelevant(results, { topicPattern: /housing|qf/i, filePattern: /qf-student-housing/ });
  });

  test("career tools question retrieves Handshake and VMock page", () => {
    const results = retrieveRelevantDocs("Where do I find Handshake and VMock?");
    expectRelevant(results, { topicPattern: /career/i, filePattern: /career-tools-resources/ });
  });

  test("Canvas student question retrieves canvas for students", () => {
    const results = retrieveRelevantDocs("How do I submit assignments on Canvas?");
    expectRelevant(results, { topicPattern: /canvas/i, filePattern: /canvas-for-students|canvas-help/ });
  });

  test("AI tools question retrieves artificial intelligence page", () => {
    const results = retrieveRelevantDocs("What CMU-approved AI tools can I use?");
    expectRelevant(results, { topicPattern: /artificial intelligence|ai tools/i, filePattern: /artificial-intelligence/ });
  });

  test("supplemental instruction question retrieves ARC SI page", () => {
    const results = retrieveRelevantDocs("What is supplemental instruction and who are SI leaders?");
    expectRelevant(results, { topicPattern: /supplemental instruction/i, filePattern: /supplemental-instruction/ });
  });

  test("emergency loan question retrieves emergency grants page", () => {
    const results = retrieveRelevantDocs("How do I apply for an emergency student loan?");
    expectRelevant(results, { topicPattern: /emergency|loan|grant/i, filePattern: /emergency-student-loans/ });
  });
});

// ─── buildContextBlock ────────────────────────────────────────────────────────

describe("buildContextBlock", () => {
  test("returns empty string for empty array", () => {
    expect(buildContextBlock([])).toBe("");
  });

  test("includes the document topic in the output", () => {
    const results = retrieveRelevantDocs("registration");
    const block = buildContextBlock(results);
    expect(block.length).toBeGreaterThan(0);
    expect(block).toContain("[Source:");
  });
});

// ─── checkKeyFacts ────────────────────────────────────────────────────────────

describe("checkKeyFacts", () => {
  test("returns empty array for empty query", () => {
    expect(checkKeyFacts("")).toEqual([]);
    expect(checkKeyFacts(null)).toEqual([]);
  });

  test("matches TAFAWQ GPA question to structured fact", () => {
    const facts = checkKeyFacts("What GPA do I need for TAFAWQ?");
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.some((f) => f.id === "tafawqGpaRequirement")).toBe(true);
  });

  test("matches course overload question to unit limit fact", () => {
    const facts = checkKeyFacts("What's the course overload unit limit?");
    expect(facts.some((f) => f.id === "courseOverloadUnitLimit")).toBe(true);
  });

  test("matches WiFi question to campus wifi networks fact", () => {
    const facts = checkKeyFacts("What are the campus WiFi network names?");
    expect(facts.some((f) => f.id === "campusWifiNetworks")).toBe(true);
  });

  test("matches QF housing cost question to housing rate fact", () => {
    const facts = checkKeyFacts("How much is QF residence hall per semester?");
    expect(facts.some((f) => f.id === "qfHousingSemesterRate")).toBe(true);
  });

  test("matches printing portal question to print retention fact", () => {
    const facts = checkKeyFacts("How long before print jobs are deleted on PaperCut?");
    expect(facts.some((f) => f.id === "printPortalAndRetention")).toBe(true);
  });

  test("matches CaPS-Q question to confidential services fact", () => {
    const facts = checkKeyFacts("Is CaPS-Q counseling free and confidential?");
    expect(facts.some((f) => f.id === "capsQConfidentialFree")).toBe(true);
  });

  test("returns no facts for unrelated queries", () => {
    expect(checkKeyFacts("xyzzy frobble quuxington")).toEqual([]);
  });

  test("buildKeyFactsBlock marks facts as authoritative", () => {
    const facts = checkKeyFacts("TAMAIYUZ application deadline");
    const block = buildKeyFactsBlock(facts);
    expect(block).toMatch(/AUTHORITATIVE STRUCTURED KEY FACTS/);
    expect(block).toMatch(/Last verified:/);
    expect(block).toMatch(/tamaiyuzApplicationWindow|tamaiyuz scholarship/i);
  });
});

// ─── computeConfidence ────────────────────────────────────────────────────────

describe("computeConfidence", () => {
  test("returns zero confidence for empty results", () => {
    const conf = computeConfidence([]);
    expect(conf.score).toBe(0);
    expect(conf.sourceCount).toBe(0);
    expect(conf.message).toBeNull();
  });

  test("returns confidence message with source count", () => {
    const results = retrieveRelevantDocs("What is StuCo?", { limit: 2 });
    const conf = computeConfidence(results);
    expect(conf.score).toBeGreaterThan(0);
    expect(conf.sourceCount).toBe(results.length);
    expect(conf.method).toBe("tfidf");
    expect(conf.message).toMatch(/Scotty is \d+% confident/);
    expect(conf.message).toMatch(/based on \d+ sources?/);
  });

  test("assigns low confidence to weak tangential matches", () => {
    const results = retrieveRelevantDocs("What are the quantum physics lab hours?", { limit: 2 });
    if (results.length) {
      const conf = computeConfidence(results);
      expect(conf.score).toBeLessThan(45);
    }
  });

  test("assigns high confidence to strong matches for tuition", () => {
    const results = retrieveRelevantDocs("How much is tuition per semester?", { limit: 2 });
    const conf = computeConfidence(results);
    expect(conf.score).toBeGreaterThanOrEqual(80);
  });

  test("assigns high confidence to strong matches", () => {
    const results = retrieveRelevantDocs("What is StuCo?", { limit: 2 });
    const conf = computeConfidence(results);
    expect(conf.score).toBeGreaterThanOrEqual(80);
  });
});

// ─── buildStudentContext ──────────────────────────────────────────────────────

describe("buildStudentContext", () => {
  const completeProfile = {
    major: "Computer Science",
    graduationDate: "May 2027",
    learningStyle: "visual",
    intendedUse: "course tutoring and campus navigation",
    onboardingComplete: true,
  };

  test("returns personalized paragraph for complete onboarding", () => {
    const context = buildStudentContext(completeProfile);
    expect(context).toMatch(/Computer Science/);
    expect(context).toMatch(/May 2027/);
    expect(context).toMatch(/visual/);
    expect(context).toMatch(/campus navigation/);
    expect(context).toMatch(/whiteboard brainstorms and flashcards/i);
  });

  test("returns empty string when onboarding is incomplete", () => {
    expect(buildStudentContext({ ...completeProfile, onboardingComplete: false })).toBe("");
    expect(buildStudentContext(null)).toBe("");
    expect(buildStudentContext(undefined)).toBe("");
  });

  test("returns empty string when any profile field is missing", () => {
    expect(buildStudentContext({ ...completeProfile, major: null })).toBe("");
    expect(buildStudentContext({ ...completeProfile, graduationDate: "" })).toBe("");
    expect(buildStudentContext({ ...completeProfile, learningStyle: "  " })).toBe("");
    expect(buildStudentContext({ ...completeProfile, intendedUse: null })).toBe("");
  });
});
