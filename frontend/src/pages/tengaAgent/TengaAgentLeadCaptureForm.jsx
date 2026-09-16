import { useState } from "react";

import "./tengaagent-lead.css";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  company: "",
  projectSummary: "",
  consentToContact: false,
};

export default function TengaAgentLeadCaptureForm({
  isSubmitting = false,
  error = "",
  onSubmit,
  onDismiss,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [localError, setLocalError] = useState("");

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
      setLocalError("Add an email address or phone number so the Tengacion team can reach you.");
      return;
    }

    if (!form.consentToContact) {
      setLocalError("Please confirm that Tengacion may contact you about this enquiry.");
      return;
    }

    onSubmit?.({
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      company: form.company.trim(),
      projectSummary: form.projectSummary.trim(),
    });
  };

  return (
    <form className="tengaagent-lead-card" onSubmit={handleSubmit}>
      <div className="tengaagent-lead-heading">
        <div>
          <span>HUMAN FOLLOW-UP</span>
          <strong>Leave your details</strong>
        </div>

        <button
          type="button"
          className="tengaagent-lead-dismiss"
          onClick={onDismiss}
          aria-label="Close contact form"
          disabled={isSubmitting}
        >
          ×
        </button>
      </div>

      <p>
        Share only the contact information needed for this enquiry. Never send passwords, OTPs, card details, API keys, or other secrets.
      </p>

      <div className="tengaagent-lead-grid">
        <label>
          <span>Name</span>
          <input
            value={form.name}
            maxLength={120}
            autoComplete="name"
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Your name"
          />
        </label>

        <label>
          <span>Company</span>
          <input
            value={form.company}
            maxLength={160}
            autoComplete="organization"
            onChange={(event) => updateField("company", event.target.value)}
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
            onChange={(event) => updateField("email", event.target.value)}
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
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="+234..."
          />
        </label>
      </div>

      <label className="tengaagent-lead-summary">
        <span>What do you need help with?</span>
        <textarea
          value={form.projectSummary}
          maxLength={2000}
          rows={3}
          onChange={(event) => updateField("projectSummary", event.target.value)}
          placeholder="Briefly describe your project, question, or support request."
        />
      </label>

      <label className="tengaagent-lead-consent">
        <input
          type="checkbox"
          checked={form.consentToContact}
          onChange={(event) => updateField("consentToContact", event.target.checked)}
        />
        <span>I agree that Tengacion may contact me about this enquiry.</span>
      </label>

      {localError || error ? (
        <div className="tengaagent-lead-error" role="alert">
          {localError || error}
        </div>
      ) : null}

      <button
        type="submit"
        className="tengaagent-lead-submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Sending…" : "Send my details"}
      </button>
    </form>
  );
}
