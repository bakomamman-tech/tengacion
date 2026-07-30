const express = require("express");

let rateLimit;
try {
  rateLimit = require("express-rate-limit");
} catch {
  rateLimit = () => (_req, _res, next) => next();
}

const auth = require("../middleware/auth");
const {
  TeacherTrainingError,
  answerTeacherTrainingQuestion,
  getTeacherTrainingStatus,
  startTeacherTrainingAssessment,
} = require("../services/teacherTrainingService");

const router = express.Router();

const assessmentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.user?.id ? `user:${req.user.id}` : rateLimit.ipKeyGenerator(req.ip || ""),
  message: { error: "Too many training actions. Please pause briefly and try again." },
});

const handleError = (res, error) => {
  if (error instanceof TeacherTrainingError) {
    return res.status(error.status || 400).json({
      error: error.message,
      code: error.code,
      ...(error.payload || {}),
    });
  }
  console.error("Teacher training route failed:", error);
  return res.status(500).json({
    error: "The teacher training service could not process this request.",
  });
};

router.get("/status", auth, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    return res.json(await getTeacherTrainingStatus(req.user.id));
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/modules/:moduleCode/start", auth, assessmentLimiter, async (req, res) => {
  try {
    return res.status(201).json(
      await startTeacherTrainingAssessment({
        userId: req.user.id,
        moduleCode: req.params.moduleCode,
      })
    );
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/modules/:moduleCode/answer", auth, assessmentLimiter, async (req, res) => {
  try {
    return res.json(
      await answerTeacherTrainingQuestion({
        userId: req.user.id,
        moduleCode: req.params.moduleCode,
        questionId: req.body?.questionId,
        selectedIndex: req.body?.selectedIndex,
      })
    );
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
