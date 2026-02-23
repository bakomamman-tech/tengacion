const express = require("express");
const auth = require("../middleware/auth");
const creatorAuth = require("../middleware/creatorAuth");
const { getMyPurchases, getCreatorSales } = require("../controllers/purchasesController");

const router = express.Router();

router.get("/my", auth, getMyPurchases);
router.get("/creator/sales", auth, creatorAuth, getCreatorSales);

module.exports = router;
