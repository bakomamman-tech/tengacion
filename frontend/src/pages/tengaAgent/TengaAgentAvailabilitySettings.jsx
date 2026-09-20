import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getTengaAgentOwnerAvailability,
  saveTengaAgentOwnerAvailability,
} from "../../services/tengaAgentApi";

import TengaAgentCalendarConnections from "./TengaAgentCalendarConnections";
import "./tengaagent-availability.css";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const minutesToTime = (value) => {
  const minutes = Number(value);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(
    remainder
  ).padStart(2, "0")}`;
};

const timeToMinutes = (value) => {
  const [hours, minutes] = String(value || "")
    .split(":")
    .map(Number);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes)
  ) {
    return 0;
  }

  return hours * 60 + minutes;
};

const normalizeSchedule = (schedule = {}) => ({
  enabled: Boolean(schedule.enabled),
  timezone: schedule.timezone || "Africa/Lagos",
  minimumNoticeMinutes: String(
    schedule.minimumNoticeMinutes ?? 60
  ),
  bookingHorizonDays: String(
    schedule.bookingHorizonDays ?? 30
  ),
  slotStepMinutes: String(
    schedule.slotStepMinutes ?? 30
  ),
  defaultDurationMinutes: String(
    schedule.defaultDurationMinutes ?? 30
  ),
  bufferBeforeMinutes: String(
    schedule.bufferBeforeMinutes ?? 0
  ),
  bufferAfterMinutes: String(
    schedule.bufferAfterMinutes ?? 0
  ),
  weeklyHours: Array.isArray(schedule.weeklyHours)
    ? schedule.weeklyHours.map((window) => ({
        dayOfWeek: Number(window.dayOfWeek),
        start: minutesToTime(window.startMinutes),
        end: minutesToTime(window.endMinutes),
      }))
    : [],
});

export default function TengaAgentAvailabilitySettings() {
  const [schedule, setSchedule] = useState(null);
  const [isLoading, setIsLoading] =
    useState(true);
  const [isSaving, setIsSaving] =
    useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSchedule = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response =
        await getTengaAgentOwnerAvailability();
      setSchedule(
        normalizeSchedule(response?.schedule)
      );
    } catch (requestError) {
      if (requestError?.status === 404) {
        setSchedule(null);
      } else {
        setError(
          requestError?.message ||
            "TengaAgent could not load booking availability."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const updateField = (field, value) => {
    setSchedule((current) => ({
      ...current,
      [field]: value,
    }));
    setError("");
    setNotice("");
  };

  const updateWindow = (index, field, value) => {
    setSchedule((current) => ({
      ...current,
      weeklyHours: current.weeklyHours.map(
        (window, windowIndex) =>
          windowIndex === index
            ? {
                ...window,
                [field]:
                  field === "dayOfWeek"
                    ? Number(value)
                    : value,
              }
            : window
      ),
    }));
    setError("");
    setNotice("");
  };

  const addWindow = () => {
    setSchedule((current) => ({
      ...current,
      weeklyHours: [
        ...current.weeklyHours,
        {
          dayOfWeek: 1,
          start: "09:00",
          end: "17:00",
        },
      ],
    }));
  };

  const removeWindow = (index) => {
    setSchedule((current) => ({
      ...current,
      weeklyHours: current.weeklyHours.filter(
        (_window, windowIndex) =>
          windowIndex !== index
      ),
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!schedule || isSaving) {
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const response =
        await saveTengaAgentOwnerAvailability({
          enabled: schedule.enabled,
          timezone: schedule.timezone.trim(),
          minimumNoticeMinutes: Number(
            schedule.minimumNoticeMinutes
          ),
          bookingHorizonDays: Number(
            schedule.bookingHorizonDays
          ),
          slotStepMinutes: Number(
            schedule.slotStepMinutes
          ),
          defaultDurationMinutes: Number(
            schedule.defaultDurationMinutes
          ),
          bufferBeforeMinutes: Number(
            schedule.bufferBeforeMinutes
          ),
          bufferAfterMinutes: Number(
            schedule.bufferAfterMinutes
          ),
          weeklyHours: schedule.weeklyHours.map(
            (window) => ({
              dayOfWeek: window.dayOfWeek,
              startMinutes:
                timeToMinutes(window.start),
              endMinutes:
                timeToMinutes(window.end),
            })
          ),
        });

      setSchedule(
        normalizeSchedule(response?.schedule)
      );
      setNotice(
        response?.schedule?.enabled
          ? "Booking availability is active. Public visitors will see free TengaAgent slots after internal and connected external calendars are checked."
          : "Booking availability is off. Visitors will continue to request preferred times manually."
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not save booking availability."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="tengaagent-availability">
        Loading booking availability…
      </section>
    );
  }

  if (!schedule) {
    return null;
  }

  return (
    <section
      className="tengaagent-availability"
      aria-labelledby="tengaagent-availability-title"
    >
      <div className="tengaagent-availability__header">
        <div>
          <span>BOOKING AVAILABILITY</span>
          <h3 id="tengaagent-availability-title">
            Real TengaAgent meeting slots
          </h3>
          <p>
            Define when your team can accept meetings.
            Confirmed TengaAgent appointments and connected
            external calendar events block overlapping slots
            automatically.
          </p>
        </div>

        <button
          type="button"
          onClick={loadSchedule}
          disabled={isSaving}
        >
          Refresh
        </button>
      </div>

      <div className="tengaagent-availability__scope">
        <strong>Availability sources</strong>
        <span>
          Internal weekly rules remain the base schedule.
          Connected Google or Outlook calendars add read-only
          busy periods. If a connected provider cannot be
          verified, public booking falls back to a manual
          preferred-time request instead of claiming a slot is
          free.
        </span>
      </div>

      <TengaAgentCalendarConnections />

      <form onSubmit={handleSave}>
        <label className="tengaagent-availability__toggle">
          <input
            type="checkbox"
            checked={schedule.enabled}
            onChange={(event) =>
              updateField(
                "enabled",
                event.target.checked
              )
            }
          />
          <span>
            Show real available slots to public visitors
          </span>
        </label>

        <div className="tengaagent-availability__grid">
          <label>
            <span>Booking timezone</span>
            <input
              value={schedule.timezone}
              maxLength={100}
              onChange={(event) =>
                updateField(
                  "timezone",
                  event.target.value
                )
              }
              placeholder="Africa/Lagos"
              required
            />
          </label>

          <label>
            <span>Minimum notice</span>
            <select
              value={schedule.minimumNoticeMinutes}
              onChange={(event) =>
                updateField(
                  "minimumNoticeMinutes",
                  event.target.value
                )
              }
            >
              <option value="0">No minimum</option>
              <option value="60">1 hour</option>
              <option value="120">2 hours</option>
              <option value="240">4 hours</option>
              <option value="1440">24 hours</option>
              <option value="2880">48 hours</option>
            </select>
          </label>

          <label>
            <span>Booking horizon</span>
            <select
              value={schedule.bookingHorizonDays}
              onChange={(event) =>
                updateField(
                  "bookingHorizonDays",
                  event.target.value
                )
              }
            >
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
          </label>

          <label>
            <span>Slot spacing</span>
            <select
              value={schedule.slotStepMinutes}
              onChange={(event) =>
                updateField(
                  "slotStepMinutes",
                  event.target.value
                )
              }
            >
              <option value="15">Every 15 minutes</option>
              <option value="30">Every 30 minutes</option>
              <option value="60">Every 60 minutes</option>
            </select>
          </label>

          <label>
            <span>Default duration</span>
            <select
              value={schedule.defaultDurationMinutes}
              onChange={(event) =>
                updateField(
                  "defaultDurationMinutes",
                  event.target.value
                )
              }
            >
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </label>

          <label>
            <span>Buffer before</span>
            <select
              value={schedule.bufferBeforeMinutes}
              onChange={(event) =>
                updateField(
                  "bufferBeforeMinutes",
                  event.target.value
                )
              }
            >
              <option value="0">None</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </label>

          <label>
            <span>Buffer after</span>
            <select
              value={schedule.bufferAfterMinutes}
              onChange={(event) =>
                updateField(
                  "bufferAfterMinutes",
                  event.target.value
                )
              }
            >
              <option value="0">None</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </label>
        </div>

        <div className="tengaagent-availability__hours">
          <div className="tengaagent-availability__hours-header">
            <div>
              <strong>Weekly booking hours</strong>
              <span>
                Add multiple windows for split shifts or
                different days.
              </span>
            </div>
            <button
              type="button"
              onClick={addWindow}
            >
              Add window
            </button>
          </div>

          {schedule.weeklyHours.length === 0 ? (
            <div className="tengaagent-availability__empty">
              No booking windows configured.
            </div>
          ) : (
            schedule.weeklyHours.map((window, index) => (
              <div
                className="tengaagent-availability__window"
                key={`${window.dayOfWeek}-${index}`}
              >
                <select
                  aria-label={`Booking day ${index + 1}`}
                  value={window.dayOfWeek}
                  onChange={(event) =>
                    updateWindow(
                      index,
                      "dayOfWeek",
                      event.target.value
                    )
                  }
                >
                  {DAYS.map((day, dayIndex) => (
                    <option
                      value={dayIndex}
                      key={day}
                    >
                      {day}
                    </option>
                  ))}
                </select>

                <input
                  aria-label={`Start time ${index + 1}`}
                  type="time"
                  value={window.start}
                  onChange={(event) =>
                    updateWindow(
                      index,
                      "start",
                      event.target.value
                    )
                  }
                />

                <span>to</span>

                <input
                  aria-label={`End time ${index + 1}`}
                  type="time"
                  value={window.end}
                  onChange={(event) =>
                    updateWindow(
                      index,
                      "end",
                      event.target.value
                    )
                  }
                />

                <button
                  type="button"
                  onClick={() => removeWindow(index)}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        {error ? (
          <div
            className="tengaagent-availability__notice tengaagent-availability__notice--error"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {notice ? (
          <div
            className="tengaagent-availability__notice"
            role="status"
          >
            {notice}
          </div>
        ) : null}

        <button
          type="submit"
          className="tengaagent-availability__save"
          disabled={isSaving}
        >
          {isSaving
            ? "Saving availability…"
            : "Save booking availability"}
        </button>
      </form>
    </section>
  );
}
