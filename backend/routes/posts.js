const express = require("express");
const router = express.Router();
const legacyRoute = require("../../apps/api/routes/posts");

router.use((req, _res, next) => {
  console.warn(
    "DEPRECATED ROUTE: /api/posts is now handled by apps/api/routes/posts. Update upstream clients before removing this proxy."
  );
  next();
});

router.use("/", legacyRoute);

module.exports = router;
