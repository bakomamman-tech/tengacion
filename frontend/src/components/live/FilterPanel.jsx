const FILTER_OPTIONS = [
  { id: "none", label: "Normal" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "bw", label: "B&W" },
  { id: "sepia", label: "Sepia" },
];

export default function FilterPanel({
  open,
  currentFilter,
  blurEnabled,
  onSelectFilter,
  onToggleBlur,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="live-popover">
      <p className="live-popover-title">Filter presets</p>
      <div className="live-filter-grid">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`live-chip ${currentFilter === option.id ? "active" : ""}`}
            onClick={() => onSelectFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`live-chip live-blur-chip ${blurEnabled ? "active" : ""}`}
        onClick={onToggleBlur}
      >
        Background blur (beta)
      </button>
    </div>
  );
}
