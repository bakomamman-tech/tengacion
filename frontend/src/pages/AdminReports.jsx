import { useEffect, useState } from "react";
import {
  adminListReports,
  adminModerationAction,
  adminUpdateReport,
} from "../api";

const REASONS = ["spam", "hate_speech", "violence", "harassment", "misinformation", "nudity", "other"];

export default function AdminReportsPage() {
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");

  const load = () => {
    adminListReports({ status }).then((payload) => setRows(Array.isArray(payload?.reports) ? payload.reports : [])).catch(() => setRows([]));
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
    <div className="app-shell">
      <main className="feed" style={{ maxWidth: 980, margin: "0 auto", padding: 20, display: "grid", gap: 14 }}>
        <section className="card" style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Reports queue</h2>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="reviewing">Reviewing</option>
              <option value="actioned">Actioned</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {rows.map((entry) => (
              <article key={entry._id} className="card" style={{ padding: 10 }}>
                <div><b>{entry.targetType}</b> | reason: {entry.reason}</div>
                <div>reporter: @{entry?.reporterId?.username || "unknown"}</div>
                <div>status: {entry.status}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <button type="button" onClick={() => adminUpdateReport(entry._id, { status: "dismissed" }).then(load)}>Dismiss</button>
                  <button type="button" onClick={() => adminUpdateReport(entry._id, { status: "reviewing" }).then(load)}>Mark reviewing</button>
                  <button type="button" onClick={() => action(entry, "warn")}>Warn + strike</button>
                  <button type="button" onClick={() => action(entry, "mute")}>Mute + strike</button>
                  <button type="button" onClick={() => action(entry, "ban")}>Ban + strike</button>
                  {entry.targetType === "post" ? (
                    <button type="button" onClick={() => action(entry, "delete_post")}>Delete post</button>
                  ) : null}
                </div>
              </article>
            ))}
            {rows.length === 0 ? <p>No reports found.</p> : null}
          </div>
          {message ? <p>{message}</p> : null}
        </section>

        <section className="card" style={{ padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Report reasons</h3>
          <p>{REASONS.join(", ")}</p>
        </section>
      </main>
    </div>
  );
}
