const express = require("express");

const marketplaceAdminGuard = require("../middleware/marketplaceAdminGuard");
const adminController = require("../controllers/marketplaceAdminController");

const router = express.Router();

router.use(marketplaceAdminGuard);

router.get("/sellers", adminController.listSellerApplications);
router.get("/sellers/:id", adminController.getSellerApplication);
router.patch(
  "/sellers/:id/approve",
  adminController.requireMutationStepUp,
  adminController.approveSeller
);
router.patch(
  "/sellers/:id/reject",
  adminController.requireMutationStepUp,
  adminController.rejectSeller
);
router.patch(
  "/sellers/:id/suspend",
  adminController.requireMutationStepUp,
  adminController.suspendSeller
);
router.get("/products", adminController.listMarketplaceProducts);
router.patch(
  "/products/:id/hide",
  adminController.requireMutationStepUp,
  adminController.hideProduct
);
router.delete(
  "/products/:id",
  adminController.requireMutationStepUp,
  adminController.deleteProduct
);
router.get("/orders", adminController.listMarketplaceOrders);
router.get("/payouts", adminController.listMarketplacePayouts);

module.exports = router;
