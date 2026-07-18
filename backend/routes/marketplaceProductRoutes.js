const express = require("express");

const auth = require("../middleware/auth");
const approvedSellerGuard = require("../middleware/approvedSellerGuard");
const upload = require("../middleware/marketplaceProductUpload");
const moderateUpload = require("../middleware/moderateUpload");
const productController = require("../controllers/marketplaceProductController");

const router = express.Router();

const validateProductMediaFields = (req, res, next) => {
  const imageFiles = Array.isArray(req.files?.images) ? req.files.images : [];
  const videoFile = Array.isArray(req.files?.video) ? req.files.video[0] || null : null;
  const invalidImage = imageFiles.find(
    (file) => !String(file?.mimetype || "").toLowerCase().startsWith("image/")
  );

  if (invalidImage) {
    return res.status(400).json({ error: "Product images must be image files" });
  }
  if (videoFile && !String(videoFile.mimetype || "").toLowerCase().startsWith("video/")) {
    return res.status(400).json({ error: "Product video must be an MP4, MOV, or WebM file" });
  }

  return next();
};

router.get("/seller/products", auth, approvedSellerGuard, productController.getManagedSellerListings);
router.get("/products", productController.getMarketplaceFeed);
router.get("/store/:storeId/products", productController.getSellerStorefrontListings);
router.get("/products/:idOrSlug", productController.getMarketplaceProductDetail);
router.post(
  "/products",
  auth,
  approvedSellerGuard,
  ...upload.fields([
    { name: "images", maxCount: 8 },
    { name: "video", maxCount: 1 },
  ]),
  validateProductMediaFields,
  moderateUpload({
    sourceType: "marketplace_product_upload",
    titleFields: ["title", "name"],
    descriptionFields: ["description", "details"],
  }),
  productController.createListing
);
router.put(
  "/products/:id",
  auth,
  approvedSellerGuard,
  ...upload.fields([
    { name: "images", maxCount: 8 },
    { name: "video", maxCount: 1 },
  ]),
  validateProductMediaFields,
  moderateUpload({
    sourceType: "marketplace_product_upload",
    titleFields: ["title", "name"],
    descriptionFields: ["description", "details"],
  }),
  productController.updateListing
);
router.delete("/products/:id", auth, approvedSellerGuard, productController.deleteListing);
router.patch("/products/:id/publish", auth, approvedSellerGuard, productController.publishListing);
router.patch("/products/:id/unpublish", auth, approvedSellerGuard, productController.unpublishListing);

module.exports = router;
