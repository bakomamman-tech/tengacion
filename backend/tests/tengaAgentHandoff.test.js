process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  "mongodb://127.0.0.1:27017/tengaagent-handoff-test";
process.env.JWT_SECRET = "tengaagent-handoff-test-secret";
process.env.OPENAI_API_KEY = "";

const mongoose = require("mongoose");
const {
  MongoMemoryServer,
} = require("mongodb-memory-server");

const Conversation = require("../models/tengaAgent/Conversation");
const Message = require("../models/tengaAgent/Message");
const Lead = require("../models/tengaAgent/Lead");
const {
  createOrUpdateOwnerWorkspace,
} = require("../services/tengaAgent/ownerWorkspaceService");
const {
  getOwnerConversation,
  listOwnerConversations,
  sendOwnerHumanMessage,
  updateOwnerConversationAction,
} = require("../services/tengaAgent/handoffService");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});

const createOwner = async (name) => {
  const userId = new mongoose.Types.ObjectId();
  const workspace = await createOrUpdateOwnerWorkspace({
    userId,
    name,
    industry: "Services",
    countryCode: "NG",
    timezone: "Africa/Lagos",
  });

  return { userId, ...workspace };
};

const createConversation = async ({ owner, sessionKey, status }) => {
  const conversation = await Conversation.create({
    organizationId: owner.organization._id,
    agentId: owner.agent._id,
    sessionKey,
    channel: "web",
    status,
    lastMessageAt: new Date(),
  });

  await Message.create({
    organizationId: owner.organization._id,
    conversationId: conversation._id,
    agentId: owner.agent._id,
    sender: "customer",
    content: `Message from ${sessionKey}`,
  });

  return conversation;
};

describe("TengaAgent human handoff service", () => {
  it("lists only the authenticated tenant conversations with lead context", async () => {
    const ownerA = await createOwner("Alpha Services");
    const ownerB = await createOwner("Beta Services");

    const alphaConversation = await createConversation({
      owner: ownerA,
      sessionKey: "alpha-session",
      status: "handoff_requested",
    });
    await createConversation({
      owner: ownerB,
      sessionKey: "beta-session",
      status: "handoff_requested",
    });

    await Lead.create({
      organizationId: ownerA.organization._id,
      agentId: ownerA.agent._id,
      conversationId: alphaConversation._id,
      sessionKey: "alpha-session",
      name: "Alpha Visitor",
      email: "alpha@example.com",
      source: "web",
      status: "new",
      consentToContact: true,
      lastCapturedAt: new Date(),
    });

    const result = await listOwnerConversations({
      userId: ownerA.userId,
      status: "all",
      limit: 100,
    });

    expect(result.conversations).toHaveLength(1);
    expect(result.conversations[0].sessionKey).toBe("alpha-session");
    expect(result.conversations[0].lead.email).toBe("alpha@example.com");
    expect(result.conversations[0].lastMessage.content).toBe(
      "Message from alpha-session"
    );
  });

  it("supports claim, human reply, release, close and reopen with audit fields", async () => {
    const owner = await createOwner("Northstar Support");
    const conversation = await createConversation({
      owner,
      sessionKey: "handoff-session",
      status: "handoff_requested",
    });

    const claimed = await updateOwnerConversationAction({
      userId: owner.userId,
      conversationId: conversation._id,
      action: "claim",
    });

    expect(claimed.conversation.status).toBe("human_active");
    expect(String(claimed.conversation.assignedToUser)).toBe(
      String(owner.userId)
    );
    expect(claimed.conversation.claimedAt).toBeTruthy();

    const replied = await sendOwnerHumanMessage({
      userId: owner.userId,
      conversationId: conversation._id,
      content: "Hello, a human is here to help.",
    });

    expect(replied.message.sender).toBe("human");
    expect(String(replied.message.senderUserId)).toBe(
      String(owner.userId)
    );

    const released = await updateOwnerConversationAction({
      userId: owner.userId,
      conversationId: conversation._id,
      action: "release",
    });
    expect(released.conversation.status).toBe("handoff_requested");
    expect(released.conversation.assignedToUser).toBeNull();

    await updateOwnerConversationAction({
      userId: owner.userId,
      conversationId: conversation._id,
      action: "claim",
    });
    const closed = await updateOwnerConversationAction({
      userId: owner.userId,
      conversationId: conversation._id,
      action: "close",
    });
    expect(closed.conversation.status).toBe("closed");
    expect(closed.conversation.closedAt).toBeTruthy();

    const reopened = await updateOwnerConversationAction({
      userId: owner.userId,
      conversationId: conversation._id,
      action: "reopen",
    });
    expect(reopened.conversation.status).toBe("handoff_requested");
    expect(reopened.conversation.closedAt).toBeNull();
  });

  it("rejects cross-tenant transcript access and handoff actions", async () => {
    const ownerA = await createOwner("Alpha Boundary");
    const ownerB = await createOwner("Beta Boundary");
    const conversationA = await createConversation({
      owner: ownerA,
      sessionKey: "private-alpha",
      status: "handoff_requested",
    });

    const detail = await getOwnerConversation({
      userId: ownerB.userId,
      conversationId: conversationA._id,
    });
    expect(detail.conversation).toBeNull();

    const action = await updateOwnerConversationAction({
      userId: ownerB.userId,
      conversationId: conversationA._id,
      action: "claim",
    });
    expect(action.conversation).toBeNull();

    const unchanged = await Conversation.findById(
      conversationA._id
    );
    expect(unchanged.status).toBe("handoff_requested");
  });
});
