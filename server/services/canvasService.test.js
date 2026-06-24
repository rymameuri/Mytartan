const axios = require("axios");
const { setConnection, clearConnection } = require("../canvasStore");
const { createUser, clearUserCanvasConnection } = require("../userStore");
const {
  getCanvasContext,
  isDueToday,
  stripHtml,
  truncateDescription,
  formatCanvasContext,
  _clearAllCaches,
} = require("./canvasService");

jest.mock("axios", () => ({
  get: jest.fn(),
  defaults: { proxy: false },
}));

describe("canvasService helpers", () => {
  test("stripHtml removes tags and collapses whitespace", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
    expect(stripHtml(null)).toBeNull();
  });

  test("truncateDescription limits to 800 chars", () => {
    const long = "a".repeat(900);
    expect(truncateDescription(long)).toBe(`${"a".repeat(800)}...`);
    expect(truncateDescription("short")).toBe("short");
  });

  test("isDueToday compares local calendar date", () => {
    const now = new Date();
    const todayIso = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59
    ).toISOString();
    const tomorrowIso = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      12,
      0
    ).toISOString();

    expect(isDueToday(todayIso)).toBe(true);
    expect(isDueToday(tomorrowIso)).toBe(false);
  });

  test("formatCanvasContext renders due today and upcoming blocks", () => {
    const now = new Date();
    const todayIso = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      17,
      0
    ).toISOString();
    const laterIso = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 3,
      12,
      0
    ).toISOString();

    const output = formatCanvasContext(
      [
        {
          id: 1,
          name: "15-213",
          assignments: [
            { id: 10, name: "Lab 3", due_at: todayIso },
            { id: 11, name: "Project 1", due_at: laterIso },
          ],
        },
      ],
      [
        {
          courseName: "15-213",
          name: "Lab 3",
          due_at: todayIso,
          points_possible: 10,
          submission_types: ["online_upload"],
          description: "<p>Submit your lab report.</p>",
        },
      ]
    );

    expect(output).toContain("DUE TODAY (");
    expect(output).toContain("- 15-213: Lab 3");
    expect(output).toContain("Submit via: online_upload");
    expect(output).toContain("Instructions: Submit your lab report.");
    expect(output).toContain("UPCOMING ASSIGNMENTS:");
    expect(output).toContain("- 15-213: Project 1, due");
  });

  test("formatCanvasContext handles empty due today", () => {
    const output = formatCanvasContext([], []);
    expect(output).toContain("DUE TODAY: Nothing due today.");
    expect(output).toContain("UPCOMING ASSIGNMENTS:\nNone listed.");
  });
});

describe("getCanvasContext", () => {
  const sessionId = "user-canvas-test";

  beforeEach(() => {
    _clearAllCaches();
    clearUserCanvasConnection(sessionId);
    clearConnection(sessionId);
    axios.get.mockReset();
    createUser({
      id: sessionId,
      email: `canvas-svc-${Date.now()}@example.com`,
      passwordHash: "hash",
    });
  });

  test("returns null when Canvas is not connected", async () => {
    expect(await getCanvasContext(sessionId)).toBeNull();
  });

  test("fetches courses, assignments, and formats context", async () => {
    const now = new Date();
    const todayIso = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      18,
      30
    ).toISOString();

    setConnection(sessionId, "https://canvas.cmu.edu", "token-abc");

    axios.get.mockImplementation(async (url) => {
      if (url.includes("/courses?enrollment_state=active")) {
        return { data: [{ id: 101, name: "Intro to CS" }] };
      }
      if (url.includes("/courses/101/assignments?bucket=upcoming")) {
        return { data: [{ id: 501, name: "Homework 2", due_at: todayIso }] };
      }
      if (url.includes("/courses/101/assignments/501")) {
        return {
          data: {
            id: 501,
            name: "Homework 2",
            due_at: todayIso,
            points_possible: 20,
            submission_types: ["online_text_entry"],
            description: null,
          },
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const context = await getCanvasContext(sessionId);
    expect(context).toContain("DUE TODAY (");
    expect(context).toContain("- Intro to CS: Homework 2");
    expect(context).toContain(
      "Instructions: No instructions provided — check Canvas directly."
    );
  });

  test("returns null when Canvas API fails", async () => {
    setConnection(sessionId, "https://canvas.cmu.edu", "bad-token");
    axios.get.mockRejectedValue(new Error("Unauthorized"));

    expect(await getCanvasContext(sessionId)).toBeNull();
  });
});
