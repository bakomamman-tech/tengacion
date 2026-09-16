import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getTengaAgentOwnerAppointments,
  rescheduleTengaAgentOwnerAppointment,
  updateTengaAgentOwnerAppointmentStatus,
} from "../../services/tengaAgentApi";

import TengaAgentAvailabilitySettings from "./TengaAgentAvailabilitySettings";
import TengaAgentHandoffInbox from "./TengaAgentHandoffInbox";
import "./tengaagent-appointment-owner.css";

const FILTERS = [
  "all",
  "requested",
  "confirmed",
  "completed",
  "cancelled",
];

const TIME_FILTERS = ["all", "upcoming", "past"];

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

const padDatePart = (value) =>
  String(value).padStart(2, "0");

const toDateTimeLocal = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return [
    date.getFullYear(),
    "-",
    padDatePart(date.getMonth() + 1),
    "-",
    padDatePart(date.getDate()),
    "T",
    padDatePart(date.getHours()),
    ":",
    padDatePart(date.getMinutes()),
  ].join("");
};

const deviceTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone ||
  "Africa/Lagos";

const contactLabel = (appointment) =>
  appointment.email ||
  appointment.phone ||
  "No contact method";

const appointmentTime = (appointment) => {
  const time = new Date(
    appointment?.preferredStartAt
  ).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const matchesSearch = (appointment, query) => {
  if (!query) {
    return true;
  }

  return [
    appointment?.name,
    appointment?.email,
    appointment?.phone,
    appointment?.company,
    appointment?.purpose,
    appointment?.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
};

const availabilityLabel = (appointment) => {
  switch (appointment.availabilityState) {
    case "available_at_request":
      return "available when requested";
    case "confirmed_free":
      return "availability checked at confirmation";
    case "conflict_at_confirmation":
      return "time now conflicts";
    default:
      return "manual request-time review";
  }
};

export default function TengaAgentAppointmentInbox({
  user,
}) {
  const [appointments, setAppointments] =
    useState([]);
  const [filter, setFilter] = useState("all");
  const [timeFilter, setTimeFilter] =
    useState("all");
  const [searchQuery, setSearchQuery] =
    useState("");
  const [isLoading, setIsLoading] =
    useState(true);
  const [updatingId, setUpdatingId] =
    useState("");
  const [rescheduleDraft, setRescheduleDraft] =
    useState(null);
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

  const visibleAppointments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = Date.now();

    return appointments
      .filter(
        (appointment) =>
          filter === "all" ||
          appointment.status === filter
      )
      .filter((appointment) => {
        if (timeFilter === "all") {
          return true;
        }

        const time = appointmentTime(appointment);
        if (!time) {
          return false;
        }

        return timeFilter === "upcoming"
          ? time >= now
          : time < now;
      })
      .filter((appointment) =>
        matchesSearch(appointment, query)
      )
      .sort((left, right) => {
        const leftTime = appointmentTime(left);
        const rightTime = appointmentTime(right);

        if (timeFilter === "past") {
          return rightTime - leftTime;
        }

        return leftTime - rightTime;
      });
  }, [appointments, filter, searchQuery, timeFilter]);

  const replaceAppointment = (appointment) => {
    setAppointments((current) =>
      current.map((entry) =>
        entry.id === appointment.id
          ? appointment
          : entry
      )
    );
  };

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
        replaceAppointment(
          response.appointment
        );
      }
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not update that appointment."
      );
      await loadAppointments();
    } finally {
      setUpdatingId("");
    }
  };

  const openReschedule = (appointment) => {
    if (
      updatingId ||
      !["requested", "confirmed"].includes(
        appointment?.status
      )
    ) {
      return;
    }

    setError("");
    setRescheduleDraft({
      appointmentId: appointment.id,
      preferredStartLocal:
        toDateTimeLocal(
          appointment.preferredStartAt
        ),
      durationMinutes: String(
        appointment.durationMinutes || 30
      ),
    });
  };

  const saveReschedule = async (appointment) => {
    if (
      !rescheduleDraft ||
      rescheduleDraft.appointmentId !==
        appointment.id ||
      updatingId
    ) {
      return;
    }

    const parsedStart = new Date(
      rescheduleDraft.preferredStartLocal
    );

    if (
      !rescheduleDraft.preferredStartLocal ||
      Number.isNaN(parsedStart.getTime())
    ) {
      setError(
        "Choose a valid future meeting time before saving."
      );
      return;
    }

    setUpdatingId(appointment.id);
    setError("");

    try {
      const response =
        await rescheduleTengaAgentOwnerAppointment({
          appointmentId: appointment.id,
          preferredStartAt:
            parsedStart.toISOString(),
          timezone: deviceTimezone(),
          durationMinutes: Number(
            rescheduleDraft.durationMinutes
          ),
        });

      if (response?.appointment) {
        replaceAppointment(
          response.appointment
        );
        setRescheduleDraft(null);
      }
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not reschedule that appointment."
      );
      await loadAppointments();
    } finally {
      setUpdatingId("");
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <TengaAgentAvailabilitySettings />

      <div
        className="tengaagent-owner-appointments"
        id="owner-appointments"
      >
        <div className="tengaagent-owner-appointments__header">
          <div>
            <span>APPOINTMENTS</span>
            <h3>Meeting requests</h3>
            <p>
              When internal availability is enabled,
              visitors choose from free TengaAgent slots
              and confirmation rechecks for conflicts.
              Otherwise, preferred times remain manual
              requests until you approve them.
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

        <div className="tengaagent-owner-appointments__tools">
          <label className="tengaagent-owner-appointments__search">
            <span>Search appointments</span>
            <input
              type="search"
              value={searchQuery}
              placeholder="Name, email, company or purpose"
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
            />
          </label>

          <div
            className="tengaagent-owner-appointments__time-filters"
            role="group"
            aria-label="Appointment time filter"
          >
            {TIME_FILTERS.map((scope) => (
              <button
                key={scope}
                type="button"
                className={
                  timeFilter === scope ? "active" : ""
                }
                onClick={() => setTimeFilter(scope)}
              >
                {scope}
              </button>
            ))}
          </div>

          <span className="tengaagent-owner-appointments__result-count">
            Showing {visibleAppointments.length} of{" "}
            {appointments.length}
          </span>
        </div>

        {isLoading ? (
          <div className="tengaagent-owner-appointments__empty">
            Loading appointment requests…
          </div>
        ) : visibleAppointments.length === 0 ? (
          <div className="tengaagent-owner-appointments__empty">
            <strong>No appointments match these filters.</strong>
            <span>
              Clear the search or adjust the status and
              time filters to see other meeting requests.
            </span>
          </div>
        ) : (
          <div className="tengaagent-owner-appointments__list">
            {visibleAppointments.map((appointment) => {
              const options =
                STATUS_OPTIONS[
                  appointment.status
                ] || [appointment.status];
              const canReschedule =
                ["requested", "confirmed"].includes(
                  appointment.status
                );
              const isRescheduling =
                rescheduleDraft?.appointmentId ===
                appointment.id;

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
                      {" minutes · meeting timezone: "}
                      {appointment.timezone || "—"}
                    </span>
                    <span>
                      Availability: {availabilityLabel(
                        appointment
                      )}
                      {appointment.availabilitySource
                        ? ` · ${appointment.availabilitySource}`
                        : ""}
                    </span>
                    {appointment.rescheduleCount ? (
                      <span>
                        Rescheduled {appointment.rescheduleCount}{" "}
                        {appointment.rescheduleCount === 1
                          ? "time"
                          : "times"}
                        {appointment.rescheduledAt
                          ? ` · last ${formatDate(appointment.rescheduledAt)}`
                          : ""}
                      </span>
                    ) : null}
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
                    {canReschedule ? (
                      <button
                        type="button"
                        className="tengaagent-owner-appointments__reschedule-button"
                        disabled={Boolean(updatingId)}
                        onClick={() =>
                          isRescheduling
                            ? setRescheduleDraft(null)
                            : openReschedule(appointment)
                        }
                      >
                        {isRescheduling
                          ? "Close reschedule"
                          : "Reschedule"}
                      </button>
                    ) : null}
                    {updatingId === appointment.id ? (
                      <span aria-live="polite">
                        Saving…
                      </span>
                    ) : null}
                  </div>

                  {isRescheduling ? (
                    <div className="tengaagent-owner-appointments__reschedule">
                      <div>
                        <label
                          htmlFor={`tengaagent-reschedule-time-${appointment.id}`}
                        >
                          New meeting time (your device timezone)
                        </label>
                        <input
                          id={`tengaagent-reschedule-time-${appointment.id}`}
                          type="datetime-local"
                          value={
                            rescheduleDraft.preferredStartLocal
                          }
                          onChange={(event) =>
                            setRescheduleDraft((current) => ({
                              ...current,
                              preferredStartLocal:
                                event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`tengaagent-reschedule-duration-${appointment.id}`}
                        >
                          Duration (minutes)
                        </label>
                        <input
                          id={`tengaagent-reschedule-duration-${appointment.id}`}
                          type="number"
                          min="15"
                          max="180"
                          step="15"
                          value={
                            rescheduleDraft.durationMinutes
                          }
                          onChange={(event) =>
                            setRescheduleDraft((current) => ({
                              ...current,
                              durationMinutes:
                                event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="tengaagent-owner-appointments__reschedule-actions">
                        <button
                          type="button"
                          disabled={Boolean(updatingId)}
                          onClick={() =>
                            saveReschedule(appointment)
                          }
                        >
                          Save new time
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          disabled={Boolean(updatingId)}
                          onClick={() =>
                            setRescheduleDraft(null)
                          }
                        >
                          Keep current time
                        </button>
                      </div>
                      <small>
                        Confirmed meetings are rechecked against
                        internal and connected calendar conflicts
                        before the new time is saved.
                      </small>
                    </div>
                  ) : null}
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
