const mongoose = require("mongoose");

const Appointment = require("../../models/tengaAgent/Appointment");
const FollowUpReminder = require("../../models/tengaAgent/FollowUpReminder");
const Organization = require("../../models/tengaAgent/Organization");
const {
  supersedeOpenFollowUpReminders,
} = require("./followUpReminderService");
const {
  recommendationsForAppointments,
} = require("./followUpIntelligenceService");

const TERMINAL_APPOINTMENT_STATUSES = ["completed", "no_show"];
const FOLLOW_UP_FILTERS = ["all", "overdue", "upcoming"];

const findOwnerOrganization = async (userId) => {
  if (!userId) return null;

  return Organization.findOne({
    ownerUser: userId,
    status: { $ne: "closed" },
  }).sort({ createdAt: 1 });
};

const normalizeFilter = (value) => {
  const filter = String(value || "all").trim().toLowerCase();
  if (!FOLLOW_UP_FILTERS.includes(filter)) {
    throw new Error("Unsupported follow-up queue filter.");
  }
  return filter;
};

const normalizeFutureFollowUpAt = (value, now = new Date()) => {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    throw new Error("A valid follow-up due date is required.");
  }
  if (parsed.getTime() <= now.getTime()) {
    throw new Error("Rescheduled follow-up must be in the future.");
  }
  return parsed;
};

const serializeReminder = (reminder) =>
  reminder
    ? {
        id: reminder._id,
        status: reminder.status,
        scheduledFor: reminder.scheduledFor || null,
        attempts: Number(reminder.attempts || 0),
        lastAttemptAt: reminder.lastAttemptAt || null,
        sentAt: reminder.sentAt || null,
        lastError: reminder.lastError || "",
      }
    : null;

const serializeFollowUp = (appointment, reminder, now = new Date(), recommendation = null) => {
  const followUpAt = appointment.followUpAt || null;
  const dueAt = followUpAt ? new Date(followUpAt) : null;
  const overdue = Boolean(
    dueAt && !Number.isNaN(dueAt.getTime()) && dueAt.getTime() <= now.getTime()
  );

  return {
    appointmentId: appointment._id,
    agentId: appointment.agentId,
    name: appointment.name,
    email: appointment.email,
    phone: appointment.phone,
    company: appointment.company,
    purpose: appointment.purpose,
    consentToContact: Boolean(appointment.consentToContact),
    appointmentStatus: appointment.status,
    preferredStartAt: appointment.preferredStartAt,
    timezone: appointment.timezone,
    outcomeDisposition: appointment.outcomeDisposition || "unreviewed",
    outcomeNotes: appointment.outcomeNotes || "",
    followUpAt,
    followUpUpdatedAt: appointment.followUpUpdatedAt || null,
    followUpCompletedAt: appointment.followUpCompletedAt || null,
    overdue,
    dueState: followUpAt ? (overdue ? "overdue" : "upcoming") : "completed",
    reminder: serializeReminder(reminder),
    recommendation,
    updatedAt: appointment.updatedAt,
  };
};

const latestRemindersByAppointment = async ({ organizationId, appointmentIds }) => {
  if (!appointmentIds.length) return new Map();

  const reminders = await FollowUpReminder.find({
    organizationId,
    appointmentId: { $in: appointmentIds },
  })
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  const latestByAppointment = new Map();
  for (const reminder of reminders) {
    const key = String(reminder.appointmentId);
    if (!latestByAppointment.has(key)) {
      latestByAppointment.set(key, reminder);
    }
  }

  return latestByAppointment;
};

const followUpMetricsForOrganization = async ({ organizationId, now }) => {
  const base = {
    organizationId,
    status: { $in: TERMINAL_APPOINTMENT_STATUSES },
    followUpNeeded: true,
    followUpAt: { $ne: null },
  };
  const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [open, overdue, upcoming, dueNext7Days] = await Promise.all([
    Appointment.countDocuments(base),
    Appointment.countDocuments({
      ...base,
      followUpAt: { $ne: null, $lte: now },
    }),
    Appointment.countDocuments({
      ...base,
      followUpAt: { $gt: now },
    }),
    Appointment.countDocuments({
      ...base,
      followUpAt: { $gt: now, $lte: nextSevenDays },
    }),
  ]);

  return { open, overdue, upcoming, dueNext7Days };
};

const listOwnerFollowUps = async ({
  userId,
  filter = "all",
  limit = 100,
  now = new Date(),
}) => {
  const organization = await findOwnerOrganization(userId);
  if (!organization) return null;

  const normalizedFilter = normalizeFilter(filter);
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 250);
  const query = {
    organizationId: organization._id,
    status: { $in: TERMINAL_APPOINTMENT_STATUSES },
    followUpNeeded: true,
    followUpAt: { $ne: null },
  };

  if (normalizedFilter === "overdue") {
    query.followUpAt = { $ne: null, $lte: now };
  } else if (normalizedFilter === "upcoming") {
    query.followUpAt = { $gt: now };
  }

  const appointments = await Appointment.find(query)
    .sort({ followUpAt: 1, updatedAt: -1 })
    .limit(safeLimit)
    .lean();

  const [latestReminders, metrics, recommendations] = await Promise.all([
    latestRemindersByAppointment({
      organizationId: organization._id,
      appointmentIds: appointments.map((appointment) => appointment._id),
    }),
    followUpMetricsForOrganization({
      organizationId: organization._id,
      now,
    }),
    recommendationsForAppointments({
      organizationId: organization._id,
      appointments,
      now,
    }),
  ]);

  return {
    organization,
    filter: normalizedFilter,
    metrics,
    followUps: appointments.map((appointment) =>
      serializeFollowUp(
        appointment,
        latestReminders.get(String(appointment._id)) || null,
        now,
        recommendations.get(String(appointment._id)) || null
      )
    ),
  };
};

const findOwnerAppointment = async ({ userId, appointmentId }) => {
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

  return {
    workspaceFound: true,
    organization,
    appointment,
  };
};

const serializeUpdatedFollowUp = async ({ organization, appointment, now }) => {
  const [reminders, recommendations] = await Promise.all([
    latestRemindersByAppointment({
      organizationId: organization._id,
      appointmentIds: [appointment._id],
    }),
    recommendationsForAppointments({
      organizationId: organization._id,
      appointments: [appointment.toObject ? appointment.toObject() : appointment],
      now,
    }),
  ]);

  return serializeFollowUp(
    appointment,
    reminders.get(String(appointment._id)) || null,
    now,
    recommendations.get(String(appointment._id)) || null
  );
};

const completeOwnerFollowUp = async ({ userId, appointmentId, now = new Date() }) => {
  const result = await findOwnerAppointment({ userId, appointmentId });
  if (!result.workspaceFound || !result.appointment) return result;

  const { appointment, organization } = result;

  if (appointment.followUpNeeded) {
    appointment.followUpNeeded = false;
    appointment.followUpAt = null;
    appointment.followUpUpdatedAt = now;
    appointment.followUpCompletedAt = now;
    await appointment.save();

    await supersedeOpenFollowUpReminders({
      appointmentId: appointment._id,
    });
  }

  return {
    ...result,
    followUp: await serializeUpdatedFollowUp({ organization, appointment, now }),
  };
};

const rescheduleOwnerFollowUp = async ({
  userId,
  appointmentId,
  followUpAt,
  now = new Date(),
}) => {
  const result = await findOwnerAppointment({ userId, appointmentId });
  if (!result.workspaceFound || !result.appointment) return result;

  const { appointment, organization } = result;
  if (!appointment.followUpNeeded) {
    throw new Error("Follow-up is already complete.");
  }

  const normalizedFollowUpAt = normalizeFutureFollowUpAt(followUpAt, now);
  appointment.followUpAt = normalizedFollowUpAt;
  appointment.followUpUpdatedAt = now;
  appointment.followUpCompletedAt = null;
  await appointment.save();

  await supersedeOpenFollowUpReminders({
    appointmentId: appointment._id,
  });

  return {
    ...result,
    followUp: await serializeUpdatedFollowUp({ organization, appointment, now }),
  };
};

module.exports = {
  FOLLOW_UP_FILTERS,
  completeOwnerFollowUp,
  listOwnerFollowUps,
  rescheduleOwnerFollowUp,
  serializeFollowUp,
};
