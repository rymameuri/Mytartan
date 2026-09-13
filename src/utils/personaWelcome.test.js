import { personaWelcomeCaption } from "./personaWelcome";

describe("personaWelcomeCaption", () => {
  test("uses preferred name and major when both exist", () => {
    expect(
      personaWelcomeCaption({ preferredName: "Rym", major: "Computer Science" })
    ).toBe("Hey Rym — Computer Science, right? What's going on?");
  });

  test("uses preferred name alone", () => {
    expect(personaWelcomeCaption({ preferredName: "Rym" })).toBe("Hey Rym. What's going on?");
  });

  test("falls back when the profile is empty", () => {
    expect(personaWelcomeCaption()).toBe("What's going on?");
    expect(personaWelcomeCaption({})).toBe("What's going on?");
    expect(personaWelcomeCaption(null)).toBe("What's going on?");
  });
});
