const express = require("express");
const router = express.Router();
const billingRoutes = require("../../apps/api/routes/billing");

router.use((req, _res, next) => {
  console.warn(
    "DEPRECATED ROUTE: /api/billing is now served by apps/api/routes/billing. Update references before removing this proxy."
  );
  next();
});

router.use("/", billingRoutes);

module.exports = router;
