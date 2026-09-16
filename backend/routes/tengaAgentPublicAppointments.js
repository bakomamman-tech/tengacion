const express = require("express");
const rateLimit = require("express-rate-limit");

const Conversation = require(
  "../models/tengaAgent/Conversation"
);
const {
  resolvePublishedAgent,
} = require(
  "../services/tengaAgent/publicAgentService"
);
const {
  cancelPublicSessionAppointment,
  findPublicSessionAppointment,
  reschedulePublicSessionAppointment,
} = require(
  "../services/tengaAgent/publicAppointmentService"
);

const router = express.Router();
const MAX_SESSION_LENGTH = 160;
const appointmentMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      "Too many appointment changes from this connection. Please try again later.",
  },
});

const cleanText = (value, max) =>
  String(value || "")
    .trim()
    .slice(0, max);

const serializeAppointment = (appointment) => ({
  id: appointment._id,
  status: appointment.status,
  purpose: appointment.purpose || "",
  preferredStartAt: appointment.preferredStartAt,
  timezone: appointment.timezone,
  durationMinutes: appointment.durationMinutes,
  availabilityState:
    appointment.availabilityState || "not_checked",
  availabilitySource:
    appointment.availabilitySource || "request_only",
  confirmedAt: appointment.confirmedAt || null,
  rescheduledAt: appointment.rescheduledAt || null,
  rescheduleCount:
    Number(appointment.rescheduleCount || 0),
  requestedAt: appointment.requestedAt,
  updatedAt: appointment.updatedAt,
});

const resolveSessionContext = async ({
  req,
  sessionId,
}) => {
  const publicAgent = await resolvePublishedAgent({
    organizationSlug: req.params.organizationSlug,
    agentKey: req.params.agentKey,
  });

  if (!publicAgent) {
    return {
      publicAgent: null,
      conversation: null,
    };
  }

  const conversation = await Conversation.findOne({
    organizationId: publicAgent.organization._id,
    agentId: publicAgent.agent._id,
    sessionKey: sessionId,
  });

  return {
    publicAgent,
    conversation,
  };
};

router.get(
  "/:organizationSlug/:agentKey/appointment",
  async (req, res, next) => {
    try {
      const sessionId = cleanText(
        req.query?.sessionId,
        MAX_SESSION_LENGTH
      );

      if (!sessionId) {
        return res.status(400).json({
          message: "Session is required.",
        });
      }

      const { publicAgent, conversation } =
        await resolveSessionContext({
          req,
          sessionId,
        });

      if (!publicAgent) {
        return res.status(404).json({
          message:
            "This TengaAgent is not currently public.",
        });
      }

      if (!conversation) {
        res.set("Cache-Control", "no-store");
        return res.json({
          ok: true,
          exists: false,
          appointment: null,
        });
      }

      const appointment =
        await findPublicSessionAppointment({
          organizationId:
            publicAgent.organization._id,
          agentId: publicAgent.agent._id,
          conversationId: conversation._id,
          sessionKey: sessionId,
        });

      res.set("Cache-Control", "no-store");
      return res.json({
        ok: true,
        exists: Boolean(appointment),
        appointment: appointment
          ? serializeAppointment(appointment)
          : null,
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  "/:organizationSlug/:agentKey/appointment/reschedule",
  appointmentMutationLimiter,
  async (req, res, next) => {
    try {
      const sessionId = cleanText(
        req.body?.sessionId,
        MAX_SESSION_LENGTH
      );

      if (!sessionId) {
        return res.status(400).json({
          message:
            "Session is required before changing an appointment."
        });
      }

      const { publicAgent, conversation } =
        await resolveSessionContext({
          req,
          sessionId,
        });

      if (!publicAgent) {
        return res.status(404).json({
          message:
            "This TengaAgent is not currently public.",
        });
      }

      if (!conversation) {
        return res.status(404).json({
          message:
            "Appointment not found for this session."
        });
      }

      const appointment =
        await reschedulePublicSessionAppointment({
          organizationId:
            publicAgent.organization._id,
          agentId: publicAgent.agent._id,
          conversationId: conversation._id,
          sessionKey: sessionId,
          preferredStartAt:
            req.body?.preferredStartAt,
          timezone: req.body?.timezone,
          durationMinutes:
            req.body?.durationMinutes,
        });

      if (!appointment) {
        return res.status(404).json({
          message:
            "Appointment not found for this session."
        });
      }

      res.set("Cache-Control", "no-store");
      return res.json({
        ok: true,
        appointment: serializeAppointment(appointment),
        message:
          appointment.status === "confirmed"
            ? "Your confirmed appointment has been moved to the new time."
            : "Your requested appointment time has been updated. The business still needs to confirm it.",
      });
    } catch (error) {
      if (
        /appointment|reschedul|future|duration|timezone|available|availability|calendar|booking/i.test(
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

router.patch(
  "/:organizationSlug/:agentKey/appointment/cancel",
  appointmentMutationLimiter,
  async (req, res, next) => {
    try {
      const sessionId = cleanText(
        req.body?.sessionId,
        MAX_SESSION_LENGTH
      );

      if (!sessionId) {
        return res.status(400).json({
          message:
            "Session is required before cancelling an appointment."
        });
      }

      const { publicAgent, conversation } =
        await resolveSessionContext({
          req,
          sessionId,
        });

      if (!publicAgent) {
        return res.status(404).json({
          message:
            "This TengaAgent is not currently public.",
        });
      }

      if (!conversation) {
        return res.status(404).json({
          message:
            "Appointment not found for this session."
        });
      }

      const appointment =
        await cancelPublicSessionAppointment({
          organizationId:
            publicAgent.organization._id,
          agentId: publicAgent.agent._id,
          conversationId: conversation._id,
          sessionKey: sessionId,
        });

      if (!appointment) {
        return res.status(404).json({
          message:
            "Appointment not found for this session."
        });
      }

      res.set("Cache-Control", "no-store");
      return res.json({
        ok: true,
        appointment: serializeAppointment(appointment),
        message: "Your appointment has been cancelled.",
      });
    } catch (error) {
      if (/appointment|cancel|booking/i.test(error?.message || "")) {
        return res.status(400).json({
          message: error.message,
        });
      }

      return next(error);
    }
  }
);

module.exports = router;
