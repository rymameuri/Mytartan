import { render, screen } from "@testing-library/react";
import ScottyAvatar from "./ScottyAvatar";

test("idle mascot does not lock a live mouth pose", () => {
  render(<ScottyAvatar />);
  const avatar = screen.getByRole("img", { name: /scotty/i });
  expect(avatar).not.toHaveAttribute("data-mouth");
  expect(avatar.className).not.toMatch(/lip-sync/);
});
