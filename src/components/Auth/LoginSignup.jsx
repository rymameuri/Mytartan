import { useState } from "react";
import ScottyPattern from "../ScottyPattern";
import ScottyMascot from "../ScottyMascot";
import { useAuth } from "../../context/AuthContext";
import "./LoginSignup.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function LoginSignup() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const isLogin = mode === "login";

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const nextFieldErrors = validateAuthForm({ email, password, isLogin });
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        await signup(email.trim(), password);
      }
    } catch (err) {
      const message = err.message || "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setFieldErrors({});
  }

  return (
    <div className="auth-page">
      <ScottyPattern />

      <div className="auth-page__content">
        <header className="auth-page__intro">
          <ScottyMascot className="auth-page__mascot" />
          <h1 className="auth-page__greeting brand-display">Hey, I&apos;m Scotty</h1>
          <p className="auth-page__tagline">Your CMU-Q classmate</p>
          <p className="auth-page__app-name">MyTartan</p>
        </header>

        <main className="auth-page__main">
          <div className="auth-page__card">
            <div className="auth-page__tabs" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                role="tab"
                aria-selected={isLogin}
                className={`auth-page__tab${isLogin ? " auth-page__tab--active" : ""}`}
                onClick={() => switchMode("login")}
              >
                Log in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!isLogin}
                className={`auth-page__tab${!isLogin ? " auth-page__tab--active" : ""}`}
                onClick={() => switchMode("signup")}
              >
                Sign up
              </button>
            </div>

            <form className="auth-page__form" onSubmit={handleSubmit} noValidate>
              <label className="auth-page__field" htmlFor="auth-email">
                <span className="auth-page__label">Email</span>
                <input
                  id="auth-email"
                  type="email"
                  className={`auth-page__input${fieldErrors.email ? " auth-page__input--error" : ""}`}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }
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
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
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

              {error && (
                <p className="auth-page__error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" className="auth-page__submit" disabled={submitting}>
                {submitting ? "Please wait…" : isLogin ? "Log in" : "Create account"}
              </button>
            </form>
          </div>
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
