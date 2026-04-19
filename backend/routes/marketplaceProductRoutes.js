const express = require("express");

const auth = require("../middleware/auth");
const approvedSellerGuard = require("../middleware/approvedSellerGuard");
const upload = require("../middleware/privateUpload");
const productController = require("../controllers/marketplaceProductController");

const router = express.Router();

router.get("/seller/products", auth, approvedSellerGuard, productController.getManagedSellerListings);
router.get("/products", productController.getMarketplaceFeed);
router.get("/store/:storeId/products", productController.getSellerStorefrontListings);
router.get("/products/:idOrSlug", productController.getMarketplaceProductDetail);
router.post(
  "/products",
  auth,
  approvedSellerGuard,
  ...upload.array("images", 8),
  productController.createListing
);
router.put(
  "/products/:id",
  auth,
  approvedSellerGuard,
  ...upload.array("images", 8),
  productController.updateListing
);
router.delete("/products/:id", auth, approvedSellerGuard, productController.deleteListing);
router.patch("/products/:id/publish", auth, approvedSellerGuard, productController.publishListing);
router.patch("/products/:id/unpublish", auth, approvedSellerGuard, productController.unpublishListing);

module.exports = router;
