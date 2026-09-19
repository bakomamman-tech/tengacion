process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  "mongodb://127.0.0.1:27017/tengaagent-handoff-route-test";
process.env.JWT_SECRET = "tengaagent-handoff-route-test-secret";
process.env.OPENAI_API_KEY = "";

jest.mock(
  "../middleware/auth",
  () => (req, res, next) => {
    const userId = req.headers["x-test-user-id"];
    if (!userId) {
      return res.status(401).json({ error: "No token" });
    }
    req.user = { id: userId, _id: userId };
    req.userId = userId;
    return next();
  }
);

const express = require("express");
const mongoose = require("mongoose");
const request = require("supertest");
const {
  MongoMemoryServer,
} = require("mongodb-memory-server");

const ownerRoutes = require("../routes/tengaAgentOwner");
const publicRoutes = require("../routes/tengaAgentPublic");
const Conversation = require("../models/tengaAgent/Conversation");
const Message = require("../models/tengaAgent/Message");
const {
  createOrUpdateOwnerWorkspace,
  setOwnerAgentPublication,
} = require("../services/tengaAgent/ownerWorkspaceService");

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  app = express();
  app.use(express.json());
  app.use("/api/tengaagent/owner", ownerRoutes);
  app.use("/api/tengaagent/public", publicRoutes);
  app.use((error, _req, res, _next) =>
    res.status(500).json({
      message: error?.message || "Internal error",
    })
  );
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
  const published = await setOwnerAgentPublication({
    userId,
    published: true,
  });
  return { userId, ...published };
};

const publicPath = (owner) =>
  `/api/tengaagent/public/${owner.organization.slug}/${owner.agent.key}`;

describe("TengaAgent human handoff HTTP flow", () => {
  it("lets an owner claim and reply while suppressing AI for the visitor", async () => {
    const owner = await createOwner("Northstar Support");
    const sessionId = "human-flow-session";

    await request(app)
      .post(`${publicPath(owner)}/message`)
      .send({
        sessionId,
        message: "I need a human to help me",
      })
      .expect(200);

    const conversation = await Conversation.findOne({
      organizationId: owner.organization._id,
      sessionKey: sessionId,
    });
    conversation.status = "handoff_requested";
    await conversation.save();

    const claimed = await request(app)
      .patch(
        `/api/tengaagent/owner/conversations/${conversation._id}/action`
      )
      .set("x-test-user-id", owner.userId.toString())
      .send({ action: "claim" })
      .expect(200);

    expect(claimed.body.conversation.status).toBe("human_active");

    await request(app)
      .post(
        `/api/tengaagent/owner/conversations/${conversation._id}/messages`
      )
      .set("x-test-user-id", owner.userId.toString())
      .send({ content: "Hello, I have taken over this chat." })
      .expect(201);

    const agentMessagesBefore = await Message.countDocuments({
      conversationId: conversation._id,
      sender: "agent",
    });

    const visitorMessage = await request(app)
      .post(`${publicPath(owner)}/message`)
      .send({
        sessionId,
        message: "Thank you. Can you check my request?",
      })
      .expect(200);

    expect(visitorMessage.body.mode).toBe("human");
    expect(visitorMessage.body.status).toBe("human_active");
    expect(visitorMessage.body.reply).toBeNull();

    const agentMessagesAfter = await Message.countDocuments({
      conversationId: conversation._id,
      sender: "agent",
    });
    expect(agentMessagesAfter).toBe(agentMessagesBefore);

    const transcript = await request(app)
      .get(`${publicPath(owner)}/conversation`)
      .query({ sessionId })
      .expect(200);

    expect(transcript.body.status).toBe("human_active");
    expect(transcript.body.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sender: "human",
          content: "Hello, I have taken over this chat.",
        }),
        expect.objectContaining({
          sender: "customer",
          content: "Thank you. Can you check my request?",
        }),
      ])
    );
  });

  it("reopens a closed conversation to AI only when the visitor sends a new message", async () => {
    const owner = await createOwner("Reopen Support");
    const sessionId = "closed-session";

    const conversation = await Conversation.create({
      organizationId: owner.organization._id,
      agentId: owner.agent._id,
      sessionKey: sessionId,
      channel: "web",
      status: "closed",
      closedAt: new Date(),
      lastMessageAt: new Date(),
    });

    const response = await request(app)
      .post(`${publicPath(owner)}/message`)
      .send({
        sessionId,
        message: "I have another question",
      })
      .expect(200);

    expect(response.body.mode).toBe("ai");
    expect(response.body.status).toBe("ai_active");

    const refreshed = await Conversation.findById(conversation._id);
    expect(refreshed.status).toBe("ai_active");
    expect(refreshed.closedAt).toBeNull();
  });

  it("does not expose another tenant conversation through owner routes", async () => {
    const ownerA = await createOwner("Alpha Support");
    const ownerB = await createOwner("Beta Support");

    const conversationA = await Conversation.create({
      organizationId: ownerA.organization._id,
      agentId: ownerA.agent._id,
      sessionKey: "alpha-private-session",
      channel: "web",
      status: "handoff_requested",
      lastMessageAt: new Date(),
    });

    await request(app)
      .get(
        `/api/tengaagent/owner/conversations/${conversationA._id}`
      )
      .set("x-test-user-id", ownerB.userId.toString())
      .expect(404);

    await request(app)
      .patch(
        `/api/tengaagent/owner/conversations/${conversationA._id}/action`
      )
      .set("x-test-user-id", ownerB.userId.toString())
      .send({ action: "claim" })
      .expect(404);
  });
});
