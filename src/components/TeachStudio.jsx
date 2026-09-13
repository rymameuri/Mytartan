import { useEffect } from "react";
import ScottyAvatar from "./ScottyAvatar";
import MessageContent from "./MessageContent";
import QuizPlayer from "./QuizPlayer";
import MindMapBoard from "./MindMapBoard";
import "./TeachStudio.css";

function TeachStudio({
  studio,
  messages = [],
  isLoading = false,
  avatarState = "idle",
  avatarRef,
  onClose,
  onAnswer,
  onQuizComplete,
  onMindMapStep,
  isDesktop = true,
}) {
  useEffect(() => {
    if (studio?.kind !== "mindmap") return undefined;
    const last = (studio.map?.steps?.length ?? 1) - 1;
    if (studio.step >= last) return undefined;
    const timer = window.setTimeout(() => {
      onMindMapStep?.(studio.step + 1);
    }, 3800);
    return () => window.clearTimeout(timer);
  }, [studio?.kind, studio?.step, studio?.map?.steps?.length, onMindMapStep]);

  if (!studio) return null;

  const recent = messages.slice(-4);

  return (
    <main className={`teach-studio${isDesktop ? "" : " teach-studio--stack"}`}>
      <aside className="teach-studio__rail">
        <div className="teach-studio__scotty">
          <ScottyAvatar ref={avatarRef} persona avatarState={avatarState} />
        </div>
        {studio.reaction?.text && (
          <p className={`teach-studio__reaction teach-studio__reaction--${studio.reaction.type || "teach"}`}>
            {studio.reaction.text}
          </p>
        )}
        <div className="teach-studio__log" aria-label="Recent chat">
          {recent.map((message, index) => (
            <div
              key={message.id ?? `studio-msg-${index}`}
              className={`teach-studio__msg teach-studio__msg--${message.role}`}
            >
              <MessageContent content={message.content} />
            </div>
          ))}
          {isLoading && <p className="teach-studio__thinking">thinking…</p>}
        </div>
      </aside>

      <section className="teach-studio__pane">
        <header className="teach-studio__pane-bar">
          <p className="teach-studio__kicker">
            {studio.kind === "quiz" ? "Quiz studio" : "Whiteboard studio"}
            {studio.sourceName ? ` · ${studio.sourceName}` : ""}
          </p>
          <button type="button" className="teach-studio__close" onClick={onClose}>
            Back to chat
          </button>
        </header>
        <div className="teach-studio__surface">
          {studio.kind === "quiz" && (
            <QuizPlayer
              questions={studio.questions}
              title={studio.title}
              revealMode="immediate"
              onAnswer={onAnswer}
              onComplete={onQuizComplete}
            />
          )}
          {studio.kind === "mindmap" && (
            <MindMapBoard map={studio.map} step={studio.step} onContinue={onMindMapStep} />
          )}
        </div>
      </section>
    </main>
  );
}

export default TeachStudio;
