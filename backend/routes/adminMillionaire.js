const express = require("express");
const requireStepUp = require("../middleware/requireStepUp");

const {
  MillionaireGameError,
  listMillionaireParticipantsForAdmin,
  updateMillionaireParticipantStatus,
  updateMillionairePayout,
} = require("../services/millionaireGameService");
const {
  getMillionaireLaunchCampaignStatus,
  getMillionaireReminderCampaignStatus,
  queueMillionaireLaunchCampaign,
  queueMillionaireReminderCampaign,
} = require("../services/millionaireLaunchCampaignService");
const { writeAuditLog } = require("../services/auditLogService");

const router = express.Router();

const handleError = (res, error) => {
  if (error instanceof MillionaireGameError) {
    return res.status(error.status || 400).json({
      error: error.message,
      code: error.code,
      ...(error.payload || {}),
    });
  }
  if (error?.status) {
    return res.status(error.status).json({
      error: error.message,
      code: error.code || "millionaire_campaign_error",
    });
  }
  console.error("Admin Millionaire route failed:", error);
  return res.status(500).json({ error: "Failed to process Millionaire administration." });
};

router.get("/launch-campaign", async (_req, res) => {
  try {
    return res.json({ campaign: await getMillionaireLaunchCampaignStatus() });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/launch-campaign", requireStepUp({ adminOnly: true }), async (req, res) => {
  try {
    if (req.body?.confirmCampaignKey !== "millionaire-launch-2026-07-26") {
      return res.status(400).json({
        error: "Confirm the exact Millionaire launch campaign before sending.",
        code: "campaign_confirmation_required",
      });
    }
    const result = await queueMillionaireLaunchCampaign({
      adminUserId: req.user.id,
      io: req.app.get("io"),
      onlineUsers: req.app.get("onlineUsers"),
    });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "millionaire.launch_email_queued",
      targetType: "AdminEmailCampaign",
      targetId: result.campaign?.campaignKey,
      reason: "Tengacion Millionaire commencement announcement",
      metadata: {
        status: result.campaign?.status,
        audienceCount: result.campaign?.audienceCount,
        alreadyRunningOrSent: result.alreadyRunningOrSent,
      },
    }).catch(() => null);
    return res.status(result.alreadyRunningOrSent ? 200 : 202).json(result);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get("/reminder-campaign", async (_req, res) => {
  try {
    return res.json({ campaign: await getMillionaireReminderCampaignStatus() });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/reminder-campaign", requireStepUp({ adminOnly: true }), async (req, res) => {
  try {
    if (req.body?.confirmCampaignKey !== "millionaire-reminder-2026-07-26") {
      return res.status(400).json({
        error: "Confirm the exact Millionaire reminder campaign before sending.",
        code: "campaign_confirmation_required",
      });
    }
    const result = await queueMillionaireReminderCampaign({
      adminUserId: req.user.id,
      io: req.app.get("io"),
      onlineUsers: req.app.get("onlineUsers"),
    });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "millionaire.reminder_email_queued",
      targetType: "AdminEmailCampaign",
      targetId: result.campaign?.campaignKey,
      reason: "Tengacion Millionaire rules and eligibility reminder",
      metadata: {
        status: result.campaign?.status,
        audienceCount: result.campaign?.audienceCount,
        alreadyRunningOrSent: result.alreadyRunningOrSent,
      },
    }).catch(() => null);
    return res.status(result.alreadyRunningOrSent ? 200 : 202).json(result);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get("/participants", async (req, res) => {
  try {
    return res.json(
      await listMillionaireParticipantsForAdmin({
        search: req.query.search,
        participantStatus: req.query.participantStatus,
        attemptStatus: req.query.attemptStatus,
        payoutStatus: req.query.payoutStatus,
        page: req.query.page,
        limit: req.query.limit,
      })
    );
  } catch (error) {
    return handleError(res, error);
  }
});

router.patch("/attempts/:attemptId/payout", async (req, res) => {
  try {
    return res.json(
      await updateMillionairePayout({
        attemptId: req.params.attemptId,
        status: req.body?.status,
        reference: req.body?.reference,
        note: req.body?.note,
        adminUserId: req.user.id,
      })
    );
  } catch (error) {
    return handleError(res, error);
  }
});

router.patch("/participants/:participantId/status", async (req, res) => {
  try {
    return res.json(
      await updateMillionaireParticipantStatus({
        participantId: req.params.participantId,
        status: req.body?.status,
      })
    );
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
