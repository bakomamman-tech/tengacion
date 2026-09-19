const crypto = require("crypto");
const express = require("express");
const { isTengaAgentPilotMode } = require("../config/tengaAgentPilotMode");

const Conversation = require("../models/tengaAgent/Conversation");
const Message = require("../models/tengaAgent/Message");

const {
  CUSTOMER_ZERO_AGENT_KEY,
  ensureCustomerZeroAgent,
} = require("../services/tengaAgent/customerZeroService");

const {
  respondToCustomerZero,
} = require("../services/tengaAgent/agentRuntimeService");

const {
  captureLead,
} = require("../services/tengaAgent/leadCaptureService");

const {
  captureAppointmentRequest,
} = require("../services/tengaAgent/appointmentService");

const router = express.Router();
const SESSION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_MESSAGE_LENGTH = 2000;
const MAX_SESSION_LENGTH = 160;

const cleanText = (value, max) =>
  String(value || "")
    .trim()
    .slice(0, max);

const wantsAppointmentRequest = (value) => {
  const input = String(value || "")
    .trim()
    .toLowerCase();

  return [
    "appointment",
    "book a meeting",
    "book meeting",
    "book a call",
    "schedule a call",
    "schedule call",
    "schedule a meeting",
    "schedule meeting",
    "set up a meeting",
    "arrange a meeting",
    "meeting time",
  ].some((phrase) =>
    input.includes(phrase)
  );
};

const resolveCustomerZeroAgent = async (
  agentId
) => {
  const agentKey = cleanText(
    agentId,
    120
  ).toLowerCase();

  if (
    agentKey !==
    CUSTOMER_ZERO_AGENT_KEY
  ) {
    return null;
  }

  return ensureCustomerZeroAgent();
};

router.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-store");

  return res.json({
    ok: true,
    product: "TengaAgent",
    stage: "mvp",
    pilotMode: isTengaAgentPilotMode(),
  });
});

// A visitor's cryptographically random session ID is the sole capability for reading
// replies in that visitor's own pilot demo chat. Never accept weak legacy session IDs.
router.get("/chat/:agentId/conversation", async (req, res, next) => {
  try {
    if (!isTengaAgentPilotMode()) return res.status(404).json({ message: "Not found." });
    const sessionId = String(req.query?.sessionId || "");
    if (!SESSION_UUID.test(sessionId)) return res.status(400).json({ message: "Invalid demo session." });
    const context = await resolveCustomerZeroAgent(req.params.agentId);
    if (!context) return res.status(404).json({ message: "Demo agent not found." });
    const conversation = await Conversation.findOne({
      organizationId: context.organization._id,
      agentId: context.agent._id, sessionKey: sessionId, channel: "web",
    });
    res.set("Cache-Control", "no-store");
    if (!conversation) return res.json({ ok: true, status: "ai_active", messages: [] });
    const messages = await Message.find({
      organizationId: context.organization._id, agentId: context.agent._id,
      conversationId: conversation._id, sender: "human",
    }).sort({ createdAt: -1, _id: -1 }).limit(40).lean();
    return res.json({
      ok: true, status: conversation.status,
      messages: messages.reverse().map((item) => ({
        id: item._id, sender: "human", content: item.content, createdAt: item.createdAt,
      })),
    });
  } catch (error) { return next(error); }
});

router.post(
  "/chat/:agentId/message",
  async (req, res, next) => {
    try {
      const customerZero =
        await resolveCustomerZeroAgent(
          req.params.agentId
        );

      if (!customerZero) {
        return res.status(404).json({
          message: "TengaAgent not found.",
        });
      }

      const rawMessage = String(
        req.body?.message || ""
      );

      const message = rawMessage.trim();

      if (!message) {
        return res.status(400).json({
          message: "Message is required.",
        });
      }

      if (
        message.length >
        MAX_MESSAGE_LENGTH
      ) {
        return res.status(400).json({
          message:
            "Message is too long.",
        });
      }

      const requestedSessionId =
        cleanText(
          req.body?.sessionId,
          MAX_SESSION_LENGTH
        );

      const sessionId =
        requestedSessionId ||
        crypto.randomUUID();

      const {
        organization,
        agent,
      } = customerZero;

      let conversation =
        await Conversation.findOne({
          organizationId:
            organization._id,
          agentId: agent._id,
          sessionKey: sessionId,
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
            lastMessageAt:
              new Date(),
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

      if (isTengaAgentPilotMode() && conversation.status === "human_active") {
        conversation.lastMessageAt = new Date();
        await conversation.save();
        res.set("Cache-Control", "no-store");
        return res.json({
          ok: true, conversationId: conversation._id, sessionId,
          reply: "A Tengacion representative is handling this chat. Your message was received; please wait for a reply here.",
          actions: [], agent: { key: agent.key, name: agent.name, role: agent.role },
        });
      }

      const recentMessages =
        await Message.find({
          conversationId:
            conversation._id,
        })
          .sort({
            createdAt: -1,
          })
          .limit(12)
          .lean();

      const conversationHistory =
        recentMessages
          .reverse()
          .map((entry) => ({
            sender:
              entry.sender,
            content:
              entry.content,
          }));

      const result =
        await respondToCustomerZero({
          message,
          organizationId:
            organization._id,
          agentId:
            agent._id,
          conversationHistory,
        });

      // Human takeover may occur while the AI request is in flight.
      let humanTookOver = false;
      if (isTengaAgentPilotMode()) {
        const current = await Conversation.findById(conversation._id).select("status").lean();
        if (current?.status === "human_active") {
          humanTookOver = true;
          result.reply = "A Tengacion representative has taken over this chat. Your message was received; please wait for their reply here.";
          result.actions = [];
        }
      }

      if (!humanTookOver &&
        wantsAppointmentRequest(
          message
        )
      ) {
        result.reply =
          "I can help you request a meeting time with the Tengacion team. Choose a preferred date and time below; the appointment is not confirmed until the team approves it.";
        result.actions = [
          {
            type: "book_appointment",
            label: "Request a meeting time",
          },
        ];
      }

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

      res.set(
        "Cache-Control",
        "no-store"
      );

      return res.json({
        ok: true,
        conversationId:
          conversation._id,
        sessionId,
        reply: result.reply,
        actions:
          result.actions || [],
        agent: {
          key: agent.key,
          name: agent.name,
          role: agent.role,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/chat/:agentId/lead",
  async (req, res, next) => {
    try {
      const customerZero =
        await resolveCustomerZeroAgent(
          req.params.agentId
        );

      if (!customerZero) {
        return res.status(404).json({
          message: "TengaAgent not found.",
        });
      }

      const sessionId =
        cleanText(
          req.body?.sessionId,
          MAX_SESSION_LENGTH
        );

      if (!sessionId) {
        return res.status(400).json({
          message:
            "Session is required before lead capture.",
        });
      }

      const {
        organization,
        agent,
      } = customerZero;

      const conversation =
        await Conversation.findOne({
          organizationId:
            organization._id,
          agentId: agent._id,
          sessionKey: sessionId,
        });

      if (!conversation) {
        return res.status(404).json({
          message:
            "Conversation not found for this session.",
        });
      }

      const lead =
        await captureLead({
          organizationId:
            organization._id,
          agentId: agent._id,
          conversationId:
            conversation._id,
          sessionKey: sessionId,
          name: req.body?.name,
          email: req.body?.email,
          phone: req.body?.phone,
          company:
            req.body?.company,
          projectSummary:
            req.body?.projectSummary,
          source: "web",
          consentToContact:
            req.body?.consentToContact ===
            true,
        });

      conversation.contactId =
        lead._id;
      conversation.status =
        "handoff_requested";

      await conversation.save();

      res.set(
        "Cache-Control",
        "no-store"
      );

      return res.status(201).json({
        ok: true,
        lead: {
          id: lead._id,
          status: lead.status,
        },
        conversation: {
          id: conversation._id,
          status:
            conversation.status,
        },
        message:
          "Thanks. Your details were saved and the Tengacion team can follow up on this enquiry.",
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/chat/:agentId/appointment",
  async (req, res, next) => {
    try {
      const customerZero =
        await resolveCustomerZeroAgent(
          req.params.agentId
        );

      if (!customerZero) {
        return res.status(404).json({
          message: "TengaAgent not found.",
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

      const {
        organization,
        agent,
      } = customerZero;

      const conversation =
        await Conversation.findOne({
          organizationId:
            organization._id,
          agentId: agent._id,
          sessionKey: sessionId,
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
          agentId:
            agent._id,
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
          timezone:
            req.body?.timezone,
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

      res.set(
        "Cache-Control",
        "no-store"
      );

      return res.status(201).json({
        ok: true,
        appointment: {
          id: appointment._id,
          status: appointment.status,
          preferredStartAt:
            appointment.preferredStartAt,
          timezone:
            appointment.timezone,
          durationMinutes:
            appointment.durationMinutes,
        },
        conversation: {
          id: conversation._id,
          status: conversation.status,
        },
        message:
          "Your preferred meeting time has been requested. The Tengacion team still needs to confirm the appointment.",
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
