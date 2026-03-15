import { CREATOR_CATEGORY_CONFIG } from "./creatorConfig";

const CATEGORY_KEYS = ["music", "books", "podcasts"];

export default function CreatorTypeSelector({ value = [], onChange, error = "" }) {
  const selected = Array.isArray(value) ? value : [];

  const toggle = (category) => {
    const next = selected.includes(category)
      ? selected.filter((entry) => entry !== category)
      : [...selected, category];
    onChange(next);
  };

  return (
    <div className="creator-type-selector">
      <div className="creator-form-block-head">
        <div>
          <h3>Choose your creator lanes</h3>
          <p>Tick Music, Book Publishing, Podcasts, or all three to unlock the right workspace.</p>
        </div>
      </div>
      <div className="creator-type-grid" role="group" aria-label="Creator content categories">
        {CATEGORY_KEYS.map((key) => {
          const item = CREATOR_CATEGORY_CONFIG[key];
          const active = selected.includes(key);
          return (
            <button
              key={key}
              type="button"
              className={`creator-type-card ${active ? "is-active" : ""}`}
              onClick={() => toggle(key)}
              role="checkbox"
              aria-checked={active}
            >
              <div className="creator-type-card-top">
                <span className="creator-type-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className={`creator-type-check ${active ? "is-active" : ""}`} aria-hidden="true">
                  <svg viewBox="0 0 20 20">
                    <path d="m5.3 10.4 3.1 3.1 6.3-7" />
                  </svg>
                </span>
              </div>
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </button>
          );
        })}
      </div>
      {error ? <p className="creator-field-error">{error}</p> : null}
    </div>
  );
}
