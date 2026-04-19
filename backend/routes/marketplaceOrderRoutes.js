const express = require("express");

const auth = require("../middleware/auth");
const approvedSellerGuard = require("../middleware/approvedSellerGuard");
const orderController = require("../controllers/marketplaceOrderController");

const router = express.Router();

router.post("/orders/initialize", auth, orderController.initializeOrder);
router.post("/orders/verify", auth, orderController.verifyOrder);
router.post("/orders/webhook/paystack", orderController.handlePaystackWebhook);
router.get("/orders/buyer", auth, orderController.getBuyerOrders);
router.get("/orders/seller", auth, approvedSellerGuard, orderController.getSellerOrders);
router.patch(
  "/orders/:id/status",
  auth,
  approvedSellerGuard,
  orderController.updateSellerOrderStatus
);

module.exports = router;
