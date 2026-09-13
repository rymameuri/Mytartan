import { useEffect, useState } from "react";
import ScottyPersonaStage from "./ScottyPersonaStage";
import PersonaCaption from "./PersonaCaption";
import QuizPlayer from "./QuizPlayer";
import MindMapBoard from "./MindMapBoard";
import StudySheetBoard from "./StudySheetBoard";
import "./TeachStudio.css";

const SCENE_LABEL = {
  quiz: "Quiz studio",
  mindmap: "Whiteboard studio",
  sheet: "Study studio",
};

function TeachStudio({
  studio,
  isLoading = false,
  isSpeaking = false,
  speechCaption = "",
  avatarState = "idle",
  avatarRef,
  onClose,
  onAnswer,
  onQuizComplete,
  onMindMapStep,
  onSheetStep,
  onSheetDensity,
  onSheetRegenerate,
  isDesktop = true,
}) {
  const [playing, setPlaying] = useState(true);
  const canAutoplay = studio?.kind === "mindmap" || studio?.kind === "sheet";

  useEffect(() => {
    setPlaying(true);
  }, [studio?.kind, studio?.title]);

  useEffect(() => {
    if (!playing || !canAutoplay) return undefined;
    if (studio?.kind === "mindmap") {
      const last = (studio.map?.steps?.length ?? 1) - 1;
      if (studio.step >= last) return undefined;
      const timer = window.setTimeout(() => onMindMapStep?.(studio.step + 1), 3600);
      return () => window.clearTimeout(timer);
    }
    if (studio?.kind === "sheet") {
      const last = (studio.sheet?.sections?.length ?? 1) - 1;
      if (studio.step >= last) return undefined;
      const timer = window.setTimeout(() => onSheetStep?.(studio.step + 1), 2600);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [
    playing,
    canAutoplay,
    studio?.kind,
    studio?.step,
    studio?.map?.steps?.length,
    studio?.sheet?.sections?.length,
    onMindMapStep,
    onSheetStep,
  ]);

  if (!studio) return null;

  const scene = SCENE_LABEL[studio.kind] || "Studio";
  const beat =
    studio.kind === "mindmap"
      ? `${(studio.step ?? 0) + 1}/${studio.map?.steps?.length || 1}`
      : studio.kind === "sheet"
        ? `${(studio.step ?? 0) + 1}/${studio.sheet?.sections?.length || 1}`
        : null;

  return (
    <main
      className={`teach-studio teach-studio--scene${isDesktop ? "" : " teach-studio--stack"}`}
    >
      <aside className="teach-studio__rail">
        <div className="teach-studio__spot" aria-hidden="true" />
        <ScottyPersonaStage
          compact
          tone="cream"
          avatarRef={avatarRef}
          avatarState={avatarState}
          title="Scotty"
          subtitle="Your CMU-Q classmate"
        >
          {isSpeaking && speechCaption ? (
            <PersonaCaption text={speechCaption} />
          ) : isLoading ? (
            <PersonaCaption text="thinking" typing />
          ) : null}
        </ScottyPersonaStage>
        {studio.reaction?.text && (
          <p
            key={studio.reaction.text}
            className={`teach-studio__reaction teach-studio__reaction--${studio.reaction.type || "teach"}`}
          >
            {studio.reaction.text}
          </p>
        )}
      </aside>

      <section className="teach-studio__pane">
        <header className="teach-studio__pane-bar">
          <p className="teach-studio__kicker">
            {scene}
            {beat ? ` · beat ${beat}` : ""}
          </p>
          <div className="teach-studio__bar-actions">
            {canAutoplay && (
              <button
                type="button"
                className="teach-studio__ghost"
                onClick={() => setPlaying((prev) => !prev)}
              >
                {playing ? "Pause" : "Play"}
              </button>
            )}
            <button type="button" className="teach-studio__close" onClick={onClose}>
              End scene
            </button>
          </div>
        </header>
        <div className="teach-studio__surface" key={`${studio.kind}-${studio.title}`}>
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
          {studio.kind === "sheet" && (
            <StudySheetBoard
              sheet={studio.sheet}
              step={studio.step}
              density={studio.density}
              onContinue={onSheetStep}
              onToggleDensity={onSheetDensity}
              onRegenerate={onSheetRegenerate}
            />
          )}
        </div>
      </section>
    </main>
  );
}

export default TeachStudio;
