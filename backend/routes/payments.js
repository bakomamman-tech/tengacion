const express = require("express");
const auth = require("../middleware/auth");
const requireStepUp = require("../middleware/requireStepUp");
const {
  initializePayment,
  providerWebhook,
  paystackWebhook,
} = require("../controllers/paymentsController");

const router = express.Router();

router.post("/init", auth, requireStepUp(), initializePayment);
router.post("/initiate", auth, requireStepUp(), initializePayment);
router.post("/webhook/:provider", providerWebhook);
router.post("/webhook/paystack", paystackWebhook);

module.exports = router;
