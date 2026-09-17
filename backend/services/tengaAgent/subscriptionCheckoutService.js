const Agent = require("../../models/tengaAgent/Agent");
const BillingCheckout = require("../../models/tengaAgent/BillingCheckout");
const Organization = require("../../models/tengaAgent/Organization");
const Subscription = require("../../models/tengaAgent/Subscription");
const { config } = require("../../config/env");
const {
  getTengaAgentPlanEntitlements,
  getTengaAgentPlanPrice,
} = require("../../config/tengaAgentPlans");
const {
  generatePaymentReference,
  initializeTransaction,
  validateWebhookSignature,
  verifyTransaction,
} = require("../paystackService");
const {
  constructWebhookEvent,
  createCheckoutSession,
  generateStripeReference,
  retrieveCheckoutSession,
} = require("../stripeService");
const { findOwnerWorkspace } = require("./ownerWorkspaceService");

const PREPAID_PERIOD_DAYS = 30;
const PREPAID_PERIOD_MS = PREPAID_PERIOD_DAYS * 24 * 60 * 60 * 1000;
const SUPPORTED_CURRENCIES = new Set(["NGN", "USD"]);
const PAID_STRIPE_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

class TengaAgentCheckoutError extends Error {
  constructor(message, code, status = 400) {
    super(message);
    this.name = "TengaAgentCheckoutError";
    this.code = code;
    this.status = status;
    this.statusCode = status;
    this.isOperational = true;
  }
}

const normalizePlanCode = (value) =>
  String(value || "").trim().toLowerCase();

const normalizeCurrency = (value) =>
  String(value || "").trim().toUpperCase();

const providerForCurrency = (currency) =>
  currency === "USD" ? "stripe" : "paystack";

const buildReturnUrl = () => {
  const base = String(config.clientUrl || config.appUrl || "https://tengacion.com")
    .trim()
    .replace(/\/+$/, "");
  return `${base}/tengaagent?billing=return`;
};

const assertTargetPlanCapacity = async ({ organizationId, planCode }) => {
  const entitlements = getTengaAgentPlanEntitlements(planCode);
  if (entitlements.agents === null) {
    return entitlements;
  }

  const activeAgentCount = await Agent.countDocuments({
    organizationId,
    status: { $ne: "retired" },
  });

  if (activeAgentCount > entitlements.agents) {
    throw new TengaAgentCheckoutError(
      `The ${planCode} plan supports ${entitlements.agents} active agent${entitlements.agents === 1 ? "" : "s"}. Retire extra agents before changing to this plan.`,
      "TENGAAGENT_PLAN_AGENT_CAP_EXCEEDED",
      409
    );
  }

  return entitlements;
};

const hasProtectedActivePrepaidPeriod = ({
  subscription,
  planCode,
  now = new Date(),
}) => {
  if (!subscription || subscription.status !== "active") {
    return false;
  }
  if (subscription.renewalMode !== "prepaid") {
    return false;
  }
  if (normalizePlanCode(subscription.planCode) !== normalizePlanCode(planCode)) {
    return false;
  }

  const periodEnd = new Date(subscription.currentPeriodEnd || "");
  const currentTime = now instanceof Date ? now : new Date(now);
  if (
    Number.isNaN(periodEnd.getTime()) ||
    Number.isNaN(currentTime.getTime())
  ) {
    return false;
  }

  return periodEnd.getTime() > currentTime.getTime();
};

const assertNoProtectedActivePrepaidPeriod = async ({
  organizationId,
  planCode,
}) => {
  const subscription = await Subscription.findOne({ organizationId });
  if (!hasProtectedActivePrepaidPeriod({ subscription, planCode })) {
    return subscription;
  }

  throw new TengaAgentCheckoutError(
    "This TengaAgent plan is already prepaid and active. Renew it after the current paid period ends so remaining paid days are not lost.",
    "TENGAAGENT_PREPAID_PERIOD_ACTIVE",
    409
  );
};

const serializeCheckout = (checkout, checkoutUrl = "") => ({
  id: String(checkout?._id || ""),
  planCode: checkout?.planCode || "",
  provider: checkout?.provider || "",
  currency: checkout?.currency || "",
  amount: Number(checkout?.amount || 0),
  reference: checkout?.reference || "",
  status: checkout?.status || "pending",
  checkoutUrl: checkoutUrl || "",
  paidAt: checkout?.paidAt || null,
  activatedAt: checkout?.activatedAt || null,
});

const markCheckoutFailed = async (checkout, error) => {
  if (!checkout?._id) return;
  await BillingCheckout.updateOne(
    { _id: checkout._id, status: "pending" },
    {
      $set: {
        status: "failed",
        failureCode: String(error?.code || "provider_initialization_failed").slice(0, 120),
      },
    }
  ).catch(() => null);
};

const initializeOwnerPlanCheckout = async ({
  userId,
  userEmail,
  planCode,
  currency,
}) => {
  const workspace = await findOwnerWorkspace(userId);
  if (!workspace) {
    throw new TengaAgentCheckoutError(
      "Create your TengaAgent workspace before starting checkout.",
      "TENGAAGENT_WORKSPACE_REQUIRED",
      404
    );
  }

  const normalizedPlan = normalizePlanCode(planCode);
  const normalizedCurrency = normalizeCurrency(
    currency || (workspace.organization.countryCode === "NG" ? "NGN" : "USD")
  );

  if (!SUPPORTED_CURRENCIES.has(normalizedCurrency)) {
    throw new TengaAgentCheckoutError(
      "TengaAgent checkout supports NGN or USD.",
      "TENGAAGENT_CHECKOUT_CURRENCY_UNSUPPORTED"
    );
  }

  const amount = getTengaAgentPlanPrice(normalizedPlan, normalizedCurrency);
  await assertTargetPlanCapacity({
    organizationId: workspace.organization._id,
    planCode: normalizedPlan,
  });
  await assertNoProtectedActivePrepaidPeriod({
    organizationId: workspace.organization._id,
    planCode: normalizedPlan,
  });

  const email = String(userEmail || "").trim().toLowerCase();
  if (!email) {
    throw new TengaAgentCheckoutError(
      "A verified account email is required to start TengaAgent checkout.",
      "TENGAAGENT_CHECKOUT_EMAIL_REQUIRED"
    );
  }

  const provider = providerForCurrency(normalizedCurrency);
  const reference =
    provider === "stripe"
      ? generateStripeReference(`tengaagent_${normalizedPlan}`)
      : generatePaymentReference(`tengaagent_${normalizedPlan}`);

  const checkout = await BillingCheckout.create({
    organizationId: workspace.organization._id,
    requestedByUserId: userId,
    planCode: normalizedPlan,
    provider,
    currency: normalizedCurrency,
    amount,
    reference,
    status: "pending",
  });

  const metadata = {
    app: "tengacion",
    product: "tengaagent",
    checkoutId: String(checkout._id),
    organizationId: String(workspace.organization._id),
    planCode: normalizedPlan,
    billingMode: "prepaid_30_day",
  };

  try {
    if (provider === "paystack") {
      const payment = await initializeTransaction({
        email,
        amountNgn: amount,
        reference,
        callbackUrl: buildReturnUrl(),
        metadata,
      });

      return {
        checkout: serializeCheckout(
          checkout,
          String(payment?.authorization_url || "")
        ),
      };
    }

    const session = await createCheckoutSession({
      email,
      amountUsd: amount,
      reference,
      purchaseId: String(checkout._id),
      item: {
        title: `TengaAgent ${normalizedPlan} plan — 30 days`,
        description: "Prepaid 30-day TengaAgent plan activation",
      },
      returnUrl: buildReturnUrl(),
      metadata,
    });

    checkout.providerSessionId = String(session?.id || "");
    await checkout.save();

    return {
      checkout: serializeCheckout(
        checkout,
        String(session?.authorization_url || session?.url || "")
      ),
    };
  } catch (error) {
    await markCheckoutFailed(checkout, error);
    throw error;
  }
};

const getCheckoutWithProviderState = async (query) =>
  BillingCheckout.findOne(query).select("+providerSessionId");

const assertProviderPaymentMatchesCheckout = ({ checkout, payment }) => {
  const paymentAmount = Number(payment?.amount || 0);
  const expectedAmount = Number(checkout.amount || 0);
  const paymentCurrency = normalizeCurrency(payment?.currency);

  if (Math.abs(paymentAmount - expectedAmount) > 0.001) {
    throw new TengaAgentCheckoutError(
      "The verified payment amount does not match the TengaAgent checkout.",
      "TENGAAGENT_CHECKOUT_AMOUNT_MISMATCH",
      409
    );
  }

  if (paymentCurrency !== checkout.currency) {
    throw new TengaAgentCheckoutError(
      "The verified payment currency does not match the TengaAgent checkout.",
      "TENGAAGENT_CHECKOUT_CURRENCY_MISMATCH",
      409
    );
  }
};

const verifyProviderPayment = async (checkout) => {
  if (checkout.provider === "paystack") {
    const payment = await verifyTransaction(checkout.reference);
    if (String(payment?.status || "").toLowerCase() !== "success") {
      throw new TengaAgentCheckoutError(
        "Paystack has not confirmed this TengaAgent payment yet.",
        "TENGAAGENT_CHECKOUT_NOT_PAID",
        409
      );
    }
    if (String(payment?.reference || "") !== checkout.reference) {
      throw new TengaAgentCheckoutError(
        "Paystack returned a different payment reference.",
        "TENGAAGENT_CHECKOUT_REFERENCE_MISMATCH",
        409
      );
    }
    assertProviderPaymentMatchesCheckout({ checkout, payment });
    return payment;
  }

  if (!checkout.providerSessionId) {
    throw new TengaAgentCheckoutError(
      "Stripe checkout session is unavailable for verification.",
      "TENGAAGENT_STRIPE_SESSION_MISSING",
      409
    );
  }

  const payment = await retrieveCheckoutSession(checkout.providerSessionId);
  if (String(payment?.payment_status || "").toLowerCase() !== "paid") {
    throw new TengaAgentCheckoutError(
      "Stripe has not confirmed this TengaAgent payment yet.",
      "TENGAAGENT_CHECKOUT_NOT_PAID",
      409
    );
  }

  if (
    String(payment?.metadata?.checkoutId || "") &&
    String(payment.metadata.checkoutId) !== String(checkout._id)
  ) {
    throw new TengaAgentCheckoutError(
      "Stripe returned a checkout that does not belong to this TengaAgent payment.",
      "TENGAAGENT_CHECKOUT_ID_MISMATCH",
      409
    );
  }

  assertProviderPaymentMatchesCheckout({ checkout, payment });
  return payment;
};

const activatePaidCheckout = async ({ checkout, payment }) => {
  if (checkout.activatedAt && checkout.status === "paid") {
    return checkout;
  }

  const paidAtCandidate = payment?.paidAt ? new Date(payment.paidAt) : new Date();
  const paidAt = Number.isFinite(paidAtCandidate.getTime())
    ? paidAtCandidate
    : new Date();
  const periodEnd = new Date(paidAt.getTime() + PREPAID_PERIOD_MS);

  await Subscription.findOneAndUpdate(
    { organizationId: checkout.organizationId },
    {
      $set: {
        planCode: checkout.planCode,
        status: "active",
        billingProvider: checkout.provider,
        currentPeriodStart: paidAt,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: true,
        renewalMode: "prepaid",
        lastPaymentReference: checkout.reference,
        lastPaymentAt: paidAt,
      },
      $setOnInsert: {
        organizationId: checkout.organizationId,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  await Organization.updateOne(
    { _id: checkout.organizationId, status: { $ne: "closed" } },
    {
      $set: {
        plan: checkout.planCode,
        status: "active",
      },
    }
  );

  return BillingCheckout.findOneAndUpdate(
    { _id: checkout._id },
    {
      $set: {
        status: "paid",
        paidAt,
        activatedAt: checkout.activatedAt || new Date(),
        failureCode: "",
      },
    },
    { returnDocument: "after" }
  );
};

const verifyAndActivateCheckout = async (checkout) => {
  if (!checkout) {
    throw new TengaAgentCheckoutError(
      "TengaAgent checkout was not found.",
      "TENGAAGENT_CHECKOUT_NOT_FOUND",
      404
    );
  }

  if (checkout.status === "cancelled") {
    throw new TengaAgentCheckoutError(
      "This TengaAgent checkout was cancelled.",
      "TENGAAGENT_CHECKOUT_CANCELLED",
      409
    );
  }

  if (checkout.status === "paid" && checkout.activatedAt) {
    return checkout;
  }

  const payment = await verifyProviderPayment(checkout);
  return activatePaidCheckout({ checkout, payment });
};

const verifyOwnerPlanCheckout = async ({ userId, reference }) => {
  const workspace = await findOwnerWorkspace(userId);
  if (!workspace) {
    throw new TengaAgentCheckoutError(
      "TengaAgent workspace not found.",
      "TENGAAGENT_WORKSPACE_REQUIRED",
      404
    );
  }

  const checkout = await getCheckoutWithProviderState({
    organizationId: workspace.organization._id,
    requestedByUserId: userId,
    reference: String(reference || "").trim(),
  });

  const activated = await verifyAndActivateCheckout(checkout);
  return { checkout: serializeCheckout(activated) };
};

const handlePaystackWebhook = async ({ rawBody, signature, payload }) => {
  if (!validateWebhookSignature({ rawBody, signature })) {
    throw new TengaAgentCheckoutError(
      "Invalid Paystack webhook signature.",
      "TENGAAGENT_PAYSTACK_WEBHOOK_INVALID",
      401
    );
  }

  if (String(payload?.event || "") !== "charge.success") {
    return { handled: false };
  }

  const reference = String(payload?.data?.reference || "").trim();
  if (!reference) {
    return { handled: false };
  }

  const checkout = await getCheckoutWithProviderState({
    provider: "paystack",
    reference,
  });
  if (!checkout) {
    return { handled: false };
  }

  const activated = await verifyAndActivateCheckout(checkout);
  return {
    handled: true,
    checkout: serializeCheckout(activated),
  };
};

const handleStripeWebhook = async ({ rawBody, signature }) => {
  let event;
  try {
    event = constructWebhookEvent({ rawBody, signature });
  } catch (error) {
    throw new TengaAgentCheckoutError(
      "Invalid Stripe webhook signature.",
      "TENGAAGENT_STRIPE_WEBHOOK_INVALID",
      401
    );
  }

  if (!PAID_STRIPE_EVENTS.has(String(event?.type || ""))) {
    return { handled: false };
  }

  const session = event?.data?.object || {};
  const checkoutId = String(session?.metadata?.checkoutId || "").trim();
  const providerSessionId = String(session?.id || "").trim();
  if (!checkoutId && !providerSessionId) {
    return { handled: false };
  }

  const checkout = await getCheckoutWithProviderState({
    provider: "stripe",
    ...(checkoutId ? { _id: checkoutId } : { providerSessionId }),
  });
  if (!checkout) {
    return { handled: false };
  }

  const activated = await verifyAndActivateCheckout(checkout);
  return {
    handled: true,
    checkout: serializeCheckout(activated),
  };
};

module.exports = {
  PREPAID_PERIOD_DAYS,
  TengaAgentCheckoutError,
  activatePaidCheckout,
  handlePaystackWebhook,
  handleStripeWebhook,
  hasProtectedActivePrepaidPeriod,
  initializeOwnerPlanCheckout,
  serializeCheckout,
  verifyOwnerPlanCheckout,
  verifyProviderPayment,
};
