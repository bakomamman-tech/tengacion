import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef } from "react";

import AssistantComposer from "./AssistantComposer";
import AssistantMessageList from "./AssistantMessageList";
import Button from "../ui/Button";

const isBrowser = typeof document !== "undefined";

const DEFAULT_SUGGESTIONS = [
  "Take me home",
  "Open messages",
  "Go to creator dashboard",
  "Help me upload music",
  "Find creators",
];

function AssistantHeaderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.75 13.8 8.2 19.25 10 13.8 11.8 12 17.25 10.2 11.8 4.75 10 10.2 8.2z" />
      <path d="M7 16.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
      <path d="M17 16.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
    </svg>
  );
}

export default function TengacionAssistantPanel({
  open = false,
  onClose,
  messages = [],
  loading = false,
  error = "",
  onRetry,
  composerValue = "",
  onComposerChange,
  onComposerSubmit,
  onCardAction,
  onSuggestionClick,
  composerDisabled = false,
  composerRef,
}) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const hasConversation = Array.isArray(messages) && messages.length > 0;
  const suggestions = useMemo(() => DEFAULT_SUGGESTIONS, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      composerRef?.current?.focus?.();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [composerRef, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = panelRef.current?.querySelectorAll(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements?.length) {
        event.preventDefault();
        return;
      }

      const focusable = Array.from(focusableElements);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open || !isBrowser) {
    return null;
  }

  return createPortal(
    <div className="tg-assistant-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        ref={panelRef}
        className="tg-assistant-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="tg-assistant-panel__header">
          <div className="tg-assistant-panel__identity">
            <span className="tg-assistant-panel__icon" aria-hidden="true">
              <AssistantHeaderIcon />
            </span>
            <div>
              <h2 id={titleId}>Akuso</h2>
              <p id={descriptionId}>Navigate Tengacion, discover content, and draft short copy.</p>
            </div>
          </div>

          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close Akuso">
            Close
          </Button>
        </header>

        <section className="tg-assistant-panel__body">
          {!hasConversation ? (
            <div className="tg-assistant-empty-state">
              <strong>What can Akuso do?</strong>
              <p>
                Ask to open messages, notifications, profile, creator tools, or to
                search creators and content.
              </p>
              <div className="tg-assistant-suggestions" aria-label="Suggested prompts">
                {suggestions.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="tg-assistant-chip"
                    onClick={() => onSuggestionClick?.(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="tg-assistant-error" role="status">
              <div>
                <strong>Akuso couldn't finish that request.</strong>
                <p>{error}</p>
              </div>
              {onRetry ? (
                <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
                  Retry
                </Button>
              ) : null}
            </div>
          ) : null}

          <AssistantMessageList
            messages={messages}
            loading={loading}
            onCardAction={onCardAction}
          />
        </section>

        <footer className="tg-assistant-panel__footer">
          <AssistantComposer
            ref={composerRef}
            value={composerValue}
            onChange={onComposerChange}
            onSubmit={onComposerSubmit}
            disabled={composerDisabled}
          />
        </footer>
      </aside>
    </div>,
    document.body
  );
}
