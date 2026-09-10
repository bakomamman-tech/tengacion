const express = require("express");
const rateLimit = require("express-rate-limit");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const service = require("../services/externalReadinessService");
const Question = require("../models/ExternalReadinessQuestion");
const { writeAuditLog } = require("../services/auditLogService");

const router = express.Router();
router.use(auth);
router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
const limiter = rateLimit({ windowMs: 60000, limit: 30, standardHeaders: true, legacyHeaders: false });
const handle = (operation, action) => async (req, res) => {
  try {
    const result = await operation(req);
    if (action) await writeAuditLog({ req, actorId: req.user.id, action: `external_readiness.${action}`,
      targetType: "ExternalReadiness", targetId: String(result?._id || result?.id || req.params.id || ""),
      reason: action === "question" ? "Recipient question submitted" : String(req.body?.reason || action),
      metadata: { status: result?.status, packageKey: result?.packageKey } });
    return res.json(result);
  } catch (err) {
    const status = err.status || (["ValidationError", "CastError", "StrictModeError"].includes(err.name) ? 400 : err.name === "VersionError" || err.code === 11000 ? 409 : 500);
    return res.status(status).json({ error: status === 500 ? "Unable to complete readiness request" : err.message });
  }
};

// Recipient access is checked against the authenticated account on every read.
router.get("/shares/:id", handle(async (req) => {
  const { packet } = await service.readShare(req.params.id, req.user.id);
  const questions = await Question.find({ share: req.params.id, askedBy: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
  return { packet, questions: questions.map((q) => ({ id: q._id, question: q.question, status: q.status,
    response: ["approved", "closed"].includes(q.status) ? q.response : "" })) };
}));
router.post("/shares/:id/questions", limiter, handle(async (req) => {
  const row = await service.askQuestion({ shareId: req.params.id, actor: req.user.id, body: req.body });
  return { id: row._id, question: row.question, status: row.status };
}, "question"));

router.use(requireRole.requireAdmin());
router.get("/", handle(() => service.report()));
router.post("/records", limiter, handle((req) => service.saveDraft({ body: req.body, actor: req.user.id }), "create"));
router.patch("/records/:id", limiter, handle((req) => service.saveDraft({ recordId: req.params.id, body: req.body, actor: req.user.id }), "revise"));
router.post("/records/:id/transitions", limiter, handle((req) => service.transition({ recordId: req.params.id, body: req.body, actor: req.user.id }), "transition"));
router.post("/records/:id/shares", limiter, handle((req) => service.createShare({ recordId: req.params.id, body: req.body, actor: req.user.id }), "share"));
router.post("/shares/:id/revoke", limiter, handle((req) => {
  service.requireText(req.body?.reason, "Reason");
  return service.revokeShare(req.params.id);
}, "revoke"));
router.post("/questions/:id", limiter, handle((req) => service.answerQuestion({ questionId: req.params.id, actor: req.user.id, body: req.body }), "answer"));
module.exports = router;
