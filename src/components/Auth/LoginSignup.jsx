import { useEffect, useMemo, useState } from "react";
import ScottyAvatar from "../ScottyAvatar";
import { useAuth } from "../../context/AuthContext";
import "./LoginSignup.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readQuery() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function validateAuthForm({ email, password, isLogin }) {
  const fieldErrors = {};
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    fieldErrors.email = "Enter your email.";
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (!password) {
    fieldErrors.password = "Enter your password.";
  } else if (!isLogin && password.length < 6) {
    fieldErrors.password = "Password must be at least 6 characters.";
  }

  return fieldErrors;
}

function initialViewFromUrl() {
  const params = readQuery();
  if (params.get("verify")) return "verify";
  if (params.get("reset")) return "reset";
  if (params.get("view") === "login") return "login";
  if (params.get("view") === "signup") return "signup";
  if (params.get("view") === "forgot") return "forgot";
  return "landing";
}

function AuthCard({ title, children }) {
  return (
    <div className="auth-page__card">
      {title ? <h2 className="auth-page__card-title">{title}</h2> : null}
      {children}
    </div>
  );
}

function LoginSignup({ initialView } = {}) {
  const {
    login,
    signup,
    requestPasswordReset,
    resetPassword,
    verifyEmail,
  } = useAuth();
  const params = useMemo(() => readQuery(), []);
  const [view, setView] = useState(initialView || initialViewFromUrl);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [verifyState, setVerifyState] = useState(params.get("verify") ? "pending" : "");

  const isLogin = view === "login";

  useEffect(() => {
    if (view !== "verify") return undefined;
    const token = params.get("verify");
    if (!token) {
      setVerifyState("missing");
      return undefined;
    }
    let cancelled = false;
    setVerifyState("pending");
    verifyEmail(token)
      .then(() => {
        if (!cancelled) setVerifyState("ok");
      })
      .catch((err) => {
        if (!cancelled) {
          setVerifyState("error");
          setError(err.message || "That verification link did not work.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [view, params, verifyEmail]);

  function switchView(next) {
    setView(next);
    setError("");
    setNotice("");
    setFieldErrors({});
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    const nextFieldErrors = validateAuthForm({ email, password, isLogin });
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        const data = await signup(email.trim(), password);
        if (data.email && data.email.sent === false && data.email.reason) {
          setNotice(data.email.reason);
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgot(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!email.trim()) {
      setFieldErrors({ email: "Enter your email." });
      return;
    }
    setSubmitting(true);
    try {
      const data = await requestPasswordReset(email.trim());
      setNotice(data.message || "If that email is registered, we sent a reset link.");
    } catch (err) {
      setError(err.message || "Could not start a password reset.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!password || password.length < 6) {
      setFieldErrors({ password: "Password must be at least 6 characters." });
      return;
    }
    const token = params.get("reset");
    if (!token) {
      setError("That reset link is missing a token.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await resetPassword(token, password);
      setNotice(data.message || "Password updated. You can log in.");
      setView("login");
    } catch (err) {
      setError(err.message || "Could not reset that password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`auth-page${view === "landing" ? " auth-page--landing" : ""}`}>
      <div className="auth-page__content">
        <header className="auth-page__intro">
          <div className={`auth-page__hero${view === "landing" ? " auth-page__hero--large" : ""}`}>
            <ScottyAvatar persona hero={view === "landing"} />
          </div>
          <p className="auth-page__app-name">MyTartan</p>
          <h1 className="auth-page__greeting">Hey, I&apos;m Scotty</h1>
          <p className="auth-page__tagline">Your CMU-Q classmate — campus answers, company, and study help.</p>
        </header>

        <main className="auth-page__main">
          {view === "landing" && (
            <div className="auth-page__overview">
              <ul className="auth-page__points">
                <li>Ask campus questions in classmate voice, not a portal dump.</li>
                <li>Talk through a rough night or a quiet study plan.</li>
                <li>Quiz and whiteboard from your own notes — Scotty stays with you.</li>
              </ul>
              <div className="auth-page__cta-row">
                <button type="button" className="auth-page__submit" onClick={() => switchView("signup")}>
                  Get started
                </button>
                <button type="button" className="auth-page__ghost" onClick={() => switchView("login")}>
                  Log in
                </button>
              </div>
            </div>
          )}

          {(view === "login" || view === "signup") && (
            <AuthCard>
              <div className="auth-page__tabs" role="tablist" aria-label="Authentication mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={isLogin}
                  className={`auth-page__tab${isLogin ? " auth-page__tab--active" : ""}`}
                  onClick={() => switchView("login")}
                >
                  Log in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={!isLogin}
                  className={`auth-page__tab${!isLogin ? " auth-page__tab--active" : ""}`}
                  onClick={() => switchView("signup")}
                >
                  Sign up
                </button>
              </div>

              <form className="auth-page__form" onSubmit={handleAuthSubmit} noValidate>
                <label className="auth-page__field" htmlFor="auth-email">
                  <span className="auth-page__label">Email</span>
                  <input
                    id="auth-email"
                    type="email"
                    className={`auth-page__input${fieldErrors.email ? " auth-page__input--error" : ""}`}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    autoComplete="email"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? "auth-email-error" : undefined}
                  />
                  {fieldErrors.email && (
                    <span id="auth-email-error" className="auth-page__field-error" role="alert">
                      {fieldErrors.email}
                    </span>
                  )}
                </label>

                <label className="auth-page__field" htmlFor="auth-password">
                  <span className="auth-page__label">Password</span>
                  <input
                    id="auth-password"
                    type="password"
                    className={`auth-page__input${fieldErrors.password ? " auth-page__input--error" : ""}`}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? "auth-password-error" : undefined}
                  />
                  {fieldErrors.password && (
                    <span id="auth-password-error" className="auth-page__field-error" role="alert">
                      {fieldErrors.password}
                    </span>
                  )}
                </label>

                {isLogin && (
                  <button type="button" className="auth-page__text-btn" onClick={() => switchView("forgot")}>
                    Forgot password?
                  </button>
                )}

                {error && (
                  <p className="auth-page__error" role="alert">
                    {error}
                  </p>
                )}
                {notice && (
                  <p className="auth-page__notice" role="status">
                    {notice}
                  </p>
                )}

                <button type="submit" className="auth-page__submit" disabled={submitting}>
                  {submitting ? "Please wait…" : isLogin ? "Log in" : "Create account"}
                </button>
              </form>
              <button type="button" className="auth-page__text-btn auth-page__text-btn--center" onClick={() => switchView("landing")}>
                Back to overview
              </button>
            </AuthCard>
          )}

          {view === "forgot" && (
            <AuthCard title="Reset your password">
              <p className="auth-page__help">
                We&apos;ll email a reset link if this address has a MyTartan account. If mail isn&apos;t configured on the
                server, you&apos;ll see an honest error — we won&apos;t pretend it sent.
              </p>
              <form className="auth-page__form" onSubmit={handleForgot} noValidate>
                <label className="auth-page__field" htmlFor="auth-forgot-email">
                  <span className="auth-page__label">Email</span>
                  <input
                    id="auth-forgot-email"
                    type="email"
                    className={`auth-page__input${fieldErrors.email ? " auth-page__input--error" : ""}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                  {fieldErrors.email && (
                    <span className="auth-page__field-error" role="alert">
                      {fieldErrors.email}
                    </span>
                  )}
                </label>
                {error && (
                  <p className="auth-page__error" role="alert">
                    {error}
                  </p>
                )}
                {notice && (
                  <p className="auth-page__notice" role="status">
                    {notice}
                  </p>
                )}
                <button type="submit" className="auth-page__submit" disabled={submitting}>
                  {submitting ? "Please wait…" : "Send reset link"}
                </button>
              </form>
              <button type="button" className="auth-page__text-btn auth-page__text-btn--center" onClick={() => switchView("login")}>
                Back to log in
              </button>
            </AuthCard>
          )}

          {view === "reset" && (
            <AuthCard title="Choose a new password">
              <form className="auth-page__form" onSubmit={handleReset} noValidate>
                <label className="auth-page__field" htmlFor="auth-reset-password">
                  <span className="auth-page__label">New password</span>
                  <input
                    id="auth-reset-password"
                    type="password"
                    className={`auth-page__input${fieldErrors.password ? " auth-page__input--error" : ""}`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  {fieldErrors.password && (
                    <span className="auth-page__field-error" role="alert">
                      {fieldErrors.password}
                    </span>
                  )}
                </label>
                {error && (
                  <p className="auth-page__error" role="alert">
                    {error}
                  </p>
                )}
                {notice && (
                  <p className="auth-page__notice" role="status">
                    {notice}
                  </p>
                )}
                <button type="submit" className="auth-page__submit" disabled={submitting}>
                  {submitting ? "Please wait…" : "Update password"}
                </button>
              </form>
            </AuthCard>
          )}

          {view === "verify" && (
            <AuthCard title="Email verification">
              {verifyState === "pending" && <p className="auth-page__help">Checking that link…</p>}
              {verifyState === "ok" && (
                <p className="auth-page__notice" role="status">
                  Email verified. You&apos;re in — next I&apos;ll learn how to talk to you.
                </p>
              )}
              {verifyState === "missing" && (
                <p className="auth-page__error" role="alert">
                  This page needs a verification token from your email.
                </p>
              )}
              {verifyState === "error" && (
                <p className="auth-page__error" role="alert">
                  {error || "That verification link is invalid or expired."}
                </p>
              )}
              <button type="button" className="auth-page__text-btn auth-page__text-btn--center" onClick={() => switchView("login")}>
                Go to log in
              </button>
            </AuthCard>
          )}
        </main>

        <footer className="auth-page__footer">
          Made by Rym A. Ameuri under the supervision of the IX Lab
        </footer>
      </div>
    </div>
  );
}

export default LoginSignup;
export { validateAuthForm };
