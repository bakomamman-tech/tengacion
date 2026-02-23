const express = require("express");
const auth = require("../middleware/auth");
const {
  initializePayment,
  paystackWebhook,
} = require("../controllers/paymentsController");

const router = express.Router();

router.post("/init", auth, initializePayment);
router.post("/webhook/paystack", paystackWebhook);

module.exports = router;
