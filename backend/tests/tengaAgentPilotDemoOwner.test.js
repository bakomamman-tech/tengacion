"use strict";
const express = require("express");
const request = require("supertest");

jest.mock("../config/tengaAgentPilotMode", () => ({ isTengaAgentPilotMode: jest.fn() }));
jest.mock("../middleware/auth", () => (req, _res, next) => {
  req.user = { _id: "pilot-user-one" };
  next();
});
jest.mock("../models/tengaAgent/PilotDemoOwnerClaim", () => ({
  findOne: jest.fn(), create: jest.fn(),
}));
jest.mock("../models/tengaAgent/Lead", () => ({ find: jest.fn() }));
jest.mock("../models/tengaAgent/Appointment", () => ({ find: jest.fn() }));
jest.mock("../services/tengaAgent/pilotDemoWorkflowService", () => ({
  updatePilotLead: jest.fn(), mutatePilotAppointment: jest.fn(),
  listPilotMessages: jest.fn(), sendPilotHumanReply: jest.fn(),
}));
jest.mock("../services/tengaAgent/customerZeroService", () => ({
  ensureCustomerZeroAgent: jest.fn(),
}));

const { isTengaAgentPilotMode } = require("../config/tengaAgentPilotMode");
const Claim = require("../models/tengaAgent/PilotDemoOwnerClaim");
const Lead = require("../models/tengaAgent/Lead");
const Appointment = require("../models/tengaAgent/Appointment");
const { ensureCustomerZeroAgent } = require("../services/tengaAgent/customerZeroService");
const router = require("../routes/tengaAgentPilotOwner");

const app = express();
app.use(express.json());
app.use("/api/tengaagent/owner/pilot-demo", router);
const base = "/api/tengaagent/owner/pilot-demo";
const query = (value) => ({ lean: jest.fn().mockResolvedValue(value) });
const collectionQuery = (values) => ({
  sort: jest.fn(() => ({ limit: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(values) })) })),
});

describe("pilot demo owner inbox", () => {
  const originalSecret = process.env.TENGAAGENT_PILOT_OWNER_CLAIM_SECRET;
  const secret = "this-is-a-private-test-claim-secret-32-chars";
  beforeEach(() => {
    jest.clearAllMocks();
    isTengaAgentPilotMode.mockReturnValue(true);
    process.env.TENGAAGENT_PILOT_OWNER_CLAIM_SECRET = secret;
    Claim.findOne.mockReturnValue(query(null));
    ensureCustomerZeroAgent.mockResolvedValue({
      organization: { _id: "org-demo" }, agent: { _id: "agent-demo" },
    });
  });
  afterAll(() => {
    if (originalSecret === undefined) delete process.env.TENGAAGENT_PILOT_OWNER_CLAIM_SECRET;
    else process.env.TENGAAGENT_PILOT_OWNER_CLAIM_SECRET = originalSecret;
  });

  it("does not exist outside the explicitly bound pilot", async () => {
    isTengaAgentPilotMode.mockReturnValue(false);
    const status = await request(app).get(base + "/status");
    expect(status.status).toBe(404);
    const claim = await request(app).post(base + "/claim").send({ claimSecret: secret });
    expect(claim.status).toBe(404);
    expect(Claim.findOne).not.toHaveBeenCalled();
  });
  it("requires an authenticated owner claim before returning personal records", async () => {
    const leads = await request(app).get(base + "/leads");
    const appointments = await request(app).get(base + "/appointments");
    expect(leads.status).toBe(403);
    expect(appointments.status).toBe(403);
    expect(Lead.find).not.toHaveBeenCalled();
    expect(Appointment.find).not.toHaveBeenCalled();
  });
  it("does not accept an incorrect secret or leak records", async () => {
    const result = await request(app).post(base + "/claim")
      .send({ claimSecret: "this-is-the-wrong-owner-secret-000000" });
    expect(result.status).toBe(403);
    expect(Claim.create).not.toHaveBeenCalled();
    expect(JSON.stringify(result.body)).not.toContain(secret);
  });
  it("fails closed if no strong secret is configured", async () => {
    process.env.TENGAAGENT_PILOT_OWNER_CLAIM_SECRET = "short";
    const response = await request(app).post(base + "/claim").send({ claimSecret: secret });
    expect(response.status).toBe(503);
    expect(Claim.create).not.toHaveBeenCalled();
  });
  it("creates one owner assignment scoped to the real demo organization and agent", async () => {
    Claim.create.mockResolvedValue({ ownerUser: "pilot-user-one" });
    const response = await request(app).post(base + "/claim").send({ claimSecret: secret });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ ok: true, claimedByYou: true });
    expect(Claim.create).toHaveBeenCalledWith({
      key: "tengacion-demo", ownerUser: "pilot-user-one",
      organizationId: "org-demo", agentId: "agent-demo",
    });
  });
  it("does not transfer an already claimed demo to another account", async () => {
    Claim.findOne.mockReturnValue(query({ ownerUser: "another-user" }));
    const response = await request(app).post(base + "/claim").send({ claimSecret: secret });
    expect(response.status).toBe(409);
    expect(Claim.create).not.toHaveBeenCalled();
  });
  it("returns only records for the claimed demo organization and agent", async () => {
    const claim = {
      ownerUser: "pilot-user-one", organizationId: "org-demo", agentId: "agent-demo",
    };
    Claim.findOne.mockReturnValue(query(claim));
    Lead.find.mockReturnValue(collectionQuery([{ _id: "lead-1", name: "Test Lead", email: "test@example.com" }]));
    Appointment.find.mockReturnValue(collectionQuery([{ _id: "appointment-1", name: "Test Visitor", status: "requested" }]));
    const [leads, appointments] = await Promise.all([
      request(app).get(base + "/leads"),
      request(app).get(base + "/appointments"),
    ]);
    expect(leads.status).toBe(200);
    expect(appointments.status).toBe(200);
    expect(Lead.find).toHaveBeenCalledWith({ organizationId: "org-demo", agentId: "agent-demo" });
    expect(Appointment.find).toHaveBeenCalledWith({ organizationId: "org-demo", agentId: "agent-demo" });
    expect(leads.body.leads[0]).toMatchObject({ name: "Test Lead" });
    expect(appointments.body.appointments[0]).toMatchObject({ status: "requested" });
  });
});
