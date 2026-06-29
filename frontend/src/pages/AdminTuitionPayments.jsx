import { useCallback, useEffect, useState } from "react";

import AdminShell from "../components/AdminShell";
import { adminListTuitionPayments } from "../api";

const formatMoney = (amount = 0, currency = "NGN") =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));

const formatDate = (value) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const statusClass = (status = "") => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid") {
    return "adminx-badge";
  }
  if (normalized === "failed") {
    return "adminx-badge adminx-badge--danger";
  }
  return "adminx-badge adminx-badge--warn";
};

const initialPayload = {
  payments: [],
  pagination: { page: 1, limit: 20, total: 0, pages: 1 },
  summary: { totalRecords: 0, paidRecords: 0, pendingRecords: 0, paidAmount: 0, currency: "NGN" },
  classes: [],
};

export default function AdminTuitionPaymentsPage({ user }) {
  const [payload, setPayload] = useState(initialPayload);
  const [status, setStatus] = useState("");
  const [childClass, setChildClass] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminListTuitionPayments({
        page,
        limit: 20,
        status,
        childClass,
        search,
        schoolSlug: "kurahtechandartsacademy",
      });
      setPayload(result || initialPayload);
      setSelected((current) => {
        if (!current) {
          return null;
        }
        return result?.payments?.find((entry) => entry._id === current._id) || current;
      });
    } catch (err) {
      setError(err?.message || "Failed to load online tuition payments.");
    } finally {
      setLoading(false);
    }
  }, [childClass, page, search, status]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = payload.summary || initialPayload.summary;
  const pagination = payload.pagination || initialPayload.pagination;

  return (
    <AdminShell
      title="Online Tuition Payments"
      subtitle="Parent and learner payment records captured from the academy's Paystack checkout."
      user={user}
      actions={<button type="button" className="adminx-btn" onClick={load}>Refresh</button>}
    >
      <section className="adminx-stats-grid">
        <article className="adminx-stat-card">
          <div className="adminx-kpi-label">All records</div>
          <div className="adminx-kpi-value">{Number(summary.totalRecords || 0).toLocaleString()}</div>
        </article>
        <article className="adminx-stat-card">
          <div className="adminx-kpi-label">Paid</div>
          <div className="adminx-kpi-value">{Number(summary.paidRecords || 0).toLocaleString()}</div>
        </article>
        <article className="adminx-stat-card">
          <div className="adminx-kpi-label">Pending attention</div>
          <div className="adminx-kpi-value">{Number(summary.pendingRecords || 0).toLocaleString()}</div>
        </article>
        <article className="adminx-stat-card">
          <div className="adminx-kpi-label">Verified paid total</div>
          <div className="adminx-kpi-value">{formatMoney(summary.paidAmount, summary.currency)}</div>
        </article>
      </section>

      <section className="adminx-panel adminx-panel--span-12">
        <form
          className="adminx-filter-row"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
        >
          <input
            className="adminx-input"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Parent, child, email, phone, reference"
            aria-label="Search tuition payments"
          />
          <select className="adminx-select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="initiated">Initiated</option>
            <option value="abandoned">Abandoned</option>
            <option value="failed">Failed</option>
          </select>
          <select className="adminx-select" value={childClass} onChange={(event) => { setChildClass(event.target.value); setPage(1); }}>
            <option value="">All classes</option>
            {(payload.classes || []).map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
          <button type="submit" className="adminx-btn adminx-btn--primary">Search</button>
          {(search || status || childClass) ? (
            <button
              type="button"
              className="adminx-btn"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setStatus("");
                setChildClass("");
                setPage(1);
              }}
            >
              Clear filters
            </button>
          ) : null}
        </form>
      </section>

      {error ? <div className="adminx-error">{error}</div> : null}
      {loading ? <div className="adminx-loading">Loading tuition payment records...</div> : null}

      {!loading ? (
        <section className="adminx-table-wrap">
          <table className="adminx-table">
            <thead>
              <tr>
                <th>Parent</th>
                <th>Child / Class</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Bank</th>
                <th>Paystack reference</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(payload.payments || []).map((entry) => (
                <tr key={entry._id}>
                  <td>
                    <button type="button" className="adminx-link-btn" onClick={() => setSelected(entry)}>{entry.parentName}</button>
                    <div className="adminx-muted">{entry.phoneNumber}</div>
                  </td>
                  <td><strong>{entry.childName}</strong><div className="adminx-muted">{entry.childClass}</div></td>
                  <td>{formatMoney(entry.amount, entry.currency)}</td>
                  <td><span className={statusClass(entry.status)}>{entry.status}</span></td>
                  <td>{entry.bankName}</td>
                  <td><code>{entry.reference}</code></td>
                  <td>{formatDate(entry.createdAt)}</td>
                </tr>
              ))}
              {!(payload.payments || []).length ? (
                <tr><td colSpan={7} className="adminx-table-empty">No online tuition payment records found.</td></tr>
              ) : null}
            </tbody>
          </table>
          <div className="adminx-row" style={{ padding: 12 }}>
            <span className="adminx-muted">Page {pagination.page || page} of {pagination.pages || 1}</span>
            <div className="adminx-action-row">
              <button type="button" className="adminx-btn" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>Previous</button>
              <button type="button" className="adminx-btn" onClick={() => setPage((value) => value + 1)} disabled={page >= (pagination.pages || 1)}>Next</button>
            </div>
          </div>
        </section>
      ) : null}

      {selected ? (
        <section className="adminx-panel adminx-panel--span-12">
          <div className="adminx-panel-head">
            <h2 className="adminx-panel-title">Payment Record</h2>
            <button type="button" className="adminx-btn" onClick={() => setSelected(null)}>Close</button>
          </div>
          <div className="adminx-tuition-detail-grid">
            <div><span>Parent/guardian</span><strong>{selected.parentName}</strong></div>
            <div><span>Child</span><strong>{selected.childName}</strong></div>
            <div><span>Class</span><strong>{selected.childClass}</strong></div>
            <div><span>Amount</span><strong>{formatMoney(selected.amount, selected.currency)}</strong></div>
            <div><span>Status</span><strong>{selected.status}</strong></div>
            <div><span>Bank supplied</span><strong>{selected.bankName}</strong></div>
            <div><span>Paystack bank</span><strong>{selected.verifiedBankName || "Not reported yet"}</strong></div>
            <div><span>Payment channel</span><strong>{selected.paymentChannel || "Not reported yet"}</strong></div>
            <div><span>Email</span><strong>{selected.email}</strong></div>
            <div><span>Phone</span><strong>{selected.phoneNumber}</strong></div>
            <div className="adminx-tuition-detail-grid__wide"><span>Home address</span><strong>{selected.homeAddress}</strong></div>
            <div className="adminx-tuition-detail-grid__wide"><span>Paystack reference</span><code>{selected.reference}</code></div>
            <div><span>Paid at</span><strong>{formatDate(selected.paidAt)}</strong></div>
            <div><span>Last verified</span><strong>{formatDate(selected.lastVerifiedAt)}</strong></div>
            {selected.failureReason ? (
              <div className="adminx-tuition-detail-grid__wide"><span>Failure reason</span><strong>{selected.failureReason}</strong></div>
            ) : null}
          </div>
        </section>
      ) : null}
    </AdminShell>
  );
}
