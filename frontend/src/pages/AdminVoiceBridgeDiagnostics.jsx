import { useCallback, useEffect, useMemo, useState } from "react";

import { apiRequest, API_BASE } from "../api";
import AdminShell from "../components/AdminShell";

import "./admin-voicebridge.css";

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};

const secondsLabel = (value) =>
  Number.isFinite(value) ? `${value} s` : "—";

const diagnosticRequest = (path, options = {}) =>
  apiRequest(`${API_BASE}/codeswitch/africastalking/voice/diagnostics${path}`, {
    timeoutMs: 20000,
    ...options,
  });

export default function AdminVoiceBridgeDiagnostics({ user }) {
  const [status, setStatus] = useState(null);
  const [rows, setRows] = useState([]);
  const [revealed, setRevealed] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [statusPayload, listPayload] = await Promise.all([
        diagnosticRequest("/status"),
        diagnosticRequest("?limit=50"),
      ]);
      setStatus(statusPayload?.diagnostics || null);
      setRows(Array.isArray(listPayload?.diagnostics) ? listPayload.diagnostics : []);
    } catch (err) {
      setError(err?.message || "Failed to load VoiceBridge diagnostics.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load({ silent: true }), 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  const enableCapture = async () => {
    setBusy("enable");
    setError("");
    try {
      const payload = await diagnosticRequest("/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: 30 }),
      });
      setStatus(payload?.diagnostics || null);
      await load({ silent: true });
    } catch (err) {
      setError(err?.message || "Could not enable transcript capture.");
    } finally {
      setBusy("");
    }
  };

  const disableCapture = async () => {
    setBusy("disable");
    setError("");
    try {
      const payload = await diagnosticRequest("/disable", { method: "POST" });
      setStatus(payload?.diagnostics || null);
    } catch (err) {
      setError(err?.message || "Could not disable transcript capture.");
    } finally {
      setBusy("");
    }
  };

  const clearAll = async () => {
    setBusy("clear");
    setError("");
    try {
      await diagnosticRequest("", { method: "DELETE" });
      setRevealed({});
      await load({ silent: true });
    } catch (err) {
      setError(err?.message || "Could not delete temporary diagnostics.");
    } finally {
      setBusy("");
    }
  };

  const revealTranscript = async (id) => {
    setBusy(`reveal:${id}`);
    setError("");
    try {
      const payload = await diagnosticRequest(`/${encodeURIComponent(id)}`);
      if (payload?.diagnostic) {
        setRevealed((current) => ({ ...current, [id]: payload.diagnostic }));
      }
    } catch (err) {
      setError(err?.message || "Could not reveal transcript.");
    } finally {
      setBusy("");
    }
  };

  const hideTranscript = (id) => {
    setRevealed((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const deleteOne = async (id) => {
    setBusy(`delete:${id}`);
    setError("");
    try {
      await diagnosticRequest(`/${encodeURIComponent(id)}`, { method: "DELETE" });
      hideTranscript(id);
      await load({ silent: true });
    } catch (err) {
      setError(err?.message || "Could not delete transcript.");
    } finally {
      setBusy("");
    }
  };

  const summary = useMemo(() => {
    const completed = rows.filter((row) => row.actionCompleted === true).length;
    const expiringSoon = rows.filter((row) => {
      const expiry = new Date(row.expiresAt).getTime();
      return Number.isFinite(expiry) && expiry - Date.now() <= 10 * 60 * 1000;
    }).length;
    return {
      calls: rows.length,
      completed,
      expiringSoon,
    };
  }, [rows]);

  const headerActions = (
    <div className="vb-admin-actions">
      <button
        type="button"
        className="adminx-btn"
        onClick={() => load()}
        disabled={loading || Boolean(busy)}
      >
        Refresh
      </button>
      {status?.active ? (
        <button
          type="button"
          className="adminx-btn"
          onClick={disableCapture}
          disabled={Boolean(busy)}
        >
          {busy === "disable" ? "Disabling…" : "Disable capture"}
        </button>
      ) : (
        <button
          type="button"
          className="adminx-btn adminx-btn--primary"
          onClick={enableCapture}
          disabled={Boolean(busy)}
        >
          {busy === "enable" ? "Enabling…" : "Enable 30 min capture"}
        </button>
      )}
    </div>
  );

  return (
    <AdminShell
      title="VoiceBridge Diagnostics"
      subtitle="Private, temporary Sahara transcript verification for Africa's Talking calls"
      user={user}
      actions={headerActions}
    >
      <div className="vb-admin-page">
        {error ? <div className="vb-admin-error" role="alert">{error}</div> : null}

        <section className="vb-admin-status-grid" aria-label="VoiceBridge diagnostic summary">
          <article className="vb-admin-card vb-admin-card--capture">
            <span className="vb-admin-card__label">Transcript capture</span>
            <strong className={status?.active ? "is-on" : "is-off"}>
              {status?.active ? "ON" : "OFF"}
            </strong>
            <p>
              {status?.active
                ? `Enabled until ${formatDateTime(status.enabledUntil)}`
                : "No new call transcript will be retained until an admin enables capture."}
            </p>
          </article>
          <article className="vb-admin-card">
            <span className="vb-admin-card__label">Temporary calls</span>
            <strong>{summary.calls}</strong>
            <p>Unexpired diagnostic records currently available.</p>
          </article>
          <article className="vb-admin-card">
            <span className="vb-admin-card__label">Actions completed</span>
            <strong>{summary.completed}</strong>
            <p>Calls that reached the safe VoiceBridge action layer.</p>
          </article>
          <article className="vb-admin-card">
            <span className="vb-admin-card__label">Expiring soon</span>
            <strong>{summary.expiringSoon}</strong>
            <p>Records scheduled to disappear within 10 minutes.</p>
          </article>
        </section>

        <section className="vb-admin-privacy">
          <div>
            <span>Privacy boundary</span>
            <h2>Transcript text stays behind the Admin Console</h2>
            <p>
              The public CodeSwitch demo contains no transcript controls. Diagnostic records contain no raw audio,
              recording URL, caller number, or raw Africa's Talking session ID. Exact transcript text is hidden until
              an administrator deliberately reveals it and is automatically removed after 30 minutes.
            </p>
          </div>
          <button
            type="button"
            className="adminx-btn adminx-btn--danger"
            onClick={clearAll}
            disabled={Boolean(busy) || rows.length === 0}
          >
            {busy === "clear" ? "Deleting…" : "Delete all temporary diagnostics"}
          </button>
        </section>

        <section className="vb-admin-table-card">
          <div className="vb-admin-section-head">
            <div>
              <span>Recent temporary calls</span>
              <h2>VoiceBridge call diagnostics</h2>
            </div>
            <p>Auto-refreshes every 10 seconds</p>
          </div>

          {loading ? (
            <div className="vb-admin-empty">Loading VoiceBridge diagnostics…</div>
          ) : rows.length === 0 ? (
            <div className="vb-admin-empty">
              No temporary call diagnostics are available. Enable capture, then place a test call.
            </div>
          ) : (
            <div className="vb-admin-table-wrap">
              <table className="vb-admin-table">
                <thead>
                  <tr>
                    <th>Captured</th>
                    <th>Language</th>
                    <th>Duration</th>
                    <th>Intent</th>
                    <th>Action</th>
                    <th>Case</th>
                    <th>Expires</th>
                    <th>Transcript</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const detail = revealed[row.id];
                    return (
                      <tr key={row.id}>
                        <td>{formatDateTime(row.createdAt)}</td>
                        <td>{row.languagePair || "—"}</td>
                        <td>{secondsLabel(row.processedAudioDurationSeconds)}</td>
                        <td>{row.intent || "Pending"}</td>
                        <td>{row.executedAction || row.requestedAction || "Pending"}</td>
                        <td>{row.caseId || "—"}</td>
                        <td>{formatDateTime(row.expiresAt)}</td>
                        <td className="vb-admin-transcript-cell">
                          {detail ? (
                            <div className="vb-admin-reveal">
                              <div className="vb-admin-reveal__text">{detail.transcript}</div>
                              <div className="vb-admin-row-actions">
                                <button type="button" className="adminx-btn" onClick={() => hideTranscript(row.id)}>
                                  Hide
                                </button>
                                <button
                                  type="button"
                                  className="adminx-btn adminx-btn--danger"
                                  onClick={() => deleteOne(row.id)}
                                  disabled={busy === `delete:${row.id}`}
                                >
                                  {busy === `delete:${row.id}` ? "Deleting…" : "Delete now"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="vb-admin-row-actions">
                              <button
                                type="button"
                                className="adminx-btn"
                                onClick={() => revealTranscript(row.id)}
                                disabled={busy === `reveal:${row.id}`}
                              >
                                {busy === `reveal:${row.id}` ? "Loading…" : "Reveal transcript"}
                              </button>
                              <button
                                type="button"
                                className="adminx-btn adminx-btn--danger"
                                onClick={() => deleteOne(row.id)}
                                disabled={busy === `delete:${row.id}`}
                              >
                                {busy === `delete:${row.id}` ? "Deleting…" : "Delete"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
