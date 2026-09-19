"use strict";
const mongoose = require("mongoose");
const Appointment = require("../../models/tengaAgent/Appointment");
const Lead = require("../../models/tengaAgent/Lead");
const Conversation = require("../../models/tengaAgent/Conversation");
const Message = require("../../models/tengaAgent/Message");
const { checkAppointmentAvailability } = require("./availabilityService");
const { withBookingConfirmationLock } = require("./bookingConfirmationLockService");
const { queueAppointmentEventNotifications } = require("./appointmentNotificationService");

const VALID_LEAD_STATUSES = new Set(["new", "qualified", "contacted", "won", "lost"]);
const VALID_APPOINTMENT_ACTIONS = new Set(["confirm", "cancel", "reschedule"]);
class PilotWorkflowError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const idOk = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const scoped = (scope, id) => ({ _id: id, organizationId: scope.organizationId, agentId: scope.agentId });
const ensureScope = (scope) => {
  if (!scope?.organizationId || !scope?.agentId) throw new PilotWorkflowError(403, "Demo owner access required.");
};
const notifySafely = async (appointment, eventType) => {
  try { await queueAppointmentEventNotifications({ appointment, eventType, actor: "owner" }); }
  catch (error) { console.error("[tengaagent-pilot] appointment notification queue failed", error?.message || "unknown"); }
};
const updatePilotLead = async ({ scope, leadId, status }) => {
  ensureScope(scope);
  if (!idOk(leadId)) throw new PilotWorkflowError(404, "Lead not found.");
  if (typeof status !== "string" || !VALID_LEAD_STATUSES.has(status)) {
    throw new PilotWorkflowError(400, "Unsupported lead status.");
  }
  const lead = await Lead.findOneAndUpdate(scoped(scope, leadId), { $set: { status } },
    { new: true, runValidators: true });
  if (!lead) throw new PilotWorkflowError(404, "Lead not found.");
  return lead;
};
const parseFuture = (value) => {
  const time = new Date(value);
  if (!value || Number.isNaN(time.getTime()) || time.getTime() <= Date.now() + 5 * 60 * 1000) {
    throw new PilotWorkflowError(400, "Choose a valid future meeting time, at least five minutes from now.");
  }
  return time;
};
const parseDuration = (value) => {
  const duration = Number(value);
  if (!Number.isInteger(duration) || duration < 15 || duration > 180) {
    throw new PilotWorkflowError(400, "Meeting duration must be 15–180 minutes.");
  }
  return duration;
};
const mutatePilotAppointment = async ({ scope, appointmentId, action, preferredStartAt, timezone, durationMinutes }) => {
  ensureScope(scope);
  if (!idOk(appointmentId)) throw new PilotWorkflowError(404, "Appointment not found.");
  if (!VALID_APPOINTMENT_ACTIONS.has(action)) throw new PilotWorkflowError(400, "Unsupported appointment action.");
  const result = await withBookingConfirmationLock({
    organizationId: scope.organizationId, agentId: scope.agentId,
    task: async () => {
      const appointment = await Appointment.findOne(scoped(scope, appointmentId));
      if (!appointment) throw new PilotWorkflowError(404, "Appointment not found.");
      const before = appointment.status;
      if (action === "cancel") {
        if (!["requested", "confirmed"].includes(before)) {
          throw new PilotWorkflowError(409, "Only requested or confirmed meetings can be cancelled.");
        }
        appointment.status = "cancelled";
        appointment.cancelledAt = new Date();
        appointment.cancelledBy = "owner";
        await appointment.save();
        return { appointment, eventType: "cancelled" };
      }
      if (action === "reschedule") {
        if (!["requested", "confirmed"].includes(before)) {
          throw new PilotWorkflowError(409, "This appointment cannot be rescheduled.");
        }
        const start = parseFuture(preferredStartAt);
        const duration = durationMinutes == null ? Number(appointment.durationMinutes || 30) : parseDuration(durationMinutes);
        const nextTimezone = String(timezone || appointment.timezone || "Africa/Lagos").trim();
        try { new Intl.DateTimeFormat("en", { timeZone: nextTimezone }).format(start); }
        catch { throw new PilotWorkflowError(400, "Choose a valid meeting timezone."); }
        if (new Date(appointment.preferredStartAt).getTime() === start.getTime() &&
            appointment.durationMinutes === duration && appointment.timezone === nextTimezone) {
          return { appointment, eventType: null };
        }
        const availability = await checkAppointmentAvailability({
          organizationId: scope.organizationId, agentId: scope.agentId,
          startAt: start, durationMinutes: duration, excludeAppointmentId: appointment._id,
        });
        if (!availability.available || (before === "confirmed" && availability.externalCalendarState === "unavailable")) {
          throw new PilotWorkflowError(409, "This time cannot be verified as available. Select another time or review the connected calendar.");
        }
        appointment.preferredStartAt = start;
        appointment.durationMinutes = duration;
        appointment.timezone = nextTimezone;
        appointment.rescheduledAt = new Date();
        appointment.rescheduleCount = Number(appointment.rescheduleCount || 0) + 1;
        appointment.availabilitySource = availability.source || "request_only";
        appointment.availabilityState = before === "confirmed" ? "confirmed_free" :
          availability.scheduleEnabled === true ? "available_at_request" : "not_checked";
        appointment.availabilityCheckedAt = (before === "confirmed" || availability.scheduleEnabled === true) ? new Date() : null;
        await appointment.save();
        return { appointment, eventType: "rescheduled" };
      }
      if (before !== "requested") throw new PilotWorkflowError(409, "Only pending meeting requests can be confirmed.");
      parseFuture(appointment.preferredStartAt);
      const availability = await checkAppointmentAvailability({
        organizationId: scope.organizationId, agentId: scope.agentId,
        startAt: appointment.preferredStartAt, durationMinutes: appointment.durationMinutes,
        excludeAppointmentId: appointment._id,
      });
      if (!availability.available || availability.externalCalendarState === "unavailable") {
        appointment.availabilityState = availability.externalCalendarState === "unavailable"
          ? "not_checked" : "conflict_at_confirmation";
        await appointment.save();
        throw new PilotWorkflowError(409, "Availability could not be verified for this meeting. Choose a different time or review the connected calendar.");
      }
      appointment.status = "confirmed";
      appointment.confirmedAt = new Date();
      appointment.availabilitySource = availability.source || "request_only";
      appointment.availabilityState = "confirmed_free";
      appointment.availabilityCheckedAt = new Date();
      await appointment.save();
      return { appointment, eventType: "confirmed" };
    },
  });
  if (result.eventType) await notifySafely(result.appointment, result.eventType);
  return result.appointment;
};
const ensureConversation = async (scope, conversationId) => {
  ensureScope(scope);
  if (!idOk(conversationId)) throw new PilotWorkflowError(404, "Conversation not found.");
  const conversation = await Conversation.findOne(scoped(scope, conversationId));
  if (!conversation) throw new PilotWorkflowError(404, "Conversation not found.");
  return conversation;
};
const listPilotMessages = async ({ scope, conversationId }) => {
  const conversation = await ensureConversation(scope, conversationId);
  const messages = await Message.find({ organizationId: scope.organizationId, agentId: scope.agentId, conversationId: conversation._id })
    .sort({ createdAt: -1, _id: -1 }).limit(50).lean();
  return { conversation, messages: messages.reverse() };
};
const sendPilotHumanReply = async ({ scope, conversationId, userId, content }) => {
  const message = typeof content === "string" ? content.trim() : "";
  if (!message || message.length > 2000) throw new PilotWorkflowError(400, "Reply must be 1–2,000 characters.");
  const conversation = await ensureConversation(scope, conversationId);
  if (conversation.status === "closed") throw new PilotWorkflowError(409, "This conversation is closed.");
  const contactFilter = { organizationId: scope.organizationId, agentId: scope.agentId,
    conversationId: conversation._id, consentToContact: true };
  const [lead, appointment] = await Promise.all([Lead.exists(contactFilter), Appointment.exists(contactFilter)]);
  if (!lead && !appointment) throw new PilotWorkflowError(403, "Visitor contact consent is required before a human reply.");
  // Switching status before creating the reply prevents subsequent demo messages from triggering AI.
  const claimed = await Conversation.findOneAndUpdate(
    { ...scoped(scope, conversationId), status: { $in: ["ai_active", "handoff_requested", "human_active"] } },
    { $set: { status: "human_active", assignedToUser: userId, claimedAt: conversation.claimedAt || new Date() } },
    { new: true, runValidators: true }
  );
  if (!claimed) throw new PilotWorkflowError(409, "Conversation is not available for a human reply.");
  const entry = await Message.create({
    organizationId: scope.organizationId, agentId: scope.agentId,
    conversationId: claimed._id, sender: "human", senderUserId: userId, type: "text", content: message,
  });
  await Conversation.updateOne(scoped(scope, conversationId), { $set: { lastMessageAt: entry.createdAt || new Date() } });
  return entry;
};

module.exports = { PilotWorkflowError, updatePilotLead, mutatePilotAppointment,
  listPilotMessages, sendPilotHumanReply };
