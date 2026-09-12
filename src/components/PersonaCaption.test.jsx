import { render, screen, act } from "@testing-library/react";
import PersonaCaption from "./PersonaCaption";

test("renders caption text", () => {
  render(<PersonaCaption text="Hello there" />);
  expect(screen.getByText("Hello there")).toBeInTheDocument();
});

test("types thinking letter by letter", () => {
  jest.useFakeTimers();
  render(<PersonaCaption text="thinking" typing />);

  expect(screen.queryByText("thinking")).not.toBeInTheDocument();

  act(() => {
    jest.advanceTimersByTime(70 * 8);
  });

  expect(screen.getByText("thinking")).toBeInTheDocument();
  jest.useRealTimers();
});
