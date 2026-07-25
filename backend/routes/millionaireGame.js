const express = require("express");

let rateLimit;
try {
  rateLimit = require("express-rate-limit");
} catch {
  rateLimit = () => (_req, _res, next) => next();
}

const auth = require("../middleware/auth");
const {
  MillionaireGameError,
  answerMillionaireQuestion,
  askMillionaireAi,
  getMillionaireStatus,
  registerMillionaireParticipant,
  startMillionaireAttempt,
} = require("../services/millionaireGameService");

const router = express.Router();

const actionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.user?.id ? `user:${req.user.id}` : rateLimit.ipKeyGenerator(req.ip || ""),
  message: { error: "Too many game actions. Pause for a moment and try again." },
});

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.user?.id ? `user:${req.user.id}` : rateLimit.ipKeyGenerator(req.ip || ""),
  message: { error: "Too many registration attempts. Please try again later." },
});

const handleError = (res, error) => {
  if (error instanceof MillionaireGameError) {
    return res.status(error.status || 400).json({
      error: error.message,
      code: error.code,
      ...(error.payload || {}),
    });
  }
  console.error("Millionaire game route failed:", error);
  return res.status(500).json({ error: "The Millionaire game could not be processed." });
};

router.get("/status", auth, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    return res.json(await getMillionaireStatus(req.user.id));
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/register", auth, registrationLimiter, async (req, res) => {
  try {
    const payload = await registerMillionaireParticipant({
      userId: req.user.id,
      rulesAccepted: req.body?.rulesAccepted,
      prizeTermsAccepted: req.body?.prizeTermsAccepted,
      source: req.body?.source,
    });
    return res.status(payload.alreadyRegistered ? 200 : 201).json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/start", auth, actionLimiter, async (req, res) => {
  try {
    return res.status(201).json(await startMillionaireAttempt(req.user.id));
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/answer", auth, actionLimiter, async (req, res) => {
  try {
    return res.json(
      await answerMillionaireQuestion({
        userId: req.user.id,
        questionId: req.body?.questionId,
        selectedIndex: req.body?.selectedIndex,
      })
    );
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/ask-ai", auth, actionLimiter, async (req, res) => {
  try {
    return res.json(
      await askMillionaireAi({
        userId: req.user.id,
        questionId: req.body?.questionId,
      })
    );
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
