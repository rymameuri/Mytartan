import { useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { CMUQ_MAJORS } from "../../data/cmuqMajors";
import "./OnboardingFlow.css";

const LEARNING_STYLES = [
  "Visual",
  "Reading and writing",
  "Hands on practice",
  "Talking it through",
];

const USE_CASES = [
  "General campus questions",
  "Someone to talk to",
  "Finding my way around campus",
  "A mix of everything",
];

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const TOTAL_STEPS = 4;

function OnboardingFlow() {
  const { updateProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [learningStyle, setLearningStyle] = useState("");
  const [useCase, setUseCase] = useState("");
  const [major, setMajor] = useState("");
  const [gradMonth, setGradMonth] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => currentYear + i);
  }, []);

  const majorSuggestions = useMemo(() => {
    const query = major.trim().toLowerCase();
    if (!query) return CMUQ_MAJORS.slice(0, 6);
    return CMUQ_MAJORS.filter((item) => item.toLowerCase().includes(query)).slice(0, 6);
  }, [major]);

  function canContinue() {
    if (step === 1) return Boolean(learningStyle);
    if (step === 2) return Boolean(useCase);
    if (step === 3) return major.trim().length > 0;
    if (step === 4) return Boolean(gradMonth && gradYear);
    return false;
  }

  async function handleNext() {
    setError("");
    if (!canContinue()) return;

    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      return;
    }

    setSubmitting(true);
    try {
      const monthLabel = MONTHS.find((m) => m.value === gradMonth)?.label ?? gradMonth;
      await updateProfile({
        learningStyle,
        intendedUse: useCase,
        major: major.trim(),
        graduationDate: `${monthLabel} ${gradYear}`,
      });
    } catch (err) {
      setError(err.message || "Could not save your profile. Please try again.");
      setSubmitting(false);
    }
  }

  function handleBack() {
    setError("");
    if (step > 1) setStep((s) => s - 1);
  }

  function selectMajor(value) {
    setMajor(value);
    setShowSuggestions(false);
  }

  return (
    <div className="onboarding">
      <div className="onboarding__content">
        <header className="onboarding__header">
          <p className="onboarding__step">Step {step} of {TOTAL_STEPS}</p>
          <div className="onboarding__progress" aria-hidden="true">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <span
                key={i}
                className={`onboarding__progress-dot${i < step ? " onboarding__progress-dot--filled" : ""}${
                  i + 1 === step ? " onboarding__progress-dot--current" : ""
                }`}
              />
            ))}
          </div>
        </header>

        <main className="onboarding__main">
          {step === 1 && (
            <section className="onboarding__section">
              <h1 className="onboarding__question">What is your learning style?</h1>
              <div className="onboarding__options">
                {LEARNING_STYLES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`onboarding__option${learningStyle === option ? " onboarding__option--selected" : ""}`}
                    onClick={() => setLearningStyle(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="onboarding__section">
              <h1 className="onboarding__question">What do you hope to use MyTartan for?</h1>
              <div className="onboarding__options">
                {USE_CASES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`onboarding__option${useCase === option ? " onboarding__option--selected" : ""}`}
                    onClick={() => setUseCase(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="onboarding__section">
              <h1 className="onboarding__question">What is your major?</h1>
              <div className="onboarding__field-wrap">
                <input
                  type="text"
                  className="onboarding__input"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="e.g. Computer Science"
                  autoComplete="off"
                />
                {showSuggestions && majorSuggestions.length > 0 && (
                  <ul className="onboarding__suggestions" role="listbox">
                    {majorSuggestions.map((suggestion) => (
                      <li key={suggestion}>
                        <button
                          type="button"
                          className="onboarding__suggestion"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectMajor(suggestion)}
                        >
                          {suggestion}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="onboarding__section">
              <h1 className="onboarding__question">When are you graduating?</h1>
              <div className="onboarding__date-row">
                <label className="onboarding__date-field">
                  <span className="onboarding__label">Month</span>
                  <select
                    className="onboarding__select"
                    value={gradMonth}
                    onChange={(e) => setGradMonth(e.target.value)}
                  >
                    <option value="">Select month</option>
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="onboarding__date-field">
                  <span className="onboarding__label">Year</span>
                  <select
                    className="onboarding__select"
                    value={gradYear}
                    onChange={(e) => setGradYear(e.target.value)}
                  >
                    <option value="">Select year</option>
                    {yearOptions.map((year) => (
                      <option key={year} value={String(year)}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
          )}

          {error && (
            <p className="onboarding__error" role="alert">
              {error}
            </p>
          )}
        </main>

        <footer className="onboarding__footer">
          {step > 1 && (
            <button type="button" className="onboarding__back" onClick={handleBack}>
              Back
            </button>
          )}
          <button
            type="button"
            className="onboarding__continue"
            onClick={handleNext}
            disabled={!canContinue() || submitting}
          >
            {submitting ? "Saving…" : step === TOTAL_STEPS ? "Finish" : "Continue"}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default OnboardingFlow;
