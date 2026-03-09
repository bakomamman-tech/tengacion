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

  return (
    <section className="tdash-panel">
      <div className="tdash-panel__head">
        <h3 className="tdash-panel__title">Audience by Age</h3>
      </div>

      {!hasData ? <div className="tdash-empty">No audience age data is available yet.</div> : null}
      <div className="tdash-age-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items}>
            <CartesianGrid stroke="rgba(129, 153, 204, 0.14)" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="#7f8db1" />
            <YAxis tickLine={false} axisLine={false} stroke="#7f8db1" width={34} />
            <Tooltip content={<AgeTooltip />} />
            <Bar dataKey="value" fill="#7a8dff" radius={[10, 10, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
