import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { submitAdminComplaint } from "../../api";

const SUPPORT_TOPICS = [
  {
    key: "creator_onboarding",
    label: "Onboarding blocked",
    summary: "Creator registration, category selection, or profile readiness is stuck.",
    category: "account",
    subject: "Creator onboarding blocked",
    sourcePath: "/creator/register",
    sourceLabel: "Creator onboarding",
  },
  {
    key: "creator_payouts",
    label: "Payout readiness",
    summary: "Bank details, readiness status, earnings, or withdrawal steps need review.",
    category: "account",
    subject: "Creator payout readiness blocked",
    sourcePath: "/creator/payouts",
    sourceLabel: "Creator payouts",
  },
  {
    key: "creator_uploads",
    label: "Upload or catalog",
    summary: "Music, book, podcast, metadata, preview, or publishing tools are failing.",
    category: "bug",
    subject: "Creator upload or catalog issue",
    sourcePath: "/creator/categories",
    sourceLabel: "Creator upload workspace",
  },
  {
    key: "creator_verification",
    label: "Verification review",
    summary: "Verification, rights declarations, or creator account review needs attention.",
    category: "account",
    subject: "Creator verification review needed",
    sourcePath: "/creator/verification",
    sourceLabel: "Creator verification",
  },
];

export default function CreatorSupportPage() {
  const location = useLocation();
  const [activeTopicKey, setActiveTopicKey] = useState(SUPPORT_TOPICS[0].key);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const activeTopic = useMemo(
    () => SUPPORT_TOPICS.find((topic) => topic.key === activeTopicKey) || SUPPORT_TOPICS[0],
    [activeTopicKey]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const trimmedDetails = details.trim();
    if (!trimmedDetails) {
      setError("Add the blocker details before sending this to creator support.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await submitAdminComplaint({
        subject: activeTopic.subject,
        category: activeTopic.category,
        details: `${activeTopic.summary} Creator note: ${trimmedDetails}`,
        sourcePath: activeTopic.sourcePath || location.pathname || "/creator/support",
        sourceLabel: activeTopic.sourceLabel,
        supportFlow: activeTopic.key,
      });

      const ticketId = response?.complaint?._id ? ` Ticket ${response.complaint._id}.` : "";
      setNotice(`Creator support escalation sent.${ticketId}`);
      setDetails("");
    } catch (err) {
      setError(err?.message || "Could not send this creator support escalation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="creator-page-stack">
      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Creator escalation</h2>
            <p>Send blocked creator setup, payout, upload, or verification issues to admin support with the right context attached.</p>
          </div>
        </div>

        <div className="creator-support-topic-grid" role="tablist" aria-label="Creator support blocker type">
          {SUPPORT_TOPICS.map((topic) => (
            <button
              key={topic.key}
              type="button"
              role="tab"
              aria-selected={topic.key === activeTopic.key}
              className={`creator-quick-action creator-support-topic${topic.key === activeTopic.key ? " is-active" : ""}`}
              onClick={() => {
                setActiveTopicKey(topic.key);
                setError("");
                setNotice("");
              }}
            >
              <span>{topic.label}</span>
              <small>{topic.summary}</small>
            </button>
          ))}
        </div>

        <form className="creator-support-form" onSubmit={handleSubmit}>
          <label className="creator-form-full">
            <span>What is blocking you?</span>
            <textarea
              rows={5}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Include the step, error message, content title, or payout status you see."
            />
          </label>

          {error ? (
            <div className="creator-inline-notice warning" role="alert">
              <strong>Not sent</strong>
              <span>{error}</span>
            </div>
          ) : null}

          {notice ? (
            <div className="creator-inline-notice success" role="status">
              <strong>Sent</strong>
              <span>{notice}</span>
            </div>
          ) : null}

          <div className="creator-form-actions">
            <button type="submit" className="creator-primary-btn" disabled={submitting}>
              {submitting ? "Sending..." : "Send to creator support"}
            </button>
          </div>
        </form>
      </section>

      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Support shortcuts</h2>
            <p>Use the built-in platform routes for creator questions, policy review, and issue reporting.</p>
          </div>
        </div>
        <div className="creator-quick-list">
          <Link className="creator-quick-action" to="/help-support">
            <span>Help center</span>
            <small>Get help with creator setup, publishing, and workspace questions.</small>
          </Link>
          <Link className="creator-quick-action" to="/feedback?type=bug">
            <span>Report a problem</span>
            <small>Share a bug report if a creator tool, upload form, or dashboard state looks wrong.</small>
          </Link>
          <Link className="creator-quick-action" to="/terms">
            <span>Terms of Service</span>
            <small>Review the platform rules tied to creator accounts and uploaded content.</small>
          </Link>
          <Link className="creator-quick-action" to="/copyright-policy">
            <span>Copyright policy</span>
            <small>Read how Tengacion handles screening, rights declarations, and review flows.</small>
          </Link>
        </div>
      </section>
    </div>
  );
}
