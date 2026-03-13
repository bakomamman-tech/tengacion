function ShareActionIcon({ kind }) {
  switch (kind) {
    case "messenger":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3.4c-4.9 0-8.8 3.6-8.8 8.1 0 2.6 1.4 4.9 3.6 6.3v3.7l3.5-2c.6.1 1.1.2 1.7.2 4.9 0 8.8-3.6 8.8-8.1S16.9 3.4 12 3.4z"
            fill="currentColor"
          />
          <path d="M8.2 14l3-3.2 1.8 1.8 3.1-3.2-2.5 4-2-1.7L8.2 14z" fill="#fff" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3.2a8.9 8.9 0 0 0-7.7 13.4L3 21l4.7-1.2A8.9 8.9 0 1 0 12 3.2z"
            fill="currentColor"
          />
          <path
            d="M15.8 13.1c-.2-.1-1.3-.7-1.5-.8-.2-.1-.4-.1-.5.1l-.4.5c-.2.2-.3.2-.5.1a6.9 6.9 0 0 1-1.9-1.2 7.4 7.4 0 0 1-1.3-1.7c-.1-.2 0-.3.1-.4l.3-.3.2-.5c.1-.1 0-.3 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4H8c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.8s.8 2.2 1 2.4c.1.1 1.7 2.5 4 3.3.6.3 1 .4 1.4.5.6.1 1.1.2 1.5.1.5-.1 1.3-.6 1.4-1.2.2-.6.2-1 .1-1.1-.1-.2-.3-.2-.4-.3z"
            fill="#fff"
          />
        </svg>
      );
    case "story":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="5" fill="currentColor" />
          <circle cx="8" cy="8.5" r="1.7" fill="#fff" />
          <path d="M6.2 17.3l3.5-3.2 2.4 1.9 2.7-3 3.1 4.3H6.2z" fill="#fff" />
        </svg>
      );
    case "copy":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M9 7.4A3.4 3.4 0 0 1 12.4 4h3.2a3.4 3.4 0 1 1 0 6.8h-1.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <path
            d="M15 16.6A3.4 3.4 0 0 1 11.6 20H8.4a3.4 3.4 0 1 1 0-6.8h1.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <path
            d="M9.5 14.5h5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      );
    case "group":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="8" cy="8.8" r="2.8" fill="currentColor" />
          <circle cx="16.2" cy="9.5" r="2.4" fill="currentColor" opacity=".75" />
          <path d="M3.8 19a4.6 4.6 0 0 1 9.2 0z" fill="currentColor" />
          <path d="M12 19.2a4.1 4.1 0 0 1 8.2 0z" fill="currentColor" opacity=".75" />
        </svg>
      );
    case "profile":
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8.1" r="3.2" fill="currentColor" />
          <path d="M5 19.1a7 7 0 0 1 14 0z" fill="currentColor" />
        </svg>
      );
  }
}

export default function QuickShareActions({ items = [] }) {
  return (
    <section className="tg-share-section">
      <div className="tg-share-section-head">
        <div>
          <h3>Share to</h3>
          <p>Use a quick route or switch the destination above.</p>
        </div>
      </div>

      <div className="tg-share-quick-actions">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="tg-share-quick-action"
            onClick={item.onClick}
            disabled={Boolean(item.disabled)}
          >
            <span className={`tg-share-quick-action__icon ${item.id}`}>
              <ShareActionIcon kind={item.id} />
            </span>
            <span className="tg-share-quick-action__label">{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
