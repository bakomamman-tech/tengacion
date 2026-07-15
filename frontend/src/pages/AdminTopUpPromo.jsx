import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import AdminShell from "../components/AdminShell";
import { adminGetTopUpPromoPlays } from "../api";
import "./admin-top-up-promo.css";

const OUTCOME_FILTERS = [
  { value: "", label: "All discoveries" },
  { value: "win", label: "Winners" },
  { value: "water", label: "Water chests" },
];

const number = (value) => Number(value || 0).toLocaleString();
const naira = (value) => `₦${Number(value || 0).toLocaleString("en-NG")}`;
const dateTime = (value) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

export default function AdminTopUpPromoPage({ user }) {
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState({
    campaign: {},
    summary: {},
    plays: [],
    pagination: {},
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await adminGetTopUpPromoPlays({ outcome, limit: 250 });
      setPayload(next || { campaign: {}, summary: {}, plays: [], pagination: {} });
    } catch (err) {
      setError(err?.message || "Failed to load promo discoveries");
    } finally {
      setLoading(false);
    }
  }, [outcome]);

  useEffect(() => {
    void load();
  }, [load]);

  const campaign = payload.campaign || {};
  const summary = payload.summary || {};
  const stats = [
    ["All Discoveries", number(summary.totalDiscoveries)],
    ["Winners", number(summary.winners)],
    ["Water Chests", number(summary.waterDiscoveries)],
    ["Prize Liability", naira(summary.prizeLiability)],
  ];

  return (
    <AdminShell
      title="Top-Up Bank Account Promo"
      subtitle="Secure winner and participant records for the application-wide discovery campaign."
      user={user}
      actions={(
        <>
          <button type="button" className="adminx-btn adminx-btn--primary" onClick={() => navigate("/admin/top-up-bank-account-promo/preview")}>Preview UI/UX</button>
          <button type="button" className="adminx-btn" onClick={load}>Refresh</button>
        </>
      )}
    >
      <section className="adminx-panel adminx-panel--span-12 admin-topup-hero">
        <img
          src={campaign.artworkUrl || "/assets/promos/top-up-bank-account-promo.png"}
          alt="Tengacion Find the Passcode and Top Up Your Bank Account Promo flyer"
        />
        <div className="admin-topup-hero__copy">
          <span className="admin-topup-eyebrow">Live application discovery game</span>
          <h2>{campaign.title || "Top-Up Bank Account Promo"}</h2>
          <p>
            Fifteen stars distributed across permitted Tengacion pages open server-controlled chests. Two chest positions contain gold,
            confetti, a unique passcode, and a {naira(campaign.prizeAmount || 5000)} declaration;
            thirteen contain animated water. Each account can record one discovery.
          </p>
          <div className="admin-topup-rules">
            <span>{number(campaign.totalChests || 15)} chests</span>
            <span>{number(campaign.prizeChests || 2)} winning positions</span>
            <span>Customer Care: {campaign.customerCarePhone || "08164649980"}</span>
          </div>
          <small>
            Promo stars may sit near navbar controls and sidebars. They do not appear in the full-registration
            Creator workspace, Marketplace, public authentication pages, or Admin pages/accounts.
          </small>
        </div>
      </section>

      {error ? <div className="adminx-error">{error}</div> : null}

      <div className="adminx-stats-grid">
        {stats.map(([label, value]) => (
          <article key={label} className="adminx-stat-card">
            <div className="adminx-kpi-label">{label}</div>
            <div className="adminx-kpi-value">{value}</div>
          </article>
        ))}
      </div>

      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-panel-head admin-topup-table-head">
          <div>
            <h2 className="adminx-panel-title">Discovery records</h2>
            <span className="adminx-section-meta">Names, phone numbers, email addresses, passcodes, and discovery times</span>
          </div>
          <div className="adminx-filter-row">
            {OUTCOME_FILTERS.map((filter) => (
              <button
                key={filter.value || "all"}
                type="button"
                className={`adminx-tab ${outcome === filter.value ? "is-active" : ""}`}
                onClick={() => setOutcome(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? <div className="adminx-loading">Loading promo discoveries…</div> : null}
        {!loading ? (
          <div className="adminx-table-wrap adminx-table-wrap--flush admin-topup-table-wrap">
            <table className="adminx-table admin-topup-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Phone & email</th>
                  <th>Outcome</th>
                  <th>Chest</th>
                  <th>Passcode</th>
                  <th>Prize</th>
                  <th>Discovered</th>
                </tr>
              </thead>
              <tbody>
                {(payload.plays || []).map((play) => (
                  <tr key={play.id}>
                    <td>
                      <strong>{play.name || "-"}</strong>
                      <small>@{play.username || "-"}</small>
                    </td>
                    <td>
                      {play.phone ? <a href={`tel:${play.phone}`}>{play.phone}</a> : <span>-</span>}
                      {play.email ? <a href={`mailto:${play.email}`}>{play.email}</a> : null}
                    </td>
                    <td>
                      <span className={`adminx-badge ${play.won ? "adminx-badge--good" : ""}`}>
                        {play.won ? "Winner" : "Water"}
                      </span>
                    </td>
                    <td>#{play.chestNumber}</td>
                    <td><code>{play.passcode || "—"}</code></td>
                    <td>{play.won ? naira(play.prizeAmount) : "—"}</td>
                    <td>{dateTime(play.discoveredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!(payload.plays || []).length ? (
              <div className="adminx-empty">No promo discoveries match this filter yet.</div>
            ) : null}
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
