const express = require("express");
const router = express.Router();
const authRoutes = require("../../apps/api/routes/auth");

router.use((req, _res, next) => {
  console.warn(
    "DEPRECATED ROUTE: /api/auth now handled by apps/api/routes/auth. Please update upstream integrations."
  );
  next();
});

router.use("/", authRoutes);

module.exports = router;
