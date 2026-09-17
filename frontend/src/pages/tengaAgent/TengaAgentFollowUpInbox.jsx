import { useCallback, useEffect, useState } from "react";

import {
  completeTengaAgentOwnerFollowUp,
  getTengaAgentOwnerFollowUpActivity,
  getTengaAgentOwnerFollowUps,
  logTengaAgentOwnerFollowUpContact,
  rescheduleTengaAgentOwnerFollowUp,
  sendTengaAgentOwnerFollowUpEmail,
} from "../../services/tengaAgentFollowUpApi";
import "./tengaagent-follow-up.css";

const FILTERS = ["all", "overdue", "upcoming"];
const EMPTY_METRICS = {
  open: 0,
  overdue: 0,
  upcoming: 0,
  dueNext7Days: 0,
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const contactLabel = (followUp) =>
  followUp.email || followUp.phone || "No contact method";

const reminderLabel = (reminder) => {
  if (!reminder) return "Reminder not queued yet";
  if (reminder.status === "sent") return "Reminder sent";
  if (reminder.status === "failed") return "Reminder delivery failed";
  if (reminder.status === "superseded") return "Previous reminder superseded";
  if (reminder.status === "sending") return "Reminder sending";
  return "Reminder queued";
};

const activityLabel = (activity) => {
  if (activity.channel === "email" && activity.status === "sent") return "Email sent";
  if (activity.channel === "email" && activity.status === "failed") return "Email failed";
  if (activity.channel === "email" && activity.status === "sending") return "Email sending";
  if (activity.channel === "phone") {
    return activity.direction === "inbound" ? "Inbound phone contact" : "Phone contact logged";
  }
  return activity.direction === "inbound" ? "Inbound contact logged" : "Manual contact logged";
};

const defaultEmailSubject = (followUp) => {
  const purpose = String(followUp?.purpose || "").trim();
  return purpose ? `Following up: ${purpose.slice(0, 160)}` : "Following up on our conversation";
};

export default function TengaAgentFollowUpInbox({ user }) {
  const [filter, setFilter] = useState("all");
  const [followUps, setFollowUps] = useState([]);
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [rescheduleId, setRescheduleId] = useState("");
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [workspace, setWorkspace] = useState({ appointmentId: "", mode: "" });
  const [activitiesByAppointment, setActivitiesByAppointment] = useState({});
  const [activityLoadingId, setActivityLoadingId] = useState("");
  const [emailDraft, setEmailDraft] = useState({ subject: "", message: "" });
  const [contactDraft, setContactDraft] = useState({
    channel: "phone",
    direction: "outbound",
    notes: "",
  });
  const [error, setError] = useState("");

  const loadFollowUps = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await getTengaAgentOwnerFollowUps({
        filter,
        limit: 100,
      });
      setFollowUps(Array.isArray(response?.followUps) ? response.followUps : []);
      setMetrics(response?.metrics || EMPTY_METRICS);
    } catch (requestError) {
      if (requestError?.status === 404) {
        setFollowUps([]);
        setMetrics(EMPTY_METRICS);
      } else {
        setError(
          requestError?.message || "TengaAgent could not load the follow-up queue."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [filter, user]);

  const loadActivity = useCallback(async (followUp) => {
    if (!followUp?.appointmentId) return;

    setActivityLoadingId(followUp.appointmentId);
    try {
      const response = await getTengaAgentOwnerFollowUpActivity({
        appointmentId: followUp.appointmentId,
        limit: 100,
      });
      setActivitiesByAppointment((current) => ({
        ...current,
        [followUp.appointmentId]: Array.isArray(response?.activities)
          ? response.activities
          : [],
      }));
    } catch (requestError) {
      setError(
        requestError?.message || "TengaAgent could not load contact activity."
      );
    } finally {
      setActivityLoadingId("");
    }
  }, []);

  useEffect(() => {
    loadFollowUps();
  }, [loadFollowUps]);

  const openWorkspace = async (followUp, mode) => {
    if (!followUp?.appointmentId || actionId) return;

    const isSame =
      workspace.appointmentId === followUp.appointmentId && workspace.mode === mode;
    if (isSame) {
      setWorkspace({ appointmentId: "", mode: "" });
      return;
    }

    setError("");
    setWorkspace({ appointmentId: followUp.appointmentId, mode });
    if (mode === "email") {
      setEmailDraft({
        subject: defaultEmailSubject(followUp),
        message: "",
      });
    }
    if (mode === "log") {
      setContactDraft({
        channel: followUp.phone ? "phone" : "manual",
        direction: "outbound",
        notes: "",
      });
    }
    await loadActivity(followUp);
  };

  const completeFollowUp = async (followUp) => {
    if (!followUp?.appointmentId || actionId) return;

    setActionId(followUp.appointmentId);
    setError("");
    try {
      await completeTengaAgentOwnerFollowUp({
        appointmentId: followUp.appointmentId,
      });
      setRescheduleId("");
      setRescheduleAt("");
      setWorkspace({ appointmentId: "", mode: "" });
      await loadFollowUps();
    } catch (requestError) {
      setError(
        requestError?.message || "TengaAgent could not complete that follow-up."
      );
    } finally {
      setActionId("");
    }
  };

  const rescheduleFollowUp = async (followUp) => {
    if (!followUp?.appointmentId || actionId) return;

    const parsed = new Date(rescheduleAt);
    if (!rescheduleAt || Number.isNaN(parsed.getTime())) {
      setError("Choose a valid future follow-up date and time.");
      return;
    }

    setActionId(followUp.appointmentId);
    setError("");
    try {
      await rescheduleTengaAgentOwnerFollowUp({
        appointmentId: followUp.appointmentId,
        followUpAt: parsed.toISOString(),
      });
      setRescheduleId("");
      setRescheduleAt("");
      await loadFollowUps();
    } catch (requestError) {
      setError(
        requestError?.message || "TengaAgent could not reschedule that follow-up."
      );
    } finally {
      setActionId("");
    }
  };

  const sendEmail = async (followUp) => {
    if (!followUp?.appointmentId || actionId) return;
    if (!emailDraft.subject.trim() || !emailDraft.message.trim()) {
      setError("Add an email subject and message before sending.");
      return;
    }

    setActionId(followUp.appointmentId);
    setError("");
    try {
      await sendTengaAgentOwnerFollowUpEmail({
        appointmentId: followUp.appointmentId,
        subject: emailDraft.subject,
        message: emailDraft.message,
      });
      setEmailDraft({ subject: "", message: "" });
      setWorkspace({ appointmentId: followUp.appointmentId, mode: "activity" });
      await loadActivity(followUp);
    } catch (requestError) {
      setError(requestError?.message || "TengaAgent could not send that email.");
      if (requestError?.status === 502) {
        setWorkspace({ appointmentId: followUp.appointmentId, mode: "activity" });
        await loadActivity(followUp);
      }
    } finally {
      setActionId("");
    }
  };

  const logContact = async (followUp) => {
    if (!followUp?.appointmentId || actionId) return;
    if (!contactDraft.notes.trim()) {
      setError("Add contact notes before saving the activity.");
      return;
    }

    setActionId(followUp.appointmentId);
    setError("");
    try {
      await logTengaAgentOwnerFollowUpContact({
        appointmentId: followUp.appointmentId,
        channel: contactDraft.channel,
        direction: contactDraft.direction,
        notes: contactDraft.notes,
      });
      setContactDraft({ channel: "phone", direction: "outbound", notes: "" });
      setWorkspace({ appointmentId: followUp.appointmentId, mode: "activity" });
      await loadActivity(followUp);
    } catch (requestError) {
      setError(
        requestError?.message || "TengaAgent could not save that contact activity."
      );
    } finally {
      setActionId("");
    }
  };

  if (!user) return null;

  return (
    <section
      className="tengaagent-follow-up"
      aria-labelledby="tengaagent-follow-up-title"
    >
      <div className="tengaagent-follow-up__header">
        <div>
          <span>OWNER FOLLOW-UP QUEUE</span>
          <h3 id="tengaagent-follow-up-title">Follow-ups that need attention</h3>
          <p>
            Work the next customer action from one tenant-isolated queue, with
            reminder delivery and owner contact activity kept separately auditable.
          </p>
        </div>
        <button
          type="button"
          onClick={loadFollowUps}
          disabled={isLoading || Boolean(actionId)}
        >
          {isLoading ? "Refreshing…" : "Refresh queue"}
        </button>
      </div>

      {error ? (
        <div className="tengaagent-follow-up__error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="tengaagent-follow-up__metrics">
        <article>
          <span>Open</span>
          <strong>{metrics.open}</strong>
        </article>
        <article className={metrics.overdue ? "attention" : ""}>
          <span>Overdue</span>
          <strong>{metrics.overdue}</strong>
        </article>
        <article>
          <span>Upcoming</span>
          <strong>{metrics.upcoming}</strong>
        </article>
        <article>
          <span>Due next 7 days</span>
          <strong>{metrics.dueNext7Days}</strong>
        </article>
      </div>

      <div
        className="tengaagent-follow-up__filters"
        role="group"
        aria-label="Follow-up queue filter"
      >
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
            disabled={Boolean(actionId)}
          >
            {value.replaceAll("_", " ")}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="tengaagent-follow-up__empty">Loading follow-ups…</div>
      ) : followUps.length === 0 ? (
        <div className="tengaagent-follow-up__empty">
          <strong>No open follow-ups in this view.</strong>
          <span>New owner follow-up commitments will appear here automatically.</span>
        </div>
      ) : (
        <div className="tengaagent-follow-up__list">
          {followUps.map((followUp) => {
            const isActing = actionId === followUp.appointmentId;
            const isRescheduling = rescheduleId === followUp.appointmentId;
            const isWorkspaceOpen = workspace.appointmentId === followUp.appointmentId;
            const activities = activitiesByAppointment[followUp.appointmentId] || [];
            const emailAllowed = Boolean(
              followUp.email && followUp.consentToContact
            );

            return (
              <article
                className={`tengaagent-follow-up__card${
                  followUp.overdue ? " is-overdue" : ""
                }`}
                key={followUp.appointmentId}
              >
                <div className="tengaagent-follow-up__topline">
                  <div>
                    <strong>{followUp.name || "Unnamed visitor"}</strong>
                    <span>{contactLabel(followUp)}</span>
                  </div>
                  <span className={`due-state ${followUp.dueState}`}>
                    {followUp.dueState}
                  </span>
                </div>

                <p>{followUp.purpose || "No meeting purpose supplied."}</p>

                {followUp.outcomeNotes ? (
                  <p className="tengaagent-follow-up__notes">
                    {followUp.outcomeNotes}
                  </p>
                ) : null}

                <div className="tengaagent-follow-up__meta">
                  <span>Due: {formatDate(followUp.followUpAt)}</span>
                  <span>
                    Outcome: {String(followUp.outcomeDisposition || "unreviewed").replaceAll("_", " ")}
                  </span>
                  <span className={`reminder reminder--${followUp.reminder?.status || "none"}`}>
                    {reminderLabel(followUp.reminder)}
                  </span>
                </div>

                {followUp.reminder?.lastError ? (
                  <div className="tengaagent-follow-up__delivery-error">
                    {followUp.reminder.lastError}
                  </div>
                ) : null}

                <div className="tengaagent-follow-up__actions">
                  <button
                    type="button"
                    onClick={() => openWorkspace(followUp, "email")}
                    disabled={Boolean(actionId) || !emailAllowed}
                    title={
                      !followUp.email
                        ? "Customer email is not available"
                        : !followUp.consentToContact
                          ? "Customer contact consent is required"
                          : "Send a follow-up email"
                    }
                  >
                    Send email
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => openWorkspace(followUp, "log")}
                    disabled={Boolean(actionId)}
                  >
                    Log contact
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => openWorkspace(followUp, "activity")}
                    disabled={Boolean(actionId)}
                  >
                    Activity
                  </button>
                  <button
                    type="button"
                    onClick={() => completeFollowUp(followUp)}
                    disabled={Boolean(actionId)}
                  >
                    {isActing ? "Saving…" : "Mark follow-up done"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={Boolean(actionId)}
                    onClick={() => {
                      setError("");
                      setRescheduleId(isRescheduling ? "" : followUp.appointmentId);
                      setRescheduleAt("");
                    }}
                  >
                    {isRescheduling ? "Cancel reschedule" : "Reschedule"}
                  </button>
                </div>

                {!emailAllowed ? (
                  <div className="tengaagent-follow-up__contact-guard">
                    {!followUp.email
                      ? "Email outreach unavailable: no customer email address is stored."
                      : "Email outreach unavailable: customer contact consent is not recorded."}
                  </div>
                ) : null}

                {isRescheduling ? (
                  <div className="tengaagent-follow-up__reschedule">
                    <label>
                      New follow-up due
                      <input
                        type="datetime-local"
                        value={rescheduleAt}
                        onChange={(event) => setRescheduleAt(event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={Boolean(actionId)}
                      onClick={() => rescheduleFollowUp(followUp)}
                    >
                      Save new due time
                    </button>
                  </div>
                ) : null}

                {isWorkspaceOpen ? (
                  <div className="tengaagent-follow-up__workspace">
                    {workspace.mode === "email" ? (
                      <div className="tengaagent-follow-up__form">
                        <div>
                          <strong>Send follow-up email</strong>
                          <span>
                            Delivery is attempted only after you explicitly press Send.
                          </span>
                        </div>
                        <label>
                          Email subject
                          <input
                            value={emailDraft.subject}
                            maxLength={200}
                            onChange={(event) =>
                              setEmailDraft((current) => ({
                                ...current,
                                subject: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          Email message
                          <textarea
                            value={emailDraft.message}
                            maxLength={5000}
                            rows={6}
                            onChange={(event) =>
                              setEmailDraft((current) => ({
                                ...current,
                                message: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <div className="tengaagent-follow-up__form-actions">
                          <button
                            type="button"
                            disabled={Boolean(actionId)}
                            onClick={() => sendEmail(followUp)}
                          >
                            {isActing ? "Sending…" : `Send to ${followUp.email}`}
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            disabled={Boolean(actionId)}
                            onClick={() =>
                              setWorkspace({ appointmentId: "", mode: "" })
                            }
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {workspace.mode === "log" ? (
                      <div className="tengaagent-follow-up__form">
                        <div>
                          <strong>Log owner contact</strong>
                          <span>Record a call or another manually completed contact.</span>
                        </div>
                        <div className="tengaagent-follow-up__form-grid">
                          <label>
                            Contact channel
                            <select
                              value={contactDraft.channel}
                              onChange={(event) =>
                                setContactDraft((current) => ({
                                  ...current,
                                  channel: event.target.value,
                                }))
                              }
                            >
                              <option value="phone">Phone</option>
                              <option value="manual">Manual / other</option>
                            </select>
                          </label>
                          <label>
                            Contact direction
                            <select
                              value={contactDraft.direction}
                              onChange={(event) =>
                                setContactDraft((current) => ({
                                  ...current,
                                  direction: event.target.value,
                                }))
                              }
                            >
                              <option value="outbound">Outbound</option>
                              <option value="inbound">Inbound</option>
                            </select>
                          </label>
                        </div>
                        <label>
                          Contact notes
                          <textarea
                            value={contactDraft.notes}
                            maxLength={4000}
                            rows={4}
                            onChange={(event) =>
                              setContactDraft((current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <div className="tengaagent-follow-up__form-actions">
                          <button
                            type="button"
                            disabled={Boolean(actionId)}
                            onClick={() => logContact(followUp)}
                          >
                            {isActing ? "Saving…" : "Save contact activity"}
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            disabled={Boolean(actionId)}
                            onClick={() =>
                              setWorkspace({ appointmentId: "", mode: "" })
                            }
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="tengaagent-follow-up__activity">
                      <div className="tengaagent-follow-up__activity-heading">
                        <strong>Contact activity</strong>
                        <button
                          type="button"
                          className="secondary"
                          disabled={activityLoadingId === followUp.appointmentId}
                          onClick={() => loadActivity(followUp)}
                        >
                          {activityLoadingId === followUp.appointmentId
                            ? "Loading…"
                            : "Refresh activity"}
                        </button>
                      </div>

                      {activityLoadingId === followUp.appointmentId && !activities.length ? (
                        <div className="tengaagent-follow-up__activity-empty">
                          Loading contact history…
                        </div>
                      ) : activities.length === 0 ? (
                        <div className="tengaagent-follow-up__activity-empty">
                          No contact activity has been recorded yet.
                        </div>
                      ) : (
                        <div className="tengaagent-follow-up__timeline">
                          {activities.map((activity) => (
                            <article key={activity.id}>
                              <div>
                                <strong>{activityLabel(activity)}</strong>
                                <span>{formatDate(activity.occurredAt)}</span>
                              </div>
                              {activity.subject ? <b>{activity.subject}</b> : null}
                              {activity.message ? <p>{activity.message}</p> : null}
                              {activity.notes ? <p>{activity.notes}</p> : null}
                              {activity.recipient ? (
                                <span>Recipient: {activity.recipient}</span>
                              ) : null}
                              {activity.lastError ? (
                                <span className="activity-error">
                                  Delivery error: {activity.lastError}
                                </span>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
