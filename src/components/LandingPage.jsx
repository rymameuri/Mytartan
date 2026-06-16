import ScottyPattern from "./ScottyPattern";
import "./LandingPage.css";

function LandingPage({ onStart }) {
  return (
    <div className="landing">
      <ScottyPattern />

      <div className="landing__content">
        <header className="landing__header">
          <h1 className="landing__title brand-display">MY TARTAN</h1>
          <p className="landing__subtitle">A CUSTOM AI PERSONA FOR CMUQ STUDENTS</p>
        </header>

        <main className="landing__main">
          <button type="button" className="landing__cta tartan-btn" onClick={onStart}>
            Start chatting with MyTartan
          </button>
        </main>

        <footer className="landing__footer">
          MADE BY RYM A. AMEURI UNDER THE SUPERVISION OF THE IX LAB
        </footer>
      </div>
    </div>
  );
}

export default LandingPage;
