import { SHARE_PRIVACY_OPTIONS } from "./postShareUtils";

export default function ShareAudienceSelector({
  value = "public",
  onChange,
  disabled = false,
  options = SHARE_PRIVACY_OPTIONS,
}) {
  return (
    <div
      className={`tg-share-chip-group${disabled ? " is-disabled" : ""}`}
      role="radiogroup"
      aria-label="Share audience"
      aria-disabled={disabled}
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`tg-share-chip${active ? " active" : ""}`}
            onClick={() => !disabled && onChange?.(option.id)}
            disabled={disabled}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
