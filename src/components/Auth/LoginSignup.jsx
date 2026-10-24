import { useState } from "react";
import ScottyPattern from "../ScottyPattern";
import { useAuth } from "../../context/AuthContext";
import "./LoginSignup.css";

function LoginSignup() {
  const { login, signup, continueAsGuest } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isLogin = mode === "login";

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
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
  }

  return (
    <div className="auth-page">
      <ScottyPattern />

      <div className="auth-page__content">
        <header className="auth-page__header">
          <h1 className="auth-page__title brand-display">MY TARTAN</h1>
          <p className="auth-page__subtitle">A CUSTOM AI PERSONA FOR CMUQ STUDENTS</p>
        </header>

        <main className="auth-page__main">
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

          <form className="auth-page__form" onSubmit={handleSubmit}>
            <label className="auth-page__field">
              <span className="auth-page__label">Email</span>
              <input
                type="email"
                className="auth-page__input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label className="auth-page__field">
              <span className="auth-page__label">Password</span>
              <input
                type="password"
                className="auth-page__input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLogin ? "current-password" : "new-password"}
                minLength={6}
                required
              />
            </label>

            {error && (
              <p className="auth-page__error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="auth-page__submit" disabled={submitting}>
              {submitting ? "Please wait…" : isLogin ? "Log in" : "Create account"}
            </button>
            <button type="button" className="auth-page__guest" onClick={continueAsGuest}>
              Continue to the demo
            </button>
          </form>
        </main>

        <footer className="auth-page__footer">
          MADE BY RYM A. AMEURI UNDER THE SUPERVISION OF THE IX LAB
        </footer>
      </div>
    </div>
  );
}

export default LoginSignup;
