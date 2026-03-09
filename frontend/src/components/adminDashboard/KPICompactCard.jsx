import AdminDashboardIcon from "./AdminDashboardIcon";

const formatValue = (value) => Number(value || 0).toLocaleString();

export default function KPICompactCard({ items = [] }) {
  const hasData = items.some((item) => Number(item?.value || 0) > 0);

  return (
    <section className="tdash-panel">
      <div className="tdash-panel__head">
        <h3 className="tdash-panel__title">KPI Snapshot</h3>
      </div>

      {!hasData ? <div className="tdash-empty">No interaction KPIs have been recorded in this range yet.</div> : null}
      <div className="tdash-kpi-grid">
        {items.map((item) => (
          <article key={item.id} className="tdash-kpi-card">
            <span className="tdash-kpi-card__icon">
              <AdminDashboardIcon name={item.icon} size={16} />
            </span>
            <div>
              <div className="tdash-kpi-card__label">{item.label}</div>
              <div className="tdash-kpi-card__value">{formatValue(item.value)}</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
