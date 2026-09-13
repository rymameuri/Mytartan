const { isMailConfigured, mailStatus, publicAppUrl } = require("./mailer");

describe("mailer", () => {
  test("is not configured without SMTP_HOST", () => {
    const env = {};
    expect(isMailConfigured(env)).toBe(false);
    expect(mailStatus(env).configured).toBe(false);
    expect(mailStatus(env).hint).toMatch(/SMTP_HOST/);
  });

  test("is configured with host and from", () => {
    const env = { SMTP_HOST: "smtp.example.com", SMTP_FROM: "scotty@example.com" };
    expect(isMailConfigured(env)).toBe(true);
    expect(mailStatus(env).configured).toBe(true);
  });

  test("publicAppUrl prefers APP_PUBLIC_URL and strips a trailing slash", () => {
    expect(publicAppUrl({ APP_PUBLIC_URL: "https://mytartan.example/" })).toBe(
      "https://mytartan.example"
    );
  });
});
