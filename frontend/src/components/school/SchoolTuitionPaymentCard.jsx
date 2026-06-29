import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import PaystackSecureBadge from "../payments/PaystackSecureBadge";
import {
  fetchSchoolTuitionReceipt,
  getSchoolTuitionReceiptUrl,
  initializeSchoolTuitionPayment,
  verifySchoolTuitionPayment,
} from "../../services/schoolPageService";

const CLASS_OPTIONS = [
  "Nursery 1",
  "Nursery 2",
  "Nursery 3",
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
  "Junior Secondary 1",
  "Junior Secondary 2",
  "Junior Secondary 3",
];

const initialForm = {
  parentName: "",
  childName: "",
  childClass: "",
  bankName: "",
  email: "",
  homeAddress: "",
  phoneNumber: "",
  amount: "",
};

const formatMoney = (amount = 0, currency = "NGN") =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));

export default function SchoolTuitionPaymentCard({ slug, canonicalPath }) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [receiptAction, setReceiptAction] = useState("");
  const [receiptMessage, setReceiptMessage] = useState("");
  const [verification, setVerification] = useState({
    state: "idle",
    message: "",
    payment: null,
    reference: "",
  });

  const callbackReference = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("tuition") !== "verify") {
      return "";
    }
    return params.get("reference") || params.get("trxref") || "";
  }, []);

  const verifyPayment = useCallback(async (reference) => {
    if (!reference) {
      return;
    }
    setVerification((current) => ({
      ...current,
      state: "verifying",
      message: "Confirming this payment with Paystack...",
      reference,
    }));

    try {
      const result = await verifySchoolTuitionPayment(slug, reference);
      const payment = result?.payment || null;
      if (result?.verified && payment?.status === "paid") {
        setVerification({
          state: "success",
          message: "Payment confirmed and recorded for the school.",
          payment,
          reference,
        });
        toast.success("Tuition payment confirmed");
        return;
      }

      const isPending = ["initiated", "pending", "abandoned"].includes(payment?.status);
      setVerification({
        state: isPending ? "pending" : "failed",
        message: isPending
          ? "Paystack has not confirmed this payment yet. You can check again without paying twice."
          : "This payment could not be confirmed. Contact the school with the reference below if money left your account.",
        payment,
        reference,
      });
    } catch (error) {
      setVerification({
        state: "failed",
        message: error?.message || "Payment verification could not be completed.",
        payment: null,
        reference,
      });
    }
  }, [slug]);

  useEffect(() => {
    if (!callbackReference) {
      return;
    }
    document.getElementById("tuition-payment")?.scrollIntoView({ behavior: "smooth", block: "start" });
    verifyPayment(callbackReference);
  }, [callbackReference, verifyPayment]);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormMessage("");
    try {
      const result = await initializeSchoolTuitionPayment(slug, {
        ...form,
        amount: Number(form.amount),
        sourcePath: canonicalPath,
      });
      const checkoutUrl = result?.authorization_url || result?.checkoutUrl;
      if (!checkoutUrl) {
        throw new Error("Paystack did not return a checkout link.");
      }
      setFormMessage("Secure checkout is ready. Redirecting to Paystack...");
      window.location.assign(checkoutUrl);
    } catch (error) {
      const message = error?.details?.[0] || error?.message || "Could not start tuition payment.";
      setFormMessage(message);
      toast.error(message);
      setSubmitting(false);
    }
  };

  const startAnotherPayment = () => {
    setVerification({ state: "idle", message: "", payment: null, reference: "" });
    setForm(initialForm);
    setFormMessage("");
    setReceiptAction("");
    setReceiptMessage("");
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", canonicalPath || window.location.pathname);
    }
  };

  const receiptFileName = `tuition-receipt-${verification.reference || "payment"}.pdf`;

  const downloadReceipt = async () => {
    setReceiptAction("download");
    setReceiptMessage("");
    try {
      const blob = await fetchSchoolTuitionReceipt(slug, verification.reference);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = receiptFileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setReceiptMessage("Receipt downloaded to this device.");
      toast.success("Receipt downloaded");
    } catch (error) {
      const message = error?.message || "Could not download the receipt.";
      setReceiptMessage(message);
      toast.error(message);
    } finally {
      setReceiptAction("");
    }
  };

  const getAbsoluteReceiptUrl = () => {
    const path = getSchoolTuitionReceiptUrl(slug, verification.reference);
    return typeof window === "undefined" ? path : new URL(path, window.location.origin).toString();
  };

  const buildReceiptShareText = () => {
    const payment = verification.payment || {};
    return [
      `${payment.schoolName || "School"} tuition payment receipt`,
      `Learner: ${payment.childName || "-"}`,
      `Class: ${payment.childClass || "-"}`,
      `Amount: ${formatMoney(payment.amount, payment.currency)}`,
      `Paystack reference: ${verification.reference}`,
      `Receipt: ${getAbsoluteReceiptUrl()}`,
    ].join("\n");
  };

  const openWhatsAppReceipt = () => {
    const whatsAppUrl = `https://wa.me/?text=${encodeURIComponent(buildReceiptShareText())}`;
    window.open(whatsAppUrl, "_blank", "noopener,noreferrer");
  };

  const shareReceipt = async () => {
    setReceiptAction("share");
    setReceiptMessage("");
    try {
      const blob = await fetchSchoolTuitionReceipt(slug, verification.reference);
      const file = typeof File === "undefined"
        ? null
        : new File([blob], receiptFileName, { type: "application/pdf" });
      const sharePayload = file
        ? { files: [file], title: "Tuition payment receipt", text: buildReceiptShareText() }
        : null;
      const canShareFile = Boolean(
        sharePayload &&
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: sharePayload.files }))
      );

      if (canShareFile) {
        await navigator.share(sharePayload);
        setReceiptMessage("Receipt shared from this device.");
      } else {
        openWhatsAppReceipt();
        setReceiptMessage("WhatsApp opened with the secure receipt link.");
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
      const message = error?.message || "Could not share the receipt.";
      setReceiptMessage(message);
      toast.error(message);
    } finally {
      setReceiptAction("");
    }
  };

  const statusClass = verification.state === "success"
    ? "is-success"
    : verification.state === "failed"
      ? "is-error"
      : "is-pending";

  return (
    <div className="school-profile-tuition-card">
      <div className="school-profile-tuition-card__intro">
        <span className="school-profile-tuition-card__eyebrow">Online tuition payment</span>
        <h3>Pay school fees securely</h3>
        <p>
          Complete the learner and parent details, enter the approved amount, then continue to Paystack.
          Card, bank, USSD, and bank-transfer details are entered only on Paystack&apos;s secure checkout.
        </p>
        <PaystackSecureBadge />
        <ul>
          <li>The school receives a payment record with the Paystack reference.</li>
          <li>Payment is marked paid only after server-side Paystack verification.</li>
          <li>If confirmation is delayed, check the same reference before trying again.</li>
        </ul>
      </div>

      <div className="school-profile-tuition-card__body">
        {verification.state !== "idle" ? (
          <div className={`school-profile-tuition-status ${statusClass}`} role="status">
            <strong>
              {verification.state === "success"
                ? "Payment successful"
                : verification.state === "verifying"
                  ? "Verifying payment"
                  : verification.state === "pending"
                    ? "Confirmation pending"
                    : "Payment not confirmed"}
            </strong>
            <p>{verification.message}</p>
            {verification.payment ? (
              <div className="school-profile-tuition-status__summary">
                <span>{verification.payment.childName}</span>
                <span>{verification.payment.childClass}</span>
                <span>{formatMoney(verification.payment.amount, verification.payment.currency)}</span>
              </div>
            ) : null}
            <code>{verification.reference}</code>
            {verification.state === "success" ? (
              <div className="school-profile-tuition-receipt-actions">
                <button
                  type="button"
                  className="school-profile-btn school-profile-btn--primary"
                  onClick={downloadReceipt}
                  disabled={Boolean(receiptAction)}
                >
                  {receiptAction === "download" ? "Preparing PDF..." : "Download PDF receipt"}
                </button>
                <button
                  type="button"
                  className="school-profile-btn school-profile-btn--primary"
                  onClick={shareReceipt}
                  disabled={Boolean(receiptAction)}
                >
                  {receiptAction === "share" ? "Preparing share..." : "Share receipt"}
                </button>
                <button
                  type="button"
                  className="school-profile-btn"
                  onClick={openWhatsAppReceipt}
                >
                  Send with WhatsApp
                </button>
                <button
                  type="button"
                  className="school-profile-btn"
                  onClick={startAnotherPayment}
                >
                  Make another payment
                </button>
                {receiptMessage ? <p>{receiptMessage}</p> : null}
              </div>
            ) : (
              <button
                type="button"
                className="school-profile-btn school-profile-btn--primary"
                onClick={() => verifyPayment(verification.reference)}
                disabled={verification.state === "verifying"}
              >
                {verification.state === "verifying" ? "Checking..." : "Check payment again"}
              </button>
            )}
          </div>
        ) : null}

        {verification.state === "idle" ? (
          <form className="school-profile-tuition-form" onSubmit={submitPayment}>
          <label>
            <span>Name of parent/guardian</span>
            <input
              value={form.parentName}
              onChange={updateField("parentName")}
              autoComplete="name"
              required
            />
          </label>
          <label>
            <span>Name of child</span>
            <input value={form.childName} onChange={updateField("childName")} required />
          </label>
          <label>
            <span>Class of child</span>
            <select value={form.childClass} onChange={updateField("childClass")} required>
              <option value="">Select class</option>
              {CLASS_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <label>
            <span>Bank name</span>
            <input
              value={form.bankName}
              onChange={updateField("bankName")}
              placeholder="Bank you intend to pay from"
              required
            />
          </label>
          <label>
            <span>Email address</span>
            <input
              type="email"
              value={form.email}
              onChange={updateField("email")}
              autoComplete="email"
              required
            />
          </label>
          <label>
            <span>Phone number</span>
            <input
              type="tel"
              value={form.phoneNumber}
              onChange={updateField("phoneNumber")}
              autoComplete="tel"
              required
            />
          </label>
          <label>
            <span>Amount to pay (NGN)</span>
            <input
              type="number"
              min="100"
              max="10000000"
              step="100"
              value={form.amount}
              onChange={updateField("amount")}
              inputMode="decimal"
              required
            />
          </label>
          <label className="school-profile-tuition-form__full">
            <span>Home address</span>
            <textarea
              rows={3}
              value={form.homeAddress}
              onChange={updateField("homeAddress")}
              autoComplete="street-address"
              required
            />
          </label>
          <button
            className="school-profile-btn school-profile-btn--primary school-profile-tuition-form__full"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Preparing secure checkout..." : "Continue to Paystack"}
          </button>
          {formMessage ? <p className="school-profile-form-note school-profile-tuition-form__full">{formMessage}</p> : null}
          <p className="school-profile-tuition-form__privacy school-profile-tuition-form__full">
            Tengacion stores the details above for the school&apos;s payment records. We do not collect your card number,
            PIN, OTP, or online-banking password.
          </p>
          </form>
        ) : null}
      </div>
    </div>
  );
}
