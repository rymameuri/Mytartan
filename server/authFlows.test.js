/**
 * Auth funnel: signup, login errors, password reset, email verification.
 * Uses the real JWT + JSON user store. Mail is left unconfigured so reset/verify
 * prove honest 503s, then tokens are planted to exercise the consume endpoints.
 */
const request = require("supertest");

process.env.AI_PROVIDER = "claude";
process.env.ANTHROPIC_API_KEY = "placeholder";
process.env.CLAUDE_API_KEY = "placeholder";
process.env.AI_GATEWAY_BASE_URL = "";
delete process.env.SMTP_HOST;
delete process.env.SMTP_FROM;

const app = require("./server");
const { patchUser, getUserByEmail } = require("./userStore");
const { createToken, VERIFY_TTL_MS, RESET_TTL_MS } = require("./authTokens");

function uniqueEmail(label) {
  return `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@cmu.edu`;
}

describe("auth funnel", () => {
  test("mail-status reports when SMTP is missing", async () => {
    const res = await request(app).get("/api/auth/mail-status");
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
    expect(res.body.hint).toMatch(/SMTP_HOST/);
  });

  test("signup creates a session and is honest when mail cannot send", async () => {
    const email = uniqueEmail("signup");
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email, password: "testpass123" });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.emailVerified).toBe(false);
    expect(res.body.email.sent).toBe(false);
    expect(res.body.email.reason).toMatch(/SMTP_HOST/);
  });

  test("signup rejects a short password", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: uniqueEmail("short"), password: "123" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 6 characters/i);
  });

  test("login returns a clear error for a bad password", async () => {
    const email = uniqueEmail("login");
    await request(app).post("/api/auth/signup").send({ email, password: "testpass123" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  test("forgot-password is 503 when SMTP is not configured", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "anyone@cmu.edu" });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/SMTP_HOST/);
    expect(res.body.email.sent).toBe(false);
  });

  test("reset-password consumes a hashed token and updates the password", async () => {
    const email = uniqueEmail("reset");
    await request(app).post("/api/auth/signup").send({ email, password: "oldpass123" });
    const user = getUserByEmail(email);
    const issued = createToken(RESET_TTL_MS);
    patchUser(user.id, {
      resetTokenHash: issued.hash,
      resetTokenExpires: issued.expiresAt,
    });

    const resetRes = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: issued.token, password: "newpass123" });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.ok).toBe(true);

    const badOld = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "oldpass123" });
    expect(badOld.status).toBe(401);

    const okNew = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "newpass123" });
    expect(okNew.status).toBe(200);
    expect(okNew.body.token).toBeTruthy();
  });

  test("verify-email consumes a hashed token and marks the user verified", async () => {
    const email = uniqueEmail("verify");
    const signup = await request(app)
      .post("/api/auth/signup")
      .send({ email, password: "testpass123" });
    const user = getUserByEmail(email);
    const issued = createToken(VERIFY_TTL_MS);
    patchUser(user.id, {
      verifyTokenHash: issued.hash,
      verifyTokenExpires: issued.expiresAt,
    });

    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: issued.token });
    expect(res.status).toBe(200);
    expect(res.body.user.emailVerified).toBe(true);
    expect(res.body.token).toBeTruthy();
    expect(getUserByEmail(email).emailVerified).toBe(true);
    expect(signup.body.user.emailVerified).toBe(false);
  });

  test("profile PATCH persists preferredName and marks onboarding complete", async () => {
    const email = uniqueEmail("profile");
    const signup = await request(app)
      .post("/api/auth/signup")
      .send({ email, password: "testpass123" });

    const res = await request(app)
      .patch("/api/auth/profile")
      .set("Authorization", `Bearer ${signup.body.token}`)
      .send({
        preferredName: "Rym",
        major: "Computer Science",
        graduationDate: "May 2028",
        learningStyle: "Talking it through",
        intendedUse: "Someone to talk to",
      });

    expect(res.status).toBe(200);
    expect(res.body.profile.preferredName).toBe("Rym");
    expect(res.body.profile.onboardingComplete).toBe(true);

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${signup.body.token}`);
    expect(me.body.profile.preferredName).toBe("Rym");
    expect(me.body.profile.major).toBe("Computer Science");
  });
});
