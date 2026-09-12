import { render, screen } from "@testing-library/react";
import MessageContent from "./MessageContent";

const STUDENT_AFFAIRS =
  "https://sites.google.com/andrew.cmu.edu/mycmuq-student-affairs/home";

test("renders plain text", () => {
  render(<MessageContent content="StuCo is the Student College at CMU-Q." />);
  expect(screen.getByText("StuCo is the Student College at CMU-Q.")).toBeInTheDocument();
});

test("turns a URL into a clickable chat link", () => {
  render(
    <MessageContent
      content={`Hmm, I don't have that one.\n${STUDENT_AFFAIRS}`}
    />
  );

  const link = screen.getByRole("link", { name: /mycmu-q student affairs/i });
  expect(link).toHaveAttribute("href", STUDENT_AFFAIRS);
  expect(link).toHaveAttribute("target", "_blank");
  expect(screen.queryByText(STUDENT_AFFAIRS)).not.toBeInTheDocument();
});
