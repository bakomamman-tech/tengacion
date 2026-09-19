const mongoose = require("mongoose");

const Appointment = require("../../models/tengaAgent/Appointment");
const FollowUpActivity = require("../../models/tengaAgent/FollowUpActivity");
const Organization = require("../../models/tengaAgent/Organization");
const { sendBrandedEmail } = require("../../utils/sendBrandedEmail");

const TERMINAL_APPOINTMENT_STATUSES = ["completed", "no_show"];
const MANUAL_CHANNELS = ["phone", "manual"];
const DIRECTIONS = ["outbound", "inbound"];

const validationError = (message) => {
  const error = new Error(message);
  error.code = "TENGAAGENT_FOLLOW_UP_ACTIVITY_VALIDATION";
  return error;
};

const findOwnerOrganization = async (userId) => {
  if (!userId) return null;

  return Organization.findOne({
    ownerUser: userId,
    status: { $ne: "closed" },
  }).sort({ createdAt: 1 });
};

const findOwnerAppointment = async ({ userId, appointmentId, requireOpen = false }) => {
  const organization = await findOwnerOrganization(userId);
  if (!organization) {
    return { workspaceFound: false, organization: null, appointment: null };
  }

  if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
    return { workspaceFound: true, organization, appointment: null };
  }

  const appointment = await Appointment.findOne({
    _id: appointmentId,
    organizationId: organization._id,
    status: { $in: TERMINAL_APPOINTMENT_STATUSES },
  });

  if (appointment && requireOpen && !appointment.followUpNeeded) {
    throw validationError("Follow-up is already complete.");
  }

  return {
    workspaceFound: true,
    organization,
    appointment,
  };
};

const normalizeText = (value, { label, max, required = false }) => {
  const normalized = String(value || "").trim();
  if (required && !normalized) {
    throw validationError(`${label} is required.`);
  }
  if (normalized.length > max) {
    throw validationError(`${label} must be ${max} characters or fewer.`);
  }
  return normalized;
};

const normalizeSubject = (value) =>
  normalizeText(String(value || "").replace(/[\r\n]+/g, " "), {
    label: "Email subject",
    max: 200,
    required: true,
  });

const normalizeOccurredAt = (value, now = new Date()) => {
  if (!value) return now;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw validationError("A valid contact time is required.");
  }
  if (parsed.getTime() > now.getTime() + 5 * 60 * 1000) {
    throw validationError("Contact time cannot be in the future.");
  }
  return parsed;
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const messageToHtml = ({ message, organizationName }) => {
  const body = escapeHtml(message).replace(/\n/g, "<br />");
  const businessName = escapeHtml(organizationName || "your business");

  return `<p>${body}</p><p style="margin-top:24px;color:#64748b;font-size:13px;">Sent on behalf of ${businessName} via TengaAgent.</p>`;
};

const serializeActivity = (activity) => ({
  id: activity._id,
  appointmentId: activity.appointmentId,
  agentId: activity.agentId,
  ownerUserId: activity.ownerUserId,
  channel: activity.channel,
  direction: activity.direction,
  status: activity.status,
  recipient: activity.recipient || "",
  subject: activity.subject || "",
  message: activity.message || "",
  notes: activity.notes || "",
  provider: activity.provider || "manual",
  attemptedAt: activity.attemptedAt || null,
  sentAt: activity.sentAt || null,
  occurredAt: activity.occurredAt || activity.createdAt,
  lastError: activity.lastError || "",
  createdAt: activity.createdAt,
  updatedAt: activity.updatedAt,
});

const listOwnerFollowUpActivities = async ({ userId, appointmentId, limit = 100 }) => {
  const result = await findOwnerAppointment({ userId, appointmentId });
  if (!result.workspaceFound || !result.appointment) return result;

  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 250);
  const activities = await FollowUpActivity.find({
    organizationId: result.organization._id,
    appointmentId: result.appointment._id,
  })
    .sort({ occurredAt: -1, createdAt: -1, _id: -1 })
    .limit(safeLimit)
    .lean();

  return {
    ...result,
    activities: activities.map(serializeActivity),
  };
};

const logOwnerFollowUpContact = async ({
  userId,
  appointmentId,
  channel,
  direction = "outbound",
  notes,
  occurredAt,
  now = new Date(),
}) => {
  const result = await findOwnerAppointment({
    userId,
    appointmentId,
    requireOpen: true,
  });
  if (!result.workspaceFound || !result.appointment) return result;

  const normalizedChannel = String(channel || "").trim().toLowerCase();
  if (!MANUAL_CHANNELS.includes(normalizedChannel)) {
    throw validationError("Contact channel must be phone or manual.");
  }

  const normalizedDirection = String(direction || "outbound").trim().toLowerCase();
  if (!DIRECTIONS.includes(normalizedDirection)) {
    throw validationError("Contact direction must be outbound or inbound.");
  }

  const normalizedNotes = normalizeText(notes, {
    label: "Contact notes",
    max: 4000,
    required: true,
  });
  const normalizedOccurredAt = normalizeOccurredAt(occurredAt, now);

  const activity = await FollowUpActivity.create({
    organizationId: result.organization._id,
    agentId: result.appointment.agentId,
    appointmentId: result.appointment._id,
    ownerUserId: userId,
    channel: normalizedChannel,
    direction: normalizedDirection,
    status: "logged",
    recipient:
      normalizedChannel === "phone" ? result.appointment.phone || "" : "",
    notes: normalizedNotes,
    provider: "manual",
    occurredAt: normalizedOccurredAt,
  });

  return {
    ...result,
    activity: serializeActivity(activity),
  };
};

const sendOwnerFollowUpEmail = async ({
  userId,
  appointmentId,
  subject,
  message,
  now = new Date(),
}) => {
  const result = await findOwnerAppointment({
    userId,
    appointmentId,
    requireOpen: true,
  });
  if (!result.workspaceFound || !result.appointment) return result;

  const { appointment, organization } = result;
  if (!appointment.email) {
    throw validationError("This follow-up does not have a customer email address.");
  }
  if (!appointment.consentToContact) {
    throw validationError("Customer contact consent is required before sending email.");
  }

  const normalizedSubject = normalizeSubject(subject);
  const normalizedMessage = normalizeText(message, {
    label: "Email message",
    max: 5000,
    required: true,
  });

  const activity = await FollowUpActivity.create({
    organizationId: organization._id,
    agentId: appointment.agentId,
    appointmentId: appointment._id,
    ownerUserId: userId,
    channel: "email",
    direction: "outbound",
    status: "sending",
    recipient: appointment.email,
    subject: normalizedSubject,
    message: normalizedMessage,
    provider: "smtp",
    attemptedAt: now,
    occurredAt: now,
  });

  try {
    await sendBrandedEmail({
      to: appointment.email,
      subject: normalizedSubject,
      text: `${normalizedMessage}\n\nSent on behalf of ${organization.name} via TengaAgent.`,
      html: messageToHtml({
        message: normalizedMessage,
        organizationName: organization.name,
      }),
      previewText: normalizedSubject,
    });

    activity.status = "sent";
    activity.sentAt = new Date();
    activity.lastError = "";
    await activity.save();

    return {
      ...result,
      deliveryFailed: false,
      activity: serializeActivity(activity),
    };
  } catch (error) {
    activity.status = "failed";
    activity.lastError = String(error?.message || "Email delivery failed").slice(0, 1000);
    await activity.save();

    return {
      ...result,
      deliveryFailed: true,
      deliveryError: activity.lastError,
      activity: serializeActivity(activity),
    };
  }
};

module.exports = {
  DIRECTIONS,
  MANUAL_CHANNELS,
  listOwnerFollowUpActivities,
  logOwnerFollowUpContact,
  sendOwnerFollowUpEmail,
  serializeActivity,
};
