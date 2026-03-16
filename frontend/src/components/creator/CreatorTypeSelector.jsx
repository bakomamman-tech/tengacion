import { CREATOR_CATEGORY_CONFIG, CREATOR_CATEGORY_ORDER } from "./creatorConfig";

const CATEGORY_KEYS = CREATOR_CATEGORY_ORDER;

export default function CreatorTypeSelector({ value = [], onChange, error = "" }) {
  const selected = Array.isArray(value) ? value : [];
  const selectedCount = selected.length;

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
      <div className="creator-type-meta">
        <span className="creator-status-badge neutral">
          {selectedCount} of {CATEGORY_KEYS.length} selected
        </span>
        <span className="creator-field-hint">Click any card to turn a lane on or off.</span>
      </div>
      <div className="creator-type-grid" aria-label="Creator content categories">
        {CATEGORY_KEYS.map((key) => {
          const item = CREATOR_CATEGORY_CONFIG[key];
          const active = selected.includes(key);
          return (
            <label key={key} className={`creator-type-card ${active ? "is-active" : ""}`}>
              <input
                className="creator-type-input"
                type="checkbox"
                checked={active}
                onChange={() => toggle(key)}
              />
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
              <span className={`creator-type-state ${active ? "is-active" : ""}`}>
                {active ? "Enabled" : "Disabled"}
              </span>
            </label>
          );
        })}
      </div>
      {error ? <p className="creator-field-error">{error}</p> : null}
    </div>
  );
}
