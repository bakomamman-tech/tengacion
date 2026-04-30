const express = require("express");

let rateLimit;
try {
  rateLimit = require("express-rate-limit");
} catch {
  rateLimit = () => (_req, _res, next) => next();
}

const auth = require("../middleware/auth");
const {
  RechargeRaffleError,
  buildRaffleStatus,
  spinRaffle,
} = require("../services/rechargeRaffleService");

const router = express.Router();

const spinLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.user?.id ? `user:${req.user.id}` : rateLimit.ipKeyGenerator(req.ip || ""),
  message: { error: "Too many raffle spins. Please slow down and try again shortly." },
});

const handleRaffleError = (res, error) => {
  if (error instanceof RechargeRaffleError) {
    return res.status(error.status || 400).json({
      error: error.message,
      code: error.code,
      ...(error.payload || {}),
    });
  }

  console.error("Recharge raffle route failed:", error);
  return res.status(500).json({ error: "Failed to load recharge raffle." });
};

router.get("/me", auth, async (req, res) => {
  try {
    return res.json(await buildRaffleStatus(req.user.id));
  } catch (error) {
    return handleRaffleError(res, error);
  }
});

router.post("/spin", auth, spinLimiter, async (req, res) => {
  try {
    return res.json(
      await spinRaffle({
        userId: req.user.id,
        network: req.body?.network,
      })
    );
  } catch (error) {
    return handleRaffleError(res, error);
  }
});

module.exports = router;
