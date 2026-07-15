const express = require("express");
const rateLimit = require("express-rate-limit");

const auth = require("../middleware/auth");
const {
  TopUpPromoError,
  buildTopUpPromoStatus,
  discoverTopUpPromoChest,
} = require("../services/topUpPromoService");

const router = express.Router();

const discoveryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.user?.id ? `user:${req.user.id}` : rateLimit.ipKeyGenerator(req.ip || ""),
  message: { error: "Too many promo attempts. Please try again shortly." },
});

const handleError = (res, error) => {
  if (error instanceof TopUpPromoError) {
    return res.status(error.status || 400).json({
      error: error.message,
      code: error.code,
      ...(error.payload || {}),
    });
  }
  console.error("Top-Up Bank Account Promo route failed:", error);
  return res.status(500).json({ error: "Failed to load the Top-Up Bank Account Promo." });
};

router.get("/me", auth, async (req, res) => {
  try {
    return res.json(await buildTopUpPromoStatus(req.user.id));
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/discover", auth, discoveryLimiter, async (req, res) => {
  try {
    const result = await discoverTopUpPromoChest({
      userId: req.user.id,
      chestNumber: req.body?.chestNumber,
    });

    if (result?.alreadyPlayed === false) {
      req.app.get("io")?.emit("top-up-promo:discovered", {
        chestNumber: Number(result.play?.chestNumber || 0),
        discoveredChestNumbers: result.discoveredChestNumbers || [],
        remainingChests: Number(result.remainingChests || 0),
      });
    }

    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
