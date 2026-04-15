import { forwardRef, useId } from "react";

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4.75a.75.75 0 0 1 .75.75v9.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.22 3.22V5.5a.75.75 0 0 1 .75-.75z" />
    </svg>
  );
}

const AssistantComposer = forwardRef(function AssistantComposer(
  {
    value = "",
    onChange,
    onSubmit,
    disabled = false,
    placeholder = "Ask Akuso to open a page, find something, or draft a caption.",
  },
  ref
) {
  const textareaId = useId();
  const trimmedValue = String(value || "").trim();

  return (
    <form
      className="tg-assistant-composer"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(trimmedValue);
      }}
    >
      <label className="tg-assistant-composer__field" htmlFor={textareaId}>
        <span className="sr-only">Message Akuso</span>
        <textarea
          ref={ref}
          id={textareaId}
          className="tg-assistant-composer__textarea"
          value={value}
          rows={3}
          placeholder={placeholder}
          onChange={(event) => onChange?.(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit?.(trimmedValue);
            }
          }}
        />
      </label>

      <div className="tg-assistant-composer__actions">
        <span className="tg-assistant-composer__hint">
          {disabled ? "Akuso is replying..." : "Press Enter to send, Shift+Enter for a new line"}
        </span>
        <button
          type="submit"
          className="tg-assistant-composer__send"
          disabled={disabled || !trimmedValue}
          aria-label={disabled ? "Working" : "Send"}
          title={disabled ? "Akuso is replying" : "Send to Akuso"}
        >
          <SendIcon />
        </button>
      </div>
    </form>
  );
});

export default AssistantComposer;
