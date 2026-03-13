import { SHARE_DESTINATION_OPTIONS } from "./postShareUtils";

export default function ShareDestinationSelector({
  value = "feed",
  onChange,
  options = SHARE_DESTINATION_OPTIONS,
}) {
  return (
    <div className="tg-share-chip-group" role="radiogroup" aria-label="Share destination">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`tg-share-chip${active ? " active" : ""}`}
            onClick={() => onChange?.(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
