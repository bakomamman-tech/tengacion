const express = require("express");
const auth = require("../middleware/auth");
const requireStepUp = require("../middleware/requireStepUp");
const {
  initializePaymentCheckout,
  initializePaystackPayment,
  verifyPaystackPayment,
  handlePaystackWebhook,
  handlePaystackTransferWebhook,
  handleStripeWebhook,
  listPaystackBanks,
  resolvePaystackAccount,
} = require("../controllers/paystackController");

const router = express.Router();

router.post("/init", auth, requireStepUp(), initializePaystackPayment);
router.post("/initiate", auth, requireStepUp(), initializePaystackPayment);
router.post("/checkout", auth, initializePaymentCheckout);
router.post("/initialize", auth, initializePaymentCheckout);
router.post("/paystack/initialize", auth, initializePaystackPayment);
router.get("/paystack/banks", auth, listPaystackBanks);
router.post("/paystack/resolve-account", auth, resolvePaystackAccount);
router.get("/paystack/verify/:reference", auth, verifyPaystackPayment);
router.post("/webhook/paystack", handlePaystackWebhook);
router.post("/paystack/webhook", handlePaystackWebhook);
router.post("/paystack/transfers/webhook", handlePaystackTransferWebhook);
router.post("/webhook/stripe", handleStripeWebhook);
router.post("/stripe/webhook", handleStripeWebhook);
router.post("/webhook/:provider", (req, res, next) => {
  const provider = String(req.params.provider || "").trim().toLowerCase();
  if (provider === "paystack") {
    return handlePaystackWebhook(req, res, next);
  }
  if (provider === "stripe") {
    return handleStripeWebhook(req, res, next);
  }

  return res.status(400).json({ error: "Unsupported provider webhook" });
});

module.exports = router;
