const express = require("express");

const {
  completeOwnerFollowUp,
  listOwnerFollowUps,
  rescheduleOwnerFollowUp,
} = require("../services/tengaAgent/followUpQueueService");

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
