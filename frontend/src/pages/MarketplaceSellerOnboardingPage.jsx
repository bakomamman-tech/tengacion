import { useCallback, useEffect, useMemo, useState } from "react";
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
  { label: "Full name", value: user?.name || "Not added yet", present: Boolean(user?.name) },
  {
    label: "Username",
    value: user?.username ? `@${user.username}` : "Not added yet",
    present: Boolean(user?.username),
  },
  { label: "Email", value: user?.email || "Not added yet", present: Boolean(user?.email) },
  { label: "Mobile number", value: user?.phone || "Not added yet", present: Boolean(user?.phone) },
  { label: "Country", value: user?.country || "Not added yet", present: Boolean(user?.country) },
  {
    label: "State of origin",
    value: user?.stateOfOrigin || "Not added yet",
    present: Boolean(user?.stateOfOrigin),
  },
  { label: "Gender", value: user?.gender || "Not added yet", present: Boolean(user?.gender) },
  { label: "Date of birth", value: formatDateLabel(user?.dob), present: Boolean(user?.dob) },
];

const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Federal Capital Territory",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

const NIGERIAN_BANKS = [
  "Access Bank",
  "Citibank Nigeria",
  "Ecobank Nigeria",
  "Fidelity Bank",
  "First Bank of Nigeria",
  "First City Monument Bank",
  "Globus Bank",
  "Guaranty Trust Bank",
  "Keystone Bank",
  "Kuda Microfinance Bank",
  "Moniepoint Microfinance Bank",
  "Opay Digital Services",
  "PalmPay",
  "Polaris Bank",
  "Providus Bank",
  "Stanbic IBTC Bank",
  "Standard Chartered Bank Nigeria",
  "Sterling Bank",
  "SunTrust Bank",
  "Titan Trust Bank",
  "Union Bank of Nigeria",
  "United Bank for Africa",
  "Unity Bank",
  "Wema Bank",
  "Zenith Bank",
];

const CITY_SUGGESTIONS = [
  "Abuja",
  "Abeokuta",
  "Asaba",
  "Benin City",
  "Calabar",
  "Enugu",
  "Ibadan",
  "Ikeja",
  "Ilorin",
  "Jos",
  "Kaduna",
  "Kano",
  "Lekki",
  "Lagos Island",
  "Port Harcourt",
  "Uyo",
  "Yaba",
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
  const hasCacDocument = Boolean(
    form.cacCertificate ||
      seller?.cacCertificate?.secureUrl ||
      seller?.cacCertificate?.url
  );
  const bankOptions = useMemo(
    () => [...new Set([form.bankName, ...NIGERIAN_BANKS].filter(Boolean))],
    [form.bankName]
  );
  const completion = useMemo(() => {
    const requiredChecks = [
      form.fullName,
      form.storeName,
      form.phoneNumber,
      form.bankName,
      form.accountNumber,
      form.accountName,
      form.residentialAddress,
      form.businessAddress,
      form.state,
      form.city,
      hasCacDocument,
      form.acceptedTerms,
    ];
    const completed = requiredChecks.filter(Boolean).length;
    return {
      completed,
      total: requiredChecks.length,
      percent: Math.round((completed / requiredChecks.length) * 100),
    };
  }, [form, hasCacDocument]);

  return (
    <QuickAccessLayout
      user={user}
      title="Marketplace Registration"
      subtitle="Register your seller profile with Tengacion account details, payout information, verified addresses, and your CAC document."
      showAppSidebar={false}
      showRightRail={false}
      showHero={false}
      shellClassName="quick-access-shell--marketplace"
      mainClassName="quick-access-main--marketplace"
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

              <div className="marketplace-registration-progress" aria-label="Seller registration completion">
                <div className="marketplace-registration-progress__top">
                  <strong>Seller readiness</strong>
                  <span>{completion.percent}%</span>
                </div>
                <div className="marketplace-registration-progress__bar" aria-hidden="true">
                  <span style={{ width: `${completion.percent}%` }} />
                </div>
                <p>
                  {completion.completed} of {completion.total} review fields are complete.
                </p>
              </div>

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
                  <span className="marketplace-btn__icon" aria-hidden="true">
                    &lt;
                  </span>
                  Back to marketplace
                </Link>
                <Link className="marketplace-ghost-btn" to="/marketplace/dashboard">
                  <span className="marketplace-btn__icon" aria-hidden="true">
                    &gt;
                  </span>
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
                    <article
                      key={entry.label}
                      className={`marketplace-registration-account-card${entry.present ? "" : " is-missing"}`}
                    >
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
                  <div className="marketplace-form-field">
                    <div className="marketplace-form-field__top">
                      <label htmlFor="seller-fullName">Legal full name</label>
                      <span>Required</span>
                    </div>
                    <input
                      id="seller-fullName"
                      name="fullName"
                      value={form.fullName}
                      autoComplete="name"
                      required
                      onChange={(event) => updateField("fullName", event.target.value)}
                    />
                    <p className="marketplace-field-hint">Use the name that matches your bank and account identity.</p>
                  </div>

                  <div className="marketplace-form-field">
                    <div className="marketplace-form-field__top">
                      <label htmlFor="seller-storeName">Store or business name</label>
                      <span>Required</span>
                    </div>
                    <input
                      id="seller-storeName"
                      name="storeName"
                      value={form.storeName}
                      autoComplete="organization"
                      required
                      onChange={(event) => updateField("storeName", event.target.value)}
                    />
                    <p className="marketplace-field-hint">This is the storefront name buyers will see after approval.</p>
                  </div>

                  <div className="marketplace-form-field">
                    <div className="marketplace-form-field__top">
                      <label htmlFor="seller-phoneNumber">Phone number</label>
                      <span>Required</span>
                    </div>
                    <input
                      id="seller-phoneNumber"
                      name="phoneNumber"
                      type="tel"
                      value={form.phoneNumber}
                      autoComplete="tel"
                      inputMode="tel"
                      required
                      onChange={(event) => updateField("phoneNumber", event.target.value)}
                    />
                    <p className="marketplace-field-hint">Use a reachable Nigerian number for admin review and buyer issues.</p>
                  </div>

                  <div className="marketplace-form-field">
                    <div className="marketplace-form-field__top">
                      <label htmlFor="seller-state">Operating state</label>
                      <span>Required</span>
                    </div>
                    <select
                      id="seller-state"
                      name="state"
                      value={form.state}
                      autoComplete="address-level1"
                      required
                      onChange={(event) => updateField("state", event.target.value)}
                    >
                      <option value="">Select operating state</option>
                      {NIGERIAN_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                    <p className="marketplace-field-hint">Choose where the store mainly operates from.</p>
                  </div>

                  <div className="marketplace-form-field marketplace-form-field--full">
                    <div className="marketplace-form-field__top">
                      <label htmlFor="seller-city">City or service area</label>
                      <span>Required</span>
                    </div>
                    <input
                      id="seller-city"
                      name="city"
                      list="seller-city-suggestions"
                      value={form.city}
                      autoComplete="address-level2"
                      required
                      onChange={(event) => updateField("city", event.target.value)}
                    />
                    <datalist id="seller-city-suggestions">
                      {CITY_SUGGESTIONS.map((city) => (
                        <option key={city} value={city} />
                      ))}
                    </datalist>
                    <p className="marketplace-field-hint">Add the city buyers should associate with your pickup or delivery base.</p>
                  </div>
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
                  <div className="marketplace-form-field">
                    <div className="marketplace-form-field__top">
                      <label htmlFor="seller-bankName">Bank name</label>
                      <span>Required</span>
                    </div>
                    <select
                      id="seller-bankName"
                      name="bankName"
                      value={form.bankName}
                      autoComplete="organization"
                      required
                      onChange={(event) => updateField("bankName", event.target.value)}
                    >
                      <option value="">Select payout bank</option>
                      {bankOptions.map((bank) => (
                        <option key={bank} value={bank}>
                          {bank}
                        </option>
                      ))}
                    </select>
                    <p className="marketplace-field-hint">Select the bank that will receive marketplace settlements.</p>
                  </div>

                  <div className="marketplace-form-field">
                    <div className="marketplace-form-field__top">
                      <label htmlFor="seller-accountNumber">Account number</label>
                      <span>10-20 digits</span>
                    </div>
                    <input
                      id="seller-accountNumber"
                      name="accountNumber"
                      value={form.accountNumber}
                      autoComplete="off"
                      inputMode="numeric"
                      maxLength={20}
                      pattern="[0-9]{10,20}"
                      required
                      onChange={(event) =>
                        updateField("accountNumber", event.target.value.replace(/\D/g, "").slice(0, 20))
                      }
                    />
                    <p className="marketplace-field-hint">Numbers only. Admin review checks this before approval.</p>
                  </div>

                  <div className="marketplace-form-field marketplace-form-field--full">
                    <div className="marketplace-form-field__top">
                      <label htmlFor="seller-accountName">Account name</label>
                      <span>Required</span>
                    </div>
                    <input
                      id="seller-accountName"
                      name="accountName"
                      value={form.accountName}
                      autoComplete="name"
                      required
                      onChange={(event) => updateField("accountName", event.target.value)}
                    />
                    <p className="marketplace-field-hint">Enter the exact name attached to the payout account.</p>
                  </div>
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
                    <div className="marketplace-form-field__top">
                      <label htmlFor="seller-residential-address">Home address</label>
                      <span>Required</span>
                    </div>
                    <textarea
                      id="seller-residential-address"
                      name="residentialAddress"
                      rows={4}
                      value={form.residentialAddress}
                      autoComplete="street-address"
                      maxLength={300}
                      required
                      onChange={(event) => updateField("residentialAddress", event.target.value)}
                    />
                    <p className="marketplace-field-hint">Include house number, street, area, city, and state.</p>
                  </div>

                  <div className="marketplace-form-field marketplace-form-field--full">
                    <div className="marketplace-form-field__top">
                      <label htmlFor="seller-business-address">Office or pickup address</label>
                      <span>Required</span>
                    </div>
                    <textarea
                      id="seller-business-address"
                      name="businessAddress"
                      rows={4}
                      value={form.businessAddress}
                      autoComplete="street-address"
                      maxLength={300}
                      required
                      onChange={(event) => updateField("businessAddress", event.target.value)}
                    />
                    <p className="marketplace-field-hint">Use the verified office, warehouse, or pickup address for this store.</p>
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
                    <div className="marketplace-form-field__top">
                      <label htmlFor="seller-cac">CAC registration certificate</label>
                      <span>{hasCacDocument ? "On file" : "Required"}</span>
                    </div>
                    <input
                      id="seller-cac"
                      name="cacCertificate"
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      onChange={(event) => updateField("cacCertificate", event.target.files?.[0] || null)}
                    />
                    <p className="marketplace-field-hint">
                      Upload a PDF, JPG, PNG, or WEBP copy of the registered CAC certificate for admin review.
                    </p>
                    {form.cacCertificate ? (
                      <p className="marketplace-field-value-note">{form.cacCertificate.name}</p>
                    ) : null}
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
                    <label className="marketplace-checkbox marketplace-checkbox--statement">
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
                  <span className="marketplace-btn__icon" aria-hidden="true">
                    +
                  </span>
                  {saving ? "Saving..." : "Save draft"}
                </button>
                {currentStatus === "rejected" ? (
                  <button
                    type="button"
                    className="marketplace-primary-btn"
                    disabled={saving}
                    onClick={() => submitForm("resubmit")}
                  >
                    <span className="marketplace-btn__icon" aria-hidden="true">
                      &gt;
                    </span>
                    {saving ? "Sending..." : "Resubmit application"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="marketplace-primary-btn"
                    disabled={saving || currentStatus === "pending_review"}
                    onClick={() => submitForm("submit")}
                  >
                    <span className="marketplace-btn__icon" aria-hidden="true">
                      &gt;
                    </span>
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
