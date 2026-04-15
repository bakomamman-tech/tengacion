import { useEffect, useRef } from "react";

function AssistantSpark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.4 13.6 8.4 18.6 10 13.6 11.6 12 16.6 10.4 11.6 5.4 10 10.4 8.4z" />
    </svg>
  );
}

function TypingIndicator({ label = "Akuso is thinking" }) {
  return (
    <div className="tg-assistant-message tg-assistant-message--assistant">
      <div className="tg-assistant-message__meta">
        <span className="tg-assistant-message__avatar" aria-hidden="true">
          <AssistantSpark />
        </span>
        <span>Akuso</span>
      </div>
      <div className="tg-assistant-message__bubble tg-assistant-message__bubble--assistant tg-assistant-message__bubble--loading" aria-live="polite">
        <span className="tg-assistant-typing" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="tg-assistant-typing__text">{label}</span>
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

const TRUST_MODE_LABELS = {
  "app-aware": "App-aware",
  "public-knowledge": "Public knowledge",
  "creator-writing": "Creator writing",
  "health-caution": "Health caution",
  general: "General help",
};

function buildTrustSummary(trust) {
  const contextLabel = trust.grounded ? "grounded" : "limited context";
  const providerLabel = trust.usedModel ? trust.provider : "local safety flow";
  return `${TRUST_MODE_LABELS[trust.mode] || "Guided"} | ${contextLabel} | ${trust.confidenceLabel} confidence | ${providerLabel}`;
}

export default function AssistantMessageList({
  messages = [],
  loading = false,
  streamingLabel = "",
  onFollowUpClick,
}) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  return (
    <div className="tg-assistant-thread" role="log" aria-live="polite" aria-relevant="additions text">
      {messages.map((message) => {
        const isUser = message?.role === "user";
        const followUps = Array.isArray(message?.followUps) ? message.followUps : [];
        const safety = message?.safety || { level: "safe", notice: "", escalation: "" };
        const trust = message?.trust || {
          provider: "local-fallback",
          mode: "general",
          grounded: true,
          usedModel: false,
          confidenceLabel: "medium",
          note: "",
        };
        return (
          <article
            key={message?.id || `${message?.role || "assistant"}-${message?.content || ""}`}
            className={`tg-assistant-message${isUser ? " tg-assistant-message--user" : " tg-assistant-message--assistant"}`}
          >
            <div className="tg-assistant-message__meta">
              {isUser ? (
                <span>You</span>
              ) : (
                <>
                  <span className="tg-assistant-message__avatar" aria-hidden="true">
                    <AssistantSpark />
                  </span>
                  <span>Akuso</span>
                  {message?.mode ? (
                    <span className="tg-assistant-message__meta-tag">{message.mode}</span>
                  ) : null}
                </>
              )}
            </div>

            <div
              className={`tg-assistant-message__bubble${isUser ? "" : " tg-assistant-message__bubble--assistant"}`}
            >
              {message?.content}
            </div>

            {!isUser ? (
              <div className="tg-assistant-message__support-note">
                {buildTrustSummary(trust)}
              </div>
            ) : null}

            {!isUser && safety?.level && safety.level !== "safe" ? (
              <div className={`tg-assistant-safety tg-assistant-safety--${safety.level}`}>
                <strong>{SAFETY_LABELS[safety.level] || "Notice"}</strong>
                <p>{safety.notice || "Akuso added a cautionary note for this answer."}</p>
              </div>
            ) : null}

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
          </article>
        );
      })}

      {loading ? <TypingIndicator label={streamingLabel || "Akuso is thinking"} /> : null}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}
