const formatNaira = (value = 0) => `NGN ${Number(value || 0).toLocaleString()}`;

export default function PayoutSummaryCards({ summary = {} }) {
  const cards = [
    {
      label: "Total sales",
      value: formatNaira(summary.totalSales || 0),
    },
    {
      label: "Buyer-confirmed",
      value: formatNaira(summary.confirmedNetReceivable || 0),
    },
    {
      label: "Held until delivery",
      value: formatNaira(summary.heldNetReceivable || 0),
    },
    {
      label: "Available to withdraw",
      value: formatNaira(summary.withdrawableAmount || summary.availableBalance || 0),
    },
  ];

  return (
    <div className="marketplace-summary-grid">
      {cards.map((card) => (
        <article key={card.label} className="marketplace-summary-card">
          <strong>{card.value}</strong>
          <span>{card.label}</span>
        </article>
      ))}
    </div>
  );
}
