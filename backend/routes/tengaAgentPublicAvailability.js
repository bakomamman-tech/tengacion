const express = require("express");

const {
  resolvePublishedAgent,
} = require(
  "../services/tengaAgent/publicAgentService"
);
const {
  getPublicAvailability,
} = require(
  "../services/tengaAgent/availabilityService"
);

const router = express.Router();

router.get(
  "/:organizationSlug/:agentKey/availability",
  async (req, res, next) => {
    try {
      const publicAgent =
        await resolvePublishedAgent({
          organizationSlug:
            req.params.organizationSlug,
          agentKey: req.params.agentKey,
        });

      if (!publicAgent) {
        return res.status(404).json({
          message:
            "This TengaAgent is not currently public.",
        });
      }

      const availability =
        await getPublicAvailability({
          organization:
            publicAgent.organization,
          agent: publicAgent.agent,
          from: req.query?.from,
          to: req.query?.to,
          durationMinutes:
            req.query?.durationMinutes,
        });

      res.set("Cache-Control", "no-store");
      return res.json({
        ok: true,
        ...availability,
        slots: availability.slots.map(
          (slot) => ({
            startAt: slot.startAt,
            endAt: slot.endAt,
          })
        ),
      });
    } catch (error) {
      if (
        /availability range|duration|required|invalid/i.test(
          error?.message || ""
        )
      ) {
        return res.status(400).json({
          message: error.message,
        });
      }

      return next(error);
    }
  }
);

module.exports = router;
