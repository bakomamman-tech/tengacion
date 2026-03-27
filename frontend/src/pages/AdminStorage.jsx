import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "../components/AdminShell";
import {
  fetchStorageOverview,
  previewStorageCleanup,
  runStorageCleanup,
} from "../services/adminStorageService";

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatBytes = (value) => {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

export default function AdminStoragePage({ user }) {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({ actions: [], collections: [], totals: {} });
  const [selectedActions, setSelectedActions] = useState([]);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchStorageOverview();
      setOverview(payload || { actions: [], collections: [], totals: {} });
      setSelectedActions((current) => {
        if (current.length > 0) {
          return current;
        }
        return (payload?.actions || [])
          .filter((action) => action.key !== "demoData")
          .map((action) => action.key);
      });
    } catch (err) {
      setError(err?.message || "Failed to load storage overview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const actionMap = useMemo(
    () => new Map((overview.actions || []).map((entry) => [entry.key, entry])),
    [overview.actions]
  );

  const selectedActionDetails = useMemo(
    () => selectedActions.map((key) => actionMap.get(key)).filter(Boolean),
    [actionMap, selectedActions]
  );

  const toggleAction = (key) => {
    setPreview(null);
    setStatus("");
    setSelectedActions((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]
    );
  };

  const handlePreview = async () => {
    setBusy(true);
    setError("");
    setStatus("Loading preview...");
    try {
      const payload = await previewStorageCleanup(selectedActions);
      setPreview(payload);
      setStatus("Preview ready.");
    } catch (err) {
      setError(err?.message || "Failed to preview cleanup");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  const handleRun = async () => {
    if (!selectedActions.length) {
      setError("Select at least one cleanup action first.");
      return;
    }
    if (!window.confirm("Run the selected storage cleanup actions now? This will permanently delete the chosen records.")) {
      return;
    }

    setBusy(true);
    setError("");
    setStatus("Running cleanup...");
    try {
      const payload = await runStorageCleanup(selectedActions);
      setPreview(payload);
      setStatus("Cleanup completed successfully.");
      await load();
    } catch (err) {
      setError(err?.message || "Failed to run cleanup");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  const collections = overview.collections || [];
  const totals = overview.totals || {};

  return (
    <AdminShell
      title="Storage Cleanup"
      subtitle="Inspect collection bloat, preview cleanup counts, and run safe retention jobs."
      user={user}
      actions={
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="adminx-btn" onClick={load} disabled={busy}>
            Refresh Overview
          </button>
          <button type="button" className="adminx-btn" onClick={handlePreview} disabled={busy}>
            Preview Cleanup
          </button>
          <button type="button" className="adminx-btn adminx-btn--danger" onClick={handleRun} disabled={busy}>
            Run Cleanup
          </button>
        </div>
      }
    >
      {error ? <div className="adminx-error">{error}</div> : null}
      {status ? <div className="adminx-muted" style={{ marginBottom: 16 }}>{status}</div> : null}
      {loading ? <div className="adminx-loading">Loading storage overview...</div> : null}

      {!loading ? (
        <>
          <div className="adminx-stats-grid">
            <article className="adminx-stat-card">
              <div className="adminx-kpi-label">Collections</div>
              <div className="adminx-kpi-value">{formatNumber(totals.collections)}</div>
            </article>
            <article className="adminx-stat-card">
              <div className="adminx-kpi-label">Documents</div>
              <div className="adminx-kpi-value">{formatNumber(totals.estimatedDocuments)}</div>
            </article>
            <article className="adminx-stat-card">
              <div className="adminx-kpi-label">Storage Size</div>
              <div className="adminx-kpi-value">{formatBytes(totals.storageSizeBytes)}</div>
            </article>
            <article className="adminx-stat-card">
              <div className="adminx-kpi-label">Index Size</div>
              <div className="adminx-kpi-value">{formatBytes(totals.totalIndexSizeBytes)}</div>
            </article>
          </div>

          <div className="adminx-analytics-grid">
            <section className="adminx-panel adminx-panel--span-6">
              <div className="adminx-panel-head">
                <h2 className="adminx-panel-title">Cleanup Actions</h2>
                <span className="adminx-section-meta">Choose exactly what we should preview or delete</span>
              </div>
              <div className="adminx-leaderboard">
                {overview.actions.map((action) => (
                  <label key={action.key} className="adminx-leaderboard-item" style={{ cursor: "pointer" }}>
                    <div className="adminx-row" style={{ alignItems: "center", gap: 12 }}>
                      <input
                        type="checkbox"
                        checked={selectedActions.includes(action.key)}
                        onChange={() => toggleAction(action.key)}
                      />
                      <div>
                        <strong>{action.label}</strong>
                        <div className="adminx-muted">{action.description}</div>
                      </div>
                    </div>
                    {action.dangerous ? (
                      <div className="adminx-badge" style={{ alignSelf: "flex-start" }}>Destructive</div>
                    ) : null}
                  </label>
                ))}
              </div>
            </section>

            <section className="adminx-panel adminx-panel--span-6">
              <div className="adminx-panel-head">
                <h2 className="adminx-panel-title">Selected Actions</h2>
                <span className="adminx-section-meta">Preview counts before execution</span>
              </div>
              <div className="adminx-leaderboard">
                {selectedActionDetails.length ? (
                  selectedActionDetails.map((action) => (
                    <article key={action.key} className="adminx-leaderboard-item">
                      <div className="adminx-row">
                        <strong>{action.label}</strong>
                        <span>{action.dangerous ? "Will delete data" : "Preview only"}</span>
                      </div>
                      <div className="adminx-muted">{action.description}</div>
                    </article>
                  ))
                ) : (
                  <div className="adminx-empty">Pick one or more cleanup actions to preview.</div>
                )}
              </div>
            </section>
          </div>

          <section className="adminx-panel" style={{ marginTop: 20 }}>
            <div className="adminx-panel-head">
              <h2 className="adminx-panel-title">Collection Health</h2>
              <span className="adminx-section-meta">Estimated document size, indexes, and likely waste fields</span>
            </div>
            <div className="adminx-table-wrap">
              <table className="adminx-table">
                <thead>
                  <tr>
                    <th>Collection</th>
                    <th>Documents</th>
                    <th>Avg Doc Size</th>
                    <th>Indexes</th>
                    <th>Storage</th>
                    <th>Likely Waste Fields</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.length ? (
                    collections.map((row) => (
                      <tr key={row.collectionName}>
                        <td>
                          <strong>{row.collectionName}</strong>
                          {row.modelName ? <div className="adminx-muted">{row.modelName}</div> : null}
                        </td>
                        <td>{formatNumber(row.estimatedDocumentCount)}</td>
                        <td>{formatBytes(row.averageDocumentSizeBytes)}</td>
                        <td>{formatNumber(row.indexCount)}</td>
                        <td>{formatBytes(row.storageSizeBytes)}</td>
                        <td>{(row.likelyWasteFields || []).join(", ") || "None detected"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="adminx-table-empty">No collections found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="adminx-panel" style={{ marginTop: 20 }}>
            <div className="adminx-panel-head">
              <h2 className="adminx-panel-title">Preview Results</h2>
              <span className="adminx-section-meta">Matches and deletes from the most recent preview or run</span>
            </div>
            {preview ? (
              <div className="adminx-table-wrap">
                <table className="adminx-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Matched</th>
                      <th>Deleted</th>
                      <th>Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.results || []).map((row) => (
                      <tr key={row.action}>
                        <td>{actionMap.get(row.action)?.label || row.action}</td>
                        <td>{formatNumber(row.matchedCount)}</td>
                        <td>{formatNumber(row.deletedCount)}</td>
                        <td>{formatNumber(row.modifiedCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="adminx-empty">Run a preview to see the exact cleanup counts before deleting anything.</div>
            )}
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
