export default function CreatorStatsCard({
  label,
  value,
  helper = "",
  tone = "neutral",
}) {
  return (
    <article className={`creator-stats-card creator-stats-card--${tone} card`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </article>
  );
}
