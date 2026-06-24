import { GearIcon } from "./Icons";

function SettingsButton({ onClick }) {
  return (
    <button
      type="button"
      className="pv-icon-btn"
      aria-label="Settings"
      title="Settings"
      onClick={onClick}
    >
      <GearIcon />
    </button>
  );
}

export default SettingsButton;
