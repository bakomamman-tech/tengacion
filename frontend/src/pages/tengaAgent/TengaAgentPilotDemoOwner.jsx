import { useCallback, useEffect, useState } from "react";
import {
  claimTengaAgentPilotDemo, getTengaAgentPilotAppointments,
  getTengaAgentPilotLeads, getTengaAgentPilotOwnerStatus,
} from "../../services/tengaAgentApi";
import "./tengaagent-pilot-owner.css";

const displayDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en", {
    dateStyle: "medium", timeStyle: "short",
  }).format(date);
};

export default function TengaAgentPilotDemoOwner({ user }) {
  const [status, setStatus] = useState(null);
  const [claimSecret, setClaimSecret] = useState("");
  const [leads, setLeads] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextStatus = await getTengaAgentPilotOwnerStatus();
      setStatus(nextStatus);
      if (nextStatus.claimedByYou) {
        const [leadData, appointmentData] = await Promise.all([
          getTengaAgentPilotLeads(), getTengaAgentPilotAppointments(),
        ]);
        setLeads(Array.isArray(leadData.leads) ? leadData.leads : []);
        setAppointments(Array.isArray(appointmentData.appointments) ? appointmentData.appointments : []);
      } else {
        setLeads([]);
        setAppointments([]);
      }
    } catch (requestError) {
      setError(requestError.message || "Could not load your pilot inbox.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);
  useEffect(() => {
    if (window.location.hash === "#pilot-demo-owner" && status) {
      document.getElementById("pilot-demo-owner")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [status]);

  const claim = async (event) => {
    event.preventDefault();
    if (busy || claimSecret.length < 32) return;
    setBusy(true);
    setError("");
    try {
      await claimTengaAgentPilotDemo(claimSecret);
      setClaimSecret("");
      await load();
    } catch (requestError) {
      setError(requestError.message || "Owner claim failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;
  return (
    <section className="tengaagent-pilot-owner" id="pilot-demo-owner" aria-labelledby="pilot-demo-owner-title">
      <div className="tengaagent-pilot-owner__heading">
        <div>
          <span>PRIVATE PILOT WORKSPACE</span>
          <h2 id="pilot-demo-owner-title">Tengacion demo owner inbox</h2>
          <p>The saved demo enquiries are private. A pilot sign-in alone does not grant access.</p>
        </div>
        {status?.claimedByYou ? (
          <button type="button" onClick={load} disabled={loading || busy}>Refresh records</button>
        ) : null}
      </div>
      {error ? <p className="tengaagent-pilot-owner__error" role="alert">{error}</p> : null}
      {loading ? <p>Loading pilot owner access…</p> : null}
      {!loading && status && !status.claimedByYou ? (
        status.available ? (
          <form className="tengaagent-pilot-owner__claim" onSubmit={claim}>
            <h3>Connect your pilot account to the Tengacion demo</h3>
            <p>Enter the private owner-claim secret configured in your pilot Render environment. This does not create a new business workspace or expose customer records to other accounts.</p>
            {!status.claimConfigured ? (
              <p className="tengaagent-pilot-owner__error">Ask the pilot administrator to set TENGAAGENT_PILOT_OWNER_CLAIM_SECRET to a private random value of at least 32 characters in Render, then refresh this page.</p>
            ) : null}
            <label htmlFor="tengaagent-pilot-claim-secret">Private pilot owner-claim secret</label>
            <input
              id="tengaagent-pilot-claim-secret" type="password" autoComplete="off"
              value={claimSecret} onChange={(event) => setClaimSecret(event.target.value)}
              minLength={32} maxLength={256} required disabled={!status.claimConfigured || busy}
            />
            <button type="submit" disabled={!status.claimConfigured || busy || claimSecret.length < 32}>
              {busy ? "Verifying owner…" : "Unlock demo owner inbox"}
            </button>
          </form>
        ) : <p>This demo already has an owner. Other pilot accounts cannot view its enquiries.</p>
      ) : null}
      {!loading && status?.claimedByYou ? (
        <>
          <div className="tengaagent-pilot-owner__counts">
            <span><strong>{leads.length}</strong> demo leads</span>
            <span><strong>{appointments.length}</strong> appointment requests</span>
          </div>
          <h3>Demo leads</h3>
          {leads.length ? (
            <div className="tengaagent-pilot-owner__list">
              {leads.map((lead) => (
                <article key={lead.id}>
                  <div className="tengaagent-pilot-owner__card-title">
                    <strong>{lead.name || "Unnamed visitor"}</strong>
                    <span>{lead.status}</span>
                  </div>
                  <p>{[lead.email, lead.phone, lead.company].filter(Boolean).join(" · ") || "No contact details"}</p>
                  <p>{lead.projectSummary || "No project summary provided."}</p>
                  <small>Captured: {displayDate(lead.lastCapturedAt || lead.createdAt)} · Consent to contact: {lead.consentToContact ? "Yes" : "No"}</small>
                </article>
              ))}
            </div>
          ) : <p>No demo leads have been captured yet.</p>}
          <h3 id="pilot-demo-appointments">Demo appointment requests</h3>
          {appointments.length ? (
            <div className="tengaagent-pilot-owner__list">
              {appointments.map((appointment) => (
                <article key={appointment.id}>
                  <div className="tengaagent-pilot-owner__card-title">
                    <strong>{appointment.name || "Unnamed visitor"}</strong>
                    <span>{appointment.status}</span>
                  </div>
                  <p>{[appointment.email, appointment.phone, appointment.company].filter(Boolean).join(" · ")}</p>
                  <p>{appointment.purpose || "No meeting purpose provided."}</p>
                  <p>Preferred time: {displayDate(appointment.preferredStartAt)} · {appointment.durationMinutes || 30} minutes · {appointment.timezone || "—"}</p>
                  {appointment.notes ? <p>{appointment.notes}</p> : null}
                  <small>This is a request until the team confirms it.</small>
                </article>
              ))}
            </div>
          ) : <p>No demo appointment requests have been captured yet.</p>}
          <p className="tengaagent-pilot-owner__note">This pilot inbox is read-only. It does not send follow-up messages or confirm meetings.</p>
        </>
      ) : null}
    </section>
  );
}
