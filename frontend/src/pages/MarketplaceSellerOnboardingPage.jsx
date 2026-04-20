import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import QuickAccessLayout from "../components/QuickAccessLayout";
import SellerStatusBanner from "../components/marketplace/SellerStatusBanner";
import { useAuth } from "../context/AuthContext";
import {
  fetchMyMarketplaceSellerProfile,
  resubmitMarketplaceSellerApplication,
  saveMarketplaceSellerDraft,
  submitMarketplaceSellerApplication,
} from "../services/marketplaceSellerService";

import "../components/marketplace/marketplace.css";

const buildEmptyForm = (user = null) => ({
  fullName: user?.name || "",
  storeName: "",
  phoneNumber: user?.phone || "",
  bankName: "",
  accountNumber: "",
  accountName: "",
  residentialAddress: "",
  businessAddress: "",
  state: "",
  city: "",
  cacCertificate: null,
  acceptedTerms: false,
});

const toFormState = (seller = null, user = null) =>
  seller
    ? {
        fullName: seller.fullName || user?.name || "",
        storeName: seller.storeName || "",
        phoneNumber: seller.phoneNumber || user?.phone || "",
        bankName: seller.bankName || "",
        accountNumber: seller.accountNumber || "",
        accountName: seller.accountName || "",
        residentialAddress: seller.residentialAddress || "",
        businessAddress: seller.businessAddress || "",
        state: seller.state || "",
        city: seller.city || "",
        cacCertificate: null,
        acceptedTerms: true,
      }
    : buildEmptyForm(user);

const formatDateLabel = (value) => {
  if (!value) {
    return "Not added yet";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not added yet";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

const buildLinkedAccountFields = (user = null) => [
  { label: "Full name", value: user?.name || "Not added yet" },
  { label: "Username", value: user?.username ? `@${user.username}` : "Not added yet" },
  { label: "Email", value: user?.email || "Not added yet" },
  { label: "Mobile number", value: user?.phone || "Not added yet" },
  { label: "Country", value: user?.country || "Not added yet" },
  { label: "State of origin", value: user?.stateOfOrigin || "Not added yet" },
  { label: "Gender", value: user?.gender || "Not added yet" },
  { label: "Date of birth", value: formatDateLabel(user?.dob) },
];

export default function MarketplaceSellerOnboardingPage() {
  const { user } = useAuth();
  const [seller, setSeller] = useState(null);
  const [form, setForm] = useState(buildEmptyForm(user));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSeller = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchMyMarketplaceSellerProfile();
      setSeller(response?.seller || null);
      setForm(toFormState(response?.seller || null, user));
    } catch (err) {
      toast.error(err?.message || "Could not load your seller profile.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSeller();
  }, [loadSeller]);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submitForm = async (mode) => {
    setSaving(true);
    try {
      const handler =
        mode === "draft"
          ? saveMarketplaceSellerDraft
          : mode === "resubmit"
            ? resubmitMarketplaceSellerApplication
            : submitMarketplaceSellerApplication;
      const response = await handler(form);
      setSeller(response?.seller || null);
      setForm(toFormState(response?.seller || null, user));
      toast.success(
        mode === "draft"
          ? "Seller draft saved."
          : mode === "resubmit"
            ? "Application resubmitted for review."
            : "Seller application submitted for review."
      );
    } catch (err) {
      toast.error(err?.details?.[0] || err?.message || "Could not save seller profile.");
    } finally {
      setSaving(false);
    }
  };

  const currentStatus = seller?.status || "draft";
  const linkedAccountFields = buildLinkedAccountFields(user);

  return (
    <QuickAccessLayout
      user={user}
      title="Marketplace Registration"
      subtitle="Register your seller profile with Tengacion account details, payout information, verified addresses, and your CAC document."
    >
      <div className="marketplace-page marketplace-registration-page">
        {seller ? <SellerStatusBanner seller={seller} /> : null}

        {loading ? <div className="marketplace-loading-state">Loading seller profile...</div> : null}

        {!loading ? (
          <div className="marketplace-registration-layout">
            <aside className="marketplace-shell-card marketplace-registration-hero">
              <div>
                <span className="marketplace-section__eyebrow">Seller access</span>
                <h2>Open a marketplace storefront that feels trusted from day one.</h2>
              </div>

              <p className="marketplace-muted">
                This registration page combines your core Tengacion signup identity with the business details needed for marketplace approval.
              </p>

              <div className="marketplace-registration-highlights">
                <article className="marketplace-summary-card">
                  <strong>Linked</strong>
                  <span>Regular Tengacion account details</span>
                </article>
                <article className="marketplace-summary-card">
                  <strong>CAC</strong>
                  <span>Business verification document</span>
                </article>
                <article className="marketplace-summary-card">
                  <strong>Payout-ready</strong>
                  <span>Bank account settlement details</span>
                </article>
              </div>

              <div className="marketplace-registration-checklist">
                <div className="marketplace-registration-checklist__item">
                  <strong>1. Identity</strong>
                  <span>Your Tengacion signup details are shown below so marketplace registration stays connected to your main account.</span>
                </div>
                <div className="marketplace-registration-checklist__item">
                  <strong>2. Business info</strong>
                  <span>Add store name, contact number, office address, and location so buyers and admins can trust the storefront.</span>
                </div>
                <div className="marketplace-registration-checklist__item">
                  <strong>3. Compliance</strong>
                  <span>Upload your CAC certificate and confirm your details before you submit for review.</span>
                </div>
              </div>

              <div className="marketplace-registration-note">
                <strong>After approval</strong>
                <p className="marketplace-muted">
                  You can publish listings, manage orders, and review payouts from the seller dashboard.
                </p>
              </div>

              <div className="marketplace-cta-row">
                <Link className="marketplace-secondary-btn" to="/marketplace">
                  Back to marketplace
                </Link>
                <Link className="marketplace-ghost-btn" to="/marketplace/dashboard">
                  Open seller dashboard
                </Link>
              </div>
            </aside>

            <section className="marketplace-form-card marketplace-registration-form">
              <div className="marketplace-panel__head">
                <div>
                  <h3>Seller verification form</h3>
                  <p className="marketplace-muted">
                    Fill every required field so Tengacion can review your storefront application confidently.
                  </p>
                </div>
              </div>

              <section className="marketplace-registration-section">
                <div className="marketplace-section__head">
                  <div>
                    <span className="marketplace-section__eyebrow">Linked account</span>
                    <h3>Tengacion registration details</h3>
                    <p className="marketplace-section__copy">
                      These come from the main account you already created on Tengacion.
                    </p>
                  </div>
                </div>

                <div className="marketplace-registration-account-grid">
                  {linkedAccountFields.map((entry) => (
                    <article key={entry.label} className="marketplace-registration-account-card">
                      <span>{entry.label}</span>
                      <strong>{entry.value}</strong>
                    </article>
                  ))}
                </div>
              </section>

              <section className="marketplace-registration-section">
                <div className="marketplace-section__head">
                  <div>
                    <span className="marketplace-section__eyebrow">Business identity</span>
                    <h3>Store and contact details</h3>
                  </div>
                </div>

                <div className="marketplace-form-grid">
                  {[
                    ["fullName", "Full name"],
                    ["storeName", "Store or business name"],
                    ["phoneNumber", "Phone number"],
                    ["state", "State or location"],
                    ["city", "City"],
                  ].map(([field, label]) => (
                    <div key={field} className="marketplace-form-field">
                      <label htmlFor={`seller-${field}`}>{label}</label>
                      <input
                        id={`seller-${field}`}
                        value={form[field]}
                        onChange={(event) => updateField(field, event.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="marketplace-registration-section">
                <div className="marketplace-section__head">
                  <div>
                    <span className="marketplace-section__eyebrow">Settlement</span>
                    <h3>Bank and payout details</h3>
                  </div>
                </div>

                <div className="marketplace-form-grid">
                  {[
                    ["bankName", "Bank name"],
                    ["accountNumber", "Account number"],
                    ["accountName", "Account name"],
                  ].map(([field, label]) => (
                    <div key={field} className="marketplace-form-field">
                      <label htmlFor={`seller-${field}`}>{label}</label>
                      <input
                        id={`seller-${field}`}
                        value={form[field]}
                        onChange={(event) => updateField(field, event.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="marketplace-registration-section">
                <div className="marketplace-section__head">
                  <div>
                    <span className="marketplace-section__eyebrow">Address verification</span>
                    <h3>Home and office address</h3>
                  </div>
                </div>

                <div className="marketplace-form-grid">
                  <div className="marketplace-form-field marketplace-form-field--full">
                    <label htmlFor="seller-residential-address">Home address</label>
                    <textarea
                      id="seller-residential-address"
                      rows={4}
                      value={form.residentialAddress}
                      onChange={(event) => updateField("residentialAddress", event.target.value)}
                    />
                  </div>

                  <div className="marketplace-form-field marketplace-form-field--full">
                    <label htmlFor="seller-business-address">Office address</label>
                    <textarea
                      id="seller-business-address"
                      rows={4}
                      value={form.businessAddress}
                      onChange={(event) => updateField("businessAddress", event.target.value)}
                    />
                  </div>
                </div>
              </section>

              <section className="marketplace-registration-section">
                <div className="marketplace-section__head">
                  <div>
                    <span className="marketplace-section__eyebrow">Compliance</span>
                    <h3>CAC certificate and declaration</h3>
                  </div>
                </div>

                <div className="marketplace-form-grid">
                  <div className="marketplace-form-field marketplace-form-field--full">
                    <label htmlFor="seller-cac">CAC registration certificate</label>
                    <input
                      id="seller-cac"
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(event) => updateField("cacCertificate", event.target.files?.[0] || null)}
                    />
                    <p className="marketplace-muted">
                      Upload a PDF or clear image copy of the registered CAC certificate for admin review.
                    </p>
                    {seller?.cacCertificate?.secureUrl ? (
                      <a
                        className="marketplace-link"
                        href={seller.cacCertificate.secureUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View current CAC document
                      </a>
                    ) : null}
                  </div>

                  <div className="marketplace-form-field marketplace-form-field--full">
                    <label className="marketplace-checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(form.acceptedTerms)}
                        onChange={(event) => updateField("acceptedTerms", event.target.checked)}
                      />
                      <span>
                        I confirm these seller details are accurate and I agree to Tengacion&apos;s marketplace review process.
                      </span>
                    </label>
                  </div>
                </div>
              </section>

              <div className="marketplace-form-actions">
                <button
                  type="button"
                  className="marketplace-secondary-btn"
                  disabled={saving}
                  onClick={() => submitForm("draft")}
                >
                  {saving ? "Saving..." : "Save draft"}
                </button>
                {currentStatus === "rejected" ? (
                  <button
                    type="button"
                    className="marketplace-primary-btn"
                    disabled={saving}
                    onClick={() => submitForm("resubmit")}
                  >
                    {saving ? "Sending..." : "Resubmit application"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="marketplace-primary-btn"
                    disabled={saving || currentStatus === "pending_review"}
                    onClick={() => submitForm("submit")}
                  >
                    {saving ? "Sending..." : currentStatus === "pending_review" ? "Under review" : "Submit for review"}
                  </button>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </QuickAccessLayout>
  );
}
