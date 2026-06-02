const express = require("express");
const auth = require("../middleware/auth");
const creatorAuth = require("../middleware/creatorAuth");
const {
  cancelMySubscription,
  getMyPurchaseReceipt,
  getMyPurchases,
  getCreatorSales,
  resumeMySubscriptionRenewal,
} = require("../controllers/purchasesController");

const router = express.Router();

router.get("/my", auth, getMyPurchases);
router.get("/creator/sales", auth, creatorAuth, getCreatorSales);
router.get("/:id", auth, getMyPurchaseReceipt);
router.post("/:id/cancel-subscription", auth, cancelMySubscription);
router.post("/:id/resume-subscription", auth, resumeMySubscriptionRenewal);

module.exports = router;
