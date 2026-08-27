const express = require("express");

const requireStepUp = require("../middleware/requireStepUp");
const { writeAuditLog } = require("../services/auditLogService");
const {
  BrightFutureError,
  buildAdminOverview,
  getCompetitionConfig,
  getLeaderboard,
  listAdminQuestions,
  listAdminResults,
  listAdminStudents,
  resetAdminAttempt,
  resetAdminPassword,
  serializePublicConfig,
  updateAdminQuestion,
  updateAdminStudent,
  updateCompetitionControls,
} = require("../services/brightFutureAcademyService");

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.get("/overview", asyncRoute(async (_req, res) => {
  res.json({ overview: await buildAdminOverview() });
}));

router.get("/students", asyncRoute(async (req, res) => {
  res.json(await listAdminStudents(req.query));
}));

router.get("/results", asyncRoute(async (req, res) => {
  res.json(await listAdminResults(req.query));
}));

router.get("/leaderboard", asyncRoute(async (req, res) => {
  try {
    res.json(await getLeaderboard({ ...req.query, limit: req.query.limit || 100 }));
  } catch (error) {
    if (error.code !== "leaderboard_hidden") throw error;
    res.json({ entries: [], leader: null, hidden: true, total: 0, page: 1, pages: 1 });
  }
}));

router.patch("/students/:id", requireStepUp({ adminOnly: true }), asyncRoute(async (req, res) => {
  const student = await updateAdminStudent(req.params.id, req.body);
  await writeAuditLog({
    req,
    actorId: req.user.id,
    action: "bright_future.student_updated",
    targetType: "BrightFutureParticipant",
    targetId: req.params.id,
    reason: String(req.body?.reason || "Administrator profile update"),
  }).catch(() => null);
  res.json({ student });
}));

router.post("/students/:id/reset-attempt", requireStepUp({ adminOnly: true }), asyncRoute(async (req, res) => {
  const student = await resetAdminAttempt(req.params.id);
  await writeAuditLog({
    req,
    actorId: req.user.id,
    action: "bright_future.attempt_reset",
    targetType: "BrightFutureParticipant",
    targetId: req.params.id,
    reason: String(req.body?.reason || "Administrator-authorized retake"),
  }).catch(() => null);
  res.json({ student });
}));

router.post("/students/:id/reset-password", requireStepUp({ adminOnly: true }), asyncRoute(async (req, res) => {
  const result = await resetAdminPassword(req.params.id);
  await writeAuditLog({
    req,
    actorId: req.user.id,
    action: "bright_future.password_reset",
    targetType: "BrightFutureParticipant",
    targetId: req.params.id,
    reason: String(req.body?.reason || "Administrator-assisted access recovery"),
    metadata: { candidateId: result.credentials.candidateId },
  }).catch(() => null);
  res.set("Cache-Control", "no-store").json(result);
}));

router.get("/controls", asyncRoute(async (_req, res) => {
  res.json({ controls: serializePublicConfig(await getCompetitionConfig()) });
}));

router.patch("/controls", requireStepUp({ adminOnly: true }), asyncRoute(async (req, res) => {
  const controls = await updateCompetitionControls(req.body, req.user.id);
  await writeAuditLog({
    req,
    actorId: req.user.id,
    action: "bright_future.controls_updated",
    targetType: "BrightFutureCompetitionConfig",
    targetId: "default",
    reason: String(req.body?.reason || "Competition control update"),
    metadata: controls,
  }).catch(() => null);
  res.json({ controls });
}));

router.get("/questions", asyncRoute(async (_req, res) => {
  const questions = await listAdminQuestions();
  res.json({ questions });
}));

router.patch("/questions/:questionId", requireStepUp({ adminOnly: true }), asyncRoute(async (req, res) => {
  const question = await updateAdminQuestion(req.params.questionId, req.body);
  await writeAuditLog({
    req,
    actorId: req.user.id,
    action: "bright_future.question_updated",
    targetType: "BrightFutureQuestion",
    targetId: question.questionId,
    reason: String(req.body?.reason || "Question bank update"),
  }).catch(() => null);
  res.json({ question });
}));

router.use((error, _req, res, next) => {
  if (!(error instanceof BrightFutureError)) return next(error);
  return res.status(error.status || 400).json({
    error: error.message,
    message: error.message,
    code: error.code,
    ...(error.payload || {}),
  });
});

module.exports = router;
