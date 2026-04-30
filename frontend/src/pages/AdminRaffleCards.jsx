import { useCallback, useEffect, useMemo, useState } from "react";

import AdminShell from "../components/AdminShell";
import {
  adminGetRaffleCards,
  adminLoadRaffleCards,
} from "../api";

const NETWORK_OPTIONS = [
  { value: "mtn", label: "MTN", hint: "16 or 17 digits" },
  { value: "airtel", label: "Airtel", hint: "16 digits" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "claimed", label: "Claimed" },
  { value: "void", label: "Void" },
];

const number = (value) => Number(value || 0).toLocaleString();

const dateTime = (value) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

export default function AdminRaffleCardsPage({ user }) {
  const [network, setNetwork] = useState("mtn");
  const [pins, setPins] = useState("");
  const [batchLabel, setBatchLabel] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [networkFilter, setNetworkFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [payload, setPayload] = useState({ summary: { byNetwork: {} }, cards: [], total: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await adminGetRaffleCards({
        status: statusFilter,
        network: networkFilter,
        limit: 50,
      });
      setPayload(next || { summary: { byNetwork: {} }, cards: [], total: 0 });
    } catch (err) {
      setError(err?.message || "Failed to load raffle cards");
    } finally {
      setLoading(false);
    }
  }, [networkFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const summary = payload?.summary || {};
    const byNetwork = summary.byNetwork || {};
    return [
      ["MTN Available", number(byNetwork.mtn?.available)],
      ["Airtel Available", number(byNetwork.airtel?.available)],
      ["Claimed PINs", number(summary.claimed)],
      ["Total Loaded", number(summary.total)],
    ];
  }, [payload?.summary]);

  const selectedHint = NETWORK_OPTIONS.find((option) => option.value === network)?.hint || "";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await adminLoadRaffleCards({
        network,
        pins,
        batchLabel,
      });
      setNotice(
        `Loaded ${number(result.createdCount)} ${result.networkLabel} PINs. Duplicates: ${number(result.duplicateCount)}. Invalid: ${number(result.invalidCount)}.`
      );
      setPins("");
      await load();
    } catch (err) {
      const invalid = Array.isArray(err?.payload?.invalidEntries)
        ? err.payload.invalidEntries[0]?.error
        : "";
      setError(invalid || err?.message || "Failed to load raffle cards");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      title="Raffle Cards"
      subtitle="Load and monitor the N100 MTN and Airtel recharge PIN inventory that powers Tengacion Spin & Win."
      user={user}
      actions={<button type="button" className="adminx-btn" onClick={load}>Refresh</button>}
    >
      {error ? <div className="adminx-error">{error}</div> : null}
      {notice ? <div className="adminx-loading">{notice}</div> : null}

      <div className="adminx-stats-grid">
        {stats.map(([label, value]) => (
          <article key={label} className="adminx-stat-card">
            <div className="adminx-kpi-label">{label}</div>
            <div className="adminx-kpi-value">{value}</div>
          </article>
        ))}
      </div>

      <div className="adminx-analytics-grid">
        <section className="adminx-panel adminx-panel--span-5">
          <div className="adminx-panel-head">
            <h2 className="adminx-panel-title">Load N100 PINs</h2>
            <span className="adminx-section-meta">One PIN per line, comma, or space</span>
          </div>

          <form className="adminx-modal__form" onSubmit={handleSubmit}>
            <label className="adminx-modal__field">
              Network
              <select
                className="adminx-select"
                value={network}
                onChange={(event) => setNetwork(event.target.value)}
              >
                {NETWORK_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} N100 - {option.hint}
                  </option>
                ))}
              </select>
            </label>

            <label className="adminx-modal__field">
              Batch label
              <input
                className="adminx-input"
                value={batchLabel}
                onChange={(event) => setBatchLabel(event.target.value)}
                placeholder="April promo batch"
              />
            </label>

            <label className="adminx-modal__field">
              Recharge PINs
              <textarea
                className="adminx-textarea"
                value={pins}
                onChange={(event) => setPins(event.target.value)}
                placeholder={network === "mtn" ? "1234567890123456" : "1234567890123456"}
                rows={10}
              />
            </label>

            <div className="adminx-muted">
              {network.toUpperCase()} accepts {selectedHint}. Only N100 cards are accepted by this loader.
            </div>

            <div className="adminx-action-row">
              <button type="submit" className="adminx-btn adminx-btn--primary" disabled={saving}>
                {saving ? "Loading..." : "Load Cards"}
              </button>
              <button type="button" className="adminx-btn" onClick={() => setPins("")}>
                Clear
              </button>
            </div>
          </form>
        </section>

        <section className="adminx-panel adminx-panel--span-7">
          <div className="adminx-panel-head">
            <h2 className="adminx-panel-title">Inventory</h2>
            <div className="adminx-filter-row">
              <select
                className="adminx-select"
                value={networkFilter}
                onChange={(event) => setNetworkFilter(event.target.value)}
              >
                <option value="">All networks</option>
                {NETWORK_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                className="adminx-select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? <div className="adminx-loading">Loading raffle inventory...</div> : null}
          {!loading ? (
            <div className="adminx-table-wrap adminx-table-wrap--flush">
              <table className="adminx-table">
                <thead>
                  <tr>
                    <th>Network</th>
                    <th>PIN</th>
                    <th>Status</th>
                    <th>Claimed By</th>
                    <th>Loaded</th>
                  </tr>
                </thead>
                <tbody>
                  {(payload.cards || []).map((card) => (
                    <tr key={card._id}>
                      <td>{card.networkLabel}</td>
                      <td>{card.pinMasked}</td>
                      <td><span className="adminx-badge">{card.status}</span></td>
                      <td>{card.claimedBy?.username ? `@${card.claimedBy.username}` : "-"}</td>
                      <td>{dateTime(card.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!(payload.cards || []).length ? (
                <div className="adminx-empty">No raffle cards match this filter.</div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </AdminShell>
  );
}
