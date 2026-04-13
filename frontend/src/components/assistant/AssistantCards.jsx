const CARD_LABELS = {
  creator: "Creator",
  content: "Content",
  "quick-link": "Quick link",
  caption: "Caption",
  draft: "Draft",
  purchase: "Purchase",
  notification: "Notification",
  knowledge: "Knowledge",
  help: "Help",
};

const getCardActionLabel = (card) => {
  if (card?.type === "caption") {
    return "Use in composer";
  }
  if (card?.type === "draft") {
    return "Use draft";
  }
  if (card?.route) {
    return "Open";
  }
  return "Use";
};

export default function AssistantCards({ cards = [], onCardAction }) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return null;
  }

  return (
    <div className="tg-assistant-card-grid" role="list" aria-label="Akuso results">
      {cards.slice(0, 8).map((card, index) => (
        <button
          key={`${card?.type || "card"}-${card?.title || index}`}
          type="button"
          className={`tg-assistant-card tg-assistant-card--${String(card?.type || "card")
            .replace(/[^a-z0-9-]/gi, "-")
            .toLowerCase()}`}
          onClick={() => onCardAction?.(card)}
        >
          <span className="tg-assistant-card__kicker">
            {CARD_LABELS[card?.type] || "Result"}
          </span>
          <strong className="tg-assistant-card__title">{card?.title || "Untitled"}</strong>
          {card?.subtitle ? (
            <span className="tg-assistant-card__subtitle">{card.subtitle}</span>
          ) : null}
          {card?.description ? (
            <p className="tg-assistant-card__description">{card.description}</p>
          ) : null}
          <span className="tg-assistant-card__action">{getCardActionLabel(card)}</span>
        </button>
      ))}
    </div>
  );
}
