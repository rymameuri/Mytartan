import { render, screen, fireEvent } from "@testing-library/react";
import PersonaView from "./PersonaView";

jest.mock("./ScottyAvatar", () => {
  return function MockScottyAvatar() {
    return <div data-testid="scotty-avatar" />;
  };
});

jest.mock("../hooks/useMicInput", () => ({
  useMicInput: () => ({
    listening: false,
    reviewing: false,
    isFinalizing: false,
    transcript: "",
    setTranscript: jest.fn(),
    toggle: jest.fn(),
    reset: jest.fn(),
  }),
}));

jest.mock("./MessageFeedback", () => {
  return function MockMessageFeedback() {
    return null;
  };
});

const voiceModeRef = { current: false };
const noOp = () => {};

function renderPersona(props = {}) {
  return render(
    <PersonaView
      messages={[]}
      isLoading={false}
      onSend={noOp}
      onShare={noOp}
      onDownload={noOp}
      voiceModeRef={voiceModeRef}
      {...props}
    />
  );
}

describe("PersonaView empty state", () => {
  test("introduces Scotty as the classmate and MyTartan as the app", () => {
    renderPersona();
    expect(screen.getByText(/mytartan/i)).toBeInTheDocument();
    expect(screen.getByText(/hey, i'm scotty/i)).toBeInTheDocument();
    expect(screen.getByText(/your cmu-q classmate/i)).toBeInTheDocument();
    expect(screen.getByText(/what's going on\?/i)).toBeInTheDocument();
  });

  test("has a type-first composer with a secondary mic", () => {
    renderPersona();
    expect(screen.getByPlaceholderText(/message scotty/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/speak to scotty/i)).toBeInTheDocument();
    expect(screen.queryByText(/tap the mic/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tap to speak/i)).not.toBeInTheDocument();
  });

  test("hides course tutor, tartan wallpaper, and scale chrome", () => {
    renderPersona();
    expect(screen.queryByRole("tab", { name: /course tutor/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /persona/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/drag to scale/i)).not.toBeInTheDocument();
    expect(document.querySelector(".scotty-pattern")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/share chat/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/download chat/i)).not.toBeInTheDocument();
  });

  test("shows a hero Scotty and starter chips that send", () => {
    const onSend = jest.fn();
    renderPersona({ onSend });
    expect(document.querySelector(".pv-empty__mark")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stressed about midterms/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /stressed about midterms/i }));
    expect(onSend).toHaveBeenCalledWith(
      "I'm stressed about midterms. Can you help me get through this week?"
    );
  });

  test("opens a quiz studio with Scotty docked and one question", () => {
    renderPersona({
      messages: [
        { role: "user", content: "quiz me on notes.txt" },
        { role: "assistant", content: "Quiz from your notes.", studio: true },
      ],
      teachStudio: {
        kind: "quiz",
        title: "Quiz · notes.txt",
        sourceName: "notes.txt",
        questions: [
          {
            number: "1",
            text: "What is a base case?",
            options: [
              { id: "A", text: "Stopping condition" },
              { id: "B", text: "First line" },
            ],
            correct: "A",
            explanation: "Recursion must stop.",
          },
        ],
        reaction: { type: "teach", text: "Whenever you're ready — pick an answer." },
      },
    });
    expect(document.querySelector(".pv--studio")).toBeInTheDocument();
    expect(screen.getByText(/quiz studio/i)).toBeInTheDocument();
    expect(screen.getByText(/What is a base case/i)).toBeInTheDocument();
    expect(screen.getByText(/Whenever you're ready/i)).toBeInTheDocument();
    expect(screen.queryByText(/What is the call stack/i)).not.toBeInTheDocument();
  });

  test("opens a whiteboard studio for an animated mind-map", () => {
    renderPersona({
      messages: [{ role: "user", content: "whiteboard recursion" }],
      teachStudio: {
        kind: "mindmap",
        title: "Recursion",
        step: 0,
        map: {
          title: "Recursion",
          width: 800,
          height: 520,
          nodes: [
            { id: "n0", label: "Recursion", x: 400, y: 250 },
            { id: "n1", label: "Base case", x: 600, y: 250 },
          ],
          links: [{ id: "e1", from: "n0", to: "n1" }],
          steps: [
            { revealNodeIds: ["n0"], revealLinkIds: [], narration: "Start at the center." },
            { revealNodeIds: ["n1"], revealLinkIds: ["e1"], narration: "Add the base case." },
          ],
        },
        reaction: { type: "teach", text: "Start at the center." },
      },
    });
    expect(screen.getByText(/whiteboard studio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mind map of recursion/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Start at the center/i).length).toBeGreaterThan(0);
  });

  test("opens a study studio for a CMU-style cheat sheet", () => {
    renderPersona({
      messages: [{ role: "user", content: "cheat sheet from these slides" }],
      teachStudio: {
        kind: "sheet",
        title: "Cheat sheet · 15-112",
        sourceName: "15-112-recursion.pptx",
        density: "dense",
        step: 0,
        sheet: {
          kind: "cheatsheet",
          title: "Cheat sheet · 15-112",
          sourceName: "15-112-recursion.pptx",
          courseLabel: "15-112",
          courseCode: "15-112",
          density: "dense",
          disclaimer: "From your notes — not an official past paper.",
          sections: [
            {
              id: "defs",
              kicker: "Be exact",
              title: "Key definitions",
              items: [{ lead: "Core", body: "Recursion needs a base case so the calls can stop." }],
              narration: "Definitions first.",
            },
          ],
          footerNote: "Not official CMU exams.",
        },
        reaction: { type: "teach", text: "I'll lay this out like a CMU one-pager." },
      },
    });
    expect(screen.getByText(/study studio/i)).toBeInTheDocument();
    expect(screen.getByText(/Key definitions/i)).toBeInTheDocument();
    expect(screen.getByText(/not an official past paper/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /denser/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /print/i })).toBeInTheDocument();
  });

  test("hides chips and the hero once a conversation has started", () => {
    renderPersona({
      messages: [
        { role: "user", content: "Where is the library?" },
        { role: "assistant", content: "The library is in the Academic Building." },
      ],
    });
    expect(screen.queryByRole("button", { name: /stressed about midterms/i })).not.toBeInTheDocument();
    expect(document.querySelector(".pv-empty__mark")).not.toBeInTheDocument();
    expect(document.querySelector(".pv-header__avatar")).toBeInTheDocument();
  });
});
