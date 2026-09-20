import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  cancelPublicSessionAppointment,
  getPublicSessionAppointment,
  reschedulePublicSessionAppointment,
} from "../../services/tengaAgentVisitorAppointmentApi";
import "./tengaagent-visitor-appointment.css";

const toLocalInputValue = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 16);
};

const formatDateTime = (value) => {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const statusLabel = (status) => {
  if (status === "confirmed") return "Confirmed";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Awaiting confirmation";
};

export default function TengaAgentVisitorAppointmentManager({
  organizationSlug,
  agentKey,
  sessionId,
  businessName,
  refreshKey = 0,
}) {
  const [appointment, setAppointment] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [preferredStartAt, setPreferredStartAt] =
    useState("");
  const [durationMinutes, setDurationMinutes] =
    useState(30);

  const timezone = useMemo(
    () =>
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "Africa/Lagos",
    []
  );

  const load = useCallback(async () => {
    if (!organizationSlug || !agentKey || !sessionId) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await getPublicSessionAppointment({
        organizationSlug,
        agentKey,
        sessionId,
      });

      setAppointment(response?.appointment || null);
      setError("");
    } catch (loadError) {
      setError(
        loadError?.message ||
          "Your appointment status could not be refreshed."
      );
    } finally {
      setIsLoading(false);
    }
  }, [organizationSlug, agentKey, sessionId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      load().catch(() => {});
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [load]);

  const beginEditing = () => {
    setPreferredStartAt(
      toLocalInputValue(appointment?.preferredStartAt)
    );
    setDurationMinutes(
      Number(appointment?.durationMinutes || 30)
    );
    setEditing(true);
    setConfirmCancel(false);
    setError("");
    setNotice("");
  };

  const saveReschedule = async () => {
    if (!preferredStartAt) {
      setError("Choose a new appointment time.");
      return;
    }

    const parsed = new Date(preferredStartAt);
    if (Number.isNaN(parsed.getTime())) {
      setError("Choose a valid appointment time.");
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const response =
        await reschedulePublicSessionAppointment({
          organizationSlug,
          agentKey,
          sessionId,
          preferredStartAt: parsed.toISOString(),
          timezone,
          durationMinutes: Number(durationMinutes),
        });

      setAppointment(response?.appointment || appointment);
      setEditing(false);
      setNotice(
        response?.message ||
          "Your appointment time has been updated."
      );
    } catch (saveError) {
      setError(
        saveError?.message ||
          "Your appointment could not be rescheduled."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const cancelAppointment = async () => {
    if (!confirmCancel) {
      setConfirmCancel(true);
      setEditing(false);
      setError("");
      setNotice("");
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const response =
        await cancelPublicSessionAppointment({
          organizationSlug,
          agentKey,
          sessionId,
        });

      setAppointment(response?.appointment || appointment);
      setConfirmCancel(false);
      setNotice(
        response?.message ||
          "Your appointment has been cancelled."
      );
    } catch (cancelError) {
      setError(
        cancelError?.message ||
          "Your appointment could not be cancelled."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!appointment) {
    if (isLoading || !error) {
      return null;
    }

    return null;
  }

  const isActive = ["requested", "confirmed"].includes(
    appointment.status
  );

  return (
    <section
      className="tengaagent-visitor-appointment"
      aria-label="Your appointment"
    >
      <div className="tengaagent-visitor-appointment__heading">
        <div>
          <span>YOUR APPOINTMENT</span>
          <h2>{statusLabel(appointment.status)}</h2>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={isLoading || isSaving}
        >
          {isLoading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="tengaagent-visitor-appointment__summary">
        <div>
          <strong>Time</strong>
          <span>{formatDateTime(appointment.preferredStartAt)}</span>
        </div>
        <div>
          <strong>Duration</strong>
          <span>{appointment.durationMinutes || 30} minutes</span>
        </div>
        <div>
          <strong>Timezone</strong>
          <span>{appointment.timezone || timezone}</span>
        </div>
      </div>

      {appointment.purpose ? (
        <p className="tengaagent-visitor-appointment__purpose">
          {appointment.purpose}
        </p>
      ) : null}

      {appointment.rescheduleCount > 0 ? (
        <small>
          Rescheduled {appointment.rescheduleCount}{" "}
          {appointment.rescheduleCount === 1 ? "time" : "times"}
          {appointment.rescheduledAt
            ? ` · last changed ${formatDateTime(
                appointment.rescheduledAt
              )}`
            : ""}
        </small>
      ) : null}

      {notice ? (
        <div className="tengaagent-visitor-appointment__notice">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="tengaagent-visitor-appointment__error">
          {error}
        </div>
      ) : null}

      {editing ? (
        <div className="tengaagent-visitor-appointment__editor">
          <label>
            New time
            <input
              type="datetime-local"
              value={preferredStartAt}
              disabled={isSaving}
              onChange={(event) =>
                setPreferredStartAt(event.target.value)
              }
            />
          </label>

          <label>
            Duration
            <input
              type="number"
              min="15"
              max="180"
              step="15"
              value={durationMinutes}
              disabled={isSaving}
              onChange={(event) =>
                setDurationMinutes(event.target.value)
              }
            />
          </label>

          <p>
            TengaAgent will recheck {businessName}'s current
            availability before accepting the change.
          </p>

          <div className="tengaagent-visitor-appointment__actions">
            <button
              type="button"
              onClick={saveReschedule}
              disabled={isSaving}
            >
              {isSaving ? "Saving…" : "Save new time"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setEditing(false)}
              disabled={isSaving}
            >
              Keep current time
            </button>
          </div>
        </div>
      ) : null}

      {confirmCancel ? (
        <div className="tengaagent-visitor-appointment__cancel-confirm">
          <strong>Cancel this appointment?</strong>
          <span>
            This will release the time and cannot be undone from
            this session.
          </span>
          <div className="tengaagent-visitor-appointment__actions">
            <button
              type="button"
              className="danger"
              onClick={cancelAppointment}
              disabled={isSaving}
            >
              {isSaving ? "Cancelling…" : "Confirm cancellation"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setConfirmCancel(false)}
              disabled={isSaving}
            >
              Keep appointment
            </button>
          </div>
        </div>
      ) : null}

      {isActive && !editing && !confirmCancel ? (
        <div className="tengaagent-visitor-appointment__actions">
          <button
            type="button"
            onClick={beginEditing}
            disabled={isSaving}
          >
            Change time
          </button>
          <button
            type="button"
            className="danger"
            onClick={cancelAppointment}
            disabled={isSaving}
          >
            Cancel appointment
          </button>
        </div>
      ) : null}

      {appointment.status === "requested" ? (
        <small>
          This is still a request until {businessName} confirms it.
        </small>
      ) : null}
    </section>
  );
}
