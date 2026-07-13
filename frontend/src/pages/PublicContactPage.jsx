import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { submitPublicSupportReport } from "../api";
import SeoHead from "../components/seo/SeoHead";
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from "../lib/seo";
import { SUPPORT_EMAIL, buildMailto } from "../config/businessContact";

import "./public-contact.css";

const PAGE_TITLE = "Contact Tengacion | Copyright, Safety and Privacy Reports";
const PAGE_DESCRIPTION =
  "Contact Tengacion for copyright, safety, privacy, abuse, and public platform reports without needing to log in.";

const REPORT_TYPES = [
  {
    value: "copyright",
    label: "Copyright",
    helper: "Rights concerns, copied work, or uploads that need ownership review.",
    icon: "copyright",
  },
  {
    value: "safety",
    label: "Safety",
    helper: "Harassment, threats, harmful content, or community safety concerns.",
    icon: "safety",
  },
  {
    value: "privacy",
    label: "Privacy",
    helper: "Personal data, impersonation, or profile privacy concerns.",
    icon: "privacy",
  },
  {
    value: "abuse",
    label: "Abuse",
    helper: "Spam, scams, coercion, or platform misuse.",
    icon: "abuse",
  },
  {
    value: "child_safety",
    label: "Child safety",
    helper: "Urgent reports involving minors or child safety risk.",
    icon: "child-safety",
  },
  {
    value: "other",
    label: "Other",
    helper: "General public contact or trust and safety questions.",
    icon: "message",
  },
];

const POLICY_LINKS = [
  { path: "/community-guidelines", label: "Community Guidelines" },
  { path: "/child-safety", label: "Child Safety" },
  { path: "/moderation-policy", label: "Moderation" },
  { path: "/copyright-policy", label: "Copyright" },
  { path: "/privacy", label: "Privacy" },
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

const ContactIcon = ({ name, className = "" }) => {
  let content;

  switch (name) {
    case "copyright":
      content = (
        <>
          <rect x="4" y="3" width="16" height="18" rx="3" />
          <path d="M8 8h8M8 12h5" />
          <circle cx="13.5" cy="16.5" r="2.5" />
        </>
      );
      break;
    case "safety":
      content = (
        <>
          <path d="M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </>
      );
      break;
    case "privacy":
      content = (
        <>
          <rect x="5" y="10" width="14" height="11" rx="3" />
          <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v3" />
        </>
      );
      break;
    case "abuse":
      content = <path d="M6 21V4m0 1h10l-1.5 3L17 11H6" />;
      break;
    case "child-safety":
      content = (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20v-2.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V20" />
          <path d="M17.5 8.5 21 10v2.5c0 2.5-1.5 4.4-3.5 5.5-2-1.1-3.5-3-3.5-5.5V10l3.5-1.5Z" />
        </>
      );
      break;
    case "message":
      content = (
        <>
          <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
          <path d="M7.5 9.5h9M7.5 13h6" />
        </>
      );
      break;
    case "mail":
      content = (
        <>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="m4 7 8 6 8-6" />
        </>
      );
      break;
    case "clock":
      content = (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      );
      break;
    case "send":
      content = <path d="m21 3-8.5 18-2.2-7.3L3 11.5 21 3Zm-10.7 10.7L15 9" />;
      break;
    case "arrow":
      content = <path d="M5 12h14m-5-5 5 5-5 5" />;
      break;
    case "check":
      content = <path d="m5 12 4 4L19 6" />;
      break;
    default:
      content = <circle cx="12" cy="12" r="9" />;
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {content}
    </svg>
  );
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

  const selectReportType = (category) => {
    setForm((current) => ({ ...current, category }));
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
          <Link className="public-contact-brand" to="/" aria-label="Tengacion home">
            <span className="public-contact-brand__mark">
              <img src="/tengacion_logo_128.png" alt="" />
            </span>
            <span>Tengacion</span>
          </Link>
          <div className="public-contact-nav__links">
            <Link to="/safety">Safety</Link>
            <Link to="/copyright-policy">Copyright</Link>
            <Link className="public-contact-nav__login" to="/login">
              Log in
              <ContactIcon name="arrow" />
            </Link>
          </div>
        </nav>

        <div className="public-contact-hero__inner">
          <div className="public-contact-hero__content">
            <div className="public-contact-hero__badge">
              <span aria-hidden="true" />
              Tengacion Trust &amp; Safety
            </div>
            <p className="public-contact-eyebrow">Contact and reports</p>
            <h1>
              Report copyright, safety, privacy, or abuse <span>concerns.</span>
            </h1>
            <p className="public-contact-hero__lede">
              Tell us what happened and share the context that matters. Public reports go directly
              to the Tengacion admin review inbox—no account or login required.
            </p>

            <div className="public-contact-signals" aria-label="Report assurances">
              <span>
                <ContactIcon name="check" />
                No account needed
              </span>
              <span>
                <ContactIcon name="check" />
                Secure intake
              </span>
              <span>
                <ContactIcon name="check" />
                Human review
              </span>
            </div>
          </div>

          <div className="public-contact-hero__visual">
            <div className="public-contact-logo-orbit" aria-hidden="true">
              <span className="public-contact-logo-orbit__ring" />
              <span className="public-contact-logo-orbit__glow" />
              <img src="/tengacion_logo_512.png" alt="" />
            </div>

            <div className="public-contact-process-card">
              <div className="public-contact-process-card__header">
                <span className="public-contact-process-card__icon">
                  <ContactIcon name="safety" />
                </span>
                <div>
                  <small>What happens next</small>
                  <strong>A clear path to review</strong>
                </div>
              </div>
              <ol>
                <li>
                  <span>01</span>
                  <div>
                    <strong>You share the context</strong>
                    <small>Choose the closest category and add useful details.</small>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>Our team triages it</strong>
                    <small>Urgent safety reports are prioritized for review.</small>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>You receive a reference</strong>
                    <small>Keep it handy if you need to follow up.</small>
                  </div>
                </li>
              </ol>
              <p>
                <ContactIcon name="clock" />
                Include complete, accurate information to help us review efficiently.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="public-contact-section" aria-labelledby="public-contact-start-title">
        <header className="public-contact-section__header">
          <div>
            <p className="public-contact-eyebrow">Start your report</p>
            <h2 id="public-contact-start-title">Choose a category, then share the details.</h2>
          </div>
          <p>
            Fields marked <strong>Required</strong> help us identify and respond to your report.
          </p>
        </header>

        <div className="public-contact-layout">
          <aside className="public-contact-panel" aria-label="Report categories">
            <div className="public-contact-panel__heading">
              <span className="public-contact-step">1</span>
              <div>
                <p className="public-contact-eyebrow">Report type</p>
                <h2>What can we help with?</h2>
              </div>
            </div>
            <p className="public-contact-panel__intro">
              Pick the closest match. You can add all the context in the form.
            </p>

            <div className="public-contact-type-list" aria-label="Choose a report type">
              {REPORT_TYPES.map((entry) => {
                const active = entry.value === form.category;
                return (
                  <button
                    key={entry.value}
                    type="button"
                    className={active ? "is-active" : ""}
                    aria-label={`${entry.label}. ${entry.helper}`}
                    aria-pressed={active}
                    onClick={() => selectReportType(entry.value)}
                  >
                    <span className="public-contact-type-list__icon">
                      <ContactIcon name={entry.icon} />
                    </span>
                    <span className="public-contact-type-list__copy">
                      <strong>{entry.label}</strong>
                      <small>{entry.helper}</small>
                    </span>
                    <span className="public-contact-type-list__state" aria-hidden="true">
                      <ContactIcon name={active ? "check" : "arrow"} />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="public-contact-email-card">
              <span>
                <ContactIcon name="mail" />
              </span>
              <div>
                <small>Prefer email?</small>
                <a href={buildMailto(SUPPORT_EMAIL, "Tengacion support request")}>
                  {SUPPORT_EMAIL}
                </a>
              </div>
            </div>

            <div className="public-contact-panel__links">
              <small>Useful policies</small>
              <div>
                {POLICY_LINKS.map((policy) => (
                  <Link key={policy.path} to={policy.path}>
                    {policy.label}
                    <ContactIcon name="arrow" />
                  </Link>
                ))}
              </div>
            </div>
          </aside>

          <form className="public-contact-form" onSubmit={submitReport}>
            <div className="public-contact-form__header">
              <div className="public-contact-form__heading">
                <span className="public-contact-step">2</span>
                <div>
                  <p className="public-contact-eyebrow">Send a report</p>
                  <h2 id="public-contact-form-title">Public contact form</h2>
                </div>
              </div>
              <span className="public-contact-secure-label">
                <ContactIcon name="privacy" />
                Secure intake
              </span>
            </div>

            <div className="public-contact-selected-type">
              <span className="public-contact-selected-type__icon">
                <ContactIcon name={selectedType.icon} />
              </span>
              <div>
                <small>Selected report type</small>
                <strong>{selectedType.label}</strong>
                <p>{selectedType.helper}</p>
              </div>
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

            <fieldset className="public-contact-form__group">
              <legend className="public-contact-sr-only">Your contact details</legend>
              <div className="public-contact-form__group-heading">
                <div>
                  <span>01</span>
                  <h3>Your contact details</h3>
                </div>
                <p>We’ll use these details only to identify and follow up on this report.</p>
              </div>

              <div className="public-contact-fields public-contact-fields--two">
                <label>
                  <span className="public-contact-field-label">
                    Full name <small>Required</small>
                  </span>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    maxLength={120}
                    autoComplete="name"
                    placeholder="Your full name"
                    required
                  />
                </label>
                <label>
                  <span className="public-contact-field-label">
                    Email address <small>Required</small>
                  </span>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={updateField}
                    maxLength={160}
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    required
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="public-contact-form__group">
              <legend className="public-contact-sr-only">Report details</legend>
              <div className="public-contact-form__group-heading">
                <div>
                  <span>02</span>
                  <h3>Report details</h3>
                </div>
                <p>Be specific so the right team can review your report efficiently.</p>
              </div>

              <div className="public-contact-fields public-contact-fields--two">
                <label>
                  <span className="public-contact-field-label">
                    Category <small>Required</small>
                  </span>
                  <select name="category" value={form.category} onChange={updateField}>
                    {REPORT_TYPES.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="public-contact-field-label">
                    Subject <small>Required</small>
                  </span>
                  <input
                    type="text"
                    name="subject"
                    value={form.subject}
                    onChange={updateField}
                    maxLength={160}
                    placeholder="A short summary of the concern"
                    required
                  />
                </label>
              </div>

              <label>
                <span className="public-contact-field-label">
                  Link or source URL <small>Optional</small>
                </span>
                <input
                  type="url"
                  name="sourceUrl"
                  value={form.sourceUrl}
                  onChange={updateField}
                  maxLength={260}
                  inputMode="url"
                  placeholder="https://tengacion.com/..."
                />
                <span className="public-contact-field-hint">
                  Add the Tengacion post, profile, product, or original source if available.
                </span>
              </label>

              <div className="public-contact-fields public-contact-fields--two">
                <label>
                  <span className="public-contact-field-label">
                    Rights owner <small>Optional</small>
                  </span>
                  <input
                    type="text"
                    name="rightsOwner"
                    value={form.rightsOwner}
                    onChange={updateField}
                    maxLength={160}
                    placeholder="Person or organization"
                  />
                </label>
                <label>
                  <span className="public-contact-field-label">
                    Work title <small>Optional</small>
                  </span>
                  <input
                    type="text"
                    name="workTitle"
                    value={form.workTitle}
                    onChange={updateField}
                    maxLength={160}
                    placeholder="Name of the original work"
                  />
                </label>
              </div>

              <label>
                <span className="public-contact-field-label public-contact-field-label--details">
                  <span>
                    Details <small>Required</small>
                  </span>
                  <small>{form.details.length} / 2,000</small>
                </span>
                <textarea
                  name="details"
                  value={form.details}
                  onChange={updateField}
                  rows={7}
                  maxLength={2000}
                  placeholder="Describe what happened, who or what is involved, and the action you are requesting."
                  required
                />
              </label>
            </fieldset>

            <div className="public-contact-form__notice">
              <ContactIcon name="privacy" />
              <p>
                <strong>Share only what we need.</strong>
                Avoid passwords, payment PINs, or unnecessary sensitive personal information.
              </p>
            </div>

            {status.message ? (
              <div
                className={`public-contact-status public-contact-status--${status.type}`}
                role={status.type === "error" ? "alert" : "status"}
                aria-live={status.type === "error" ? "assertive" : "polite"}
              >
                <span>
                  <ContactIcon name={status.type === "success" ? "check" : "message"} />
                </span>
                <p>{status.message}</p>
              </div>
            ) : null}

            <div className="public-contact-actions">
              <button type="submit" disabled={submitting}>
                {submitting ? <span className="public-contact-spinner" aria-hidden="true" /> : <ContactIcon name="send" />}
                {submitting ? "Submitting..." : "Submit report"}
                {!submitting ? <ContactIcon className="public-contact-actions__arrow" name="arrow" /> : null}
              </button>
              <div>
                <span>Need more context first?</span>
                <Link to="/safety">
                  Review safety policy
                  <ContactIcon name="arrow" />
                </Link>
              </div>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
