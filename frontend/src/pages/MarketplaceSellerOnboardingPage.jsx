import { useCallback, useEffect, useState } from "react";
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

const emptyForm = {
  fullName: "",
  storeName: "",
  phoneNumber: "",
  bankName: "",
  accountNumber: "",
  accountName: "",
  residentialAddress: "",
  businessAddress: "",
  state: "",
  city: "",
  cacCertificate: null,
  acceptedTerms: false,
};

const toFormState = (seller = null) =>
  seller
    ? {
        fullName: seller.fullName || "",
        storeName: seller.storeName || "",
        phoneNumber: seller.phoneNumber || "",
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
    : emptyForm;

export default function MarketplaceSellerOnboardingPage() {
  const { user } = useAuth();
  const [seller, setSeller] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSeller = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchMyMarketplaceSellerProfile();
      setSeller(response?.seller || null);
      setForm(toFormState(response?.seller || null));
    } catch (err) {
      toast.error(err?.message || "Could not load your seller profile.");
    } finally {
      setLoading(false);
    }
  }, []);

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
      setForm(toFormState(response?.seller || null));
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

  return (
    <QuickAccessLayout
      user={user}
      title="Become a Seller"
      subtitle="Complete your verification details, upload your CAC certificate, and unlock your Tengacion storefront."
    >
      <div className="marketplace-page">
        {seller ? <SellerStatusBanner seller={seller} /> : null}

        {loading ? <div className="marketplace-loading-state">Loading seller profile...</div> : null}

        {!loading ? (
          <section className="marketplace-form-card">
            <div className="marketplace-panel__head">
              <div>
                <h3>Seller verification form</h3>
                <p className="marketplace-muted">
                  Fill every required field so Tengacion can review your storefront application confidently.
                </p>
              </div>
            </div>

            <div className="marketplace-form-grid">
              {[
                ["fullName", "Full name"],
                ["storeName", "Store or business name"],
                ["phoneNumber", "Phone number"],
                ["bankName", "Bank name"],
                ["accountNumber", "Account number"],
                ["accountName", "Account name"],
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

              <div className="marketplace-form-field marketplace-form-field--full">
                <label htmlFor="seller-residential-address">Residential address</label>
                <textarea
                  id="seller-residential-address"
                  rows={4}
                  value={form.residentialAddress}
                  onChange={(event) => updateField("residentialAddress", event.target.value)}
                />
              </div>

              <div className="marketplace-form-field marketplace-form-field--full">
                <label htmlFor="seller-business-address">Business address</label>
                <textarea
                  id="seller-business-address"
                  rows={4}
                  value={form.businessAddress}
                  onChange={(event) => updateField("businessAddress", event.target.value)}
                />
              </div>

              <div className="marketplace-form-field marketplace-form-field--full">
                <label htmlFor="seller-cac">CAC certificate upload</label>
                <input
                  id="seller-cac"
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(event) => updateField("cacCertificate", event.target.files?.[0] || null)}
                />
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
                  <span>I confirm these seller details are accurate and I agree to Tengacion&apos;s marketplace review process.</span>
                </label>
              </div>
            </div>

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
        ) : null}
      </div>
    </QuickAccessLayout>
  );
}
