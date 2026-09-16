import { useCallback, useEffect, useState } from "react";

import {
  completeTengaAgentOwnerFollowUp,
  getTengaAgentOwnerFollowUps,
  rescheduleTengaAgentOwnerFollowUp,
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

export default function TengaAgentFollowUpInbox({ user }) {
  const [filter, setFilter] = useState("all");
  const [followUps, setFollowUps] = useState([]);
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [rescheduleId, setRescheduleId] = useState("");
  const [rescheduleAt, setRescheduleAt] = useState("");
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

  useEffect(() => {
    loadFollowUps();
  }, [loadFollowUps]);

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
            reminder delivery state kept visible for audit and troubleshooting.
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
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
