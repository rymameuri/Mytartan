import "./PersonaCaption.css";

function PersonaCaption({ text }) {
  const line = text?.trim();
  if (!line) return null;

  return (
    <p key={line} className="persona-caption" aria-live="polite">
      {line}
    </p>
  );
}

export default PersonaCaption;
