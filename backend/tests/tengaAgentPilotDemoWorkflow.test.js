"use strict";
jest.mock("../models/tengaAgent/Appointment", () => ({
  findOne: jest.fn(),
}));
jest.mock("../models/tengaAgent/Lead", () => ({
  findOneAndUpdate: jest.fn(), exists: jest.fn(),
}));
jest.mock("../models/tengaAgent/Conversation", () => ({
  findOne: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn(),
}));
jest.mock("../models/tengaAgent/Message", () => ({ create: jest.fn(), find: jest.fn() }));
jest.mock("../services/tengaAgent/availabilityService", () => ({
  checkAppointmentAvailability: jest.fn(),
}));
jest.mock("../services/tengaAgent/bookingConfirmationLockService", () => ({
  withBookingConfirmationLock: jest.fn(async ({ task }) => task()),
}));
jest.mock("../services/tengaAgent/appointmentNotificationService", () => ({
  queueAppointmentEventNotifications: jest.fn().mockResolvedValue([]),
}));

const mongoose = require("mongoose");
const Appointment = require("../models/tengaAgent/Appointment");
const Lead = require("../models/tengaAgent/Lead");
const Conversation = require("../models/tengaAgent/Conversation");
const Message = require("../models/tengaAgent/Message");
const { checkAppointmentAvailability } = require("../services/tengaAgent/availabilityService");
const { queueAppointmentEventNotifications } = require("../services/tengaAgent/appointmentNotificationService");
const { updatePilotLead, mutatePilotAppointment, sendPilotHumanReply } =
  require("../services/tengaAgent/pilotDemoWorkflowService");

const objectId = () => new mongoose.Types.ObjectId();
const scope = { organizationId: objectId(), agentId: objectId() };
const leadId = objectId(), appointmentId = objectId(), conversationId = objectId(), userId = objectId();
const future = () => new Date(Date.now() + 86400000);
const makeAppointment = () => ({
  _id: appointmentId, organizationId: scope.organizationId, agentId: scope.agentId,
  status: "requested", preferredStartAt: future(), durationMinutes: 30,
  timezone: "Africa/Lagos", save: jest.fn().mockResolvedValue(undefined),
});
beforeEach(() => {
  jest.clearAllMocks();
  checkAppointmentAvailability.mockResolvedValue({
    available: true, source: "request_only", scheduleEnabled: false,
  });
  queueAppointmentEventNotifications.mockResolvedValue([]);
});
describe("pilot demo owner workflow keeps strict tenant and agent boundaries", () => {
  it("updates a lead only through scoped, validated status fields", async () => {
    Lead.findOneAndUpdate.mockResolvedValue({ _id: leadId, status: "contacted" });
    const lead = await updatePilotLead({ scope, leadId, status: "contacted" });
    expect(lead.status).toBe("contacted");
    expect(Lead.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: leadId, organizationId: scope.organizationId, agentId: scope.agentId },
      { $set: { status: "contacted" } }, expect.objectContaining({ runValidators: true }));
    await expect(updatePilotLead({ scope, leadId, status: "owner" })).rejects.toMatchObject({ status: 400 });
    Lead.findOneAndUpdate.mockResolvedValue(null);
    await expect(updatePilotLead({ scope, leadId, status: "new" })).rejects.toMatchObject({ status: 404 });
  });
  it("rejects invalid appointments before attempting a booking mutation", async () => {
    await expect(mutatePilotAppointment({ scope, appointmentId: "not-an-id", action: "confirm" }))
      .rejects.toMatchObject({ status: 404 });
    await expect(mutatePilotAppointment({ scope, appointmentId, action: "delete" }))
      .rejects.toMatchObject({ status: 400 });
    expect(Appointment.findOne).not.toHaveBeenCalled();
  });
  it("does not confirm a meeting whose requested time has passed", async () => {
    const entry = makeAppointment();
    entry.preferredStartAt = new Date(Date.now() - 86400000);
    Appointment.findOne.mockResolvedValue(entry);
    await expect(mutatePilotAppointment({ scope, appointmentId, action: "confirm" }))
      .rejects.toMatchObject({ status: 400 });
    expect(entry.save).not.toHaveBeenCalled();
    expect(queueAppointmentEventNotifications).not.toHaveBeenCalled();
  });
  it("confirms only an available, scoped future appointment and queues notification", async () => {
    const entry = makeAppointment();
    Appointment.findOne.mockResolvedValue(entry);
    const result = await mutatePilotAppointment({ scope, appointmentId, action: "confirm" });
    expect(Appointment.findOne).toHaveBeenCalledWith({
      _id: appointmentId, organizationId: scope.organizationId, agentId: scope.agentId,
    });
    expect(result.status).toBe("confirmed");
    expect(entry.save).toHaveBeenCalled();
    expect(queueAppointmentEventNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ appointment: entry, eventType: "confirmed", actor: "owner" }));
  });
  it("fails closed if booking availability cannot be verified", async () => {
    const entry = makeAppointment();
    Appointment.findOne.mockResolvedValue(entry);
    checkAppointmentAvailability.mockResolvedValue({ available: true, externalCalendarState: "unavailable" });
    await expect(mutatePilotAppointment({ scope, appointmentId, action: "confirm" }))
      .rejects.toMatchObject({ status: 409 });
    expect(entry.status).toBe("requested");
    expect(queueAppointmentEventNotifications).not.toHaveBeenCalled();
  });
  it("requires visitor contact consent and a scoped conversation for human replies", async () => {
    Conversation.findOne.mockResolvedValue({ _id: conversationId, status: "handoff_requested" });
    Lead.exists.mockResolvedValue(null);
    Appointment.exists.mockResolvedValue(null);
    await expect(sendPilotHumanReply({ scope, conversationId, userId, content: "Hello" }))
      .rejects.toMatchObject({ status: 403 });
    expect(Message.create).not.toHaveBeenCalled();
    Lead.exists.mockResolvedValue({ _id: leadId });
    Conversation.findOneAndUpdate.mockResolvedValue({ _id: conversationId });
    Message.create.mockResolvedValue({ _id: objectId(), createdAt: new Date(), content: "Hello" });
    await sendPilotHumanReply({ scope, conversationId, userId, content: "Hello" });
    expect(Lead.exists).toHaveBeenCalledWith({
      organizationId: scope.organizationId, agentId: scope.agentId,
      conversationId, consentToContact: true,
    });
    expect(Conversation.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: conversationId, organizationId: scope.organizationId, agentId: scope.agentId,
      }), expect.objectContaining({ $set: expect.objectContaining({ status: "human_active" }) }),
      expect.objectContaining({ runValidators: true }));
    expect(Message.create).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: scope.organizationId, agentId: scope.agentId,
      conversationId, sender: "human", senderUserId: userId, content: "Hello",
    }));
  });
});
