const express = require("express");

const auth = require("../middleware/auth");
const {
  TENGAAGENT_PLAN_ENTITLEMENTS,
  TENGAAGENT_PLAN_PRICING,
  TENGAAGENT_SELF_SERVICE_PLAN_CODES,
} = require("../config/tengaAgentPlans");
const {
  handlePaystackWebhook,
  handleStripeWebhook,
  initializeOwnerPlanCheckout,
  verifyOwnerPlanCheckout,
} = require("../services/tengaAgent/subscriptionCheckoutService");

const router = express.Router();

const toPlanLabel = (planCode) =>
  String(planCode || "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

router.get("/plans", auth, (_req, res) => {
  const plans = TENGAAGENT_SELF_SERVICE_PLAN_CODES.map((code) => ({
    code,
    label: toPlanLabel(code),
    prices: { ...(TENGAAGENT_PLAN_PRICING[code] || {}) },
    entitlements: { ...(TENGAAGENT_PLAN_ENTITLEMENTS[code] || {}) },
  }));

  res.set("Cache-Control", "private, max-age=300");
  return res.json({
    ok: true,
    billingMode: "prepaid_30_day",
    prepaidPeriodDays: 30,
    plans,
  });
});

router.post("/checkout", auth, async (req, res, next) => {
  try {
    const result = await initializeOwnerPlanCheckout({
      userId: req.user._id,
      userEmail: req.user.email,
      planCode: req.body?.planCode,
      currency: req.body?.currency,
    });

    res.set("Cache-Control", "no-store");
    return res.status(201).json({
      ok: true,
      billingMode: "prepaid_30_day",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/checkout/verify", auth, async (req, res, next) => {
  try {
    const result = await verifyOwnerPlanCheckout({
      userId: req.user._id,
      reference: req.body?.reference,
    });

    res.set("Cache-Control", "no-store");
    return res.json({
      ok: true,
      billingMode: "prepaid_30_day",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/webhook/paystack", async (req, res, next) => {
  try {
    const result = await handlePaystackWebhook({
      rawBody: req.rawBody || Buffer.from(""),
      signature: req.headers["x-paystack-signature"] || "",
      payload: req.body || {},
    });

    return res.status(200).json({
      ok: true,
      handled: Boolean(result?.handled),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/webhook/stripe", async (req, res, next) => {
  try {
    const result = await handleStripeWebhook({
      rawBody: req.rawBody || Buffer.from(""),
      signature: req.headers["stripe-signature"] || "",
    });

    return res.status(200).json({
      ok: true,
      handled: Boolean(result?.handled),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
