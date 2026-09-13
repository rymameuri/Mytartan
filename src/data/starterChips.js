export const STARTER_CHIPS = [
  {
    id: "stressed",
    label: "I'm stressed about midterms",
    prompt: "I'm stressed about midterms. Can you help me get through this week?",
    tags: ["mood", "academic"],
  },
  {
    id: "bored",
    label: "What's on campus tonight?",
    prompt: "I'm bored — what can I do on campus tonight?",
    tags: ["campus", "mood"],
  },
  {
    id: "register",
    label: "How do I register or add/drop?",
    prompt: "How do I register or add/drop a course at CMU-Q?",
    tags: ["admin", "academic"],
  },
  {
    id: "aid",
    label: "Who do I talk to about financial aid?",
    prompt: "Who do I talk to about financial aid at CMU-Q?",
    tags: ["admin"],
  },
  {
    id: "quiet",
    label: "Where's a quiet place to study?",
    prompt: "Where's a quiet place to study on the CMU-Q campus?",
    tags: ["campus", "academic"],
  },
  {
    id: "week",
    label: "Help me plan my week",
    prompt: "Help me plan my week at CMU-Q.",
    tags: ["mood", "academic"],
  },
];

function intendedUseScore(intendedUse, chip) {
  const use = (intendedUse || "").toLowerCase();
  if (!use) return 0;
  if (use.includes("talk") && chip.tags.includes("mood")) return 3;
  if (use.includes("way around") && chip.tags.includes("campus")) return 3;
  if ((use.includes("campus question") || use.includes("general")) && chip.tags.includes("admin")) {
    return 3;
  }
  return 0;
}

function majorScore(major, chip) {
  if (!major?.trim()) return 0;
  return chip.tags.includes("academic") ? 1 : 0;
}

export function orderStarterChips(profile = {}) {
  const { intendedUse, major } = profile;
  return [...STARTER_CHIPS].sort((a, b) => {
    const scoreA = intendedUseScore(intendedUse, a) + majorScore(major, a);
    const scoreB = intendedUseScore(intendedUse, b) + majorScore(major, b);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return STARTER_CHIPS.findIndex((chip) => chip.id === a.id)
      - STARTER_CHIPS.findIndex((chip) => chip.id === b.id);
  });
}
