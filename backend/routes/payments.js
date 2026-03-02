const express = require("express");
const auth = require("../middleware/auth");
const {
  initializePayment,
  providerWebhook,
  paystackWebhook,
} = require("../controllers/paymentsController");

const router = express.Router();

router.post("/init", auth, initializePayment);
router.post("/initiate", auth, initializePayment);
router.post("/webhook/:provider", providerWebhook);
router.post("/webhook/paystack", paystackWebhook);

module.exports = router;
