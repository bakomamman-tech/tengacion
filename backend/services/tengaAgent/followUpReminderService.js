const Appointment = require("../../models/tengaAgent/Appointment");
const FollowUpReminder = require("../../models/tengaAgent/FollowUpReminder");
const Organization = require("../../models/tengaAgent/Organization");
const User = require("../../models/User");
const { getEmailSettings } = require("../../utils/emailSettings");
const { sendBrandedEmail } = require("../../utils/sendBrandedEmail");

const DELIVERY_BATCH_SIZE = 25;
const MAX_DELIVERY_ATTEMPTS = 4;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const SWEEP_INITIAL_DELAY_MS = 60 * 1000;

let schedulerStarted = false;
let sweepInterval = null;
let startupTimer = null;

const cleanText = (value, max = 1000) =>
  String(value || "")
    .trim()
    .slice(0, max);

const normalizeEmail = (value) => cleanText(value, 254).toLowerCase();

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const followUpVersionFor = (appointment) =>
  new Date(
    appointment?.followUpUpdatedAt ||
      appointment?.followUpAt ||
      appointment?.updatedAt ||
      Date.now()
  ).getTime();

const dedupeKeyFor = (appointment) =>
  `${String(appointment._id)}:follow_up_due:${followUpVersionFor(appointment)}`;

const snapshotFor = ({ appointment, organization }) => ({
  businessName: cleanText(organization?.name, 180),
  visitorName: cleanText(appointment?.name, 120),
  visitorEmail: normalizeEmail(appointment?.email),
  visitorPhone: cleanText(appointment?.phone, 40),
  purpose: cleanText(appointment?.purpose, 1000),
  outcomeDisposition: cleanText(
    appointment?.outcomeDisposition || "unreviewed",
    40
  ),
  outcomeNotes: cleanText(appointment?.outcomeNotes, 4000),
  followUpAt: appointment?.followUpAt || null,
  timezone:
    cleanText(appointment?.timezone, 100) ||
    cleanText(organization?.timezone, 100) ||
    "Africa/Lagos",
});

const formatFollowUpTime = ({ followUpAt, timezone }) => {
  const date = new Date(followUpAt);
  if (Number.isNaN(date.getTime())) return "now";

  const options = {
    dateStyle: "full",
    timeStyle: "short",
  };

  try {
    return new Intl.DateTimeFormat("en", {
      ...options,
      timeZone: timezone || "Africa/Lagos",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en", options).format(date);
  }
};

const buildFollowUpReminderCopy = (reminder) => {
  const snapshot = reminder?.snapshot || {};
  const businessName = snapshot.businessName || "your business";
  const visitorName = snapshot.visitorName || "Visitor";
  const dueTime = formatFollowUpTime({
    followUpAt: snapshot.followUpAt,
    timezone: snapshot.timezone,
  });
  const disposition = cleanText(
    snapshot.outcomeDisposition || "unreviewed",
    40
  ).replaceAll("_", " ");
  const contact = snapshot.visitorEmail || snapshot.visitorPhone || "No contact method saved";
  const purpose = snapshot.purpose
    ? `<p><strong>Purpose:</strong> ${escapeHtml(snapshot.purpose)}</p>`
    : "";
  const notes = snapshot.outcomeNotes
    ? `<p><strong>Outcome notes:</strong> ${escapeHtml(snapshot.outcomeNotes)}</p>`
    : "";

  return {
    subject: `Follow-up due — ${visitorName}`,
    text: `A TengaAgent follow-up for ${visitorName} is due ${dueTime}. Outcome: ${disposition}. Contact: ${contact}.`,
    html: `<h2>TengaAgent follow-up due</h2><p>A follow-up for <strong>${escapeHtml(
      visitorName
    )}</strong> is due for ${escapeHtml(businessName)}.</p><p><strong>Due:</strong> ${escapeHtml(
      dueTime
    )}</p><p><strong>Outcome:</strong> ${escapeHtml(
      disposition
    )}</p><p><strong>Contact:</strong> ${escapeHtml(contact)}</p>${purpose}${notes}<p>Open your TengaAgent outcome workspace to update or complete this follow-up.</p>`,
  };
};

const resolveOwnerContext = async (appointment) => {
  const organization = await Organization.findById(appointment.organizationId);
  if (!organization?.ownerUser) return null;

  const owner = await User.findById(organization.ownerUser)
    .select("name email emailVerified")
    .lean();
  const recipientEmail = normalizeEmail(owner?.email);

  if (!recipientEmail) return null;

  return {
    organization,
    owner,
    recipientEmail,
  };
};

const createFollowUpReminder = async ({ appointment, organization, recipientEmail }) => {
  const dedupeKey = dedupeKeyFor(appointment);

  return FollowUpReminder.findOneAndUpdate(
    { dedupeKey },
    {
      $setOnInsert: {
        organizationId: appointment.organizationId,
        agentId: appointment.agentId,
        appointmentId: appointment._id,
        recipientEmail,
        dedupeKey,
        status: "pending",
        scheduledFor: new Date(),
        snapshot: snapshotFor({ appointment, organization }),
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    }
  );
};

const deliverFollowUpReminder = async (reminderInput) => {
  const reminder =
    reminderInput && reminderInput._id
      ? reminderInput
      : await FollowUpReminder.findById(reminderInput);

  if (!reminder) return null;
  if (["sent", "superseded"].includes(reminder.status)) return reminder;
  if (reminder.attempts >= MAX_DELIVERY_ATTEMPTS) return reminder;

  const settings = getEmailSettings();
  if (!settings.configured) {
    reminder.status = "pending";
    reminder.lastError = "Email service is not configured";
    await reminder.save();
    return reminder;
  }

  reminder.status = "sending";
  reminder.attempts = Number(reminder.attempts || 0) + 1;
  reminder.lastAttemptAt = new Date();
  reminder.lastError = "";
  await reminder.save();

  try {
    const copy = buildFollowUpReminderCopy(reminder);
    await sendBrandedEmail({
      to: reminder.recipientEmail,
      subject: copy.subject,
      text: copy.text,
      html: copy.html,
      previewText: copy.subject,
    });

    reminder.status = "sent";
    reminder.sentAt = new Date();
    reminder.lastError = "";
    await reminder.save();
    return reminder;
  } catch (error) {
    reminder.status = "failed";
    reminder.lastError = cleanText(
      error?.message || "Follow-up reminder delivery failed",
      1000
    );
    await reminder.save();
    return reminder;
  }
};

const dispatchReminders = (records) => {
  if (!Array.isArray(records) || records.length === 0) return;

  const run = () => {
    Promise.allSettled(
      records.map((record) => deliverFollowUpReminder(record._id))
    ).catch(() => {});
  };

  if (typeof setImmediate === "function") {
    setImmediate(run);
  } else {
    setTimeout(run, 0);
  }
};

const supersedeOpenFollowUpReminders = async ({ appointmentId }) =>
  FollowUpReminder.updateMany(
    {
      appointmentId,
      status: { $in: ["pending", "failed"] },
    },
    {
      $set: {
        status: "superseded",
        lastError: "Follow-up schedule changed before delivery",
      },
    }
  );

const queueDueFollowUpReminders = async ({
  now = new Date(),
  limit = 100,
  dispatch = true,
} = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 1, 1), 250);
  const appointments = await Appointment.find({
    status: { $in: ["completed", "no_show"] },
    followUpNeeded: true,
    followUpAt: { $ne: null, $lte: now },
  })
    .sort({ followUpAt: 1 })
    .limit(safeLimit);

  const records = [];
  let skipped = 0;

  for (const appointment of appointments) {
    const context = await resolveOwnerContext(appointment);
    if (!context) {
      skipped += 1;
      continue;
    }

    const reminder = await createFollowUpReminder({
      appointment,
      organization: context.organization,
      recipientEmail: context.recipientEmail,
    });
    records.push(reminder);
  }

  if (dispatch) dispatchReminders(records);

  return {
    appointments: appointments.length,
    queued: records.length,
    skipped,
  };
};

const deliverPendingFollowUpReminders = async ({
  limit = DELIVERY_BATCH_SIZE,
} = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 1, 1), 100);
  const records = await FollowUpReminder.find({
    status: { $in: ["pending", "failed"] },
    attempts: { $lt: MAX_DELIVERY_ATTEMPTS },
    scheduledFor: { $lte: new Date() },
  })
    .sort({ createdAt: 1 })
    .limit(safeLimit);

  for (const record of records) {
    await deliverFollowUpReminder(record);
  }

  return records.length;
};

const runFollowUpReminderSweep = async ({ logger = console } = {}) => {
  try {
    const due = await queueDueFollowUpReminders({ dispatch: false });
    const delivered = await deliverPendingFollowUpReminders();

    if (due.queued > 0 || delivered > 0) {
      logger?.log?.("[tengaagent-follow-up-reminders]", {
        dueAppointments: due.appointments,
        queued: due.queued,
        skipped: due.skipped,
        attempted: delivered,
      });
    }

    return {
      ...due,
      delivered,
    };
  } catch (error) {
    logger?.error?.(
      "[tengaagent-follow-up-reminders] sweep failed",
      error?.message || error
    );
    return null;
  }
};

const startFollowUpReminderScheduler = ({ logger = console } = {}) => {
  if (schedulerStarted || process.env.NODE_ENV === "test") return false;

  schedulerStarted = true;
  startupTimer = setTimeout(() => {
    runFollowUpReminderSweep({ logger }).catch(() => {});
  }, SWEEP_INITIAL_DELAY_MS);
  startupTimer.unref?.();

  sweepInterval = setInterval(() => {
    runFollowUpReminderSweep({ logger }).catch(() => {});
  }, SWEEP_INTERVAL_MS);
  sweepInterval.unref?.();

  return true;
};

const stopFollowUpReminderScheduler = () => {
  if (startupTimer) {
    clearTimeout(startupTimer);
    startupTimer = null;
  }
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
  }
  schedulerStarted = false;
};

module.exports = {
  buildFollowUpReminderCopy,
  deliverFollowUpReminder,
  deliverPendingFollowUpReminders,
  followUpVersionFor,
  queueDueFollowUpReminders,
  runFollowUpReminderSweep,
  startFollowUpReminderScheduler,
  stopFollowUpReminderScheduler,
  supersedeOpenFollowUpReminders,
};
