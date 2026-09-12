import { fireEvent, render, screen } from "@testing-library/react";
import FacialAlignTool from "./FacialAlignTool";
import { DEFAULT_FACIAL_COORDS, loadFacialCoords } from "../utils/facialCoords";

describe("FacialAlignTool", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("lets the user scale the mouth and saves it for the persona", () => {
    render(<FacialAlignTool />);

    expect(screen.getByRole("heading", { name: /scotty face editor/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/drag mouth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/resize mouth/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/width/i), { target: { value: "18.5" } });
    fireEvent.change(screen.getByLabelText(/height/i), { target: { value: "9.2" } });
    fireEvent.change(document.getElementById("mouth-top"), { target: { value: "61.4" } });

    expect(loadFacialCoords()).toMatchObject({
      ...DEFAULT_FACIAL_COORDS,
      mouthWidth: 18.5,
      mouthHeight: 9.2,
      mouthTop: 61.4,
    });
  });

  test("reset restores the default mouth", () => {
    render(<FacialAlignTool />);

    fireEvent.change(screen.getByLabelText(/width/i), { target: { value: "22" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));

    expect(loadFacialCoords()).toEqual(DEFAULT_FACIAL_COORDS);
  });
});
