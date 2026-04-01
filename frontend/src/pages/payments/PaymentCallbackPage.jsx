import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { checkEntitlement, verifyPaystackPayment } from "../../api";
import { normalizePurchaseType, safeReturnTo } from "../../utils/purchaseUx";

const MAX_ATTEMPTS = 8;
const RETRY_DELAY_MS = 2500;

const normalizeLabel = (value = "") => {
  const type = normalizePurchaseType(value);
  if (type === "track") {
    return "music";
  }
  if (type === "book") {
    return "books";
  }
  if (type === "podcast") {
    return "podcasts";
  }
  return type || "purchases";
};

export default function PaymentCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const retryTimerRef = useRef(null);
  const attemptsRef = useRef(0);

  const params = new URLSearchParams(location.search);
  const reference = params.get("reference") || params.get("trxref") || "";
  const returnTo = safeReturnTo(params.get("returnTo") || "/purchases");
  const itemType = normalizePurchaseType(params.get("itemType") || "");
  const itemId = params.get("itemId") || "";

  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("Verifying your payment with Paystack...");
  const [detail, setDetail] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const clearRetry = () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const completeRedirect = () => {
      clearRetry();
      window.setTimeout(() => {
        if (!cancelled) {
          navigate(returnTo, { replace: true });
        }
      }, 1200);
    };

    const verify = async () => {
      if (!reference) {
        setStatus("failed");
        setMessage("Payment reference is missing.");
        setDetail("Please return to the content page and try again.");
        return;
      }

      try {
        setStatus("verifying");
        setMessage("Verifying your payment with Paystack...");
        setDetail("We do not unlock content until the backend confirms the payment.");

        const result = await verifyPaystackPayment(reference);
        if (cancelled) {
          return;
        }

        const paymentStatus = String(result?.status || result?.payment?.status || "").toLowerCase();
        const accessGranted = Boolean(
          result?.accessGranted
          || paymentStatus === "success"
          || String(result?.payment?.status || "").toLowerCase() === "success"
        );

        if (accessGranted) {
          if (itemType && itemId) {
            const entitlement = await checkEntitlement({ itemType, itemId });
            if (cancelled) {
              return;
            }

            if (!entitlement?.entitled) {
              attemptsRef.current += 1;
              if (attemptsRef.current < MAX_ATTEMPTS) {
                setStatus("pending");
                setMessage("Your payment was verified, and the entitlement is still syncing.");
                setDetail("We're checking again in a moment so your library opens cleanly.");
                retryTimerRef.current = window.setTimeout(verify, RETRY_DELAY_MS);
                return;
              }
            }
          }

          setStatus("success");
          setMessage("Payment verified. Your access is now active.");
          setDetail(`You will be returned to ${normalizeLabel(itemType)} in a moment.`);
          completeRedirect();
          return;
        }

        if (paymentStatus === "pending" || paymentStatus === "abandoned") {
          attemptsRef.current += 1;
          if (attemptsRef.current < MAX_ATTEMPTS) {
            setStatus("pending");
            setMessage("Paystack is still confirming the payment.");
            setDetail("Please wait a moment while we check again.");
            retryTimerRef.current = window.setTimeout(verify, RETRY_DELAY_MS);
            return;
          }
        }

        setStatus("failed");
        setMessage("We could not confirm this payment yet.");
        setDetail("Please try again or open your purchases page to check the latest status.");
      } catch (error) {
        if (cancelled) {
          return;
        }

        attemptsRef.current += 1;
        if (attemptsRef.current < MAX_ATTEMPTS) {
          setStatus("pending");
          setMessage("We are still trying to confirm your payment.");
          setDetail(error?.message || "The verification endpoint did not respond cleanly.");
          retryTimerRef.current = window.setTimeout(verify, RETRY_DELAY_MS);
          return;
        }

        setStatus("failed");
        setMessage(error?.message || "Payment verification failed.");
        setDetail("Please retry verification or check your purchases page.");
      }
    };

    attemptsRef.current = 0;
    verify();
    return () => {
      cancelled = true;
      clearRetry();
    };
  }, [itemId, itemType, navigate, reference, retryNonce, returnTo]);

  const statusTone = status === "success" ? "success" : status === "failed" ? "error" : "pending";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-3xl items-center px-4 py-10">
      <section className="w-full overflow-hidden rounded-[2rem] border border-stone-200 bg-[linear-gradient(180deg,#fffdf7_0%,#f6efe2_100%)] shadow-[0_24px_80px_rgba(58,42,18,0.14)]">
        <div className="border-b border-brand-200/60 bg-[radial-gradient(circle_at_top_right,rgba(24,86,53,0.12),transparent_42%)] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-700">
            Paystack payment callback
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Confirming your purchase</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            We verify the payment with Tengacion's backend before unlocking access. Nothing is granted locally until the server confirms the transaction.
          </p>
        </div>

        <div className="grid gap-4 p-8">
          <div
            className={`rounded-2xl border px-4 py-4 ${
              statusTone === "success"
                ? "border-emerald-200 bg-emerald-50/90 text-emerald-900"
                : statusTone === "error"
                  ? "border-rose-200 bg-rose-50/90 text-rose-900"
                  : "border-brand-200 bg-white/85 text-slate-900"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Status</p>
            <div className="mt-2 flex items-center gap-3">
              {status === "verifying" || status === "pending" ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-700" />
              ) : null}
              <strong className="text-lg">{message}</strong>
            </div>
            {detail ? <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Reference</p>
              <p className="mt-1 break-all text-sm font-semibold text-slate-900">{reference || "Missing reference"}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Return to</p>
              <p className="mt-1 break-all text-sm font-semibold text-slate-900">{returnTo}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-2xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(15,64,39,0.2)] transition hover:bg-brand-700"
              onClick={() => {
                attemptsRef.current = 0;
                setRetryNonce((value) => value + 1);
                setStatus("verifying");
                setMessage("Verifying your payment with Paystack...");
                setDetail("We're checking the backend again now.");
              }}
              disabled={status === "success"}
            >
              {status === "verifying" || status === "pending" ? "Checking again..." : "Retry verification"}
            </button>
            <Link
              className="inline-flex items-center justify-center rounded-2xl border border-brand-200 bg-white/90 px-5 py-2.5 text-sm font-semibold text-brand-900 transition hover:bg-white"
              to="/purchases"
            >
              Open my purchases
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white/80 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
              to={returnTo}
            >
              Return to content
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
