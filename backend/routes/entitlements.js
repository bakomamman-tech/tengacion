const express = require("express");
const auth = require("../middleware/auth");
const { checkEntitlement } = require("../controllers/purchasesController");

const router = express.Router();

router.get("/check", auth, checkEntitlement);

module.exports = router;
