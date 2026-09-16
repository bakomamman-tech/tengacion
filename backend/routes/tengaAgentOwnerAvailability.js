const express = require("express");

const {
  getOwnerAvailabilitySchedule,
  saveOwnerAvailabilitySchedule,
} = require(
  "../services/tengaAgent/availabilityService"
);

const router = express.Router();

router.get("/availability", async (req, res, next) => {
  try {
    const result =
      await getOwnerAvailabilitySchedule({
        userId: req.user._id,
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
      schedule: result.schedule,
    });
  } catch (error) {
    return next(error);
  }
});

router.put("/availability", async (req, res, next) => {
  try {
    const result =
      await saveOwnerAvailabilitySchedule({
        userId: req.user._id,
        enabled: req.body?.enabled,
        timezone: req.body?.timezone,
        minimumNoticeMinutes:
          req.body?.minimumNoticeMinutes,
        bookingHorizonDays:
          req.body?.bookingHorizonDays,
        slotStepMinutes:
          req.body?.slotStepMinutes,
        defaultDurationMinutes:
          req.body?.defaultDurationMinutes,
        bufferBeforeMinutes:
          req.body?.bufferBeforeMinutes,
        bufferAfterMinutes:
          req.body?.bufferAfterMinutes,
        weeklyHours: req.body?.weeklyHours,
        blockedIntervals:
          req.body?.blockedIntervals,
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
      schedule: result.schedule,
    });
  } catch (error) {
    if (
      /availability|timezone|notice|horizon|slot step|duration|buffer|weekly|blocked|window/i.test(
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
});

router.use(
  "/",
  require("./tengaAgentOwnerCalendars")
);

router.use(
  "/",
  require("./tengaAgentOwnerOutcomes")
);

module.exports = router;
