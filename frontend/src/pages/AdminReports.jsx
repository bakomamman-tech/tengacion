import { useEffect, useState } from "react";
import AdminShell from "../components/AdminShell";
import {
  adminListReports,
  adminModerationAction,
  adminUpdateReport,
} from "../api";

const REASONS = ["spam", "hate_speech", "violence", "harassment", "misinformation", "nudity", "other"];

export default function AdminReportsPage({ user }) {
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminListReports({ status })
      .then((payload) => setRows(Array.isArray(payload?.reports) ? payload.reports : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [status]);

  const action = async (entry, nextAction) => {
    try {
      await adminModerationAction({
        action: nextAction,
        targetType: entry.targetType,
        targetId: entry.targetId,
        reportId: entry._id,
        reason: entry.reason,
        strikes: 1,
      });
      await adminUpdateReport(entry._id, { status: "actioned", actionTaken: nextAction });
      setMessage(`Action ${nextAction} applied.`);
      load();
    } catch (err) {
      setMessage(err?.message || "Action failed");
    }
  };

  return (
    <AdminShell
      title="Reports"
      subtitle="Moderation queue for user, post, comment, and message reports."
      user={user}
      actions={<button type="button" className="adminx-btn" onClick={load}>Refresh</button>}
    >
      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-filter-row">
          <select className="adminx-select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="reviewing">Reviewing</option>
            <option value="actioned">Actioned</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </section>

      {message ? <div className="adminx-panel adminx-panel--span-12">{message}</div> : null}
      {loading ? <div className="adminx-loading">Loading reports...</div> : null}

      {!loading ? (
        <section className="adminx-list-grid">
          {rows.map((entry) => (
            <article key={entry._id} className="adminx-panel adminx-panel--span-12">
              <div className="adminx-row"><strong>{entry.targetType}</strong><span className="adminx-badge">{entry.status}</span></div>
              <div className="adminx-muted">reason: {entry.reason} | reporter: @{entry?.reporterId?.username || "unknown"}</div>
              <div className="adminx-action-row">
                <button type="button" className="adminx-btn" onClick={() => adminUpdateReport(entry._id, { status: "dismissed" }).then(load)}>Dismiss</button>
                <button type="button" className="adminx-btn" onClick={() => adminUpdateReport(entry._id, { status: "reviewing" }).then(load)}>Mark Reviewing</button>
                <button type="button" className="adminx-btn" onClick={() => action(entry, "warn")}>Warn + Strike</button>
                <button type="button" className="adminx-btn" onClick={() => action(entry, "mute")}>Mute + Strike</button>
                <button type="button" className="adminx-btn adminx-btn--danger" onClick={() => action(entry, "ban")}>Ban + Strike</button>
                {entry.targetType === "post" ? <button type="button" className="adminx-btn" onClick={() => action(entry, "delete_post")}>Delete Post</button> : null}
              </div>
            </article>
          ))}
          {rows.length === 0 ? <div className="adminx-empty">No reports found.</div> : null}
        </section>
      ) : null}

      <section className="adminx-panel adminx-panel--span-12">
        <h2 className="adminx-panel-title">Report Reasons</h2>
        <p className="adminx-muted">{REASONS.join(", ")}</p>
      </section>
    </AdminShell>
  );
}
