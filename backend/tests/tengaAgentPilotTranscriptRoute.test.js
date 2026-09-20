"use strict";
const express = require("express");
const request = require("supertest");

jest.mock("../config/tengaAgentPilotMode", () => ({
  isTengaAgentPilotMode: jest.fn(),
}));
jest.mock("../services/tengaAgent/customerZeroService", () => ({
  CUSTOMER_ZERO_AGENT_KEY: "tengacion-demo",
  ensureCustomerZeroAgent: jest.fn(),
}));
jest.mock("../models/tengaAgent/Conversation", () => ({ findOne: jest.fn() }));
jest.mock("../models/tengaAgent/Message", () => ({ find: jest.fn() }));

const { isTengaAgentPilotMode } = require("../config/tengaAgentPilotMode");
const { ensureCustomerZeroAgent } = require("../services/tengaAgent/customerZeroService");
const Conversation = require("../models/tengaAgent/Conversation");
const Message = require("../models/tengaAgent/Message");
const router = require("../routes/tengaAgent");

const app = express();
app.use(express.json());
app.use("/api/tengaagent", router);
const sessionId = "9bbf15cc-d704-4c58-8e3f-49726249a102";
const url = "/api/tengaagent/chat/tengacion-demo/conversation?sessionId=" + sessionId;

const entries = [
  { _id: "human-1", sender: "human", content: "How can I help?", createdAt: new Date("2026-09-20T00:03:00Z") },
  { _id: "ai-1", sender: "agent", content: "We build websites.", createdAt: new Date("2026-09-20T00:02:00Z") },
  { _id: "customer-1", sender: "customer", content: "Do you build websites?", createdAt: new Date("2026-09-20T00:01:00Z") },
];

describe("pilot visitor session-scoped transcript", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isTengaAgentPilotMode.mockReturnValue(true);
    ensureCustomerZeroAgent.mockResolvedValue({
      organization: { _id: "demo-org" },
      agent: { _id: "demo-agent" },
    });
    Conversation.findOne.mockResolvedValue({ _id: "demo-conversation", status: "ai_active" });
    Message.find.mockImplementation(() => ({
      sort: jest.fn(() => ({
        limit: jest.fn(() => ({
          lean: jest.fn().mockResolvedValue(entries),
        })),
      })),
    }));
  });

  it("restores visitor, AI, and human messages in chronological order for the same session", async () => {
    const response = await request(app).get(url + "&view=full").expect(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(Conversation.findOne).toHaveBeenCalledWith({
      organizationId: "demo-org",
      agentId: "demo-agent",
      sessionKey: sessionId,
      channel: "web",
    });
    expect(Message.find).toHaveBeenCalledWith({
      organizationId: "demo-org",
      agentId: "demo-agent",
      conversationId: "demo-conversation",
      sender: { $in: ["customer", "agent", "human"] },
    });
    expect(response.body.messages.map(({ sender, content }) => ({ sender, content }))).toEqual([
      { sender: "customer", content: "Do you build websites?" },
      { sender: "agent", content: "We build websites." },
      { sender: "human", content: "How can I help?" },
    ]);
    expect(response.body).not.toHaveProperty("sessionId");
  });

  it("keeps the existing default visitor poll human-only", async () => {
    const response = await request(app).get(url).expect(200);
    expect(Message.find).toHaveBeenCalledWith(expect.objectContaining({ sender: "human" }));
    expect(response.body.messages).toEqual(entries.reverse().map((entry) =>
      expect.objectContaining({ sender: entry.sender, content: entry.content })
    ));
  });

  it("does not reveal history for invalid or other visitor sessions", async () => {
    await request(app).get("/api/tengaagent/chat/tengacion-demo/conversation?sessionId=weak-session&view=full").expect(400);
    expect(Conversation.findOne).not.toHaveBeenCalled();
    Conversation.findOne.mockResolvedValueOnce(null);
    const unknown = await request(app).get(
      "/api/tengaagent/chat/tengacion-demo/conversation?sessionId=00000000-0000-4000-8000-000000000000&view=full"
    ).expect(200);
    expect(unknown.body.messages).toEqual([]);
    expect(Message.find).not.toHaveBeenCalled();
  });

  it("is not available outside the isolated pilot", async () => {
    isTengaAgentPilotMode.mockReturnValue(false);
    await request(app).get(url + "&view=full").expect(404);
    expect(Conversation.findOne).not.toHaveBeenCalled();
  });
});
