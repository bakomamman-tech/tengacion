import { forwardRef, useId } from "react";

import Button from "../ui/Button";

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
          rows={2}
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
        <Button
          type="submit"
          variant="primary"
          disabled={disabled || !trimmedValue}
        >
          {disabled ? "Working" : "Send"}
        </Button>
      </div>
    </form>
  );
});

export default AssistantComposer;

