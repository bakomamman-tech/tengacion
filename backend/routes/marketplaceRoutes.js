const express = require("express");

const sellerRoutes = require("./marketplaceSellerRoutes");
const productRoutes = require("./marketplaceProductRoutes");
const orderRoutes = require("./marketplaceOrderRoutes");
const payoutRoutes = require("./marketplacePayoutRoutes");

const router = express.Router();

router.use(sellerRoutes);
router.use(productRoutes);
router.use(orderRoutes);
router.use(payoutRoutes);

module.exports = router;
