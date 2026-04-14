const express = require("express");

const requirePermissions = require("../middleware/requirePermissions");
const { writeAuditLog } = require("../services/auditLogService");
const { buildAkusoAdminMetrics } = require("../services/assistant/adminMetricsService");
const { listAssistantReviews, updateAssistantReview } = require("../services/assistant/reviewQueue");

const router = express.Router();

router.get("/metrics", requirePermissions(["view_audit_logs"]), async (req, res) => {
  try {
    const result = await buildAkusoAdminMetrics({
      range: req.query.range,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });

    return res.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const statusCode = /invalid/i.test(String(error?.message || "")) ? 400 : 500;
    return res
      .status(statusCode)
      .json({ error: error?.message || "Failed to load assistant metrics" });
  }
});

router.get("/reviews", requirePermissions(["view_audit_logs"]), async (req, res) => {
  try {
    const result = await listAssistantReviews({
      status: req.query.status,
      category: req.query.category,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Failed to load assistant reviews" });
  }
});

router.patch("/reviews/:id", requirePermissions(["view_audit_logs"]), async (req, res) => {
  try {
    const item = await updateAssistantReview({
      reviewId: req.params.id,
      reviewerId: req.user?.id || "",
      status: req.body?.status,
      resolutionNote: req.body?.resolutionNote,
    });

    await writeAuditLog({
      req,
      actorId: req.user?.id,
      action: "admin.assistant.review.update",
      targetType: "AssistantReviewItem",
      targetId: String(item?._id || req.params.id),
      reason: String(req.body?.resolutionNote || req.body?.status || "assistant review updated").slice(0, 240),
      metadata: {
        status: item?.status || "",
        severity: item?.severity || "",
        category: item?.category || "",
      },
    }).catch(() => null);

    return res.json({ ok: true, item });
  } catch (error) {
    const statusCode = /not found/i.test(String(error?.message || "")) ? 404 : /invalid/i.test(String(error?.message || "")) ? 400 : 500;
    return res.status(statusCode).json({ error: error?.message || "Failed to update assistant review" });
  }
});

module.exports = router;
