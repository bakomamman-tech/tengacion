import { useEffect, useState } from "react";
import {
  adminGetAnalyticsOverview,
  adminGetRetentionAnalytics,
  adminGetUploadErrorAnalytics,
} from "../api";

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState("7d");
  const [overview, setOverview] = useState({ latest: {}, series: [] });
  const [retention, setRetention] = useState([]);
  const [uploadErrors, setUploadErrors] = useState([]);

  useEffect(() => {
    adminGetAnalyticsOverview(range).then(setOverview).catch(() => setOverview({ latest: {}, series: [] }));
    adminGetRetentionAnalytics("weekly").then((rows) => setRetention(Array.isArray(rows) ? rows : [])).catch(() => setRetention([]));
    adminGetUploadErrorAnalytics().then((rows) => setUploadErrors(Array.isArray(rows) ? rows : [])).catch(() => setUploadErrors([]));
  }, [range]);

  const latest = overview?.latest || {};

  return (
    <div className="app-shell">
      <main className="feed" style={{ maxWidth: 1100, margin: "0 auto", padding: 20, display: "grid", gap: 14 }}>
        <section className="card" style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Analytics</h2>
            <select value={range} onChange={(event) => setRange(event.target.value)}>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
            </select>
          </div>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginTop: 10 }}>
            <div className="card" style={{ padding: 10 }}><b>DAU</b><div>{latest.dau || 0}</div></div>
            <div className="card" style={{ padding: 10 }}><b>MAU</b><div>{latest.mau || 0}</div></div>
            <div className="card" style={{ padding: 10 }}><b>New users</b><div>{latest.newUsers || 0}</div></div>
            <div className="card" style={{ padding: 10 }}><b>Posts/day</b><div>{latest.postsCount || 0}</div></div>
            <div className="card" style={{ padding: 10 }}><b>Reports</b><div>{latest.reportsCount || 0}</div></div>
            <div className="card" style={{ padding: 10 }}><b>Upload failures</b><div>{latest.uploadFailuresCount || 0}</div></div>
          </div>
        </section>

        <section className="card" style={{ padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Retention (weekly)</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%" }}>
              <thead><tr><th align="left">Cohort</th><th align="left">Users</th><th align="left">Retained</th><th align="left">Rate</th></tr></thead>
              <tbody>
                {retention.map((row) => (
                  <tr key={row.cohort}><td>{row.cohort}</td><td>{row.users}</td><td>{row.retained}</td><td>{Math.round((row.retentionRate || 0) * 100)}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card" style={{ padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Upload failures (recent)</h3>
          <div style={{ display: "grid", gap: 6 }}>
            {uploadErrors.map((row) => (
              <div key={row.date} className="card" style={{ padding: 8 }}>{row.date}: {row.uploadFailuresCount || 0}</div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
