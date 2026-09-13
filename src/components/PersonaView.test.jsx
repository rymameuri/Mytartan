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
