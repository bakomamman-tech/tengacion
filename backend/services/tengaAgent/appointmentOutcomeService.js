const mongoose = require("mongoose");

const Appointment = require("../../models/tengaAgent/Appointment");
const Organization = require("../../models/tengaAgent/Organization");
const {
  supersedeOpenFollowUpReminders,
} = require("./followUpReminderService");

const OUTCOME_DISPOSITIONS = [
  "unreviewed",
  "converted",
  "qualified",
  "not_interested",
  "reschedule_requested",
  "other",
];

const TERMINAL_OUTCOME_STATUSES = ["completed", "no_show"];

const cleanText = (value, max) =>
  String(value || "")
    .trim()
    .slice(0, max);

const findOwnerOrganization = async (userId) => {
  if (!userId) return null;

  return Organization.findOne({
    ownerUser: userId,
    status: { $ne: "closed" },
  }).sort({ createdAt: 1 });
};

const normalizeDisposition = (value) => {
  const disposition = cleanText(value || "unreviewed", 40).toLowerCase();

  if (!OUTCOME_DISPOSITIONS.includes(disposition)) {
    throw new Error("Unsupported appointment outcome disposition.");
  }

  return disposition;
};

const normalizeFollowUpAt = ({ followUpNeeded, followUpAt }) => {
  if (!followUpNeeded) {
    return null;
  }

  const parsed = new Date(followUpAt);
  if (!followUpAt || Number.isNaN(parsed.getTime())) {
    throw new Error("A valid follow-up due date is required when follow-up is needed.");
  }

  return parsed;
};

const outcomeMetricsFor = (appointments, now = new Date()) => {
  const metrics = {
    terminalAppointments: appointments.length,
    completed: 0,
    noShow: 0,
    reviewedOutcomes: 0,
    converted: 0,
    qualified: 0,
    notInterested: 0,
    rescheduleRequested: 0,
    followUpNeeded: 0,
    followUpOverdue: 0,
    followUpDueNext7Days: 0,
  };

  const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const appointment of appointments) {
    if (appointment.status === "completed") metrics.completed += 1;
    if (appointment.status === "no_show") metrics.noShow += 1;

    const disposition = appointment.outcomeDisposition || "unreviewed";
    if (disposition !== "unreviewed") metrics.reviewedOutcomes += 1;
    if (disposition === "converted") metrics.converted += 1;
    if (disposition === "qualified") metrics.qualified += 1;
    if (disposition === "not_interested") metrics.notInterested += 1;
    if (disposition === "reschedule_requested") metrics.rescheduleRequested += 1;

    if (appointment.followUpNeeded) {
      metrics.followUpNeeded += 1;
      const dueAt = appointment.followUpAt
        ? new Date(appointment.followUpAt)
        : null;

      if (dueAt && !Number.isNaN(dueAt.getTime())) {
        if (dueAt.getTime() <= now.getTime()) {
          metrics.followUpOverdue += 1;
        } else if (dueAt.getTime() <= nextSevenDays.getTime()) {
          metrics.followUpDueNext7Days += 1;
        }
      }
    }
  }

  return metrics;
};

const serializeOutcome = (appointment, now = new Date()) => {
  const followUpAt = appointment.followUpAt || null;
  const followUpOverdue = Boolean(
    appointment.followUpNeeded &&
      followUpAt &&
      new Date(followUpAt).getTime() <= now.getTime()
  );

  return {
    appointmentId: appointment._id,
    status: appointment.status,
    name: appointment.name,
    email: appointment.email,
    phone: appointment.phone,
    company: appointment.company,
    purpose: appointment.purpose,
    preferredStartAt: appointment.preferredStartAt,
    timezone: appointment.timezone,
    outcomeDisposition: appointment.outcomeDisposition || "unreviewed",
    outcomeNotes: appointment.outcomeNotes || "",
    outcomeUpdatedAt: appointment.outcomeUpdatedAt || null,
    followUpNeeded: Boolean(appointment.followUpNeeded),
    followUpAt,
    followUpUpdatedAt: appointment.followUpUpdatedAt || null,
    followUpCompletedAt: appointment.followUpCompletedAt || null,
    followUpOverdue,
    updatedAt: appointment.updatedAt,
  };
};

const listOwnerAppointmentOutcomes = async ({ userId, limit = 100 }) => {
  const organization = await findOwnerOrganization(userId);
  if (!organization) return null;

  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 250);
  const now = new Date();

  const appointments = await Appointment.find({
    organizationId: organization._id,
    status: { $in: TERMINAL_OUTCOME_STATUSES },
  })
    .sort({ updatedAt: -1 })
    .limit(safeLimit)
    .lean();

  const ordered = appointments.slice().sort((left, right) => {
    const leftDue = left.followUpNeeded && left.followUpAt
      ? new Date(left.followUpAt).getTime()
      : Number.POSITIVE_INFINITY;
    const rightDue = right.followUpNeeded && right.followUpAt
      ? new Date(right.followUpAt).getTime()
      : Number.POSITIVE_INFINITY;

    if (leftDue !== rightDue) return leftDue - rightDue;
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });

  return {
    organization,
    outcomes: ordered.map((appointment) => serializeOutcome(appointment, now)),
    metrics: outcomeMetricsFor(appointments, now),
  };
};

const updateOwnerAppointmentOutcome = async ({
  userId,
  appointmentId,
  disposition,
  notes,
  followUpNeeded,
  followUpAt,
}) => {
  const organization = await findOwnerOrganization(userId);

  if (!organization) {
    return { workspaceFound: false, appointment: null };
  }

  if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
    return { workspaceFound: true, appointment: null };
  }

  const appointment = await Appointment.findOne({
    _id: appointmentId,
    organizationId: organization._id,
  });

  if (!appointment) {
    return { workspaceFound: true, appointment: null };
  }

  if (!TERMINAL_OUTCOME_STATUSES.includes(appointment.status)) {
    throw new Error("Only completed or no-show appointments can receive an outcome.");
  }

  const normalizedDisposition = normalizeDisposition(disposition);
  const normalizedFollowUpNeeded = followUpNeeded === true;
  const normalizedFollowUpAt = normalizeFollowUpAt({
    followUpNeeded: normalizedFollowUpNeeded,
    followUpAt,
  });
  const now = new Date();
  const wasFollowUpNeeded = Boolean(appointment.followUpNeeded);
  const previousFollowUpAt = appointment.followUpAt
    ? new Date(appointment.followUpAt).getTime()
    : null;
  const nextFollowUpAt = normalizedFollowUpAt
    ? normalizedFollowUpAt.getTime()
    : null;
  const followUpChanged =
    wasFollowUpNeeded !== normalizedFollowUpNeeded ||
    previousFollowUpAt !== nextFollowUpAt;

  appointment.outcomeDisposition = normalizedDisposition;
  appointment.outcomeNotes = cleanText(notes, 4000);
  appointment.outcomeUpdatedAt = now;
  appointment.followUpNeeded = normalizedFollowUpNeeded;
  appointment.followUpAt = normalizedFollowUpAt;

  if (followUpChanged) {
    appointment.followUpUpdatedAt = now;
  }

  if (wasFollowUpNeeded && !normalizedFollowUpNeeded) {
    appointment.followUpCompletedAt = now;
  } else if (normalizedFollowUpNeeded) {
    appointment.followUpCompletedAt = null;
  }

  await appointment.save();

  if (followUpChanged) {
    await supersedeOpenFollowUpReminders({
      appointmentId: appointment._id,
    });
  }

  return {
    workspaceFound: true,
    appointment,
    outcome: serializeOutcome(appointment),
  };
};

module.exports = {
  OUTCOME_DISPOSITIONS,
  TERMINAL_OUTCOME_STATUSES,
  listOwnerAppointmentOutcomes,
  outcomeMetricsFor,
  updateOwnerAppointmentOutcome,
};
