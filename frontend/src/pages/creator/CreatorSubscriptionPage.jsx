import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { getPublicCreatorProfile, initPayment, resolveImage } from "../../api";
import { useAuth } from "../../context/AuthContext";

import "./creator-subscription.css";

const DEFAULT_PRICE = 2000;
const MAX_RETURN_CHECKS = 8;
const RETURN_CHECK_INTERVAL_MS = 3000;

const formatMoney = (value = 0) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export default function CreatorSubscriptionPage() {
  const { creatorId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paying, setPaying] = useState(false);
  const [checkingReturn, setCheckingReturn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const nextPayload = await getPublicCreatorProfile(creatorId);
        if (!cancelled) {
          setPayload(nextPayload || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to load this creator subscription page.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasPaystackCallback = params.has("reference") || params.has("trxref");
    if (!hasPaystackCallback || !creatorId) {
      return;
    }

    let cancelled = false;
    let attempts = 0;
    setCheckingReturn(true);

    const timer = window.setInterval(async () => {
      attempts += 1;
      try {
        const nextPayload = await getPublicCreatorProfile(creatorId);
        if (cancelled) {
          return;
        }
        setPayload(nextPayload || null);
        if (nextPayload?.subscription?.isSubscribed || attempts >= MAX_RETURN_CHECKS) {
          window.clearInterval(timer);
          setCheckingReturn(false);
          if (nextPayload?.subscription?.isSubscribed) {
            setPaymentError("");
            setPaying(false);
            toast.success("Subscription active. Full creator streams and downloads are ready.");
          }
        }
      } catch {
        if (attempts >= MAX_RETURN_CHECKS) {
          window.clearInterval(timer);
          if (!cancelled) {
            setCheckingReturn(false);
          }
        }
      }
    }, RETURN_CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [creatorId, location.search]);

  const creator = payload?.creator || null;
  const subscription = payload?.subscription || {};
  const price = Number(subscription?.price || creator?.subscriptionPrice || DEFAULT_PRICE) || DEFAULT_PRICE;
  const isSubscribed = Boolean(subscription?.isSubscribed);
  const benefitCopy =
    subscription?.description
    || "Supporters unlock endless streams, premium downloads, and direct support access from the creator page.";
  const accessUntilLabel = useMemo(() => {
    if (!subscription?.accessExpiresAt) {
      return "";
    }
    try {
      return new Intl.DateTimeFormat("en-NG", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(subscription.accessExpiresAt));
    } catch {
      return "";
    }
  }, [subscription?.accessExpiresAt]);

  const handleCheckout = async () => {
    if (!creatorId) {
      return;
    }

    try {
      setPaying(true);
      setPaymentError("");
      const returnUrl = `${window.location.origin}${location.pathname}`;
      const payment = await initPayment({
        itemType: "subscription",
        itemId: creatorId,
        returnUrl,
      });
      if (!payment?.authorization_url) {
        throw new Error("Payment link is missing");
      }
      toast.success("Secure checkout opened. Complete the card authorization to unlock this creator page.");
      window.location.assign(payment.authorization_url);
    } catch (err) {
      const requiresStepUp = err?.details?.code === "STEP_UP_REQUIRED";
      setPaymentError(
        requiresStepUp
          ? "Secure checkout needs an extra verification step on your account before payment can start."
          : err?.message || "Failed to start secure checkout."
      );
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="creator-subscription-page">
        <div className="creator-subscription-status">
          <h2>Loading subscription checkout</h2>
          <p>Preparing the creator membership page and secure payment handoff.</p>
        </div>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="creator-subscription-page">
        <div className="creator-subscription-status creator-subscription-status--error">
          <h2>Subscription page unavailable</h2>
          <p>{error || "We could not load this creator membership page right now."}</p>
          <Link className="creator-subscription__back-link" to="/home">
            Return home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="creator-subscription-page">
      <div className="creator-subscription-shell">
        <section className="creator-subscription-hero">
          <div className="creator-subscription-hero__media">
            {creator?.avatarUrl ? (
              <img
                src={resolveImage(creator.avatarUrl)}
                alt={creator.displayName}
              />
            ) : (
              <span>{creator.displayName?.slice(0, 1) || "C"}</span>
            )}
          </div>

          <div className="creator-subscription-hero__copy">
            <p className="creator-subscription__eyebrow">Creator Membership</p>
            <h1>{creator.displayName}</h1>
            <p className="creator-subscription-hero__summary">
              Unlock endless creator streams and premium downloads with a secure
              monthly fan pass.
            </p>
            <div className="creator-subscription-hero__meta">
              <span>{formatMoney(price)}/month</span>
              <span>{Number(payload?.stats?.totalTracks || 0)} tracks</span>
              <span>{Number(payload?.stats?.totalBooks || 0)} books</span>
              <span>{Number(payload?.stats?.totalEpisodes || 0)} episodes</span>
            </div>
          </div>
        </section>

        <div className="creator-subscription-layout">
          <section className="creator-subscription-panel creator-subscription-panel--details">
            <div className="creator-subscription-panel__head">
              <div>
                <p className="creator-subscription__eyebrow">What unlocks</p>
                <h2>Supporter access at {formatMoney(price)}/month</h2>
              </div>
            </div>

            <p className="creator-subscription-panel__body">
              {benefitCopy}
            </p>

            <div className="creator-subscription-benefits">
              <div>
                <strong>Unlimited streaming</strong>
                <span>Play full tracks, albums, podcasts, and videos across this creator page.</span>
              </div>
              <div>
                <strong>Premium downloads</strong>
                <span>Download unlocked books, tracks, videos, and albums after payment is confirmed.</span>
              </div>
              <div>
                <strong>Secure card checkout</strong>
                <span>ATM card number, expiry, CVV, and OTP are collected inside encrypted Paystack checkout.</span>
              </div>
            </div>

            <div className="creator-subscription-fields">
              <label>
                <span>Cardholder name</span>
                <input type="text" value={user?.name || creator.displayName || ""} readOnly />
              </label>
              <label>
                <span>Billing email</span>
                <input type="email" value={user?.email || ""} readOnly />
              </label>
              <label>
                <span>Charge amount</span>
                <input type="text" value={`${formatMoney(price)} monthly`} readOnly />
              </label>
              <label>
                <span>Secure card entry</span>
                <input type="text" value="Complete card details in Paystack checkout" readOnly />
              </label>
            </div>
          </section>

          <aside className="creator-subscription-panel creator-subscription-panel--checkout">
            <div className="creator-subscription-panel__head">
              <div>
                <p className="creator-subscription__eyebrow">Checkout</p>
                <h2>{isSubscribed ? "Subscription active" : "Ready to subscribe"}</h2>
              </div>
            </div>

            <div className="creator-subscription-checkout-card">
              <strong>{formatMoney(price)}/month</strong>
              <span>
                The charge only succeeds when the selected card can authorize the
                {` ${formatMoney(price)} `}
                deduction.
              </span>
            </div>

            {isSubscribed ? (
              <div className="creator-subscription-active">
                <strong>Access unlocked</strong>
                <span>
                  Full streaming and premium downloads are active on this creator page.
                </span>
                {accessUntilLabel ? <small>Active until {accessUntilLabel}</small> : null}
              </div>
            ) : null}

            {checkingReturn ? (
              <div className="creator-subscription-returning">
                <strong>Confirming payment</strong>
                <span>We’re checking your payment and unlocking the creator page now.</span>
              </div>
            ) : null}

            {paymentError ? (
              <p className="creator-subscription-error">{paymentError}</p>
            ) : null}

            <div className="creator-subscription-actions">
              {isSubscribed ? (
                <button
                  type="button"
                  className="creator-subscription__primary"
                  onClick={() => navigate(`/creators/${creator.id}`)}
                >
                  Open creator page
                </button>
              ) : (
                <button
                  type="button"
                  className="creator-subscription__primary"
                  onClick={handleCheckout}
                  disabled={paying}
                >
                  {paying ? "Redirecting to secure checkout..." : `Continue with ${formatMoney(price)}/month`}
                </button>
              )}

              <Link className="creator-subscription__secondary" to={`/creators/${creator.id}`}>
                Back to creator page
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
