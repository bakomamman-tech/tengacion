import { forwardRef } from "react";

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.6 13.6 8.4 19.4 10 13.6 11.6 12 17.4 10.4 11.6 4.6 10 10.4 8.4z" />
      <path d="M18.8 12.4 19.8 15l2.2.6-2.2.6-1 2.6-.9-2.6-2.2-.6 2.2-.6z" />
    </svg>
  );
}

const TengacionAssistantLauncher = forwardRef(function TengacionAssistantLauncher(
  { open = false, onClick },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`tg-assistant-launcher${open ? " is-open" : ""}`}
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={open ? "Close Akuso assistant" : "Open Akuso assistant"}
      title="Ask Akuso"
    >
      <span className="tg-assistant-launcher__icon" aria-hidden="true">
        <SparkIcon />
      </span>
      <span className="tg-assistant-launcher__copy">
        <strong>Akuso</strong>
        <small>Ask Tengacion AI</small>
      </span>
    </button>
  );
});

export default TengacionAssistantLauncher;

