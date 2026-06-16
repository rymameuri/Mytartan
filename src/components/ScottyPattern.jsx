function ScottyPattern({ className = "" }) {
  return <div className={`scotty-pattern${className ? ` ${className}` : ""}`} aria-hidden="true" />;
}

export default ScottyPattern;
