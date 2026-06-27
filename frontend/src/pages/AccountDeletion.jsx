import { useState } from "react";
import { Link } from "react-router-dom";

import { deleteMyAccount } from "../api";
import SeoHead from "../components/seo/SeoHead";
import { SUPPORT_EMAIL, buildMailto } from "../config/businessContact";
import { useAuth } from "../context/AuthContext";

import "./public-policy.css";

export default function AccountDeletionPage() {
  const { user, logout } = useAuth();
  const [form, setForm] = useState({ password: "", confirmation: "" });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const submitDeletion = async (event) => {
    event.preventDefault();
    if (busy) {
      return;
    }

    try {
      setBusy(true);
      setStatus({ type: "", message: "" });
      const response = await deleteMyAccount(form);
      setStatus({
        type: "success",
        message: response?.message || "Your Tengacion account was deleted.",
      });
      setForm({ password: "", confirmation: "" });
      await logout({ remote: false });
    } catch (error) {
      setStatus({
        type: "error",
        message: error?.message || "We could not delete your account. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="public-policy-page">
      <SeoHead
        title="Delete Your Tengacion Account"
        description="Delete your Tengacion account and associated personal content, or request help with deletion."
        canonical="/account-deletion"
      />

      <section className="public-policy-hero">
        <Link className="public-policy-brand" to="/">
          <img src="/tengacion_logo_128.png" alt="" />
          <span>Tengacion</span>
        </Link>
        <p className="public-policy-eyebrow">Account and data controls</p>
        <h1>Delete your account</h1>
        <p>
          Deletion removes your profile, posts, comments, messages, uploads, creator content,
          seller details, and other personal activity. This cannot be undone.
        </p>
      </section>

      <section className="public-policy-grid" aria-label="Account deletion details">
        <article className="public-policy-card">
          <h2>What happens</h2>
          <ul>
            <li>Your account is immediately disabled and all sessions are signed out.</li>
            <li>Your public and private user-generated content is removed.</li>
            <li>Active creator subscriptions are marked to stop renewing.</li>
            <li>
              Limited transaction, tax, fraud-prevention, dispute, and safety records may be
              retained where legally required, with personal profile details removed.
            </li>
          </ul>
        </article>

        <article className="public-policy-card">
          {status.type === "success" ? (
            <>
              <h2>Account deleted</h2>
              <p role="status">{status.message}</p>
              <Link to="/">Return to Tengacion</Link>
            </>
          ) : user ? (
            <>
              <h2>Confirm permanent deletion</h2>
              <form className="account-form-grid" onSubmit={submitDeletion}>
                <label>
                  Current password
                  <input
                    className="account-input"
                    type="password"
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, password: event.target.value }))
                    }
                    required
                  />
                </label>
                <label>
                  Type DELETE to confirm
                  <input
                    className="account-input"
                    value={form.confirmation}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, confirmation: event.target.value }))
                    }
                    pattern="DELETE"
                    autoComplete="off"
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy || form.confirmation !== "DELETE" || !form.password}
                >
                  {busy ? "Deleting account…" : "Permanently delete my account"}
                </button>
                {status.message ? <p role="alert">{status.message}</p> : null}
              </form>
            </>
          ) : (
            <>
              <h2>Start a deletion request</h2>
              <p>
                Sign in on the web or in the Tengacion app, then return to this page to complete
                deletion securely. If you cannot access your account, email support from the
                address registered to it.
              </p>
              <div className="public-policy-links">
                <Link to="/login">Sign in to delete account</Link>
                <a href={buildMailto(SUPPORT_EMAIL, "Tengacion account deletion request")}>
                  Email deletion request
                </a>
              </div>
            </>
          )}
        </article>
      </section>

      <section className="public-policy-band">
        <div>
          <p className="public-policy-eyebrow">Need help?</p>
          <h2>Privacy and support</h2>
        </div>
        <div className="public-policy-links">
          <Link to="/privacy">Privacy policy</Link>
          <Link to="/contact">Contact support</Link>
        </div>
      </section>
    </main>
  );
}
