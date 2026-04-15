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
const AUDIENCE_OPTIONS = [
  "fans",
  "buyers",
  "investors",
  "general public",
  "students",
  "listeners",
  "readers",
];
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

function composeConversationTitle(messages, assistantMode) {
  const firstUserTurn = messages.find(
    (message) => message?.role === "user" && String(message?.content || "").trim()
  );

  if (!firstUserTurn) {
    return assistantMode === "writing" ? "New writing conversation" : "New conversation";
  }

  const normalized = String(firstUserTurn.content).replace(/\s+/g, " ").trim();
  if (!normalized) {
    return assistantMode === "writing" ? "New writing conversation" : "New conversation";
  }

  if (normalized.length <= 46) {
    return normalized;
  }

  return `${normalized.slice(0, 46).trim()}...`;
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
  const compactConversation = hasConversation;
  const quickSuggestions = useMemo(() => suggestions.slice(0, 5), [suggestions]);
  const pageSuggestions = useMemo(() => proactiveSuggestions.slice(0, 4), [proactiveSuggestions]);
  const conversationTitle = useMemo(
    () => composeConversationTitle(messages, assistantMode),
    [assistantMode, messages]
  );
  const activeModeLabel =
    MODE_OPTIONS.find((option) => option.value === assistantMode)?.label || "App";

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
    <div
      className="tg-assistant-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
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
                A calmer, continuous conversation space for Tengacion.
              </p>
            </div>
          </div>

          <div className="tg-assistant-panel__header-actions">
            <span className="tg-assistant-panel__status">Stays open while replying</span>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close Akuso">
              Close
            </Button>
          </div>
        </header>

        <div className="tg-assistant-workspace">
          <aside className="tg-assistant-sidebar" aria-label="Akuso conversation tools">
            <button
              type="button"
              className="tg-assistant-sidebar__new-chat"
              onClick={onClearHistory}
            >
              <span aria-hidden="true">+</span>
              <span>New chat</span>
            </button>

            <div className="tg-assistant-sidebar__section">
              <span className="tg-assistant-sidebar__label">Current conversation</span>
              <div className="tg-assistant-sidebar__thread-card">
                <strong>{conversationTitle}</strong>
                <p>
                  {hasConversation
                    ? `${messages.length} turns in this thread`
                    : `Start from ${assistantContext?.pageTitle || "Tengacion"}`}
                </p>
              </div>
            </div>

            <div className="tg-assistant-sidebar__section">
              <span className="tg-assistant-sidebar__label">Mode</span>
              <div className="tg-assistant-sidebar__mode-list" role="tablist" aria-label="Assistant mode">
                {MODE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`tg-assistant-mode-pill tg-assistant-mode-pill--sidebar${assistantMode === option.value ? " is-active" : ""}`}
                    onClick={() => onModeChange?.(option.value)}
                    aria-pressed={assistantMode === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {assistantMode === "writing" ? (
              <div className="tg-assistant-sidebar__section">
                <span className="tg-assistant-sidebar__label">Writing setup</span>
                <div className="tg-assistant-writing-controls tg-assistant-writing-controls--sidebar">
                  <label>
                    <span>Tone</span>
                    <select
                      value={writingPreferences?.tone || "warm"}
                      onChange={(event) => onPreferenceChange?.("tone", event.target.value)}
                    >
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
                    <select
                      value={writingPreferences?.length || "short"}
                      onChange={(event) => onPreferenceChange?.("length", event.target.value)}
                    >
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
                      onChange={(event) =>
                        onPreferenceChange?.("simplicity", event.target.value)
                      }
                    >
                      {SIMPLICITY_OPTIONS.map((simplicity) => (
                        <option key={simplicity} value={simplicity}>
                          {simplicity}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : null}

            {pageSuggestions.length > 0 ? (
              <div className="tg-assistant-sidebar__section">
                <span className="tg-assistant-sidebar__label">On this page</span>
                <div className="tg-assistant-sidebar__chip-list">
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

            {!hasConversation && quickSuggestions.length > 0 ? (
              <div className="tg-assistant-sidebar__section">
                <span className="tg-assistant-sidebar__label">Conversation starters</span>
                <div className="tg-assistant-sidebar__starter-list">
                  {quickSuggestions.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="tg-assistant-sidebar__starter"
                      onClick={() => onFollowUpClick?.(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>

          <section className={`tg-assistant-stage${compactConversation ? " tg-assistant-stage--conversation" : ""}`}>
            <div className={`tg-assistant-stage__header${compactConversation ? " tg-assistant-stage__header--compact" : ""}`}>
              <div className="tg-assistant-stage__copy">
                <span className="tg-assistant-stage__eyebrow">
                  {assistantContext?.pageTitle || "Tengacion"} | {surface}
                </span>
                <h3>{conversationTitle}</h3>
                <p>
                  {compactConversation
                    ? "Continue chatting with Akuso in this thread."
                    : "Start a natural conversation with Akuso. Ask a question, request a page action, or draft something for your audience."}
                </p>
              </div>
              <div className="tg-assistant-stage__badge">{activeModeLabel}</div>
            </div>

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

            <div className={`tg-assistant-stage__conversation${compactConversation ? " tg-assistant-stage__conversation--compact" : ""}`}>
              <div className="tg-assistant-stage__thread">
                <AssistantMessageList
                  messages={messages}
                  loading={loading}
                  streamingLabel={streamingLabel}
                  onCardAction={onCardAction}
                  onFollowUpClick={onFollowUpClick}
                  onFeedback={onFeedback}
                />
              </div>

              <div className={`tg-assistant-stage__composer${compactConversation ? " tg-assistant-stage__composer--compact" : ""}`}>
                {!hasConversation && quickSuggestions.length > 0 ? (
                  <div className="tg-assistant-stage__starters" aria-label="Suggested prompts">
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
                ) : null}

                <div className={`tg-assistant-stage__composer-shell${compactConversation ? " tg-assistant-stage__composer-shell--compact" : ""}`}>
                  {!compactConversation ? (
                    <div className="tg-assistant-stage__composer-note">
                      <span className="tg-assistant-stage__composer-dot" aria-hidden="true" />
                      Conversation stays open while Akuso replies.
                    </div>
                  ) : null}
                  <AssistantComposer
                    ref={composerRef}
                    value={composerValue}
                    onChange={onComposerChange}
                    onSubmit={onComposerSubmit}
                    disabled={composerDisabled}
                    compact={compactConversation}
                    placeholder={
                      assistantMode === "writing"
                        ? "Ask Akuso to draft a caption, bio, promo, or article..."
                        : assistantMode === "math"
                          ? "Type a math problem or ask for a step-by-step explanation..."
                          : assistantMode === "health"
                            ? "Ask for general health guidance..."
                            : "Message Akuso naturally, just like a real conversation."
                    }
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>,
    document.body
  );
}
