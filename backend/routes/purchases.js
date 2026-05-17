const express = require("express");
const auth = require("../middleware/auth");
const creatorAuth = require("../middleware/creatorAuth");
const {
  cancelMySubscription,
  getMyPurchases,
  getCreatorSales,
  resumeMySubscriptionRenewal,
} = require("../controllers/purchasesController");

const router = express.Router();

router.get("/my", auth, getMyPurchases);
router.post("/:id/cancel-subscription", auth, cancelMySubscription);
router.post("/:id/resume-subscription", auth, resumeMySubscriptionRenewal);
router.get("/creator/sales", auth, creatorAuth, getCreatorSales);

module.exports = router;
