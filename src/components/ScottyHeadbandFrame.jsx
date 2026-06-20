import "./ScottyHeadbandFrame.css";

function ScottyHeadbandFrame({ children, avatarState = "idle", className = "" }) {
  return (
    <div
      className={`shb${className ? ` ${className}` : ""} shb--${avatarState}`}
      aria-hidden={false}
    >
      <div className="shb__band" aria-hidden="true" />
      <span className="shb__ear shb__ear--left" aria-hidden="true">
        <span className="shb__ear-flop" />
      </span>
      <span className="shb__ear shb__ear--right" aria-hidden="true">
        <span className="shb__ear-flop" />
      </span>
      <div className="shb__face">{children}</div>
    </div>
  );
}

export default ScottyHeadbandFrame;
