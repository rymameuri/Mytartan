import { visibleSheetSections, sheetToPlainText } from "../utils/studySheet";
import "./StudySheetBoard.css";

function StudySheetBoard({
  sheet,
  step = 0,
  density = "dense",
  onContinue,
  onToggleDensity,
  onRegenerate,
}) {
  const view = visibleSheetSections(sheet, step);
  const isLast = step >= Math.max(view.sections.length - 1, 0);

  function handlePrint() {
    window.print();
  }

  function handleExport() {
    const text = sheetToPlainText({ ...view, sections: view.sections });
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(view.title || "cheat-sheet").replace(/\s+/g, "-").toLowerCase()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={`study-sheet study-sheet--${view.density}`}>
      <header className="study-sheet__toolbar">
        <p className="study-sheet__counter">
          Beat {Math.min(step + 1, view.sections.length)} of {Math.max(view.sections.length, 1)}
        </p>
        <div className="study-sheet__toggles">
          <button
            type="button"
            className={`study-sheet__chip${density === "dense" ? " study-sheet__chip--on" : ""}`}
            onClick={() => onToggleDensity?.("dense")}
          >
            Denser
          </button>
          <button
            type="button"
            className={`study-sheet__chip${density === "gentle" ? " study-sheet__chip--on" : ""}`}
            onClick={() => onToggleDensity?.("gentle")}
          >
            Gentler
          </button>
        </div>
        {isLast && (
          <div className="study-sheet__actions">
            <button type="button" className="study-sheet__ghost" onClick={() => onRegenerate?.()}>
              Replay
            </button>
            <button type="button" className="study-sheet__ghost" onClick={handleExport}>
              Export
            </button>
            <button type="button" className="tartan-btn" onClick={handlePrint}>
              Print
            </button>
          </div>
        )}
      </header>

      <article className="study-sheet__page" aria-label={view.title}>
        <header className="study-sheet__masthead">
          <p className="study-sheet__course">
            {view.courseCode ? `${view.courseCode} · ` : ""}
            {view.courseLabel}
          </p>
          <h2 className="study-sheet__title">{view.title}</h2>
          <p className="study-sheet__source">from {view.sourceName}</p>
          <p className="study-sheet__disclaimer">{view.disclaimer}</p>
        </header>

        <div className="study-sheet__grid">
          {view.visibleSections.map((section, index) => (
            <section
              key={section.id}
              className={`study-sheet__block study-sheet__block--${section.id}${
                index === view.visibleSections.length - 1 ? " study-sheet__block--fresh" : ""
              }`}
            >
              <p className="study-sheet__kicker">{section.kicker}</p>
              <h3 className="study-sheet__heading">{section.title}</h3>
              <ul>
                {section.items.map((item, itemIndex) => (
                  <li key={`${section.id}-${itemIndex}`}>
                    {item.lead && <strong>{item.lead}</strong>}
                    <span>{item.body}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="study-sheet__foot">{view.footerNote}</p>
      </article>

      <footer className="study-sheet__footer">
        <p className="study-sheet__narration">{view.narration}</p>
        <button
          type="button"
          className="tartan-btn"
          disabled={isLast || !view.sections.length}
          onClick={() => onContinue?.(step + 1)}
        >
          {isLast ? "Hold on this" : "Next beat"}
        </button>
      </footer>
    </div>
  );
}

export default StudySheetBoard;
