const formatValue = (value, unit = "number") => {
  const numericValue = Number(value || 0);
  if (unit === "percent") {
    return `${numericValue.toFixed(1)}%`;
  }
  return numericValue.toLocaleString();
};

const buildPath = (values = [], width = 124, height = 42) => {
  if (!Array.isArray(values) || values.length < 2) {
    return "";
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
};

export default function StatCard({ card }) {
  const change = Number(card?.change || 0);
  const isPositive = change >= 0;
  const sparklineValues = Array.isArray(card?.sparkline) && card.sparkline.length
    ? card.sparkline
    : [0, 0, 0, 0];

  return (
    <article className="tdash-stat-card">
      <div className="tdash-stat-card__copy">
        <p className="tdash-stat-card__label">{card?.label}</p>
        <h3 className="tdash-stat-card__value">{formatValue(card?.value, card?.unit)}</h3>
        <div className="tdash-stat-card__meta">
          <span>{card?.helper}</span>
          <span className={`tdash-stat-card__change ${isPositive ? "is-positive" : "is-negative"}`}>
            {isPositive ? "+" : ""}
            {change.toFixed(1)}%
          </span>
        </div>
      </div>

      <svg className="tdash-stat-card__sparkline" viewBox="0 0 124 42" preserveAspectRatio="none" aria-hidden="true">
        <path d={buildPath(sparklineValues)} />
      </svg>
    </article>
  );
}
