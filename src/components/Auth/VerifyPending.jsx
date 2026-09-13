import { useState } from "react";
import ScottyAvatar from "../ScottyAvatar";
import { useAuth } from "../../context/AuthContext";
import "./LoginSignup.css";

function VerifyPending() {
  const { user, resendVerification, logout } = useAuth();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleResend() {
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      const data = await resendVerification();
      if (data.email?.sent) {
        setNotice(data.message || "Verification email sent.");
      } else {
        setError(data.email?.reason || data.message || "Could not send verification.");
      }
    } catch (err) {
      setError(err.message || "Could not send verification.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__content">
        <header className="auth-page__intro">
          <div className="auth-page__hero">
            <ScottyAvatar persona />
          </div>
          <p className="auth-page__app-name">MyTartan</p>
          <h1 className="auth-page__greeting">Check your email</h1>
          <p className="auth-page__tagline">
            I sent a verification link to {user?.email || "your inbox"} so I know it&apos;s you.
          </p>
        </header>
        <main className="auth-page__main">
          <div className="auth-page__card">
            <p className="auth-page__help">
              Open the link in that email to continue. If mail isn&apos;t configured on this server, the resend
              button will say so instead of faking success.
            </p>
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
            <button type="button" className="auth-page__submit" onClick={handleResend} disabled={submitting}>
              {submitting ? "Sending…" : "Resend verification"}
            </button>
            <button type="button" className="auth-page__text-btn auth-page__text-btn--center" onClick={() => logout()}>
              Use a different account
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default VerifyPending;
