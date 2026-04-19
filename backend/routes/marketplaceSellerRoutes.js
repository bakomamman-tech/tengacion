const express = require("express");

const auth = require("../middleware/auth");
const upload = require("../middleware/privateUpload");
const sellerController = require("../controllers/marketplaceSellerController");

const router = express.Router();

router.get("/seller/me", auth, sellerController.getMySellerProfile);
router.post(
  "/seller/save-draft",
  auth,
  ...upload.fields([{ name: "cacCertificate", maxCount: 1 }]),
  sellerController.saveSellerDraft
);
router.post(
  "/seller/submit",
  auth,
  ...upload.fields([{ name: "cacCertificate", maxCount: 1 }]),
  sellerController.submitSellerApplication
);
router.put(
  "/seller/resubmit",
  auth,
  ...upload.fields([{ name: "cacCertificate", maxCount: 1 }]),
  sellerController.resubmitSellerApplication
);
router.get("/store/:idOrSlug", sellerController.getPublicSellerStorefront);

module.exports = router;
