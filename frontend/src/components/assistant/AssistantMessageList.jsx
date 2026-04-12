import { useEffect, useRef } from "react";

import AssistantCards from "./AssistantCards";

function TypingIndicator() {
  return (
    <div className="tg-assistant-message tg-assistant-message--assistant">
      <div className="tg-assistant-message__meta">Akuso</div>
      <div
        className="tg-assistant-message__bubble tg-assistant-message__bubble--loading"
        aria-live="polite"
      >
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

export default function AssistantMessageList({
  messages = [],
  loading = false,
  onCardAction,
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

        return (
          <article
            key={message?.id || `${message?.role || "assistant"}-${message?.content || ""}`}
            className={`tg-assistant-message${isUser ? " tg-assistant-message--user" : " tg-assistant-message--assistant"}`}
          >
            <div className="tg-assistant-message__meta">
              {isUser ? "You" : "Akuso"}
            </div>
            <div className="tg-assistant-message__bubble">{message?.content}</div>
            {!isUser && cards.length > 0 ? (
              <AssistantCards cards={cards} onCardAction={onCardAction} />
            ) : null}
          </article>
        );
      })}

      {loading ? <TypingIndicator /> : null}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}
