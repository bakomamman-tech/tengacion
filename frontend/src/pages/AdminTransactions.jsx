import { useCallback, useEffect, useState } from "react";
import AdminShell from "../components/AdminShell";
import {
  adminGetTransactionDetail,
  adminListTransactions,
  adminReconcileTransaction,
} from "../api";

const dateTime = (value) => {
  if (!value) {return "-";}
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const formatMoney = (amount = 0, currency = "NGN") =>
  `${currency} ${Number(amount || 0).toLocaleString()}`;

const toneLabel = (tone = "") => {
  if (tone === "success") {return "adminx-badge";}
  if (tone === "warn") {return "adminx-badge adminx-badge--warn";}
  if (tone === "danger") {return "adminx-badge adminx-badge--danger";}
  return "adminx-badge";
};

export default function AdminTransactionsPage({ user }) {
  const [status, setStatus] = useState("");
  const [attention, setAttention] = useState("");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState({ transactions: [], total: 0, page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [actionError, setActionError] = useState("");
  const [reconciling, setReconciling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await adminListTransactions({ status, attention, page, limit: 20 });
      setPayload(next || { transactions: [], total: 0, page: 1, limit: 20 });
    } catch (err) {
      setError(err?.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [attention, page, status]);

  const loadDetail = useCallback(async (transactionId) => {
    if (!transactionId) {
      setDetail(null);
      setDetailError("");
      return;
    }

    setDetailLoading(true);
    setDetailError("");
    try {
      const next = await adminGetTransactionDetail(transactionId);
      setDetail(next || null);
    } catch (err) {
      setDetail(null);
      setDetailError(err?.message || "Failed to load transaction detail");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {return;}
    loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  const totalPages = Math.max(1, Math.ceil((payload.total || 0) / (payload.limit || 20)));
  const selectedTransaction = detail?.transaction || null;

  return (
    <AdminShell
      title="Transactions"
      subtitle="Audit payment attempts, webhook outcomes, entitlement grants, and wallet settlement from one operations view."
      user={user}
      actions={<button type="button" className="adminx-btn" onClick={load}>Refresh</button>}
    >
      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-filter-row">
          <select className="adminx-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="abandoned">Abandoned</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          <select className="adminx-select" value={attention} onChange={(e) => { setAttention(e.target.value); setPage(1); }}>
            <option value="">All transactions</option>
            <option value="stuck">Stuck pending only</option>
          </select>
        </div>
      </section>

      {error ? <div className="adminx-error">{error}</div> : null}
      {actionError ? <div className="adminx-error">{actionError}</div> : null}
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
                <th>Ops</th>
                <th>Paid At</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(payload.transactions || []).map((entry) => (
                <tr key={entry._id}>
                  <td>
                    <button
                      type="button"
                      className="adminx-link-btn"
                      onClick={() => {
                        setSelectedId(entry._id);
                        setActionError("");
                      }}
                    >
                      {entry.providerRef}
                    </button>
                  </td>
                  <td>{entry.itemType}</td>
                  <td>{formatMoney(entry.amount, entry.currency)}</td>
                  <td>{entry.status}</td>
                  <td>
                    {entry.stuckPending ? <span className="adminx-badge adminx-badge--warn">Stuck</span> : <span className="adminx-muted">{entry.ageMinutes}m old</span>}
                  </td>
                  <td>{dateTime(entry.paidAt)}</td>
                  <td>{dateTime(entry.createdAt)}</td>
                </tr>
              ))}
              {!(payload.transactions || []).length ? <tr><td colSpan={7} className="adminx-table-empty">No transactions found.</td></tr> : null}
            </tbody>
          </table>
          <div className="adminx-row" style={{ padding: 12 }}>
            <span className="adminx-muted">Page {payload.page || page} of {totalPages}</span>
            <div className="adminx-action-row">
              <button type="button" className="adminx-btn" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>Prev</button>
              <button type="button" className="adminx-btn" onClick={() => setPage((prev) => prev + 1)} disabled={page >= totalPages}>Next</button>
            </div>
          </div>
        </section>
      ) : null}

      {selectedId ? (
        <section className="adminx-panel adminx-panel--span-12">
          <div className="adminx-panel-head">
            <h2 className="adminx-panel-title">Transaction Detail</h2>
            {selectedTransaction?.providerRef ? <span className="adminx-section-meta">{selectedTransaction.providerRef}</span> : null}
          </div>

          {detailError ? <div className="adminx-error">{detailError}</div> : null}
          {detailLoading ? <div className="adminx-loading">Loading transaction detail...</div> : null}

          {!detailLoading && detail ? (
            <div className="adminx-grid" style={{ gap: 16 }}>
              <div className="adminx-mobile-stack">
                <span className="adminx-badge">{selectedTransaction?.status || "unknown"}</span>
                <span className="adminx-badge">{formatMoney(selectedTransaction?.amount, selectedTransaction?.currency)}</span>
                {detail.ops?.stuckPending ? <span className="adminx-badge adminx-badge--warn">Stuck pending</span> : null}
                {detail.ops?.needsEntitlementRepair ? <span className="adminx-badge adminx-badge--warn">Entitlement repair needed</span> : null}
                {detail.ops?.needsWalletRepair ? <span className="adminx-badge adminx-badge--warn">Wallet repair needed</span> : null}
              </div>

              <div className="adminx-row">
                <div>
                  <div className="adminx-muted">Buyer</div>
                  <strong>{detail.buyer?.name || detail.buyer?.username || "Unknown buyer"}</strong>
                  <div className="adminx-muted">{detail.buyer?.email || "-"}</div>
                </div>
                <div>
                  <div className="adminx-muted">Creator</div>
                  <strong>{detail.creator?.displayName || "-"}</strong>
                  <div className="adminx-muted">{selectedTransaction?.itemType || "-"}</div>
                </div>
                <div>
                  <div className="adminx-muted">Last event</div>
                  <strong>{detail.ops?.lastEventType || "No lifecycle event yet"}</strong>
                  <div className="adminx-muted">{dateTime(detail.ops?.lastEventAt)}</div>
                </div>
              </div>

              <div className="adminx-row">
                <span className="adminx-muted">Entitlement present: {detail.ops?.entitlementPresent ? "Yes" : "No"}</span>
                <span className="adminx-muted">Wallet settled: {detail.ops?.walletSettled ? "Yes" : "No"}</span>
                <span className="adminx-muted">Wallet entries: {Number(detail.ops?.walletEntryCount || 0)}</span>
                <span className="adminx-muted">Age: {Number(detail.ops?.ageMinutes || 0)} minutes</span>
              </div>

              <div className="adminx-action-row">
                <button
                  type="button"
                  className="adminx-btn"
                  onClick={async () => {
                    if (!selectedId) {return;}
                    setReconciling(true);
                    setActionError("");
                    try {
                      await adminReconcileTransaction(selectedId, { reason: "admin_transactions_page" });
                      await Promise.all([load(), loadDetail(selectedId)]);
                    } catch (err) {
                      setActionError(err?.message || "Failed to reconcile transaction");
                    } finally {
                      setReconciling(false);
                    }
                  }}
                  disabled={reconciling || !detail.ops?.canReconcile}
                >
                  {reconciling ? "Reconciling..." : "Reconcile now"}
                </button>
                <button type="button" className="adminx-btn" onClick={() => loadDetail(selectedId)} disabled={detailLoading}>
                  Refresh detail
                </button>
              </div>

              <div className="adminx-activity-list">
                {(detail.timeline || []).map((entry) => (
                  <div key={entry.id} className="adminx-activity-item">
                    <div className="adminx-row">
                      <strong>{entry.label}</strong>
                      <span className={toneLabel(entry.tone)}>{entry.kind.replace(/_/g, " ")}</span>
                    </div>
                    <div className="adminx-muted">{dateTime(entry.createdAt)}</div>
                    {entry.metadata?.reason ? <div className="adminx-muted">{entry.metadata.reason}</div> : null}
                    {entry.metadata?.gatewayStatus ? <div className="adminx-muted">Gateway status: {entry.metadata.gatewayStatus}</div> : null}
                    {entry.metadata?.amount ? <div className="adminx-muted">Amount: {formatMoney(entry.metadata.amount, entry.metadata.currency || selectedTransaction?.currency)}</div> : null}
                  </div>
                ))}
                {!(detail.timeline || []).length ? <div className="adminx-empty">No payment lifecycle entries have been recorded for this transaction yet.</div> : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </AdminShell>
  );
}
