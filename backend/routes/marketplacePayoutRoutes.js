const express = require("express");

const auth = require("../middleware/auth");
const approvedSellerGuard = require("../middleware/approvedSellerGuard");
const payoutController = require("../controllers/marketplacePayoutController");

const router = express.Router();

router.get("/payouts/me", auth, approvedSellerGuard, payoutController.getMyPayoutHistory);
router.get("/payouts/summary", auth, approvedSellerGuard, payoutController.getMyPayoutSummary);
router.get("/payouts/withdrawals", auth, approvedSellerGuard, payoutController.getMyWithdrawals);
router.post("/payouts/withdraw", auth, approvedSellerGuard, payoutController.withdrawMyPayout);

module.exports = router;
