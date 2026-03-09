import { useCallback, useEffect, useState } from "react";
import AdminShell from "../components/AdminShell";
import { adminListTransactions } from "../api";

const dateTime = (value) => {
  if (!value) {return "-";}
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

export default function AdminTransactionsPage({ user }) {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState({ transactions: [], total: 0, page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await adminListTransactions({ status, page, limit: 20 });
      setPayload(next || { transactions: [], total: 0, page: 1, limit: 20 });
    } catch (err) {
      setError(err?.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminShell
      title="Transactions"
      subtitle="Platform purchase flow visibility across successful, pending, failed, and refunded payments."
      user={user}
      actions={<button type="button" className="adminx-btn" onClick={load}>Refresh</button>}
    >
      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-filter-row">
          <select className="adminx-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </section>

      {error ? <div className="adminx-error">{error}</div> : null}
      {loading ? <div className="adminx-loading">Loading transactions...</div> : null}

      {!loading ? (
        <section className="adminx-table-wrap">
          <table className="adminx-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Item</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Provider</th>
                <th>Paid At</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(payload.transactions || []).map((entry) => (
                <tr key={entry._id}>
                  <td>{entry.providerRef}</td>
                  <td>{entry.itemType}</td>
                  <td>{entry.currency} {Number(entry.amount || 0).toLocaleString()}</td>
                  <td>{entry.status}</td>
                  <td>{entry.provider}</td>
                  <td>{dateTime(entry.paidAt)}</td>
                  <td>{dateTime(entry.createdAt)}</td>
                </tr>
              ))}
              {!(payload.transactions || []).length ? <tr><td colSpan={7} className="adminx-table-empty">No transactions found.</td></tr> : null}
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
