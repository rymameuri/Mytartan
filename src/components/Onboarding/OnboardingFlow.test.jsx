import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OnboardingFlow from "./OnboardingFlow";

const mockUpdateProfile = jest.fn();

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ updateProfile: mockUpdateProfile }),
}));

describe("OnboardingFlow", () => {
  beforeEach(() => {
    mockUpdateProfile.mockReset();
    mockUpdateProfile.mockResolvedValue({ profile: { onboardingComplete: true } });
  });

  test("asks what Scotty should call you and explains why", () => {
    render(<OnboardingFlow />);
    expect(screen.getByRole("heading", { name: /what should scotty call you/i })).toBeInTheDocument();
    expect(screen.getByText(/greet you by this name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  test("persists every pick including preferred name", async () => {
    render(<OnboardingFlow />);

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. rym/i), { target: { value: "Rym" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    fireEvent.change(screen.getByPlaceholderText(/computer science/i), {
      target: { value: "Computer Science" },
    });
    expect(screen.getByText(/right cmu-q advisor/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    fireEvent.change(screen.getByLabelText(/month/i), { target: { value: "05" } });
    fireEvent.change(screen.getByLabelText(/year/i), { target: { value: String(new Date().getFullYear() + 2) } });
    expect(screen.getByText(/year-aware referrals/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    fireEvent.click(screen.getByRole("button", { name: /someone to talk to/i }));
    fireEvent.click(screen.getByRole("button", { name: /talking it through/i }));
    fireEvent.click(screen.getByRole("button", { name: /meet scotty/i }));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        preferredName: "Rym",
        learningStyle: "Talking it through",
        intendedUse: "Someone to talk to",
        major: "Computer Science",
        graduationDate: `May ${new Date().getFullYear() + 2}`,
      });
    });
  });
});
