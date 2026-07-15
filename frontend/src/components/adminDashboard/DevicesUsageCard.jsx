import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const totalOf = (items = []) => items.reduce((sum, item) => sum + Number(item?.value || 0), 0);

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }
  const item = payload[0]?.payload;
  return (
    <div className="tdash-chart-tooltip">
      <div className="tdash-chart-tooltip__row">
        <span className="tdash-chart-tooltip__dot" style={{ backgroundColor: item?.color }} />
        <span>{item?.label}</span>
        <strong>{Number(item?.value || 0).toLocaleString()}</strong>
      </div>
    </div>
  );
}

function DonutBlock({ title, items }) {
  const total = totalOf(items);
  const lead = [...items].sort((a, b) => Number(b.value || 0) - Number(a.value || 0))[0];

  return (
    <div className="tdash-devices__chart">
      <div className="tdash-devices__chart-title">{title}</div>
      <div className="tdash-devices__chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<DonutTooltip />} />
            <Pie
              data={items}
              dataKey="value"
              nameKey="label"
              innerRadius={44}
              outerRadius={60}
              stroke="transparent"
              paddingAngle={3}
            >
              {items.map((item) => (
                <Cell key={item.label} fill={item.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="tdash-devices__chart-center">
          <strong>{lead?.label}</strong>
          <span>{total ? `${Math.round((Number(lead?.value || 0) / total) * 100)}%` : "0%"}</span>
        </div>
      </div>
    </div>
  );
}

export default function DevicesUsageCard({ data }) {
  const allItems = [...(data?.primary || []), ...(data?.secondary || [])];
  const hasData = allItems.some((item) => Number(item?.value || 0) > 0);
  const trackedSessions = (data?.legend || []).reduce((sum, item) => sum + Number(item?.value || 0), 0);

  return (
    <section className="tdash-panel">
      <div className="tdash-panel__head">
        <div className="tdash-panel__heading">
          <span className="tdash-panel__eyebrow">Access mix</span>
          <h3 className="tdash-panel__title">Device usage</h3>
          <p>Operating systems and access channels.</p>
        </div>
        <span className="tdash-panel__count">{trackedSessions.toLocaleString()} sessions</span>
      </div>

      {!hasData ? <div className="tdash-empty">No device sessions have been recorded yet.</div> : null}
      <div className="tdash-devices">
        <DonutBlock title={data?.primaryTitle || "Mobile OS"} items={data?.primary || []} />
        <DonutBlock title={data?.secondaryTitle || "Access Mix"} items={data?.secondary || []} />
      </div>

      <div className="tdash-devices__legend">
        {(data?.legend || []).map((item) => (
          <div key={item.label} className="tdash-devices__legend-item">
            <span className="tdash-devices__legend-dot" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
            <strong>
              {Number(item.percent || 0).toFixed(Number(item.percent || 0) % 1 ? 1 : 0)}%
              <small>{Number(item.value || 0).toLocaleString()}</small>
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
