import { createPortal } from "react-dom";
import { useEffect, useId, useMemo } from "react";

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

function AssistantMinimizeIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 11.25h10" />
    </svg>
  );
}

function AssistantMaximizeIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.25" y="3.25" width="9.5" height="9.5" rx="0.75" />
    </svg>
  );
}

function AssistantRestoreIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5.25 3.25h6a1.5 1.5 0 0 1 1.5 1.5v6" />
      <rect x="3.25" y="5.25" width="7.5" height="7.5" rx="0.75" />
      <path d="M5.75 5.25v-1a1 1 0 0 1 1-1h4.5" />
    </svg>
  );
}

function AssistantCloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="m4 4 8 8" />
      <path d="m12 4-8 8" />
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
  expanded = false,
  onMinimize,
  onClose,
  onToggleExpanded,
  onClearHistory,
  assistantContext = null,
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
  onFollowUpClick,
  composerDisabled = false,
  composerRef,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const hasConversation = Array.isArray(messages) && messages.length > 0;
  const compactConversation = hasConversation;
  const showSidebar = expanded;
  const quickSuggestions = useMemo(() => suggestions.slice(0, 5), [suggestions]);
  const pageSuggestions = useMemo(() => proactiveSuggestions.slice(0, 4), [proactiveSuggestions]);
  const conversationTitle = useMemo(
    () => composeConversationTitle(messages, assistantMode),
    [assistantMode, messages]
  );
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

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open || !isBrowser) {
    return null;
  }

  return createPortal(
    <div className="tg-assistant-dock" role="presentation">
      <aside
        className={`tg-assistant-panel ${
          expanded ? "tg-assistant-panel--expanded" : "tg-assistant-panel--minimized"
        }`}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
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

          <div
            className="tg-assistant-panel__header-actions"
            role="group"
            aria-label="Akuso window controls"
          >
            <button
              type="button"
              className="tg-assistant-panel__window-control tg-assistant-panel__window-control--minimize"
              onClick={onMinimize}
              aria-label="Minimize Akuso panel"
              title="Minimize panel"
            >
              <AssistantMinimizeIcon />
            </button>
            <button
              type="button"
              className="tg-assistant-panel__window-control tg-assistant-panel__window-control--maximize"
              onClick={onToggleExpanded}
              aria-label={expanded ? "Restore Akuso panel" : "Maximize Akuso panel"}
              title={expanded ? "Restore panel" : "Maximize panel"}
            >
              {expanded ? <AssistantRestoreIcon /> : <AssistantMaximizeIcon />}
            </button>
            <button
              type="button"
              className="tg-assistant-panel__window-control tg-assistant-panel__window-control--close"
              onClick={onClose}
              aria-label="Close Akuso panel"
              title="Close panel"
            >
              <AssistantCloseIcon />
            </button>
          </div>
        </header>

        <div className={`tg-assistant-workspace${showSidebar ? " is-expanded" : " is-minimized"}`}>
          {showSidebar ? (
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

              <div className="tg-assistant-sidebar__section">
                {assistantMode === "writing" ? (
                  <>
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
                  </>
                ) : null}
              </div>

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
          ) : null}

          <section className={`tg-assistant-stage${compactConversation ? " tg-assistant-stage--conversation" : ""}`}>
            <div className={`tg-assistant-stage__header${compactConversation ? " tg-assistant-stage__header--compact" : ""}`}>
              <div className="tg-assistant-stage__copy">
                <h3>{conversationTitle}</h3>
                {!compactConversation ? (
                  <p>
                    Start a natural conversation with Akuso. Ask a question, request a page
                    action, or draft something for your audience.
                  </p>
                ) : null}
              </div>
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
