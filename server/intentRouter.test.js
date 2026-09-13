const { classifyIntent, shouldSelectReferrals } = require("./intentRouter");

describe("classifyIntent", () => {
  test("routes mental-health language to supportive counseling", () => {
    const intent = classifyIntent("I'm really struggling mentally");
    expect(intent).toEqual({
      role: "emotional_support",
      topic: "mental_health",
      intent: "emotional_support",
    });
    expect(shouldSelectReferrals(intent)).toBe(true);
  });

  test("keeps midterm stress supportive without forcing CaPS", () => {
    const intent = classifyIntent("I'm so done with this week");
    expect(intent.role).toBe("emotional_support");
    expect(intent.topic).not.toBe("mental_health");
    expect(shouldSelectReferrals(intent)).toBe(false);
  });

  test("treats official campus questions as academic facts", () => {
    const intent = classifyIntent("What are the quantum physics lab hours?");
    expect(intent.role).toBe("campus_assistant");
    expect(intent.topic).toBe("academics");
    expect(intent.intent).toBe("academic_fact");
    expect(shouldSelectReferrals(intent)).toBe(true);
  });

  test("routes financial aid separately from major advising", () => {
    const intent = classifyIntent("I need help with financial aid and my FAFSA");
    expect(intent.topic).toBe("financial_aid");
    expect(intent.role).toBe("campus_assistant");
    expect(intent.intent).toBe("academic_fact");
  });

  test("uses Socratic teacher role for learning questions", () => {
    const intent = classifyIntent("Help me understand how recursion works");
    expect(intent).toEqual({
      role: "teacher",
      topic: "academics",
      intent: "tutor",
    });
    expect(shouldSelectReferrals(intent)).toBe(false);
  });

  test("tutor app mode always teaches", () => {
    const intent = classifyIntent("What time is add/drop?", "tutor");
    expect(intent.role).toBe("teacher");
    expect(intent.intent).toBe("tutor");
  });

  test("campus life stays logistical", () => {
    const intent = classifyIntent("I'm bored, what events are happening tonight?");
    expect(intent.role).toBe("campus_assistant");
    expect(intent.topic).toBe("campus_life");
    expect(intent.intent).toBe("campus_life");
  });

  test("bored plus on-campus is campus life, not an academic-fact dump", () => {
    const intent = classifyIntent("I'm bored, what's on campus tonight?");
    expect(intent.topic).toBe("campus_life");
    expect(intent.intent).toBe("campus_life");
    expect(shouldSelectReferrals(intent)).toBe(true);
  });

  test("midterm stress is supportive academic mix, not CaPS", () => {
    const intent = classifyIntent("I have three midterms and I cannot think");
    expect(intent).toEqual({
      role: "emotional_support",
      topic: "academic_support",
      intent: "emotional_support",
    });
    expect(shouldSelectReferrals(intent)).toBe(true);
  });

  test("stressed about midterms stays academic-support", () => {
    const intent = classifyIntent("I'm stressed about midterms");
    expect(intent.topic).toBe("academic_support");
    expect(intent.role).toBe("emotional_support");
  });

  test("ugh midterms and I can't do this are generous support reads", () => {
    expect(classifyIntent("ugh midterms").topic).toBe("academic_support");
    expect(classifyIntent("I can't do this").role).toBe("emotional_support");
    expect(classifyIntent("I can't do this").intent).not.toBe("academic_fact");
  });
});
