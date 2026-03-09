import { useCallback, useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import AdminShell from "../components/AdminShell";
import { adminGetMessagesOverview } from "../api";

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

const number = (value) => Number(value || 0).toLocaleString();
const dateTime = (value) => {
  if (!value) {return "-";}
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

export default function AdminMessagesPage({ user }) {
  const [range, setRange] = useState("30d");
  const [payload, setPayload] = useState({ summary: {}, series: [], recentConversations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await adminGetMessagesOverview({ range, interval: "daily" });
      setPayload(next || { summary: {}, series: [], recentConversations: [] });
    } catch (err) {
      setError(err?.message || "Failed to load message analytics");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = useMemo(
    () => [
      ["Messages", payload.summary?.totalMessages],
      ["Conversations", payload.summary?.conversations],
      ["Active Senders", payload.summary?.activeSenders],
      ["Unread", payload.summary?.unreadMessages],
      ["Read", payload.summary?.readMessages],
      ["Avg / Conversation", payload.summary?.averagePerConversation],
    ],
    [payload.summary]
  );

  return (
    <AdminShell
      title="Messages"
      subtitle="Live message volume and recent conversation activity across the platform."
      user={user}
      actions={<button type="button" className="adminx-btn" onClick={load}>Refresh</button>}
    >
      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-filter-row">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`adminx-tab ${range === option.value ? "is-active" : ""}`}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {error ? <div className="adminx-error">{error}</div> : null}
      {loading ? <div className="adminx-loading">Loading message insights...</div> : null}

      {!loading ? (
        <>
          <div className="adminx-stats-grid">
            {cards.map(([label, value]) => (
              <article key={label} className="adminx-stat-card">
                <div className="adminx-kpi-label">{label}</div>
                <div className="adminx-kpi-value">{number(value)}</div>
              </article>
            ))}
          </div>

          <div className="adminx-analytics-grid">
            <section className="adminx-panel adminx-panel--span-7">
              <div className="adminx-panel-head">
                <h2 className="adminx-panel-title">Daily Message Volume</h2>
                <span className="adminx-section-meta">Messages sent per day</span>
              </div>
              <div className="adminx-chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={payload.series || []}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="date" stroke="#9ec4ad" />
                    <YAxis stroke="#9ec4ad" />
                    <Tooltip />
                    <Line type="monotone" dataKey="messagesSent" stroke="#4de586" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="adminx-panel adminx-panel--span-5">
              <div className="adminx-panel-head">
                <h2 className="adminx-panel-title">Recent Conversations</h2>
                <span className="adminx-section-meta">Latest active threads</span>
              </div>
              <div className="adminx-leaderboard">
                {(payload.recentConversations || []).map((entry) => (
                  <article key={entry.conversationId} className="adminx-leaderboard-item">
                    <div className="adminx-row">
                      <strong>{(entry.participantNames || []).join(", ") || entry.lastSenderName || "Conversation"}</strong>
                      <span className="adminx-badge">{number(entry.messagesCount)} msgs</span>
                    </div>
                    <div className="adminx-muted">{entry.lastPreview}</div>
                    <div className="adminx-muted">{dateTime(entry.lastMessageAt)}</div>
                  </article>
                ))}
                {!(payload.recentConversations || []).length ? (
                  <div className="adminx-empty">No message conversations in this range.</div>
                ) : null}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </AdminShell>
  );
}
