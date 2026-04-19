export default function PayoutSummaryCards({ summary = {} }) {
  const cards = [
    {
      label: "Total sales",
      value: `₦${Number(summary.totalSales || 0).toLocaleString()}`,
    },
    {
      label: "Platform fees",
      value: `₦${Number(summary.totalPlatformFees || 0).toLocaleString()}`,
    },
    {
      label: "Net receivable",
      value: `₦${Number(summary.totalNetReceivable || 0).toLocaleString()}`,
    },
    {
      label: "Completed orders",
      value: Number(summary.totalCompletedOrders || 0).toLocaleString(),
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
