import { visibleMindMap } from "../utils/mindMap";
import "./MindMapBoard.css";

function MindMapBoard({ map, step = 0, onContinue }) {
  const view = visibleMindMap(map, step);
  const visibleNodes = new Set(view.visibleNodeIds);
  const visibleLinks = new Set(view.visibleLinkIds);
  const isLast = step >= view.steps.length - 1;
  const nodeById = new Map(view.nodes.map((node) => [node.id, node]));
  const nowIds = new Set(view.steps[view.currentStep]?.revealNodeIds || []);

  return (
    <div className="mind-map-board">
      <header className="mind-map-board__header">
        <h2 className="mind-map-board__title">{view.title}</h2>
        <p className="mind-map-board__counter">
          Beat {Math.min(step + 1, view.steps.length)} of {view.steps.length}
        </p>
      </header>

      <div className="mind-map-board__canvas">
        <svg
          viewBox={`0 0 ${view.width} ${view.height}`}
          role="img"
          aria-label={`Mind map of ${view.title}`}
        >
          {view.links.map((link) => {
            const from = nodeById.get(link.from);
            const to = nodeById.get(link.to);
            if (!from || !to) return null;
            const shown = visibleLinks.has(link.id);
            return (
              <line
                key={link.id}
                className={`mind-map-board__edge${shown ? " mind-map-board__edge--in" : ""}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                pathLength="1"
              />
            );
          })}
          {view.nodes.map((node, index) => {
            const shown = visibleNodes.has(node.id);
            const isRoot = index === 0;
            const isNow = nowIds.has(node.id);
            const width = isRoot ? 168 : 150;
            const height = isRoot ? 56 : 50;
            return (
              <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
                <g
                  className={`mind-map-board__node${shown ? " mind-map-board__node--in" : ""}${
                    isRoot ? " mind-map-board__node--root" : ""
                  }${isNow ? " mind-map-board__node--now" : ""}`}
                >
                  <rect
                    x={-width / 2}
                    y={-height / 2}
                    width={width}
                    height={height}
                    rx="16"
                  />
                  <text x="0" y="5" textAnchor="middle">
                    {node.label}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      <footer className="mind-map-board__footer">
        <p className="mind-map-board__narration">{view.narration}</p>
        <button
          type="button"
          className="tartan-btn"
          disabled={isLast}
          onClick={() => onContinue?.(step + 1)}
        >
          {isLast ? "Hold on this" : "Next beat"}
        </button>
      </footer>
    </div>
  );
}

export default MindMapBoard;
