import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getTengaAgentOwnerAppointments,
  updateTengaAgentOwnerAppointmentStatus,
} from "../../services/tengaAgentApi";

import TengaAgentHandoffInbox from "./TengaAgentHandoffInbox";
import "./tengaagent-appointment-owner.css";

const FILTERS = [
  "all",
  "requested",
  "confirmed",
  "completed",
  "cancelled",
];

const STATUS_OPTIONS = {
  requested: [
    "requested",
    "confirmed",
    "cancelled",
  ],
  confirmed: [
    "confirmed",
    "completed",
    "cancelled",
  ],
  completed: ["completed"],
  cancelled: ["cancelled"],
};

const formatDate = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const contactLabel = (appointment) =>
  appointment.email ||
  appointment.phone ||
  "No contact method";

export default function TengaAgentAppointmentInbox({
  user,
}) {
  const [appointments, setAppointments] =
    useState([]);
  const [filter, setFilter] = useState("all");
  const [isLoading, setIsLoading] =
    useState(true);
  const [updatingId, setUpdatingId] =
    useState("");
  const [error, setError] = useState("");

  const loadAppointments = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response =
        await getTengaAgentOwnerAppointments({
          limit: 100,
        });

      setAppointments(
        Array.isArray(response?.appointments)
          ? response.appointments
          : []
      );
    } catch (requestError) {
      if (requestError?.status === 404) {
        setAppointments([]);
      } else {
        setError(
          requestError?.message ||
            "TengaAgent could not load appointment requests."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const counts = useMemo(() => {
    const result = {
      all: appointments.length,
      requested: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const appointment of appointments) {
      if (
        Object.prototype.hasOwnProperty.call(
          result,
          appointment.status
        )
      ) {
        result[appointment.status] += 1;
      }
    }

    return result;
  }, [appointments]);

  const visibleAppointments = useMemo(
    () =>
      filter === "all"
        ? appointments
        : appointments.filter(
            (appointment) =>
              appointment.status === filter
          ),
    [appointments, filter]
  );

  const handleStatusChange = async (
    appointment,
    status
  ) => {
    if (
      !appointment?.id ||
      status === appointment.status ||
      updatingId
    ) {
      return;
    }

    setUpdatingId(appointment.id);
    setError("");

    try {
      const response =
        await updateTengaAgentOwnerAppointmentStatus({
          appointmentId:
            appointment.id,
          status,
        });

      if (response?.appointment) {
        setAppointments((current) =>
          current.map((entry) =>
            entry.id ===
            response.appointment.id
              ? response.appointment
              : entry
          )
        );
      }
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not update that appointment."
      );
    } finally {
      setUpdatingId("");
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <div
        className="tengaagent-owner-appointments"
        id="owner-appointments"
      >
        <div className="tengaagent-owner-appointments__header">
          <div>
            <span>APPOINTMENTS</span>
            <h3>Meeting requests</h3>
            <p>
              Visitors choose a preferred time. You
              confirm or cancel the request here; no
              calendar availability is implied yet.
            </p>
          </div>

          <button
            type="button"
            onClick={loadAppointments}
            disabled={
              isLoading || Boolean(updatingId)
            }
          >
            {isLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {error ? (
          <div
            className="tengaagent-owner-appointments__error"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div
          className="tengaagent-owner-appointments__filters"
          role="group"
          aria-label="Appointment status filter"
        >
          {FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              className={
                filter === status ? "active" : ""
              }
              onClick={() => setFilter(status)}
            >
              {status}
              <span>{counts[status]}</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="tengaagent-owner-appointments__empty">
            Loading appointment requests…
          </div>
        ) : visibleAppointments.length === 0 ? (
          <div className="tengaagent-owner-appointments__empty">
            <strong>No appointment requests here yet.</strong>
            <span>
              Meeting requests raised through TengaAgent
              will appear here.
            </span>
          </div>
        ) : (
          <div className="tengaagent-owner-appointments__list">
            {visibleAppointments.map((appointment) => {
              const options =
                STATUS_OPTIONS[
                  appointment.status
                ] || [appointment.status];

              return (
                <article
                  key={appointment.id}
                  className="tengaagent-owner-appointments__card"
                >
                  <div className="tengaagent-owner-appointments__topline">
                    <div>
                      <strong>
                        {appointment.name ||
                          "Unnamed visitor"}
                      </strong>
                      <span>
                        {contactLabel(appointment)}
                      </span>
                    </div>
                    <span
                      className={`tengaagent-owner-appointments__status tengaagent-owner-appointments__status--${appointment.status}`}
                    >
                      {appointment.status}
                    </span>
                  </div>

                  <div className="tengaagent-owner-appointments__time">
                    <strong>
                      {formatDate(
                        appointment.preferredStartAt
                      )}
                    </strong>
                    <span>
                      {appointment.durationMinutes || 30}
                      {" minutes · visitor timezone: "}
                      {appointment.timezone || "—"}
                    </span>
                  </div>

                  {appointment.company ? (
                    <div className="tengaagent-owner-appointments__company">
                      {appointment.company}
                    </div>
                  ) : null}

                  <p>
                    {appointment.purpose ||
                      "No meeting purpose supplied."}
                  </p>

                  {appointment.notes ? (
                    <p className="tengaagent-owner-appointments__notes">
                      {appointment.notes}
                    </p>
                  ) : null}

                  <div className="tengaagent-owner-appointments__workflow">
                    <label
                      htmlFor={`tengaagent-appointment-status-${appointment.id}`}
                    >
                      Appointment status
                    </label>
                    <select
                      id={`tengaagent-appointment-status-${appointment.id}`}
                      value={appointment.status}
                      disabled={Boolean(updatingId)}
                      onChange={(event) =>
                        handleStatusChange(
                          appointment,
                          event.target.value
                        )
                      }
                    >
                      {options.map((status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {status}
                        </option>
                      ))}
                    </select>
                    {updatingId === appointment.id ? (
                      <span aria-live="polite">
                        Saving…
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <TengaAgentHandoffInbox />
    </>
  );
}
