import { forwardRef, useId, useRef } from "react";

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4.75a.75.75 0 0 1 .75.75v9.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.22 3.22V5.5a.75.75 0 0 1 .75-.75z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4.75a3.25 3.25 0 0 0-3.25 3.25v3.2a3.25 3.25 0 0 0 6.5 0V8A3.25 3.25 0 0 0 12 4.75z" />
      <path d="M6.5 11.25a5.5 5.5 0 0 0 11 0" />
      <path d="M12 16.75v2.5" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="8" height="8" rx="1.4" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 7 10 10" />
      <path d="m17 7-10 10" />
    </svg>
  );
}

const formatSeconds = (value = 0) => {
  const total = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const AssistantComposer = forwardRef(function AssistantComposer(
  {
    value = "",
    onChange,
    onSubmit,
    attachments = [],
    onAttachmentSelect,
    onRemoveAttachment,
    recording = false,
    recordingSeconds = 0,
    recordingSupported = true,
    onToggleRecording,
    onCancelRecording,
    disabled = false,
    compact = false,
    placeholder = "Ask Akuso to open a page, find something, or draft a caption.",
  },
  ref
) {
  const textareaId = useId();
  const fileInputRef = useRef(null);
  const trimmedValue = String(value || "").trim();
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  const canSubmit = Boolean(trimmedValue || hasAttachments);

  return (
    <form
      className={`tg-assistant-composer${compact ? " tg-assistant-composer--compact" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled && canSubmit) {
          onSubmit?.(trimmedValue);
        }
      }}
    >
      <label className="tg-assistant-composer__field" htmlFor={textareaId}>
        <span className="sr-only">Message Akuso</span>
        <textarea
          ref={ref}
          id={textareaId}
          className={`tg-assistant-composer__textarea${compact ? " tg-assistant-composer__textarea--compact" : ""}`}
          value={value}
          rows={compact ? 2 : 3}
          placeholder={placeholder}
          onChange={(event) => onChange?.(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (!disabled && canSubmit) {
                onSubmit?.(trimmedValue);
              }
            }
          }}
        />
      </label>

      {hasAttachments ? (
        <div className="tg-assistant-composer__attachments" aria-label="Akuso media attachments">
          {attachments.map((attachment) => {
            const isImage = attachment?.type === "image";
            return (
              <div
                key={attachment.id}
                className={`tg-assistant-composer__attachment${isImage ? " is-image" : " is-audio"}`}
              >
                {isImage && attachment.previewUrl ? (
                  <img src={attachment.previewUrl} alt="" />
                ) : (
                  <span className="tg-assistant-composer__attachment-icon" aria-hidden="true">
                    <MicIcon />
                  </span>
                )}
                <span className="tg-assistant-composer__attachment-name">
                  {attachment.name || (isImage ? "Image" : "Voice message")}
                </span>
                <button
                  type="button"
                  className="tg-assistant-composer__attachment-remove"
                  onClick={() => onRemoveAttachment?.(attachment.id)}
                  disabled={disabled}
                  aria-label={`Remove ${attachment.name || "attachment"}`}
                  title="Remove"
                >
                  <XIcon />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className={`tg-assistant-composer__actions${compact ? " tg-assistant-composer__actions--compact" : ""}`}>
        <span className="tg-assistant-composer__hint">
          {disabled
            ? "Akuso is replying..."
            : recording
              ? `Recording ${formatSeconds(recordingSeconds)}`
            : compact
              ? "Enter to send"
              : "Press Enter to send, Shift+Enter for a new line"}
        </span>
        <div className="tg-assistant-composer__tools">
          <input
            ref={fileInputRef}
            type="file"
            className="tg-assistant-visually-hidden"
            accept="image/*,audio/*"
            multiple
            aria-label="Attach image or voice file"
            onChange={(event) => {
              onAttachmentSelect?.(event.target.files);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="tg-assistant-composer__tool"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            aria-label="Attach image or voice file"
            title="Attach image or voice file"
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            className={`tg-assistant-composer__tool${recording ? " is-recording" : ""}`}
            onClick={onToggleRecording}
            disabled={disabled || !recordingSupported}
            aria-label={recording ? "Stop voice recording" : "Record voice message"}
            title={recordingSupported ? (recording ? "Stop recording" : "Record voice message") : "Voice recording unavailable"}
          >
            {recording ? <StopIcon /> : <MicIcon />}
          </button>
          {recording ? (
            <button
              type="button"
              className="tg-assistant-composer__tool"
              onClick={onCancelRecording}
              aria-label="Cancel voice recording"
              title="Cancel recording"
            >
              <XIcon />
            </button>
          ) : null}
          <button
            type="submit"
            className={`tg-assistant-composer__send${compact ? " tg-assistant-composer__send--compact" : ""}`}
            disabled={disabled || !canSubmit}
            aria-label={disabled ? "Working" : "Send"}
            title={disabled ? "Akuso is replying" : "Send to Akuso"}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </form>
  );
});

export default AssistantComposer;
