import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function AgeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="tdash-chart-tooltip">
      <div className="tdash-chart-tooltip__title">{label}</div>
      <div className="tdash-chart-tooltip__row">
        <span className="tdash-chart-tooltip__dot" style={{ backgroundColor: "#7897ff" }} />
        <span>Audience</span>
        <strong>{Number(payload[0]?.value || 0).toLocaleString()}</strong>
      </div>
    </div>
  );
}

export default function AudienceAgeCard({ items = [] }) {
  const hasData = items.some((item) => Number(item?.value || 0) > 0);
  const total = items.reduce((sum, item) => sum + Number(item?.value || 0), 0);
  const leadCohort = [...items].sort((left, right) => Number(right?.value || 0) - Number(left?.value || 0))[0];

  return (
    <section className="tdash-panel">
      <div className="tdash-panel__head">
        <div className="tdash-panel__heading">
          <span className="tdash-panel__eyebrow">Demographics</span>
          <h3 className="tdash-panel__title">Audience by age</h3>
          <p>Tracked audience distribution by cohort.</p>
        </div>
        <span className="tdash-panel__count">{hasData ? `${leadCohort?.label} leads` : `${total} tracked`}</span>
      </div>

      {!hasData ? <div className="tdash-empty">No audience age data is available yet.</div> : null}
      <div className="tdash-age-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items}>
            <CartesianGrid stroke="var(--tdash-chart-grid)" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="var(--tdash-chart-axis)" />
            <YAxis tickLine={false} axisLine={false} stroke="var(--tdash-chart-axis)" width={34} />
            <Tooltip content={<AgeTooltip />} />
            <Bar dataKey="value" fill="#7a8dff" radius={[10, 10, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="tdash-age-breakdown" aria-label="Audience age totals">
        {items.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{Number(item.value || 0).toLocaleString()}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
