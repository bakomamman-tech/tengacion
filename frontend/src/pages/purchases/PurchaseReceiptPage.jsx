import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getPurchaseReceipt } from "../../api";
import PaymentRecoveryNotice from "../../components/payments/PaymentRecoveryNotice";
import PaymentSummaryPanel from "../../components/payments/PaymentSummaryPanel";
import PaymentTrustPanel from "../../components/payments/PaymentTrustPanel";
import PaystackSecureBadge from "../../components/payments/PaystackSecureBadge";

const formatDateTime = (value) => {
  if (!value) {
    return "Pending";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Pending";
  }
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const statusCopy = {
  abandoned: "This checkout was abandoned. Retry verification before starting a new payment.",
  failed: "Payment was not confirmed. If money left your account, contact support with the reference.",
  initiated: "Checkout has started but Paystack has not confirmed payment.",
  paid: "Payment verified and access is active.",
  pending: "Paystack verification is still pending.",
  refunded: "This purchase was refunded and access may no longer be active.",
};

export default function PurchaseReceiptPage() {
  const { purchaseId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadReceipt = async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await getPurchaseReceipt(purchaseId);
        if (!cancelled) {
          setReceipt(payload?.receipt || payload || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Could not load this receipt.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadReceipt();
    return () => {
      cancelled = true;
    };
  }, [purchaseId]);

  const status = String(receipt?.status || receipt?.paymentStatus || "pending").toLowerCase();
  const canOpenContent = ["paid", "verified", "success"].includes(status);
  const timeline = useMemo(
    () => (Array.isArray(receipt?.timeline) ? receipt.timeline : []).slice().reverse(),
    [receipt?.timeline]
  );

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <div className="rounded-[2rem] border border-stone-200 bg-white/80 p-6 text-sm text-slate-600 shadow-sm">
          Loading receipt...
        </div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <PaymentRecoveryNotice
          title="Receipt unavailable"
          message={error || "We could not load this purchase receipt."}
          supportPath="/contact"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5 px-4 py-8">
      <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-[linear-gradient(180deg,#fffdf7_0%,#f4efe2_100%)] p-6 shadow-[0_24px_80px_rgba(58,42,18,0.14)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-700">
              Purchase receipt
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{receipt.itemTitle || "Tengacion purchase"}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              {statusCopy[status] || "Purchase status is visible here after checkout."}
            </p>
          </div>
          <PaystackSecureBadge />
        </div>
      </section>

      <PaymentSummaryPanel
        amount={receipt.amount || 0}
        currency={receipt.currency || "NGN"}
        itemLabel={receipt.itemTitle || "Purchase"}
        itemType={receipt.itemType || ""}
        platformFeeAmount={receipt.feeSummary?.platformFeeIncluded}
        platformFeeLabel="Tengacion revenue share"
        processingFeeAmount={receipt.feeSummary?.processingFeeDeducted}
        netRevenueAmount={receipt.feeSummary?.netRevenue}
        platformFeeExplanation={receipt.feeSummary?.explanation}
      />

      {["failed", "abandoned"].includes(status) ? (
        <PaymentRecoveryNotice
          title="Payment recovery"
          message={statusCopy[status]}
          reference={receipt.reference || receipt.providerRef}
        />
      ) : null}

      <section className="grid gap-3 rounded-[2rem] border border-stone-200 bg-white/85 p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
            <strong className="mt-1 block capitalize text-slate-900">{status}</strong>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Reference</p>
            <strong className="mt-1 block break-all text-slate-900">{receipt.reference || receipt.providerRef || "Pending"}</strong>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Paid at</p>
            <strong className="mt-1 block text-slate-900">{formatDateTime(receipt.paidAt)}</strong>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Created</p>
            <strong className="mt-1 block text-slate-900">{formatDateTime(receipt.createdAt)}</strong>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          {canOpenContent ? (
            <Link className="rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white" to={receipt.itemRoute || "/purchases"}>
              Open content
            </Link>
          ) : (
            <Link className="rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white" to="/purchases">
              Review order status
            </Link>
          )}
          <Link className="rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700" to="/purchases">
            My purchases
          </Link>
        </div>
      </section>

      <PaymentTrustPanel compact purchasesPath="/purchases" />

      {timeline.length ? (
        <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Order status timeline</h2>
          <div className="mt-4 grid gap-3">
            {timeline.map((entry) => (
              <div key={entry.id || `${entry.type}-${entry.createdAt}`} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <strong className="text-sm text-slate-900">{entry.label || entry.type || "Purchase update"}</strong>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(entry.createdAt)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
