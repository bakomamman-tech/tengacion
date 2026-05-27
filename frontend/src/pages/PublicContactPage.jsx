import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { submitPublicSupportReport } from "../api";
import SeoHead from "../components/seo/SeoHead";
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from "../lib/seo";

import "./public-contact.css";

const PAGE_TITLE = "Contact Tengacion | Copyright, Safety and Privacy Reports";
const PAGE_DESCRIPTION =
  "Contact Tengacion for copyright, safety, privacy, abuse, and public platform reports without needing to log in.";

const REPORT_TYPES = [
  {
    value: "copyright",
    label: "Copyright",
    helper: "Rights concerns, copied work, or uploads that need ownership review.",
  },
  {
    value: "safety",
    label: "Safety",
    helper: "Harassment, threats, harmful content, or community safety concerns.",
  },
  {
    value: "privacy",
    label: "Privacy",
    helper: "Personal data, impersonation, or profile privacy concerns.",
  },
  {
    value: "abuse",
    label: "Abuse",
    helper: "Spam, scams, coercion, or platform misuse.",
  },
  {
    value: "child_safety",
    label: "Child safety",
    helper: "Urgent reports involving minors or child safety risk.",
  },
  {
    value: "other",
    label: "Other",
    helper: "General public contact or trust and safety questions.",
  },
];

const INITIAL_FORM = {
  name: "",
  email: "",
  category: "copyright",
  subject: "",
  sourceUrl: "",
  rightsOwner: "",
  workTitle: "",
  details: "",
  website: "",
};

export default function PublicContactPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const selectedType = useMemo(
    () => REPORT_TYPES.find((entry) => entry.value === form.category) || REPORT_TYPES[0],
    [form.category]
  );

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setStatus({ type: "", message: "" });
      const response = await submitPublicSupportReport(form);
      const suffix = response?.reportId ? ` Reference: ${response.reportId}.` : "";
      setStatus({
        type: "success",
        message: `Report received. The Tengacion team will review it.${suffix}`,
      });
      setForm(INITIAL_FORM);
    } catch (err) {
      setStatus({
        type: "error",
        message: err?.message || "Unable to submit the report. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="public-contact-page">
      <SeoHead
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        canonical="/contact"
        robots="index,follow"
        structuredData={[
          buildWebSiteJsonLd(),
          buildOrganizationJsonLd(),
          buildBreadcrumbJsonLd([
            { name: "Tengacion", url: "/" },
            { name: "Contact", url: "/contact" },
          ]),
        ]}
      />

      <section className="public-contact-hero">
        <nav className="public-contact-nav" aria-label="Tengacion public navigation">
          <Link className="public-contact-brand" to="/">
            <img src="/tengacion_logo_128.png" alt="" />
            <span>Tengacion</span>
          </Link>
          <div className="public-contact-nav__links">
            <Link to="/safety">Safety</Link>
            <Link to="/copyright-policy">Copyright</Link>
            <Link to="/login">Log in</Link>
          </div>
        </nav>

        <div className="public-contact-hero__content">
          <p className="public-contact-eyebrow">Contact and reports</p>
          <h1>Report copyright, safety, privacy, or abuse concerns</h1>
          <p>
            Public reports go into the Tengacion admin review inbox so the team can triage urgent
            concerns and rights questions from people outside the logged-in app.
          </p>
        </div>
      </section>

      <section className="public-contact-section" aria-labelledby="public-contact-form-title">
        <div className="public-contact-layout">
          <aside className="public-contact-panel" aria-label="Report categories">
            <p className="public-contact-eyebrow">Report type</p>
            <h2>{selectedType.label}</h2>
            <p>{selectedType.helper}</p>
            <div className="public-contact-panel__links">
              <Link to="/community-guidelines">Community Guidelines</Link>
              <Link to="/child-safety">Child Safety Policy</Link>
              <Link to="/moderation-policy">Moderation Policy</Link>
              <Link to="/copyright-policy">Copyright Policy</Link>
              <Link to="/privacy">Privacy Policy</Link>
            </div>
          </aside>

          <form className="public-contact-form" onSubmit={submitReport}>
            <div>
              <p className="public-contact-eyebrow">Send a report</p>
              <h2 id="public-contact-form-title">Public contact form</h2>
            </div>

            <input
              type="text"
              name="website"
              value={form.website}
              onChange={updateField}
              tabIndex={-1}
              autoComplete="off"
              className="public-contact-honeypot"
              aria-hidden="true"
            />

            <div className="public-contact-fields public-contact-fields--two">
              <label>
                Name
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={updateField}
                  maxLength={120}
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={updateField}
                  maxLength={160}
                  required
                />
              </label>
            </div>

            <div className="public-contact-fields public-contact-fields--two">
              <label>
                Category
                <select name="category" value={form.category} onChange={updateField}>
                  {REPORT_TYPES.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Subject
                <input
                  type="text"
                  name="subject"
                  value={form.subject}
                  onChange={updateField}
                  maxLength={160}
                  required
                />
              </label>
            </div>

            <label>
              Link or source URL
              <input
                type="url"
                name="sourceUrl"
                value={form.sourceUrl}
                onChange={updateField}
                maxLength={260}
                placeholder="https://tengacion.com/..."
              />
            </label>

            <div className="public-contact-fields public-contact-fields--two">
              <label>
                Rights owner
                <input
                  type="text"
                  name="rightsOwner"
                  value={form.rightsOwner}
                  onChange={updateField}
                  maxLength={160}
                />
              </label>
              <label>
                Work title
                <input
                  type="text"
                  name="workTitle"
                  value={form.workTitle}
                  onChange={updateField}
                  maxLength={160}
                />
              </label>
            </div>

            <label>
              Details
              <textarea
                name="details"
                value={form.details}
                onChange={updateField}
                rows={7}
                maxLength={2000}
                required
              />
            </label>

            {status.message ? (
              <p className={`public-contact-status public-contact-status--${status.type}`} aria-live="polite">
                {status.message}
              </p>
            ) : null}

            <div className="public-contact-actions">
              <button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit report"}
              </button>
              <Link to="/safety">Review safety policy</Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
