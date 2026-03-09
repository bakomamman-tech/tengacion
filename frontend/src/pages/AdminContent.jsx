import { useCallback, useEffect, useState } from "react";
import AdminShell from "../components/AdminShell";
import { adminListContent } from "../api";

const CATEGORY_OPTIONS = [
  ["all", "All Content"],
  ["music", "Music"],
  ["albums", "Albums"],
  ["books", "Books"],
  ["podcasts", "Podcasts"],
  ["videos", "Videos"],
];

const dateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

export default function AdminContentPage({ user }) {
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState({ items: [], total: 0, limit: 20, page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await adminListContent({ category, page, limit: 20 });
      setPayload(next || { items: [], total: 0, limit: 20, page: 1 });
    } catch (err) {
      setError(err?.message || "Failed to load content");
    } finally {
      setLoading(false);
    }
  }, [category, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminShell
      title="Content"
      subtitle="All creator uploads across music, albums, books, podcasts, and videos."
      user={user}
      actions={<button type="button" className="adminx-btn" onClick={load}>Refresh</button>}
    >
      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-filter-row">
          <select className="adminx-select" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
            {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </section>

      {error ? <div className="adminx-error">{error}</div> : null}
      {loading ? <div className="adminx-loading">Loading content...</div> : null}

      {!loading ? (
        <section className="adminx-table-wrap">
          <table className="adminx-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Title</th>
                <th>Status</th>
                <th>Performance</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(payload.items || []).map((entry) => (
                <tr key={`${entry.type}-${entry.id}`}>
                  <td>{entry.type}</td>
                  <td>{entry.title}</td>
                  <td>{entry.status}</td>
                  <td>{Number(entry.metricValue || 0).toLocaleString()}</td>
                  <td>{dateTime(entry.createdAt)}</td>
                </tr>
              ))}
              {!(payload.items || []).length ? (
                <tr><td colSpan={5} className="adminx-table-empty">No content found.</td></tr>
              ) : null}
            </tbody>
          </table>
          <div className="adminx-row" style={{ padding: 12 }}>
            <span className="adminx-muted">Page {payload.page || page} of {Math.max(1, Math.ceil((payload.total || 0) / (payload.limit || 20)))}</span>
            <div className="adminx-action-row">
              <button type="button" className="adminx-btn" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>Prev</button>
              <button type="button" className="adminx-btn" onClick={() => setPage((prev) => prev + 1)} disabled={page >= Math.max(1, Math.ceil((payload.total || 0) / (payload.limit || 20)))}>Next</button>
            </div>
          </div>
        </section>
      ) : null}
    </AdminShell>
  );
}
