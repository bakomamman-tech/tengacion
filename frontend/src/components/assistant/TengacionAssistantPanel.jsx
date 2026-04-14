import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef } from "react";

import AssistantComposer from "./AssistantComposer";
import AssistantMessageList from "./AssistantMessageList";
import Button from "../ui/Button";

const isBrowser = typeof document !== "undefined";

const MODE_OPTIONS = [
  { value: "copilot", label: "App" },
  { value: "knowledge", label: "Learn" },
  { value: "writing", label: "Write" },
  { value: "math", label: "Math" },
  { value: "health", label: "Health" },
];

const TONE_OPTIONS = ["warm", "professional", "premium", "exciting", "formal", "playful"];
const AUDIENCE_OPTIONS = ["fans", "buyers", "investors", "general public", "students", "listeners", "readers"];
const LENGTH_OPTIONS = ["short", "medium", "long"];
const SIMPLICITY_OPTIONS = ["basic", "standard", "advanced"];

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
  onClearHistory,
  assistantContext = null,
  surface = "general",
  suggestions = [],
  proactiveSuggestions = [],
  assistantMode = "copilot",
  onModeChange,
  writingPreferences = null,
  onPreferenceChange,
  messages = [],
  loading = false,
  streamingLabel = "",
  error = "",
  onRetry,
  composerValue = "",
  onComposerChange,
  onComposerSubmit,
  onCardAction,
  onFollowUpClick,
  onFeedback,
  composerDisabled = false,
  composerRef,
}) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const hasConversation = Array.isArray(messages) && messages.length > 0;
  const quickSuggestions = useMemo(() => suggestions.slice(0, 6), [suggestions]);
  const pageSuggestions = useMemo(() => proactiveSuggestions.slice(0, 4), [proactiveSuggestions]);

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
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
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
              <p id={descriptionId}>
                Navigate Tengacion, discover content, and draft creator copy with safe app-aware guidance.
              </p>
            </div>
          </div>

          <div className="tg-assistant-panel__header-actions">
            <Button type="button" variant="ghost" size="sm" onClick={onClearHistory}>
              Clear
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close Akuso">
              Close
            </Button>
          </div>
        </header>

        <section className="tg-assistant-panel__body">
          <div className="tg-assistant-context-card">
            <div className="tg-assistant-context-card__row">
              <strong>{assistantContext?.pageTitle || "Tengacion"}</strong>
              <span>{surface}</span>
            </div>
            <p>
              Ask Akuso to open a page, explain the screen you are on, or help you write something for your audience.
            </p>
            {pageSuggestions.length > 0 ? (
              <div className="tg-assistant-context-card__hints">
                <span className="tg-assistant-context-card__label">On this page</span>
                <div className="tg-assistant-suggestions" aria-label="Current page suggestions">
                  {pageSuggestions.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="tg-assistant-chip tg-assistant-chip--context"
                      onClick={() => onFollowUpClick?.(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="tg-assistant-mode-bar" role="tablist" aria-label="Assistant mode">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`tg-assistant-mode-pill${assistantMode === option.value ? " is-active" : ""}`}
                onClick={() => onModeChange?.(option.value)}
                aria-pressed={assistantMode === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>

          {assistantMode === "writing" ? (
            <div className="tg-assistant-writing-controls">
              <label>
                <span>Tone</span>
                <select value={writingPreferences?.tone || "warm"} onChange={(event) => onPreferenceChange?.("tone", event.target.value)}>
                  {TONE_OPTIONS.map((tone) => (
                    <option key={tone} value={tone}>
                      {tone}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Audience</span>
                <select
                  value={writingPreferences?.audience || "fans"}
                  onChange={(event) => onPreferenceChange?.("audience", event.target.value)}
                >
                  {AUDIENCE_OPTIONS.map((audience) => (
                    <option key={audience} value={audience}>
                      {audience}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Length</span>
                <select value={writingPreferences?.length || "short"} onChange={(event) => onPreferenceChange?.("length", event.target.value)}>
                  {LENGTH_OPTIONS.map((length) => (
                    <option key={length} value={length}>
                      {length}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Simplicity</span>
                <select
                  value={writingPreferences?.simplicity || "standard"}
                  onChange={(event) => onPreferenceChange?.("simplicity", event.target.value)}
                >
                  {SIMPLICITY_OPTIONS.map((simplicity) => (
                    <option key={simplicity} value={simplicity}>
                      {simplicity}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {!hasConversation ? (
            <div className="tg-assistant-empty-state">
              <strong>What can Akuso do?</strong>
              <p>
                Ask to navigate Tengacion, draft creator copy, explain a topic, solve math, or get cautious general health guidance.
              </p>
              <div className="tg-assistant-suggestions" aria-label="Suggested prompts">
                {quickSuggestions.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="tg-assistant-chip"
                    onClick={() => onFollowUpClick?.(prompt)}
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
            streamingLabel={streamingLabel}
            onCardAction={onCardAction}
            onFollowUpClick={onFollowUpClick}
            onFeedback={onFeedback}
          />

          <div className="tg-assistant-history-note">
            Akuso keeps this chat lightweight, avoids showing sensitive data, and labels when an answer is grounded or cautious.
          </div>
        </section>

        <footer className="tg-assistant-panel__footer">
          <AssistantComposer
            ref={composerRef}
            value={composerValue}
            onChange={onComposerChange}
            onSubmit={onComposerSubmit}
            disabled={composerDisabled}
            placeholder={
              assistantMode === "writing"
                ? "Write a caption, bio, article, or promo..."
                : assistantMode === "math"
                  ? "Type a math expression or a step-by-step question..."
                  : assistantMode === "health"
                    ? "Ask for general health guidance..."
                    : "Ask Akuso to open a page, find something, or draft a caption."
            }
          />
        </footer>
      </aside>
    </div>,
    document.body
  );
}
