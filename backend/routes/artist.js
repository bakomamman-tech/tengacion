const express = require("express");
const router = express.Router();
const artistRoutes = require("../../apps/api/routes/artist");

router.use((req, _res, next) => {
  console.warn(
    "DEPRECATED ROUTE: /api/artist is now served by apps/api/routes/artist. Update references before removing backend alias."
  );
  next();
});

router.use("/", artistRoutes);

module.exports = router;
