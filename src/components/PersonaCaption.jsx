import { useEffect, useState } from "react";
import "./PersonaCaption.css";

const TYPE_MS = 70;

function PersonaCaption({ text, typing = false }) {
  const full = text?.trim() ?? "";
  const [typed, setTyped] = useState(() => (typing ? "" : full));

  useEffect(() => {
    if (!typing || !full) {
      setTyped(full);
      return undefined;
    }

    setTyped("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(id);
    }, TYPE_MS);
    return () => clearInterval(id);
  }, [full, typing]);

  if (!full) return null;

  const shown = typing ? typed : full;

  return (
    <p
      key={typing ? "thinking" : full}
      className={`persona-caption${typing ? " persona-caption--thinking" : ""}`}
      aria-live="polite"
      aria-label={typing ? full : undefined}
    >
      {shown || "\u00A0"}
      {typing ? <span className="persona-caption__caret" aria-hidden="true" /> : null}
    </p>
  );
}

export default PersonaCaption;
