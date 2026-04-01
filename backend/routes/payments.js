const express = require("express");
const auth = require("../middleware/auth");
const requireStepUp = require("../middleware/requireStepUp");
const {
  initializePaystackPayment,
  verifyPaystackPayment,
  handlePaystackWebhook,
} = require("../controllers/paystackController");

const router = express.Router();

router.post("/init", auth, requireStepUp(), initializePaystackPayment);
router.post("/initiate", auth, requireStepUp(), initializePaystackPayment);
router.post("/paystack/initialize", auth, initializePaystackPayment);
router.get("/paystack/verify/:reference", auth, verifyPaystackPayment);
router.post("/webhook/paystack", handlePaystackWebhook);
router.post("/paystack/webhook", handlePaystackWebhook);
router.post("/webhook/:provider", (req, res, next) => {
  if (String(req.params.provider || "").trim().toLowerCase() !== "paystack") {
    return res.status(400).json({ error: "Unsupported provider webhook" });
  }

  return handlePaystackWebhook(req, res, next);
});

module.exports = router;
