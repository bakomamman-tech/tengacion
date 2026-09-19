const mongoose = require("mongoose");

const Conversation = require("../../models/tengaAgent/Conversation");
const Message = require("../../models/tengaAgent/Message");
const Lead = require("../../models/tengaAgent/Lead");
const Appointment = require("../../models/tengaAgent/Appointment");
const {
  findOwnerWorkspace,
} = require("./ownerWorkspaceService");

const CONVERSATION_STATUSES = new Set([
  "ai_active",
  "handoff_requested",
  "human_active",
  "closed",
]);

const HANDOFF_ACTIONS = new Set([
  "claim",
  "release",
  "close",
  "reopen",
]);

const cleanText = (value, max) =>
  String(value || "").trim().slice(0, max);

const sameId = (left, right) =>
  String(left || "") === String(right || "");

const resolveOwnerConversation = async ({
  userId,
  conversationId,
}) => {
  const workspace = await findOwnerWorkspace(userId);

  if (!workspace) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(String(conversationId || ""))) {
    return {
      ...workspace,
      conversation: null,
    };
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    organizationId: workspace.organization._id,
  });

  return {
    ...workspace,
    conversation,
  };
};

const listOwnerConversations = async ({
  userId,
  status = "all",
  limit = 50,
}) => {
  const workspace = await findOwnerWorkspace(userId);

  if (!workspace) {
    return null;
  }

  const normalizedStatus = cleanText(status, 40).toLowerCase() || "all";

  if (
    normalizedStatus !== "all" &&
    !CONVERSATION_STATUSES.has(normalizedStatus)
  ) {
    throw new Error("Unsupported conversation status.");
  }

  const safeLimit = Math.min(
    Math.max(Number(limit) || 50, 1),
    100
  );

  const query = {
    organizationId: workspace.organization._id,
  };

  if (normalizedStatus !== "all") {
    query.status = normalizedStatus;
  }

  const conversations = await Conversation.find(query)
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .limit(safeLimit)
    .lean();

  if (conversations.length === 0) {
    return {
      ...workspace,
      conversations: [],
    };
  }

  const conversationIds = conversations.map(
    (conversation) => conversation._id
  );

  const [lastMessages, leads, appointments] = await Promise.all([
    Message.aggregate([
      {
        $match: {
          organizationId: workspace.organization._id,
          conversationId: { $in: conversationIds },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$conversationId",
          message: { $first: "$$ROOT" },
        },
      },
    ]),
    Lead.find({
      organizationId: workspace.organization._id,
      conversationId: { $in: conversationIds },
    })
      .select(
        "conversationId name email phone company projectSummary status consentToContact lastCapturedAt"
      )
      .lean(),
    Appointment.find({
      organizationId: workspace.organization._id,
      conversationId: { $in: conversationIds },
    })
      .select(
        "conversationId name email phone company purpose status preferredStartAt timezone durationMinutes"
      )
      .lean(),
  ]);

  const lastMessageByConversation = new Map(
    lastMessages.map((entry) => [
      String(entry._id),
      entry.message,
    ])
  );
  const leadByConversation = new Map(
    leads.map((lead) => [
      String(lead.conversationId),
      lead,
    ])
  );
  const appointmentByConversation = new Map(
    appointments.map((appointment) => [
      String(appointment.conversationId),
      appointment,
    ])
  );

  return {
    ...workspace,
    conversations: conversations.map((conversation) => ({
      ...conversation,
      lastMessage:
        lastMessageByConversation.get(String(conversation._id)) || null,
      lead:
        leadByConversation.get(String(conversation._id)) || null,
      appointment:
        appointmentByConversation.get(String(conversation._id)) || null,
    })),
  };
};

const getOwnerConversation = async ({
  userId,
  conversationId,
  messageLimit = 200,
}) => {
  const resolved = await resolveOwnerConversation({
    userId,
    conversationId,
  });

  if (!resolved || !resolved.conversation) {
    return resolved;
  }

  const safeLimit = Math.min(
    Math.max(Number(messageLimit) || 200, 1),
    500
  );

  const [messagesDesc, lead, appointment] = await Promise.all([
    Message.find({
      organizationId: resolved.organization._id,
      conversationId: resolved.conversation._id,
    })
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean(),
    Lead.findOne({
      organizationId: resolved.organization._id,
      conversationId: resolved.conversation._id,
    }).lean(),
    Appointment.findOne({
      organizationId: resolved.organization._id,
      conversationId: resolved.conversation._id,
    }).lean(),
  ]);

  return {
    ...resolved,
    messages: messagesDesc.reverse(),
    lead,
    appointment,
  };
};

const updateOwnerConversationAction = async ({
  userId,
  conversationId,
  action,
}) => {
  const normalizedAction = cleanText(action, 30).toLowerCase();

  if (!HANDOFF_ACTIONS.has(normalizedAction)) {
    throw new Error("Unsupported handoff action.");
  }

  const resolved = await resolveOwnerConversation({
    userId,
    conversationId,
  });

  if (!resolved || !resolved.conversation) {
    return resolved;
  }

  const conversation = resolved.conversation;
  const now = new Date();

  if (normalizedAction === "claim") {
    if (conversation.status === "closed") {
      throw new Error("Closed conversations must be reopened before claiming.");
    }

    if (conversation.status === "human_active") {
      if (!sameId(conversation.assignedToUser, userId)) {
        throw new Error("This conversation is already assigned to another owner.");
      }
    } else {
      conversation.status = "human_active";
      conversation.assignedToUser = userId;
      conversation.claimedAt = now;
      conversation.closedAt = null;
    }
  }

  if (normalizedAction === "release") {
    if (
      conversation.status !== "human_active" ||
      !sameId(conversation.assignedToUser, userId)
    ) {
      throw new Error("Only the assigned owner can release this conversation.");
    }

    conversation.status = "handoff_requested";
    conversation.assignedToUser = null;
    conversation.claimedAt = null;
    conversation.closedAt = null;
  }

  if (normalizedAction === "close") {
    if (conversation.status !== "closed") {
      conversation.status = "closed";
      conversation.closedAt = now;
    }
  }

  if (normalizedAction === "reopen") {
    if (conversation.status !== "closed") {
      throw new Error("Only closed conversations can be reopened.");
    }

    conversation.status = "handoff_requested";
    conversation.assignedToUser = null;
    conversation.claimedAt = null;
    conversation.closedAt = null;
  }

  await conversation.save();

  return {
    ...resolved,
    conversation,
  };
};

const sendOwnerHumanMessage = async ({
  userId,
  conversationId,
  content,
}) => {
  const messageText = cleanText(content, 6000);

  if (!messageText) {
    throw new Error("Human reply is required.");
  }

  const resolved = await resolveOwnerConversation({
    userId,
    conversationId,
  });

  if (!resolved || !resolved.conversation) {
    return resolved;
  }

  const conversation = resolved.conversation;

  if (
    conversation.status !== "human_active" ||
    !sameId(conversation.assignedToUser, userId)
  ) {
    throw new Error(
      "Claim this conversation before sending a human reply."
    );
  }

  const message = await Message.create({
    organizationId: resolved.organization._id,
    conversationId: conversation._id,
    agentId: conversation.agentId,
    sender: "human",
    senderUserId: userId,
    type: "text",
    content: messageText,
  });

  conversation.lastMessageAt = message.createdAt;
  await conversation.save();

  return {
    ...resolved,
    conversation,
    message,
  };
};

module.exports = {
  CONVERSATION_STATUSES,
  HANDOFF_ACTIONS,
  getOwnerConversation,
  listOwnerConversations,
  resolveOwnerConversation,
  sendOwnerHumanMessage,
  updateOwnerConversationAction,
};
