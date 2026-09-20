import { useCallback, useEffect, useState } from "react";
import {
  claimTengaAgentPilotDemo, getTengaAgentPilotAppointments,
  getTengaAgentPilotLeads, getTengaAgentPilotOwnerStatus,
  updateTengaAgentPilotLeadStatus, updateTengaAgentPilotAppointment,
  getTengaAgentPilotConversation, sendTengaAgentPilotHumanReply,
} from "../../services/tengaAgentApi";
import "./tengaagent-pilot-owner.css";

const displayDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en", {
    dateStyle: "medium", timeStyle: "short",
  }).format(date);
};


const LEAD_STATUSES = ["new", "qualified", "contacted", "won", "lost"];
const deviceTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos";
const localValue = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

function PilotConversation({ conversationId, onClose }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    try {
      const result = await getTengaAgentPilotConversation(conversationId);
      setMessages(result.messages || []);
    } catch (e) { setError(e.message || "Could not load this conversation."); }
  }, [conversationId]);
  useEffect(() => { refresh(); }, [refresh]);
  const send = async (event) => {
    event.preventDefault();
    if (busy || !draft.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await sendTengaAgentPilotHumanReply(conversationId, draft.trim());
      setDraft("");
      setNotice(response.notice || "Reply saved to this visitor's web chat.");
      await refresh();
    } catch (e) { setError(e.message || "Could not send this reply."); }
    finally { setBusy(false); }
  };
  return (
    <div className="tengaagent-pilot-owner__conversation">
      <div className="tengaagent-pilot-owner__card-title">
        <h4>Conversation and human reply</h4>
        <button type="button" onClick={onClose}>Close</button>
      </div>
      <p>Replies appear only in this visitor's demo web-chat session. This does not send email, SMS, or WhatsApp. The visitor must return with the same browser session to read them.</p>
      <div className="tengaagent-pilot-owner__thread" aria-live="polite">
        {messages.map((entry) => (
          <p key={entry.id}><strong>{entry.sender === "human" ? "Tengacion representative" : entry.sender}:</strong> {entry.content}</p>
        ))}
      </div>
      <form onSubmit={send} className="tengaagent-pilot-owner__claim">
        <label htmlFor="tengaagent-pilot-human-reply">Reply to this visitor</label>
        <textarea id="tengaagent-pilot-human-reply" rows={3} maxLength={2000} required
          value={draft} onChange={(event) => setDraft(event.target.value)} disabled={busy}
          placeholder="Write a message for this visitor's web chat…" />
        <button type="submit" disabled={busy || !draft.trim()}>{busy ? "Sending…" : "Send in web chat"}</button>
      </form>
      {error ? <p role="alert" className="tengaagent-pilot-owner__error">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
    </div>
  );
}

function PilotLeadCard({ lead, onMutate }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showConversation, setShowConversation] = useState(false);
  const update = async (value) => {
    setBusy(true); setError("");
    try { await updateTengaAgentPilotLeadStatus(lead.id, value); await onMutate(); }
    catch (e) { setError(e.message || "Could not update lead."); }
    finally { setBusy(false); }
  };
  return (
    <article>
      <div className="tengaagent-pilot-owner__card-title">
        <strong>{lead.name || "Unnamed visitor"}</strong><span>{lead.status}</span>
      </div>
      <p>{[lead.email, lead.phone, lead.company].filter(Boolean).join(" · ") || "No contact details"}</p>
      <p>{lead.projectSummary || "No project summary provided."}</p>
      <small>Captured: {displayDate(lead.lastCapturedAt || lead.createdAt)} · Consent to contact: {lead.consentToContact ? "Yes" : "No"}</small>
      <div className="tengaagent-pilot-owner__actions tengaagent-pilot-owner__lead-actions">
        <label>Lead status <select aria-label={"Status for " + (lead.name || "lead")}
          disabled={busy} value={lead.status} onChange={(event) => update(event.target.value)}>
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
          ))}
        </select></label>
        {lead.conversationId && lead.consentToContact ? (
          <button type="button" onClick={() => setShowConversation((value) => !value)}>
            {showConversation ? "Hide conversation" : "Reply in web chat"}
          </button>
        ) : null}
      </div>
      {error ? <p role="alert" className="tengaagent-pilot-owner__error">{error}</p> : null}
      {showConversation ? <PilotConversation conversationId={lead.conversationId}
        onClose={() => setShowConversation(false)} /> : null}
    </article>
  );
}

function PilotAppointmentCard({ appointment, onMutate }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [newTime, setNewTime] = useState(localValue(appointment.preferredStartAt));
  const [duration, setDuration] = useState(Number(appointment.durationMinutes || 30));
  const [showConversation, setShowConversation] = useState(false);
  const requested = appointment.status === "requested";
  const active = requested || appointment.status === "confirmed";
  const future = new Date(appointment.preferredStartAt).getTime() > Date.now() + 5 * 60 * 1000;
  const update = async (data) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await updateTengaAgentPilotAppointment(appointment.id, data);
      setRescheduling(false);
      setNotice(data.action === "confirm" ? "Meeting confirmed in TengaAgent." :
        data.action === "cancel" ? "Meeting cancelled." : "Preferred meeting time updated.");
      await onMutate();
    } catch (e) { setError(e.message || "Could not update appointment."); }
    finally { setBusy(false); }
  };
  const confirm = () => {
    if (window.confirm("Confirm this meeting time? Check that the team can attend before proceeding.")) {
      update({ action: "confirm" });
    }
  };
  const cancel = () => {
    if (window.confirm("Cancel this appointment request?")) update({ action: "cancel" });
  };
  const reschedule = (event) => {
    event.preventDefault();
    if (!newTime || Number.isNaN(new Date(newTime).getTime())) {
      setError("Choose a valid future time."); return;
    }
    update({ action: "reschedule", preferredStartAt: new Date(newTime).toISOString(),
      timezone: deviceTimezone(), durationMinutes: Number(duration) });
  };
  return (
    <article>
      <div className="tengaagent-pilot-owner__card-title">
        <strong>{appointment.name || "Unnamed visitor"}</strong><span>{appointment.status}</span>
      </div>
      <p>{[appointment.email, appointment.phone, appointment.company].filter(Boolean).join(" · ")}</p>
      <p>{appointment.purpose || "No meeting purpose provided."}</p>
      <p>Preferred time: {displayDate(appointment.preferredStartAt)} · {appointment.durationMinutes || 30} minutes · {appointment.timezone || "—"}</p>
      {appointment.notes ? <p>{appointment.notes}</p> : null}
      <small>{appointment.status === "confirmed" ? "Confirmed in the appointment system." :
        appointment.status === "requested" ? "Pending owner approval." : "Status: " + appointment.status}</small>
      <div className="tengaagent-pilot-owner__actions">
        {requested && future ? <button type="button" disabled={busy} onClick={confirm}>Confirm meeting</button> : null}
        {requested && !future ? <p>Requested time has passed; reschedule to a future time before confirming.</p> : null}
        {active ? <button type="button" disabled={busy} onClick={() => setRescheduling((value) => !value)}>Reschedule</button> : null}
        {active ? <button type="button" disabled={busy} onClick={cancel}>Cancel request</button> : null}
        {appointment.conversationId && appointment.consentToContact ? (
          <button type="button" onClick={() => setShowConversation((value) => !value)}>
            {showConversation ? "Hide conversation" : "Reply in web chat"}
          </button>
        ) : null}
      </div>
      {rescheduling ? (
        <form className="tengaagent-pilot-owner__reschedule" onSubmit={reschedule}>
          <label>New time (your device timezone: {deviceTimezone()})
            <input type="datetime-local" required value={newTime}
              onChange={(event) => setNewTime(event.target.value)} disabled={busy} />
          </label>
          <label>Duration in minutes
            <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} disabled={busy}>
              {[15, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy}>Save new time</button>
        </form>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert" className="tengaagent-pilot-owner__error">{error}</p> : null}
      {showConversation ? <PilotConversation conversationId={appointment.conversationId}
        onClose={() => setShowConversation(false)} /> : null}
    </article>
  );
}

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
                <PilotLeadCard key={lead.id} lead={lead} onMutate={load} />
              ))}
            </div>
          ) : <p>No demo leads have been captured yet.</p>}
          <h3 id="pilot-demo-appointments">Demo appointment requests</h3>
          {appointments.length ? (
            <div className="tengaagent-pilot-owner__list">
              {appointments.map((appointment) => (
                <PilotAppointmentCard key={appointment.id} appointment={appointment} onMutate={load} />
              ))}
            </div>
          ) : <p>No demo appointment requests have been captured yet.</p>}
          <p className="tengaagent-pilot-owner__note">Owner actions are available only to the claimed pilot owner. Human replies appear in the visitor’s existing web chat; email, SMS and WhatsApp follow-up are not part of this pilot workflow. Appointment notification emails require separately configured email delivery.</p>
        </>
      ) : null}
    </section>
  );
}
