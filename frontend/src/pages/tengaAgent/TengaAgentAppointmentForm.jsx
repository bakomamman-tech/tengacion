import { useMemo, useState } from "react";

import "./tengaagent-appointment.css";

const getBrowserTimezone = () => {
  try {
    return (
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone || "Africa/Lagos"
    );
  } catch {
    return "Africa/Lagos";
  }
};

const toLocalDateTimeInput = (date) => {
  const local = new Date(
    date.getTime() -
      date.getTimezoneOffset() * 60 * 1000
  );

  return local
    .toISOString()
    .slice(0, 16);
};

const INITIAL_FORM = {
  name: "",
  email: "",
  phone: "",
  company: "",
  purpose: "",
  notes: "",
  preferredStartLocal: "",
  durationMinutes: "30",
  consentToContact: false,
};

export default function TengaAgentAppointmentForm({
  isSubmitting = false,
  error = "",
  onSubmit,
  onDismiss,
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [localError, setLocalError] = useState("");

  const timezone = useMemo(
    getBrowserTimezone,
    []
  );

  const minDateTime = useMemo(
    () =>
      toLocalDateTimeInput(
        new Date(Date.now() + 15 * 60 * 1000)
      ),
    []
  );

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setLocalError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.email.trim() && !form.phone.trim()) {
      setLocalError(
        "Add an email address or phone number so the team can confirm the appointment."
      );
      return;
    }

    if (!form.preferredStartLocal) {
      setLocalError(
        "Choose a preferred date and time."
      );
      return;
    }

    const preferredStart = new Date(
      form.preferredStartLocal
    );

    if (
      Number.isNaN(preferredStart.getTime()) ||
      preferredStart.getTime() <= Date.now()
    ) {
      setLocalError(
        "Choose a preferred time in the future."
      );
      return;
    }

    if (!form.consentToContact) {
      setLocalError(
        "Please confirm that Tengacion may contact you to manage this appointment request."
      );
      return;
    }

    onSubmit?.({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      company: form.company.trim(),
      purpose: form.purpose.trim(),
      notes: form.notes.trim(),
      preferredStartAt:
        preferredStart.toISOString(),
      timezone,
      durationMinutes: Number(
        form.durationMinutes
      ),
      consentToContact: true,
    });
  };

  return (
    <form
      className="tengaagent-appointment-card"
      onSubmit={handleSubmit}
    >
      <div className="tengaagent-appointment-heading">
        <div>
          <span>APPOINTMENT REQUEST</span>
          <strong>Request a meeting time</strong>
        </div>

        <button
          type="button"
          className="tengaagent-appointment-dismiss"
          onClick={onDismiss}
          aria-label="Close appointment form"
          disabled={isSubmitting}
        >
          ×
        </button>
      </div>

      <p>
        Choose your preferred time. This is a request,
        not a confirmed calendar booking, until the
        Tengacion team approves it.
      </p>

      <div className="tengaagent-appointment-grid">
        <label>
          <span>Name</span>
          <input
            value={form.name}
            maxLength={120}
            autoComplete="name"
            onChange={(event) =>
              updateField("name", event.target.value)
            }
            placeholder="Your name"
          />
        </label>

        <label>
          <span>Company</span>
          <input
            value={form.company}
            maxLength={160}
            autoComplete="organization"
            onChange={(event) =>
              updateField("company", event.target.value)
            }
            placeholder="Business or organisation"
          />
        </label>

        <label>
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            maxLength={254}
            autoComplete="email"
            onChange={(event) =>
              updateField("email", event.target.value)
            }
            placeholder="you@example.com"
          />
        </label>

        <label>
          <span>Phone</span>
          <input
            type="tel"
            value={form.phone}
            maxLength={40}
            autoComplete="tel"
            onChange={(event) =>
              updateField("phone", event.target.value)
            }
            placeholder="+234..."
          />
        </label>

        <label>
          <span>Preferred date and time</span>
          <input
            type="datetime-local"
            value={form.preferredStartLocal}
            min={minDateTime}
            onChange={(event) =>
              updateField(
                "preferredStartLocal",
                event.target.value
              )
            }
            required
          />
        </label>

        <label>
          <span>Duration</span>
          <select
            value={form.durationMinutes}
            onChange={(event) =>
              updateField(
                "durationMinutes",
                event.target.value
              )
            }
          >
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
          </select>
        </label>
      </div>

      <div className="tengaagent-appointment-timezone">
        Timezone: <strong>{timezone}</strong>
      </div>

      <label className="tengaagent-appointment-wide">
        <span>Meeting purpose</span>
        <input
          value={form.purpose}
          maxLength={1000}
          onChange={(event) =>
            updateField("purpose", event.target.value)
          }
          placeholder="Product demo, project discussion, support…"
        />
      </label>

      <label className="tengaagent-appointment-wide">
        <span>Anything the team should know?</span>
        <textarea
          value={form.notes}
          maxLength={2000}
          rows={3}
          onChange={(event) =>
            updateField("notes", event.target.value)
          }
          placeholder="Optional context for the meeting. Do not include passwords, OTPs, card details, or other secrets."
        />
      </label>

      <label className="tengaagent-appointment-consent">
        <input
          type="checkbox"
          checked={form.consentToContact}
          onChange={(event) =>
            updateField(
              "consentToContact",
              event.target.checked
            )
          }
        />
        <span>
          I agree that Tengacion may contact me to
          confirm or manage this appointment request.
        </span>
      </label>

      {localError || error ? (
        <div
          className="tengaagent-appointment-error"
          role="alert"
        >
          {localError || error}
        </div>
      ) : null}

      <button
        type="submit"
        className="tengaagent-appointment-submit"
        disabled={isSubmitting}
      >
        {isSubmitting
          ? "Requesting…"
          : "Request this meeting time"}
      </button>
    </form>
  );
}
