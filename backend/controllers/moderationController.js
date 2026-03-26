const ModerationAuditLog = require("../models/ModerationAuditLog");
const {
  generateModerationReviewUrl,
  getModerationCaseDetail,
  getModerationCaseUploaderDetail,
  getModerationSummary,
  listModerationCases,
  performModerationAction,
  scanContentForModeration,
} = require("../services/moderationService");

const getActor = (req) => ({
  ...(req.permissionUser?.toObject ? req.permissionUser.toObject() : req.permissionUser || {}),
  id: req.permissionUser?._id?.toString() || req.user?.id || "",
  _id: req.permissionUser?._id || req.user?._id || null,
  email: req.permissionUser?.email || req.user?.email || "",
  role: req.permissionUser?.role || req.user?.role || "user",
  permissions:
    req.permissionUser?.permissions || req.user?.permissions || [],
});

const listQueue = async (req, res) => {
  const payload = await listModerationCases({
    user: getActor(req),
    page: req.query.page,
    limit: req.query.limit,
    queue: req.params.category || req.query.category || req.query.queue || "",
    status: req.query.status || "",
    workflowState: req.query.workflowState || "",
    severity: req.query.severity || "",
    search: req.query.search || "",
    criticalOnly: String(req.query.critical || "").toLowerCase() === "true",
  });

  res.json(payload);
};

const getCase = async (req, res) => {
  const payload = await getModerationCaseDetail({
    caseId: req.params.id,
    user: getActor(req),
  });
  res.json(payload);
};

const getStats = async (req, res) => {
  const payload = await getModerationSummary({
    user: getActor(req),
  });
  res.json(payload);
};

const getUploader = async (req, res) => {
  const payload = await getModerationCaseUploaderDetail({
    caseId: req.params.id,
    user: getActor(req),
  });
  res.json(payload);
};

const getAuditLogs = async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 30));
  const skip = (page - 1) * limit;
  const query = {};

  if (req.query.action) {
    query.actionType = String(req.query.action);
  }
  if (req.query.caseId) {
    query.moderationCaseId = String(req.query.caseId);
  }

  const [rows, total] = await Promise.all([
    ModerationAuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ModerationAuditLog.countDocuments(query),
  ]);

  res.json({
    page,
    limit,
    total,
    logs: rows.map((row) => ({
      _id: row._id.toString(),
      moderationCaseId: row.moderationCaseId?.toString() || "",
      adminUserId: row.adminUserId?.toString() || "",
      adminEmail: row.adminEmail || "",
      action: row.actionType || "",
      oldStatus: row.previousStatus || "",
      newStatus: row.newStatus || "",
      reason: row.reason || "",
      metadata: row.metadata || {},
      createdAt: row.createdAt || null,
    })),
  });
};

const getReviewUrl = async (req, res) => {
  const payload = await generateModerationReviewUrl({
    caseId: req.params.id,
    user: getActor(req),
    req,
    mediaRole: req.body?.mediaRole || req.query.mediaRole || "",
    mediaIndex: req.body?.mediaIndex ?? req.query.mediaIndex ?? 0,
  });
  res.json(payload);
};

const applyAction = async (req, res) => {
  const action =
    req.params.action
    || req.body?.action
    || "";
  const payload = await performModerationAction({
    caseId: req.params.id,
    action,
    reason: req.body?.reason || "",
    user: getActor(req),
    req,
    metadata: req.body?.metadata || {},
  });
  res.json({ success: true, case: payload });
};

const scanContent = async (req, res) => {
  const payload = await scanContentForModeration({
    user: getActor(req),
    req,
    search: req.body?.search || req.query.search || "",
    limit: req.body?.limit ?? req.query.limit ?? 20,
    includeManualReview:
      String(req.body?.includeManualReview ?? req.query.includeManualReview ?? "true").toLowerCase() !== "false",
  });
  res.json({ success: true, ...payload });
};

module.exports = {
  applyAction,
  getAuditLogs,
  getCase,
  getUploader,
  getReviewUrl,
  scanContent,
  getStats,
  listQueue,
};
