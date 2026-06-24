import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { submitFeedback } from "../utils/feedbackApi";
import "./MessageFeedback.css";

const DOWN_REASONS = [
  { id: "wrong_info", label: "Wrong info" },
  { id: "incomplete", label: "Incomplete" },
  { id: "out_of_date", label: "Out of date" },
  { id: "hard_to_understand", label: "Hard to understand" },
  { id: "other", label: "Other" },
];

function MessageFeedback({ messageId, reply, feedbackContext, disabled = false }) {
  const { token } = useAuth();
  const [vote, setVote] = useState(null);
  const [showReasons, setShowReasons] = useState(false);
  const [selectedReason, setSelectedReason] = useState(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (disabled || !messageId || !reply?.trim()) {
    return null;
  }

  async function sendFeedback(rating, reason = null, extraComment = "") {
    setSubmitting(true);
    setError("");
    try {
      await submitFeedback(
        {
          rating,
          messageId,
          userQuery: feedbackContext?.userQuery ?? "",
          reply,
          mode: feedbackContext?.mode ?? "qa",
          reason,
          comment: extraComment,
          confidence: feedbackContext?.confidence ?? null,
          keyFacts: feedbackContext?.keyFacts ?? [],
        },
        token
      );
      setVote(rating);
      setShowReasons(false);
    } catch (err) {
      setError(err.message || "Could not save feedback");
    } finally {
      setSubmitting(false);
    }
  }

  function handleUp() {
    if (vote || submitting) return;
    sendFeedback("up");
  }

  function handleDown() {
    if (vote || submitting) return;
    setShowReasons(true);
  }

  function handleReasonSelect(reasonId) {
    setSelectedReason(reasonId);
    if (reasonId !== "other") {
      sendFeedback("down", reasonId);
    }
  }

  function handleOtherSubmit(event) {
    event.preventDefault();
    if (!selectedReason || submitting) return;
    sendFeedback("down", "other", comment.trim());
  }

  if (vote) {
    return (
      <p className="msg-feedback msg-feedback--done" aria-live="polite">
        Thanks for the feedback{vote === "down" ? " — we'll use this to improve answers" : ""}.
      </p>
    );
  }

  return (
    <div className="msg-feedback">
      <div className="msg-feedback__actions">
        <span className="msg-feedback__label">Was this helpful?</span>
        <button
          type="button"
          className="msg-feedback__btn"
          onClick={handleUp}
          disabled={submitting}
          aria-label="Thumbs up"
          title="Helpful"
        >
          👍
        </button>
        <button
          type="button"
          className="msg-feedback__btn"
          onClick={handleDown}
          disabled={submitting}
          aria-label="Thumbs down"
          title="Not helpful"
        >
          👎
        </button>
      </div>

      {showReasons && (
        <div className="msg-feedback__reasons">
          <p className="msg-feedback__prompt">What went wrong?</p>
          <div className="msg-feedback__chips">
            {DOWN_REASONS.map((reason) => (
              <button
                key={reason.id}
                type="button"
                className={`msg-feedback__chip${
                  selectedReason === reason.id ? " msg-feedback__chip--active" : ""
                }`}
                onClick={() => handleReasonSelect(reason.id)}
                disabled={submitting}
              >
                {reason.label}
              </button>
            ))}
          </div>
          {selectedReason === "other" && (
            <form className="msg-feedback__other" onSubmit={handleOtherSubmit}>
              <input
                type="text"
                className="msg-feedback__input"
                placeholder="Tell us more (optional)"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={500}
                disabled={submitting}
              />
              <button type="submit" className="msg-feedback__submit" disabled={submitting}>
                Submit
              </button>
            </form>
          )}
        </div>
      )}

      {error && <p className="msg-feedback__error">{error}</p>}
    </div>
  );
}

export default MessageFeedback;
