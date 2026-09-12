import { render, screen, fireEvent } from "@testing-library/react";
import LoginSignup, { validateAuthForm } from "./LoginSignup";

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    login: jest.fn(),
    signup: jest.fn(),
  }),
}));

describe("LoginSignup branding", () => {
  test("introduces Scotty with MyTartan as the app name", () => {
    render(<LoginSignup />);
    expect(screen.getByRole("heading", { name: /hey, i'm scotty/i })).toBeInTheDocument();
    expect(screen.getByText(/your cmu-q classmate/i)).toBeInTheDocument();
    expect(screen.getByText("MyTartan")).toBeInTheDocument();
    expect(screen.getByAltText(/scotty, the cmu mascot/i)).toBeInTheDocument();
  });

  test("places log in and sign up on a readable card", () => {
    render(<LoginSignup />);
    expect(screen.getByRole("tab", { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /sign up/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^log in$/i })).toBeInTheDocument();
    expect(document.querySelector(".auth-page__card")).toBeInTheDocument();
  });
});

describe("LoginSignup validation", () => {
  test("shows inline errors instead of relying on native tooltips", () => {
    render(<LoginSignup />);
    fireEvent.click(screen.getByRole("button", { name: /^log in$/i }));
    expect(screen.getByText(/enter your email/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your password/i)).toBeInTheDocument();
    expect(document.querySelector("form").noValidate).toBe(true);
  });

  test("validateAuthForm requires a longer password on signup", () => {
    expect(
      validateAuthForm({ email: "ada@cmu.edu", password: "123", isLogin: false }).password
    ).toMatch(/at least 6 characters/i);
    expect(
      validateAuthForm({ email: "ada@cmu.edu", password: "123", isLogin: true }).password
    ).toBeUndefined();
  });
});
