import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getTengaAgentBillingPlans,
  getTengaAgentOwnerBilling,
  redirectToTengaAgentCheckout,
  startTengaAgentPlanCheckout,
  verifyTengaAgentPlanCheckout,
} from "../../services/tengaAgentBillingApi";
import TengaAgentPilotReadinessPanel from "./TengaAgentPilotReadinessPanel";

const formatLimit = (value) =>
  value === null || value === undefined
    ? "Unlimited"
    : Number(value).toLocaleString();

const formatPrice = (amount, currency) => {
  if (!Number.isFinite(Number(amount))) return "Unavailable";

  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
};

const formatDate = (value) => {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const clearBillingReturnParams = () => {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  [
    "billing",
    "provider",
    "reference",
    "session_id",
    "status",
    "trxref",
  ].forEach((key) => url.searchParams.delete(key));

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", nextUrl);
};

export default function TengaAgentBillingPanel({ user }) {
  const [billing, setBilling] = useState(null);
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlansLoading, setIsPlansLoading] = useState(false);
  const [error, setError] = useState("");
  const [plansError, setPlansError] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("NGN");
  const [selectedPlan, setSelectedPlan] = useState("starter");
  const [isCheckoutStarting, setIsCheckoutStarting] = useState(false);
  const [isCheckoutVerifying, setIsCheckoutVerifying] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const returnVerificationStarted = useRef(false);

  const loadBilling = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await getTengaAgentOwnerBilling();
      setBilling(response?.billing || null);
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent billing status could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const loadPlans = useCallback(async () => {
    if (!user) return;

    setIsPlansLoading(true);
    setPlansError("");

    try {
      const response = await getTengaAgentBillingPlans();
      const nextPlans = Array.isArray(response?.plans) ? response.plans : [];
      if (!nextPlans.length) {
        throw new Error("No TengaAgent self-service plans are available.");
      }
      setPlans(nextPlans);
    } catch (requestError) {
      setPlans([]);
      setPlansError(
        requestError?.message ||
          "TengaAgent plan pricing could not be loaded."
      );
    } finally {
      setIsPlansLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadBilling();
    loadPlans();
  }, [loadBilling, loadPlans]);

  useEffect(() => {
    if (!plans.length) return;

    const available = plans.filter(
      (plan) => Number.isFinite(Number(plan.prices?.[selectedCurrency]))
    );

    if (!available.some((plan) => plan.code === selectedPlan)) {
      setSelectedPlan(available[0]?.code || "");
    }
  }, [plans, selectedCurrency, selectedPlan]);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    if (returnVerificationStarted.current) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") !== "return") return;

    returnVerificationStarted.current = true;
    const status = String(params.get("status") || "").toLowerCase();
    const reference = String(
      params.get("reference") || params.get("trxref") || ""
    ).trim();

    if (status === "cancelled") {
      setCheckoutMessage("Checkout was cancelled. Your current TengaAgent plan was not changed.");
      clearBillingReturnParams();
      return;
    }

    if (!reference) {
      setCheckoutError(
        "The payment provider returned without a TengaAgent payment reference."
      );
      clearBillingReturnParams();
      return;
    }

    const verifyReturnedCheckout = async () => {
      setIsCheckoutVerifying(true);
      setCheckoutError("");
      setCheckoutMessage("");

      try {
        await verifyTengaAgentPlanCheckout(reference);
        setCheckoutMessage(
          "Payment verified. Your TengaAgent prepaid plan is active for the paid period."
        );
        await loadBilling();
      } catch (requestError) {
        setCheckoutError(
          requestError?.message ||
            "TengaAgent could not verify the returned payment."
        );
      } finally {
        setIsCheckoutVerifying(false);
        clearBillingReturnParams();
      }
    };

    verifyReturnedCheckout();
  }, [loadBilling, user]);

  const startCheckout = async () => {
    const plan = plans.find(
      (candidate) => candidate.code === selectedPlan
    );
    const amount = plan?.prices?.[selectedCurrency];

    if (!plan || !Number.isFinite(Number(amount))) {
      setCheckoutError(
        "That TengaAgent plan is not available in the selected currency."
      );
      return;
    }

    setIsCheckoutStarting(true);
    setCheckoutError("");
    setCheckoutMessage("");

    try {
      const response = await startTengaAgentPlanCheckout({
        planCode: plan.code,
        currency: selectedCurrency,
      });
      redirectToTengaAgentCheckout(response?.checkout?.checkoutUrl);
    } catch (requestError) {
      setCheckoutError(
        requestError?.message ||
          "TengaAgent checkout could not be started."
      );
      setIsCheckoutStarting(false);
    }
  };

  if (!user) {
    return null;
  }

  if ((isLoading && !billing) || (isPlansLoading && !plans.length)) {
    return (
      <div className="tengaagent-owner__loading">
        Loading plan usage and pricing…
      </div>
    );
  }

  if (error && !billing) {
    return (
      <div
        className="tengaagent-owner__notice tengaagent-owner__notice--error"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!billing) {
    return null;
  }

  const conversationsUsed =
    Number(billing.usage?.conversationsStarted || 0);
  const conversationLimit =
    billing.entitlements?.monthlyConversations ?? null;
  const agentsUsed = Number(billing.usage?.agentsUsed || 0);
  const agentLimit = billing.entitlements?.agents ?? null;
  const availablePlans = plans.filter(
    (plan) => Number.isFinite(Number(plan.prices?.[selectedCurrency]))
  );
  const selectedPlanRecord = plans.find(
    (plan) => plan.code === selectedPlan
  );
  const selectedAmount = selectedPlanRecord?.prices?.[selectedCurrency];
  const sameActivePlan =
    billing.allowed === true &&
    billing.renewalMode === "prepaid" &&
    billing.planCode === selectedPlan;
  const checkoutBusy = isCheckoutStarting || isCheckoutVerifying;
  const checkoutUnavailable = !availablePlans.length || Boolean(plansError);

  return (
    <>
      <section
        className="tengaagent-owner__publication"
        aria-labelledby="tengaagent-billing-title"
      >
        <div>
          <span className="tengaagent-owner__publication-label">
            PLAN & USAGE
          </span>
          <strong id="tengaagent-billing-title">
            {billing.planCode} · {billing.subscriptionStatus}
          </strong>
          <p>
            Monthly limits and prepaid access are enforced by the backend before
            the public agent or a gated channel is accepted.
          </p>
          <div className="tengaagent-owner__lead-meta">
            <span>
              Conversations: {conversationsUsed.toLocaleString()} / {formatLimit(
                conversationLimit
              )}
            </span>
            <span>
              Agents: {agentsUsed.toLocaleString()} / {formatLimit(agentLimit)}
            </span>
            <span>
              WhatsApp: {billing.entitlements?.whatsapp ? "included" : "not included"}
            </span>
            <span>
              Voice notes: {billing.entitlements?.voice ? "included" : "not included"}
            </span>
            {billing.currentPeriodEnd ? (
              <span>
                Paid access through: {formatDate(billing.currentPeriodEnd)}
              </span>
            ) : null}
          </div>

          {billing.expired ? (
            <div
              className="tengaagent-owner__notice tengaagent-owner__notice--error"
              role="alert"
            >
              This prepaid period has expired. Complete checkout below to reactivate
              the public agent and paid channels.
            </div>
          ) : null}

          {checkoutMessage ? (
            <div className="tengaagent-owner__notice" role="status">
              {checkoutMessage}
            </div>
          ) : null}

          {checkoutError ? (
            <div
              className="tengaagent-owner__notice tengaagent-owner__notice--error"
              role="alert"
            >
              {checkoutError}
            </div>
          ) : null}

          {plansError ? (
            <div
              className="tengaagent-owner__notice tengaagent-owner__notice--error"
              role="alert"
            >
              {plansError} Checkout is disabled until current pricing is available.
            </div>
          ) : null}

          <div className="tengaagent-owner__lead-meta">
            <label>
              Billing currency
              <select
                aria-label="Billing currency"
                value={selectedCurrency}
                onChange={(event) => setSelectedCurrency(event.target.value)}
                disabled={checkoutBusy || checkoutUnavailable}
              >
                <option value="NGN">NGN · Paystack</option>
                <option value="USD">USD · Stripe</option>
              </select>
            </label>

            <label>
              30-day prepaid plan
              <select
                aria-label="30-day prepaid plan"
                value={selectedPlan}
                onChange={(event) => setSelectedPlan(event.target.value)}
                disabled={checkoutBusy || checkoutUnavailable}
              >
                {availablePlans.map((plan) => (
                  <option key={plan.code} value={plan.code}>
                    {plan.label} · {formatPrice(plan.prices[selectedCurrency], selectedCurrency)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p>
            One checkout activates 30 days of prepaid TengaAgent access. NGN uses
            Paystack and USD uses Stripe. Prices shown here come from the same
            backend catalog used to validate checkout amounts.
          </p>

          {sameActivePlan ? (
            <p>
              Your selected prepaid plan is already active. Choose a different plan
              to change immediately, or renew this plan after its current paid
              period expires.
            </p>
          ) : null}
        </div>

        <div>
          <button
            type="button"
            onClick={startCheckout}
            disabled={checkoutBusy || sameActivePlan || checkoutUnavailable}
          >
            {isCheckoutVerifying
              ? "Verifying payment…"
              : isCheckoutStarting
                ? "Opening checkout…"
                : `Pay ${formatPrice(selectedAmount, selectedCurrency)}`}
          </button>
          <button
            type="button"
            onClick={loadBilling}
            disabled={isLoading || checkoutBusy}
          >
            {isLoading ? "Refreshing…" : "Refresh usage"}
          </button>
        </div>
      </section>

      <TengaAgentPilotReadinessPanel user={user} />
    </>
  );
}
