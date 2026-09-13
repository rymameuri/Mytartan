import { useEffect, useMemo, useState } from "react";
import "./QuizPlayer.css";

function QuizPlayer({
  questions,
  title = "Quiz",
  onComplete,
  onHelp,
  onQuestionChange,
  onAnswer,
  helpDisabled = false,
  revealMode = "end",
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [phase, setPhase] = useState("taking");

  const questionsKey = useMemo(
    () => questions.map((q) => `${q.number}:${q.text}`).join("|"),
    [questions]
  );

  const score = useMemo(() => {
    let correct = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.correct && answers[i] === q.correct) correct++;
    }
    return correct;
  }, [questions, answers]);

  useEffect(() => {
    setCurrentIndex(0);
    setAnswers({});
    setPhase("taking");
  }, [questionsKey]);

  useEffect(() => {
    onQuestionChange?.(currentIndex);
  }, [currentIndex, onQuestionChange]);

  if (!questions.length) return null;

  const total = questions.length;
  const current = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const progress = phase === "submitted" ? 100 : ((currentIndex + 1) / total) * 100;

  function selectOption(optionId) {
    if (phase === "submitted") return;
    if (revealMode === "immediate" && answers[currentIndex]) return;
    setAnswers((prev) => ({ ...prev, [currentIndex]: optionId }));
    if (revealMode === "immediate") {
      onAnswer?.({
        index: currentIndex,
        question: current,
        selected: optionId,
        correct: optionId === current.correct,
      });
    }
  }

  function handleNext() {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }

  function buildQuizResults() {
    const pct = Math.round((score / total) * 100);
    return {
      score,
      total,
      pct,
      title,
      results: questions.map((q, index) => {
        const selected = answers[index];
        const selectedOpt = q.options.find((opt) => opt.id === selected);
        const correctOpt = q.options.find((opt) => opt.id === q.correct);
        return {
          question: q.text,
          selected: selected ?? null,
          selectedText: selectedOpt?.text ?? "",
          correct: q.correct,
          correctText: correctOpt?.text ?? "",
          isCorrect: selected === q.correct,
          explanation: q.explanation ?? "",
        };
      }),
    };
  }

  function handleSubmit() {
    setPhase("submitted");
    onComplete?.(buildQuizResults());
  }

  function handleRetake() {
    setCurrentIndex(0);
    setAnswers({});
    setPhase("taking");
  }

  if (phase === "submitted") {
    const pct = Math.round((score / total) * 100);
    return (
      <div className="quiz-player">
        <header className="quiz-player__header">
          <h2 className="quiz-player__title">{title}</h2>
          <div className="quiz-player__score-card">
            <p className="quiz-player__score-label">Your score</p>
            <p className="quiz-player__score-value">
              {score} / {total}
              <span className="quiz-player__score-pct"> ({pct}%)</span>
            </p>
          </div>
        </header>

        <div className="quiz-player__review">
          <h3 className="quiz-player__review-title">Review answers</h3>
          {questions.map((q, index) => {
            const selected = answers[index];
            const isCorrect = selected === q.correct;
            return (
              <div
                key={q.number}
                className={`quiz-player__review-item${isCorrect ? " quiz-player__review-item--correct" : " quiz-player__review-item--wrong"}`}
              >
                <p className="quiz-player__review-q">
                  <strong>{index + 1}.</strong> {q.text}
                </p>
                <ul className="quiz-player__review-options">
                  {q.options.map((opt) => {
                    const isSelected = selected === opt.id;
                    const isAnswer = q.correct === opt.id;
                    let className = "quiz-player__review-opt";
                    if (isAnswer) className += " quiz-player__review-opt--correct";
                    if (isSelected && !isAnswer) className += " quiz-player__review-opt--wrong";
                    return (
                      <li key={opt.id} className={className}>
                        <span className="quiz-player__opt-letter">{opt.id}</span>
                        {opt.text}
                        {isAnswer && <span className="quiz-player__opt-badge">Correct</span>}
                        {isSelected && !isAnswer && (
                          <span className="quiz-player__opt-badge quiz-player__opt-badge--yours">Your answer</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {q.explanation && (
                  <p className="quiz-player__explanation">{q.explanation}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="quiz-player__footer">
          <button type="button" className="tartan-btn" onClick={handleRetake}>
            Retake quiz
          </button>
        </div>
      </div>
    );
  }

  const selected = answers[currentIndex];
  const isLast = currentIndex === total - 1;
  const allAnswered = answeredCount === total;

  const revealed = revealMode === "immediate" && Boolean(selected);

  return (
    <div className={`quiz-player${revealMode === "immediate" ? " quiz-player--immediate" : ""}`}>
      <header className="quiz-player__header">
        <div className="quiz-player__header-top">
          <h2 className="quiz-player__title">{title}</h2>
          <span className="quiz-player__counter">
            Question {currentIndex + 1} of {total}
          </span>
        </div>
        <div className="quiz-player__progress-track" aria-hidden>
          <div className="quiz-player__progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="quiz-player__answered">
          {answeredCount} of {total} answered
        </p>
      </header>

      <div className="quiz-player__body" key={currentIndex}>
        <p className="quiz-player__question">
          <span className="quiz-player__q-num">{currentIndex + 1}.</span>
          {current.text}
        </p>

        <fieldset className="quiz-player__options">
          <legend className="quiz-player__sr-only">Select an answer</legend>
          {current.options.map((opt) => {
            const checked = selected === opt.id;
            const showCorrect = revealed && opt.id === current.correct;
            const showWrong = revealed && checked && opt.id !== current.correct;
            return (
              <label
                key={opt.id}
                className={`quiz-player__option${checked ? " quiz-player__option--selected" : ""}${
                  showCorrect ? " quiz-player__option--correct" : ""
                }${showWrong ? " quiz-player__option--wrong" : ""}`}
              >
                <input
                  type="radio"
                  name={`quiz-q-${current.number}`}
                  value={opt.id}
                  checked={checked}
                  onChange={() => selectOption(opt.id)}
                />
                <span className="quiz-player__opt-letter">{opt.id}</span>
                <span className="quiz-player__opt-text">{opt.text}</span>
              </label>
            );
          })}
        </fieldset>
      </div>

      <footer className="quiz-player__footer">
        {revealMode !== "immediate" && (
          <button
            type="button"
            className="class-workspace__ghost-btn"
            disabled={currentIndex === 0}
            onClick={handlePrev}
          >
            Previous
          </button>
        )}

        {onHelp && (
          <button
            type="button"
            className="quiz-player__help-btn"
            disabled={helpDisabled}
            onClick={() => onHelp(currentIndex)}
          >
            Help with this question
          </button>
        )}

        {isLast ? (
          <button
            type="button"
            className="tartan-btn"
            disabled={!allAnswered}
            onClick={handleSubmit}
          >
            {revealMode === "immediate" ? "See results" : "Submit quiz"}
          </button>
        ) : (
          <button
            type="button"
            className="tartan-btn"
            disabled={!selected}
            onClick={handleNext}
          >
            {revealMode === "immediate" ? "Next beat" : "Next"}
          </button>
        )}
      </footer>
    </div>
  );
}

export default QuizPlayer;
