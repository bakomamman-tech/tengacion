import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const formatDateLabel = (value) => {
  if (!value) {
    return "";
  }
  const stringValue = String(value);
  if (/^\d{4}-\d{2}$/.test(stringValue)) {
    const [year, month] = stringValue.split("-");
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(undefined, { month: "short" });
  }
  const date = new Date(stringValue);
  if (Number.isNaN(date.getTime())) {
    return stringValue;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const chartSets = {
  activity: [
    { key: "activeUsers", color: "#5b83ff", label: "Active users" },
    { key: "engagement", color: "#66dac6", label: "Engagement" },
    { key: "profileVisits", color: "#b79dff", label: "Profile visits" },
    { key: "clicks", color: "#f4a64c", label: "Clicks" },
  ],
  reach: [
    { key: "reach", color: "#5b83ff", label: "Reach" },
    { key: "impressions", color: "#66dac6", label: "Impressions" },
    { key: "profileVisits", color: "#b79dff", label: "Profile visits" },
  ],
  share: [
    { key: "shares", color: "#f4a64c", label: "Shares" },
    { key: "saves", color: "#b79dff", label: "Saves" },
    { key: "comments", color: "#66dac6", label: "Comments" },
  ],
  shares: [
    { key: "shares", color: "#5b83ff", label: "Shares" },
    { key: "likes", color: "#66dac6", label: "Likes" },
    { key: "comments", color: "#f4a64c", label: "Comments" },
    { key: "contentInteractions", color: "#b79dff", label: "Interactions" },
  ],
  clicks: [
    { key: "clicks", color: "#5b83ff", label: "Clicks" },
    { key: "profileVisits", color: "#66dac6", label: "Profile visits" },
    { key: "saves", color: "#b79dff", label: "Saves" },
  ],
};

function ChartTooltip({ active, label, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="tdash-chart-tooltip">
      <div className="tdash-chart-tooltip__title">{formatDateLabel(label)}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="tdash-chart-tooltip__row">
          <span className="tdash-chart-tooltip__dot" style={{ backgroundColor: entry.color }} />
          <span>{entry.name}</span>
          <strong>{Number(entry.value || 0).toLocaleString()}</strong>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsChartCard({
  tabs = [],
  activeTab = "activity",
  onTabChange,
  rangeOptions = [],
  activeRange = "30d",
  onRangeChange,
  series = [],
}) {
  const lines = chartSets[activeTab] || chartSets.activity;

  return (
    <section className="tdash-panel tdash-panel--chart">
      <div className="tdash-panel__head tdash-panel__head--stack">
        <div className="tdash-chart-tabs" role="tablist" aria-label="Analytics chart tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tdash-chart-tabs__button ${activeTab === tab.id ? "is-active" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className="tdash-select-wrap">
          <select
            className="tdash-select"
            value={activeRange}
            onChange={(event) => onRangeChange(event.target.value)}
            aria-label="Select time range"
          >
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="tdash-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series}>
            <CartesianGrid stroke="rgba(129, 153, 204, 0.14)" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickFormatter={formatDateLabel}
              stroke="#7f8db1"
              minTickGap={18}
            />
            <YAxis tickLine={false} axisLine={false} stroke="#7f8db1" width={56} />
            <Tooltip content={<ChartTooltip />} />
            {lines.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.label}
                stroke={line.color}
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
