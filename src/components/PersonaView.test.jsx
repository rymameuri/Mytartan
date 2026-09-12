import { render, screen } from "@testing-library/react";
import PersonaView from "./PersonaView";

jest.mock("./ScottyAvatar", () => {
  return function MockScottyAvatar() {
    return <div data-testid="scotty-avatar" />;
  };
});

jest.mock("../hooks/useMicInput", () => ({
  useMicInput: () => ({ listening: false, isFinalizing: false, toggle: jest.fn() }),
}));

jest.mock("../hooks/useAvatarZoom", () => ({
  useAvatarZoom: () => ({ avatarStyle: {} }),
}));

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
    expect(screen.getByText("MyTartan")).toBeInTheDocument();
    expect(screen.getByText(/hey, i'm scotty/i)).toBeInTheDocument();
    expect(screen.getByText(/your cmu-q classmate/i)).toBeInTheDocument();
    expect(screen.getByText(/hey\. what's going on\?/i)).toBeInTheDocument();
  });

  test("has one mic instruction plus a type-here fallback", () => {
    renderPersona();
    expect(screen.getByText("Tap the mic")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/or type here/i)).toBeInTheDocument();
    expect(screen.queryByText(/tap to speak/i)).not.toBeInTheDocument();
  });

  test("hides course tutor and scale chrome", () => {
    renderPersona();
    expect(screen.queryByRole("tab", { name: /course tutor/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /persona/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/drag to scale/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/share chat/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/download chat/i)).not.toBeInTheDocument();
  });
});
