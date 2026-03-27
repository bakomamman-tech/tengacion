import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminShell from "../components/AdminShell";
import { adminGetAnalyticsSystemAlerts, adminGetUser } from "../api";

const number = (value) => Number(value || 0).toLocaleString();
const dateTime = (value) => {
  if (!value) {return "-";}
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

export default function AdminSettingsPage({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [systemAlerts, setSystemAlerts] = useState({ alerts: [], metrics: {} });
  const [adminDetail, setAdminDetail] = useState(null);

  const adminId = user?._id || user?.id || "";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [alertsPayload, detailPayload] = await Promise.all([
        adminGetAnalyticsSystemAlerts({ range: "30d" }),
        adminId ? adminGetUser(adminId) : Promise.resolve(null),
      ]);
      setSystemAlerts(alertsPayload || { alerts: [], metrics: {} });
      setAdminDetail(detailPayload || null);
    } catch (err) {
      setError(err?.message || "Failed to load admin settings");
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = useMemo(
    () => [
      ["Role", adminDetail?.role || user?.role || "admin"],
      ["Status", adminDetail?.status || "active"],
      ["Last Login", dateTime(adminDetail?.lastLoginAt || user?.lastLoginAt)],
      ["Open Alerts", number(systemAlerts.alerts?.length)],
    ],
    [adminDetail, systemAlerts.alerts, user?.lastLoginAt, user?.role]
  );

  const shortcuts = [
    { id: "security", label: "Security Settings", description: "Password, sessions, and account security", path: "/settings/security" },
    { id: "privacy", label: "Privacy Settings", description: "Visibility and account controls", path: "/settings/privacy" },
    { id: "notifications", label: "Notification Settings", description: "Notification preferences", path: "/settings/notifications" },
    { id: "audit", label: "Audit Logs", description: "Review admin actions", path: "/admin/audit-logs" },
    { id: "reports", label: "Reports", description: "Open the moderation queue", path: "/admin/reports" },
    { id: "storage", label: "Storage Cleanup", description: "Inspect collection sizes and remove stale data", path: "/admin/storage" },
  ];

  return (
    <AdminShell
      title="Settings"
      subtitle="Administrative access, security shortcuts, and current platform health checks."
      user={user}
      actions={<button type="button" className="adminx-btn" onClick={load}>Refresh</button>}
    >
      {error ? <div className="adminx-error">{error}</div> : null}
      {loading ? <div className="adminx-loading">Loading admin settings...</div> : null}

      {!loading ? (
        <>
          <div className="adminx-stats-grid">
            {cards.map(([label, value]) => (
              <article key={label} className="adminx-stat-card">
                <div className="adminx-kpi-label">{label}</div>
                <div className="adminx-kpi-value">{value}</div>
              </article>
            ))}
          </div>

          <div className="adminx-analytics-grid">
            <section className="adminx-panel adminx-panel--span-6">
              <div className="adminx-panel-head">
                <h2 className="adminx-panel-title">Admin Shortcuts</h2>
                <span className="adminx-section-meta">Open real configuration and review screens</span>
              </div>
              <div className="adminx-leaderboard">
                {shortcuts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="adminx-leaderboard-item"
                    onClick={() => navigate(item.path)}
                  >
                    <div className="adminx-row">
                      <strong>{item.label}</strong>
                    </div>
                    <div className="adminx-muted">{item.description}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="adminx-panel adminx-panel--span-6">
              <div className="adminx-panel-head">
                <h2 className="adminx-panel-title">System Health</h2>
                <span className="adminx-section-meta">Current operational checks</span>
              </div>
              <div className="adminx-leaderboard">
                <article className="adminx-leaderboard-item"><div className="adminx-row"><strong>Failed Payments</strong><span>{number(systemAlerts.metrics?.failedPayments)}</span></div></article>
                <article className="adminx-leaderboard-item"><div className="adminx-row"><strong>Upload Failures</strong><span>{number(systemAlerts.metrics?.uploadFailures)}</span></div></article>
                <article className="adminx-leaderboard-item"><div className="adminx-row"><strong>Login Warnings</strong><span>{number(systemAlerts.metrics?.loginWarnings)}</span></div></article>
                <article className="adminx-leaderboard-item"><div className="adminx-row"><strong>Unresolved Reports</strong><span>{number(systemAlerts.metrics?.unresolvedReports)}</span></div></article>
                <article className="adminx-leaderboard-item"><div className="adminx-row"><strong>Repeat Failed Uploads</strong><span>{number(systemAlerts.metrics?.repeatFailedUploads)}</span></div></article>
              </div>
            </section>
          </div>
        </>
      ) : null}
    </AdminShell>
  );
}
