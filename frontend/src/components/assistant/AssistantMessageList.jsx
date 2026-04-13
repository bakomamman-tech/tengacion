import { useEffect, useRef } from "react";

import AssistantCards from "./AssistantCards";

function TypingIndicator() {
  return (
    <div className="tg-assistant-message tg-assistant-message--assistant">
      <div className="tg-assistant-message__meta">Akuso</div>
      <div className="tg-assistant-message__bubble tg-assistant-message__bubble--loading" aria-live="polite">
        <span className="tg-assistant-typing" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="tg-assistant-typing__text">Akuso is thinking</span>
      </div>
    </div>
  );
}

const SAFETY_LABELS = {
  safe: "Safe",
  caution: "Use caution",
  refusal: "Refused",
  emergency: "Urgent",
};

export default function AssistantMessageList({
  messages = [],
  loading = false,
  onCardAction,
  onFollowUpClick,
  onFeedback,
}) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  return (
    <div className="tg-assistant-thread" role="log" aria-live="polite" aria-relevant="additions text">
      {messages.map((message) => {
        const isUser = message?.role === "user";
        const cards = Array.isArray(message?.cards) ? message.cards : [];
        const details = Array.isArray(message?.details) ? message.details : [];
        const followUps = Array.isArray(message?.followUps) ? message.followUps : [];
        const safety = message?.safety || { level: "safe", notice: "", escalation: "" };
        const feedbackStatus = String(message?.feedbackStatus || "unrated");

        return (
          <article
            key={message?.id || `${message?.role || "assistant"}-${message?.content || ""}`}
            className={`tg-assistant-message${isUser ? " tg-assistant-message--user" : " tg-assistant-message--assistant"}`}
          >
            <div className="tg-assistant-message__meta">
              {isUser ? "You" : `Akuso${message?.mode ? ` • ${message.mode}` : ""}`}
            </div>

            <div className="tg-assistant-message__bubble">{message?.content}</div>

            {!isUser && safety?.level && safety.level !== "safe" ? (
              <div className={`tg-assistant-safety tg-assistant-safety--${safety.level}`}>
                <strong>{SAFETY_LABELS[safety.level] || "Notice"}</strong>
                <p>{safety.notice || "Akuso added a cautionary note for this answer."}</p>
              </div>
            ) : null}

            {!isUser && details.length > 0 ? (
              <div className="tg-assistant-details">
                {details.map((detail, index) => (
                  <details key={`${detail?.title || "detail"}-${index}`} className="tg-assistant-detail">
                    <summary>{detail?.title || "More details"}</summary>
                    <p>{detail?.body || ""}</p>
                  </details>
                ))}
              </div>
            ) : null}

            {!isUser && cards.length > 0 ? <AssistantCards cards={cards} onCardAction={onCardAction} /> : null}

            {!isUser && followUps.length > 0 ? (
              <div className="tg-assistant-followups" aria-label="Follow-up prompts">
                {followUps.slice(0, 4).map((followUp) => (
                  <button
                    key={`${followUp?.label || followUp?.prompt}`}
                    type="button"
                    className="tg-assistant-chip tg-assistant-chip--followup"
                    onClick={() => onFollowUpClick?.(followUp?.prompt || followUp?.label)}
                  >
                    {followUp?.label || followUp?.prompt}
                  </button>
                ))}
              </div>
            ) : null}

            {!isUser && onFeedback ? (
              <div className="tg-assistant-feedback">
                <span className="tg-assistant-feedback__label">
                  {feedbackStatus === "helpful" || feedbackStatus === "not_helpful"
                    ? feedbackStatus === "helpful"
                      ? "Thanks for the feedback."
                      : "Thanks, we’ll improve this."
                    : "Was this helpful?"}
                </span>
                <div className="tg-assistant-feedback__actions">
                  <button
                    type="button"
                    className={`tg-assistant-feedback__button${feedbackStatus === "helpful" ? " is-active" : ""}`}
                    onClick={() => onFeedback?.(message, "helpful")}
                  >
                    Helpful
                  </button>
                  <button
                    type="button"
                    className={`tg-assistant-feedback__button${feedbackStatus === "not_helpful" ? " is-active" : ""}`}
                    onClick={() => onFeedback?.(message, "not_helpful")}
                  >
                    Not helpful
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}

      {loading ? <TypingIndicator /> : null}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}
