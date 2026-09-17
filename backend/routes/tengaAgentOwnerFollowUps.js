const express = require("express");

const {
  completeOwnerFollowUp,
  listOwnerFollowUps,
  rescheduleOwnerFollowUp,
} = require("../services/tengaAgent/followUpQueueService");
const {
  listOwnerFollowUpActivities,
  logOwnerFollowUpContact,
  sendOwnerFollowUpEmail,
} = require("../services/tengaAgent/followUpActivityService");

const router = express.Router();

const respondNotFound = (res, result) => {
  if (!result?.workspaceFound) {
    return res.status(404).json({
      ok: false,
      message: "TengaAgent workspace not found.",
    });
  }

  if (!result?.appointment) {
    return res.status(404).json({
      ok: false,
      message: "TengaAgent follow-up not found.",
    });
  }

  return null;
};

const respondActivityValidationError = (res, error) => {
  if (error?.code !== "TENGAAGENT_FOLLOW_UP_ACTIVITY_VALIDATION") return null;
  return res.status(400).json({
    ok: false,
    message: error.message,
  });
};

router.get("/follow-ups", async (req, res, next) => {
  try {
    const result = await listOwnerFollowUps({
      userId: req.user._id,
      filter: req.query?.filter,
      limit: req.query?.limit,
    });

    if (!result) {
      return res.status(404).json({
        ok: false,
        message: "TengaAgent workspace not found.",
      });
    }

    res.set("Cache-Control", "no-store");
    return res.json({
      ok: true,
      filter: result.filter,
      metrics: result.metrics,
      followUps: result.followUps,
    });
  } catch (error) {
    if (/follow-up queue filter/i.test(error?.message || "")) {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
    return next(error);
  }
});

router.get("/follow-ups/:appointmentId/activity", async (req, res, next) => {
  try {
    const result = await listOwnerFollowUpActivities({
      userId: req.user._id,
      appointmentId: req.params.appointmentId,
      limit: req.query?.limit,
    });

    const notFoundResponse = respondNotFound(res, result);
    if (notFoundResponse) return notFoundResponse;

    res.set("Cache-Control", "no-store");
    return res.json({
      ok: true,
      activities: result.activities,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/follow-ups/:appointmentId/send-email", async (req, res, next) => {
  try {
    const result = await sendOwnerFollowUpEmail({
      userId: req.user._id,
      appointmentId: req.params.appointmentId,
      subject: req.body?.subject,
      message: req.body?.message,
    });

    const notFoundResponse = respondNotFound(res, result);
    if (notFoundResponse) return notFoundResponse;

    res.set("Cache-Control", "no-store");
    if (result.deliveryFailed) {
      return res.status(502).json({
        ok: false,
        message: `Follow-up email was recorded but delivery failed: ${result.deliveryError}`,
        activity: result.activity,
      });
    }

    return res.status(201).json({
      ok: true,
      activity: result.activity,
    });
  } catch (error) {
    const validationResponse = respondActivityValidationError(res, error);
    if (validationResponse) return validationResponse;
    return next(error);
  }
});

router.post("/follow-ups/:appointmentId/log-contact", async (req, res, next) => {
  try {
    const result = await logOwnerFollowUpContact({
      userId: req.user._id,
      appointmentId: req.params.appointmentId,
      channel: req.body?.channel,
      direction: req.body?.direction,
      notes: req.body?.notes,
      occurredAt: req.body?.occurredAt,
    });

    const notFoundResponse = respondNotFound(res, result);
    if (notFoundResponse) return notFoundResponse;

    res.set("Cache-Control", "no-store");
    return res.status(201).json({
      ok: true,
      activity: result.activity,
    });
  } catch (error) {
    const validationResponse = respondActivityValidationError(res, error);
    if (validationResponse) return validationResponse;
    return next(error);
  }
});

router.patch("/follow-ups/:appointmentId/complete", async (req, res, next) => {
  try {
    const result = await completeOwnerFollowUp({
      userId: req.user._id,
      appointmentId: req.params.appointmentId,
    });

    const notFoundResponse = respondNotFound(res, result);
    if (notFoundResponse) return notFoundResponse;

    res.set("Cache-Control", "no-store");
    return res.json({
      ok: true,
      followUp: result.followUp,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/follow-ups/:appointmentId/reschedule", async (req, res, next) => {
  try {
    const result = await rescheduleOwnerFollowUp({
      userId: req.user._id,
      appointmentId: req.params.appointmentId,
      followUpAt: req.body?.followUpAt,
    });

    const notFoundResponse = respondNotFound(res, result);
    if (notFoundResponse) return notFoundResponse;

    res.set("Cache-Control", "no-store");
    return res.json({
      ok: true,
      followUp: result.followUp,
    });
  } catch (error) {
    if (/follow-up|future|due date|complete/i.test(error?.message || "")) {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
    return next(error);
  }
});

module.exports = router;
