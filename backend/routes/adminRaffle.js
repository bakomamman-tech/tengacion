const express = require("express");

let rateLimit;
try {
  rateLimit = require("express-rate-limit");
} catch {
  rateLimit = () => (_req, _res, next) => next();
}

const {
  RechargeRaffleError,
  listRechargeCardsForAdmin,
  loadRechargeCards,
} = require("../services/rechargeRaffleService");

const router = express.Router();

const adminRaffleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.user?.id ? `user:${req.user.id}` : rateLimit.ipKeyGenerator(req.ip || ""),
  message: { error: "Too many raffle admin actions. Please try again later." },
});

const handleRaffleError = (res, error) => {
  if (error instanceof RechargeRaffleError) {
    return res.status(error.status || 400).json({
      error: error.message,
      code: error.code,
      ...(error.payload || {}),
    });
  }

  console.error("Admin raffle route failed:", error);
  return res.status(500).json({ error: "Failed to process raffle admin request." });
};

router.get("/cards", async (req, res) => {
  try {
    return res.json(
      await listRechargeCardsForAdmin({
        network: req.query.network,
        status: req.query.status,
        page: req.query.page,
        limit: req.query.limit,
      })
    );
  } catch (error) {
    return handleRaffleError(res, error);
  }
});

router.post("/cards/bulk", adminRaffleLimiter, async (req, res) => {
  try {
    const payload = await loadRechargeCards({
      network: req.body?.network,
      pins: req.body?.pins,
      batchLabel: req.body?.batchLabel,
      adminNote: req.body?.adminNote,
      loadedBy: req.user.id,
    });
    return res.status(payload.createdCount > 0 ? 201 : 200).json(payload);
  } catch (error) {
    return handleRaffleError(res, error);
  }
});

module.exports = router;
