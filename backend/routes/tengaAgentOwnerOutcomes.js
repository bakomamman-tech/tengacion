const express = require("express");

const {
  listOwnerAppointmentOutcomes,
  updateOwnerAppointmentOutcome,
} = require("../services/tengaAgent/appointmentOutcomeService");
const {
  startFollowUpReminderScheduler,
} = require("../services/tengaAgent/followUpReminderService");

const router = express.Router();

startFollowUpReminderScheduler();

router.get("/appointment-outcomes", async (req, res, next) => {
  try {
    const result = await listOwnerAppointmentOutcomes({
      userId: req.user._id,
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
      outcomes: result.outcomes,
      metrics: result.metrics,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch(
  "/appointments/:appointmentId/outcome",
  async (req, res, next) => {
    try {
      const result = await updateOwnerAppointmentOutcome({
        userId: req.user._id,
        appointmentId: req.params.appointmentId,
        disposition: req.body?.disposition,
        notes: req.body?.notes,
        followUpNeeded: req.body?.followUpNeeded,
        followUpAt: req.body?.followUpAt,
      });

      if (!result.workspaceFound) {
        return res.status(404).json({
          ok: false,
          message: "TengaAgent workspace not found.",
        });
      }

      if (!result.appointment) {
        return res.status(404).json({
          ok: false,
          message: "TengaAgent appointment not found.",
        });
      }

      res.set("Cache-Control", "no-store");
      return res.json({
        ok: true,
        outcome: result.outcome,
      });
    } catch (error) {
      if (
        /outcome|disposition|follow-up|completed|no-show/i.test(
          error?.message || ""
        )
      ) {
        return res.status(400).json({
          ok: false,
          message: error.message,
        });
      }

      return next(error);
    }
  }
);

module.exports = router;
