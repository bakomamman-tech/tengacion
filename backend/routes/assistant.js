const express = require("express");
const { ipKeyGenerator, rateLimit } = require("express-rate-limit");

const auth = require("../middleware/auth");
const assistantController = require("../controllers/assistantController");

const router = express.Router();

const assistantLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `assistant:${req.user?.id || ipKeyGenerator(req)}`,
});

router.post("/chat", auth, assistantLimiter, assistantController.chat);
router.post("/feedback", auth, assistantLimiter, assistantController.feedback);

module.exports = router;
