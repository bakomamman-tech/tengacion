const express = require("express");
const router = express.Router();
const musicRoutes = require("../../apps/api/routes/music");

router.use((req, _res, next) => {
  console.warn(
    "DEPRECATED ROUTE: /api/music is now served by apps/api/routes/music. Update references before removing this proxy."
  );
  next();
});

router.use("/", musicRoutes);

module.exports = router;
