import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getTengaHarvestAdminOverview,
  updateTengaHarvestBookingStatus,
  updateTengaHarvestParticipantStatus,
  updateTengaHarvestServiceStatus,
} from "./tengaHarvestApi";
import "./tengaharvest.css";

const StatusSelect = ({ value, options, onChange }) => (
  <select value={value} onChange={(event) => onChange(event.target.value)}>
    {options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
  </select>
);

export default function TengaHarvestAdminPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await getTengaHarvestAdminOverview());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mutate = async (key, action) => {
    setSaving(key);
    setError("");
    try {
      await action();
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving("");
    }
  };

  if (loading) {
    return <div className="th-page"><div className="th-admin-shell"><p>Loading TengaHarvest pilot operations…</p></div></div>;
  }

  const summary = data?.summary || {};
  return (
    <div className="th-page">
      <header className="th-nav">
        <Link className="th-brand" to="/tengaharvest"><span>TH</span><div><strong>TengaHarvest</strong><small>Pilot operations</small></div></Link>
        <Link className="th-btn th-btn-small" to="/tengaharvest">Public marketplace</Link>
      </header>
      <main className="th-admin-shell">
        <div className="th-section-heading"><span>Admin operations</span><h1>Kaduna pilot control centre</h1><p>Verify providers, activate infrastructure, confirm service delivery and keep grant evidence tied to real records.</p></div>
        {error ? <div className="th-alert">{error}</div> : null}
        <section className="th-admin-metrics">
          {[[summary.farmers,"Farmers"],[summary.providers,"Providers"],[summary.pendingServices,"Pending services"],[summary.activeServices,"Active services"],[summary.requestedBookings,"Booking requests"],[summary.completedBookings,"Completed"]].map(([value,label]) => <article key={label}><strong>{value || 0}</strong><span>{label}</span></article>)}
        </section>

        <section className="th-admin-section">
          <h2>Infrastructure verification</h2>
          <div className="th-admin-list">
            {(data?.services || []).map((service) => (
              <article key={service._id}>
                <div><strong>{service.title}</strong><span>{service.providerName} · {[service.community, service.lga, service.state].filter(Boolean).join(", ")}</span><small>{service.participant?.phone || "Provider phone unavailable"}</small></div>
                <StatusSelect value={service.status} options={["pending_review","active","paused","retired"]} onChange={(status) => mutate(`service-${service._id}`, () => updateTengaHarvestServiceStatus(service._id, { status, verificationNote: status === "active" ? "Activated through TengaHarvest pilot admin review." : "Updated through pilot operations." }))} />
                {saving === `service-${service._id}` ? <em>Saving…</em> : null}
              </article>
            ))}
            {!data?.services?.length ? <div className="th-empty">No provider services submitted yet.</div> : null}
          </div>
        </section>

        <section className="th-admin-section">
          <h2>Farmer and provider pipeline</h2>
          <div className="th-admin-list">
            {(data?.participants || []).map((participant) => (
              <article key={participant._id}>
                <div><strong>{participant.fullName}</strong><span>{participant.role} · {[participant.community, participant.lga, participant.state].filter(Boolean).join(", ")}</span><small>{participant.phone}{participant.organizationName ? ` · ${participant.organizationName}` : ""}</small></div>
                <StatusSelect value={participant.status} options={["pilot_lead","contacted","verified","active","paused"]} onChange={(status) => mutate(`participant-${participant._id}`, () => updateTengaHarvestParticipantStatus(participant._id, status))} />
                {saving === `participant-${participant._id}` ? <em>Saving…</em> : null}
              </article>
            ))}
          </div>
        </section>

        <section className="th-admin-section">
          <h2>Booking operations</h2>
          <div className="th-admin-list">
            {(data?.bookings || []).map((booking) => (
              <article key={booking._id}>
                <div><strong>{booking.reference}</strong><span>{booking.service?.title || "Service"} · {booking.customerName}</span><small>{booking.phone} · {booking.units} units · {new Date(booking.startDate).toLocaleDateString()}</small></div>
                <StatusSelect value={booking.status} options={["requested","confirmed","completed","cancelled"]} onChange={(status) => mutate(`booking-${booking._id}`, () => updateTengaHarvestBookingStatus(booking._id, { status, operationsNote: status === "completed" ? "Service delivery marked completed through TengaHarvest operations." : "Booking status updated through pilot operations." }))} />
                {saving === `booking-${booking._id}` ? <em>Saving…</em> : null}
              </article>
            ))}
            {!data?.bookings?.length ? <div className="th-empty">No booking requests yet.</div> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
