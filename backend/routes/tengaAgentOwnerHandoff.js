const express = require("express");

const auth = require("../middleware/auth");
const {
  getOwnerConversation,
  listOwnerConversations,
  sendOwnerHumanMessage,
  updateOwnerConversationAction,
} = require("../services/tengaAgent/handoffService");

const router = express.Router();

router.use(auth);

const serializeMessage = (message) =>
  message
    ? {
        id: message._id,
        sender: message.sender,
        content: message.content,
        createdAt: message.createdAt,
      }
    : null;

const serializeLead = (lead) =>
  lead
    ? {
        id: lead._id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        projectSummary: lead.projectSummary,
        status: lead.status,
        consentToContact: lead.consentToContact,
        lastCapturedAt: lead.lastCapturedAt,
      }
    : null;

const serializeAppointment = (appointment) =>
  appointment
    ? {
        id: appointment._id,
        name: appointment.name,
        email: appointment.email,
        phone: appointment.phone,
        company: appointment.company,
        purpose: appointment.purpose,
        status: appointment.status,
        preferredStartAt: appointment.preferredStartAt,
        timezone: appointment.timezone,
        durationMinutes: appointment.durationMinutes,
      }
    : null;

const serializeConversation = (conversation) => ({
  id: conversation._id,
  status: conversation.status,
  channel: conversation.channel,
  sessionKey: conversation.sessionKey,
  assignedToUser: conversation.assignedToUser,
  claimedAt: conversation.claimedAt,
  closedAt: conversation.closedAt,
  lastMessageAt: conversation.lastMessageAt,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
  lastMessage: serializeMessage(conversation.lastMessage),
  lead: serializeLead(conversation.lead),
  appointment: serializeAppointment(conversation.appointment),
});

router.get("/conversations", async (req, res, next) => {
  try {
    const result = await listOwnerConversations({
      userId: req.user._id,
      status: req.query?.status || "all",
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
      conversations: result.conversations.map(
        serializeConversation
      ),
    });
  } catch (error) {
    if (/unsupported conversation status/i.test(error?.message || "")) {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }

    return next(error);
  }
});

router.get(
  "/conversations/:conversationId",
  async (req, res, next) => {
    try {
      const result = await getOwnerConversation({
        userId: req.user._id,
        conversationId: req.params.conversationId,
      });

      if (!result || !result.conversation) {
        return res.status(404).json({
          ok: false,
          message: "Conversation not found.",
        });
      }

      res.set("Cache-Control", "no-store");
      return res.json({
        ok: true,
        conversation: serializeConversation({
          ...result.conversation.toObject(),
          lead: result.lead,
          appointment: result.appointment,
        }),
        messages: result.messages.map(serializeMessage),
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  "/conversations/:conversationId/action",
  async (req, res, next) => {
    try {
      const result = await updateOwnerConversationAction({
        userId: req.user._id,
        conversationId: req.params.conversationId,
        action: req.body?.action,
      });

      if (!result || !result.conversation) {
        return res.status(404).json({
          ok: false,
          message: "Conversation not found.",
        });
      }

      res.set("Cache-Control", "no-store");
      return res.json({
        ok: true,
        conversation: serializeConversation(result.conversation),
      });
    } catch (error) {
      if (
        /unsupported handoff action|closed conversations|assigned to another|assigned owner|only closed/i.test(
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

router.post(
  "/conversations/:conversationId/messages",
  async (req, res, next) => {
    try {
      const result = await sendOwnerHumanMessage({
        userId: req.user._id,
        conversationId: req.params.conversationId,
        content: req.body?.content,
      });

      if (!result || !result.conversation) {
        return res.status(404).json({
          ok: false,
          message: "Conversation not found.",
        });
      }

      res.set("Cache-Control", "no-store");
      return res.status(201).json({
        ok: true,
        conversation: serializeConversation(result.conversation),
        message: serializeMessage(result.message),
      });
    } catch (error) {
      if (/human reply|required|claim this conversation/i.test(error?.message || "")) {
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
