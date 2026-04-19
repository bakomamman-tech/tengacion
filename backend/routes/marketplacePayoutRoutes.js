const express = require("express");

const auth = require("../middleware/auth");
const approvedSellerGuard = require("../middleware/approvedSellerGuard");
const payoutController = require("../controllers/marketplacePayoutController");

const router = express.Router();

router.get("/payouts/me", auth, approvedSellerGuard, payoutController.getMyPayoutHistory);
router.get("/payouts/summary", auth, approvedSellerGuard, payoutController.getMyPayoutSummary);

module.exports = router;
