const crypto = require("crypto");
const express = require("express");

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

const router = express.Router();

const MAX_MESSAGE_LENGTH = 2000;
const MAX_SESSION_LENGTH = 160;

const cleanText = (value, max) =>
  String(value || "")
    .trim()
    .slice(0, max);

const resolveCustomerZeroAgent = async (agentId) => {
  const agentKey = cleanText(agentId, 120).toLowerCase();

  if (agentKey !== CUSTOMER_ZERO_AGENT_KEY) {
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
  });
});

router.post(
  "/chat/:agentId/message",
  async (req, res, next) => {
    try {
      const customerZero = await resolveCustomerZeroAgent(
        req.params.agentId
      );

      if (!customerZero) {
        return res.status(404).json({
          message: "TengaAgent not found.",
        });
      }

      const rawMessage = String(req.body?.message || "");
      const message = rawMessage.trim();

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

      const sessionId = requestedSessionId || crypto.randomUUID();
      const { organization, agent } = customerZero;

      let conversation = await Conversation.findOne({
        organizationId: organization._id,
        agentId: agent._id,
        sessionKey: sessionId,
      });

      if (!conversation) {
        conversation = await Conversation.create({
          organizationId: organization._id,
          agentId: agent._id,
          sessionKey: sessionId,
          channel: "web",
          status: "ai_active",
          lastMessageAt: new Date(),
        });
      }

      await Message.create({
        organizationId: organization._id,
        conversationId: conversation._id,
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

      const conversationHistory = recentMessages
        .reverse()
        .map((entry) => ({
          sender: entry.sender,
          content: entry.content,
        }));

      const result = await respondToCustomerZero({
        message,
        organizationId: organization._id,
        agentId: agent._id,
        conversationHistory,
      });

      const agentMessage = await Message.create({
        organizationId: organization._id,
        conversationId: conversation._id,
        agentId: agent._id,
        sender: "agent",
        type: "text",
        content: result.reply,
      });

      conversation.lastMessageAt = agentMessage.createdAt;
      await conversation.save();

      res.set("Cache-Control", "no-store");

      return res.json({
        ok: true,
        conversationId: conversation._id,
        sessionId,
        reply: result.reply,
        actions: result.actions || [],
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
      const customerZero = await resolveCustomerZeroAgent(
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
          message: "Session is required before lead capture.",
        });
      }

      const { organization, agent } = customerZero;

      const conversation = await Conversation.findOne({
        organizationId: organization._id,
        agentId: agent._id,
        sessionKey: sessionId,
      });

      if (!conversation) {
        return res.status(404).json({
          message: "Conversation not found for this session.",
        });
      }

      const lead = await captureLead({
        organizationId: organization._id,
        agentId: agent._id,
        conversationId: conversation._id,
        sessionKey: sessionId,
        name: req.body?.name,
        email: req.body?.email,
        phone: req.body?.phone,
        company: req.body?.company,
        projectSummary: req.body?.projectSummary,
        source: "web",
        consentToContact: req.body?.consentToContact === true,
      });

      conversation.contactId = lead._id;
      conversation.status = "handoff_requested";
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
          "Thanks. Your details were saved and the Tengacion team can follow up on this enquiry.",
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
