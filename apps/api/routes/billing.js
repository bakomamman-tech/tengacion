const express = require("express");
const router = express.Router();
const catchAsync = require("../utils/catchAsync");
const auth = require("../../../backend/middleware/auth");
const billingController = require("../controllers/billingController");

router.post("/subscribe", auth, catchAsync(billingController.subscribe));
router.post("/purchase", auth, catchAsync(billingController.purchase));

module.exports = router;
