const crypto = require("crypto");
const express = require("express");

const Conversation = require("../models/tengaAgent/Conversation");
const Message = require("../models/tengaAgent/Message");

const {
  resolvePublishedAgent,
  respondToPublishedAgent,
} = require("../services/tengaAgent/publicAgentService");

const {
  captureLead,
} = require("../services/tengaAgent/leadCaptureService");

const {
  captureAppointmentRequest,
} = require("../services/tengaAgent/appointmentService");

const router = express.Router();

const MAX_MESSAGE_LENGTH = 2000;
const MAX_SESSION_LENGTH = 160;

const cleanText = (value, max) =>
  String(value || "")
    .trim()
    .slice(0, max);

const serializePublicAgent = ({
  organization,
  agent,
}) => ({
  organization: {
    name: organization.name,
    slug: organization.slug,
    website: organization.website,
    industry: organization.industry,
    countryCode: organization.countryCode,
    timezone: organization.timezone,
  },
  agent: {
    key: agent.key,
    name: agent.name,
    role: agent.role,
    greeting: agent.greeting,
    tone: agent.tone,
    languages: agent.languages,
  },
});

const resolveRequestAgent = (req) =>
  resolvePublishedAgent({
    organizationSlug:
      req.params.organizationSlug,
    agentKey: req.params.agentKey,
  });

const findConversation = ({
  organization,
  agent,
  sessionId,
}) =>
  Conversation.findOne({
    organizationId: organization._id,
    agentId: agent._id,
    sessionKey: sessionId,
  });

router.get(
  "/:organizationSlug/:agentKey",
  async (req, res, next) => {
    try {
      const publicAgent =
        await resolveRequestAgent(req);

      if (!publicAgent) {
        return res.status(404).json({
          message:
            "This TengaAgent is not currently public.",
        });
      }

      res.set("Cache-Control", "no-store");

      return res.json({
        ok: true,
        ...serializePublicAgent(publicAgent),
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/:organizationSlug/:agentKey/message",
  async (req, res, next) => {
    try {
      const publicAgent =
        await resolveRequestAgent(req);

      if (!publicAgent) {
        return res.status(404).json({
          message:
            "This TengaAgent is not currently public.",
        });
      }

      const message = String(
        req.body?.message || ""
      ).trim();

      if (!message) {
        return res.status(400).json({
          message: "Message is required.",
        });
      }

      if (message.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({
          message: "Message is too long.",
        });
      }

      const requestedSessionId = cleanText(
        req.body?.sessionId,
        MAX_SESSION_LENGTH
      );

      const sessionId =
        requestedSessionId ||
        crypto.randomUUID();

      const { organization, agent } =
        publicAgent;

      let conversation =
        await findConversation({
          organization,
          agent,
          sessionId,
        });

      if (!conversation) {
        conversation =
          await Conversation.create({
            organizationId:
              organization._id,
            agentId: agent._id,
            sessionKey: sessionId,
            channel: "web",
            status: "ai_active",
            lastMessageAt: new Date(),
          });
      }

      await Message.create({
        organizationId:
          organization._id,
        conversationId:
          conversation._id,
        agentId: agent._id,
        sender: "customer",
        type: "text",
        content: message,
      });

      const recentMessages = await Message.find({
        conversationId: conversation._id,
      })
        .sort({ createdAt: -1 })
        .limit(12)
        .lean();

      const conversationHistory =
        recentMessages
          .reverse()
          .map((entry) => ({
            sender: entry.sender,
            content: entry.content,
          }));

      const result =
        await respondToPublishedAgent({
          organization,
          agent,
          message,
          conversationHistory,
        });

      const agentMessage =
        await Message.create({
          organizationId:
            organization._id,
          conversationId:
            conversation._id,
          agentId: agent._id,
          sender: "agent",
          type: "text",
          content: result.reply,
        });

      conversation.lastMessageAt =
        agentMessage.createdAt;
      await conversation.save();

      res.set("Cache-Control", "no-store");

      return res.json({
        ok: true,
        conversationId:
          conversation._id,
        sessionId,
        reply: result.reply,
        actions: result.actions || [],
        ...serializePublicAgent(
          publicAgent
        ),
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/:organizationSlug/:agentKey/lead",
  async (req, res, next) => {
    try {
      const publicAgent =
        await resolveRequestAgent(req);

      if (!publicAgent) {
        return res.status(404).json({
          message:
            "This TengaAgent is not currently public.",
        });
      }

      const sessionId = cleanText(
        req.body?.sessionId,
        MAX_SESSION_LENGTH
      );

      if (!sessionId) {
        return res.status(400).json({
          message:
            "Session is required before lead capture.",
        });
      }

      const { organization, agent } =
        publicAgent;

      const conversation =
        await findConversation({
          organization,
          agent,
          sessionId,
        });

      if (!conversation) {
        return res.status(404).json({
          message:
            "Conversation not found for this session.",
        });
      }

      const lead = await captureLead({
        organizationId: organization._id,
        agentId: agent._id,
        conversationId:
          conversation._id,
        sessionKey: sessionId,
        name: req.body?.name,
        email: req.body?.email,
        phone: req.body?.phone,
        company: req.body?.company,
        projectSummary:
          req.body?.projectSummary,
        source: "web",
        consentToContact:
          req.body?.consentToContact ===
          true,
      });

      conversation.contactId = lead._id;
      conversation.status =
        "handoff_requested";
      await conversation.save();

      res.set("Cache-Control", "no-store");

      return res.status(201).json({
        ok: true,
        lead: {
          id: lead._id,
          status: lead.status,
        },
        conversation: {
          id: conversation._id,
          status: conversation.status,
        },
        message:
          `Thanks. Your details were saved and ${organization.name} can follow up on this enquiry.`,
      });
    } catch (error) {
      if (
        /email|phone|contact|consent|required/i.test(
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

router.post(
  "/:organizationSlug/:agentKey/appointment",
  async (req, res, next) => {
    try {
      const publicAgent =
        await resolveRequestAgent(req);

      if (!publicAgent) {
        return res.status(404).json({
          message:
            "This TengaAgent is not currently public.",
        });
      }

      const sessionId = cleanText(
        req.body?.sessionId,
        MAX_SESSION_LENGTH
      );

      if (!sessionId) {
        return res.status(400).json({
          message:
            "Session is required before requesting an appointment.",
        });
      }

      const { organization, agent } =
        publicAgent;

      const conversation =
        await findConversation({
          organization,
          agent,
          sessionId,
        });

      if (!conversation) {
        return res.status(404).json({
          message:
            "Conversation not found for this session.",
        });
      }

      const appointment =
        await captureAppointmentRequest({
          organizationId:
            organization._id,
          agentId: agent._id,
          conversationId:
            conversation._id,
          sessionKey: sessionId,
          name: req.body?.name,
          email: req.body?.email,
          phone: req.body?.phone,
          company: req.body?.company,
          purpose: req.body?.purpose,
          notes: req.body?.notes,
          preferredStartAt:
            req.body?.preferredStartAt,
          timezone: req.body?.timezone,
          durationMinutes:
            req.body?.durationMinutes,
          source: "web",
          consentToContact:
            req.body?.consentToContact ===
            true,
        });

      conversation.status =
        "handoff_requested";
      await conversation.save();

      res.set("Cache-Control", "no-store");

      return res.status(201).json({
        ok: true,
        appointment: {
          id: appointment._id,
          status: appointment.status,
          preferredStartAt:
            appointment.preferredStartAt,
          timezone: appointment.timezone,
          durationMinutes:
            appointment.durationMinutes,
        },
        conversation: {
          id: conversation._id,
          status: conversation.status,
        },
        message:
          `Your preferred meeting time has been requested. ${organization.name} still needs to confirm the appointment.`,
      });
    } catch (error) {
      if (
        /appointment|email|phone|contact|consent|timezone|future|duration|changed/i.test(
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
