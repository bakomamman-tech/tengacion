const Appointment = require(
  "../../models/tengaAgent/Appointment"
);
const AppointmentNotification = require(
  "../../models/tengaAgent/AppointmentNotification"
);
const Organization = require(
  "../../models/tengaAgent/Organization"
);
const User = require("../../models/User");
const {
  getEmailSettings,
} = require("../../utils/emailSettings");
const {
  sendBrandedEmail,
} = require("../../utils/sendBrandedEmail");

const DELIVERY_BATCH_SIZE = 25;
const MAX_DELIVERY_ATTEMPTS = 4;
const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const SWEEP_INITIAL_DELAY_MS = 45 * 1000;

let schedulerStarted = false;
let reminderInterval = null;
let reminderStartupTimer = null;

const cleanText = (value, max = 1000) =>
  String(value || "")
    .trim()
    .slice(0, max);

const normalizeEmail = (value) =>
  cleanText(value, 254).toLowerCase();

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatAppointmentTime = ({
  preferredStartAt,
  timezone,
}) => {
  const date = new Date(preferredStartAt);
  if (Number.isNaN(date.getTime())) {
    return "the selected time";
  }

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

const snapshotFor = ({ appointment, organization }) => ({
  businessName: cleanText(organization?.name, 180),
  visitorName: cleanText(appointment?.name, 120),
  purpose: cleanText(appointment?.purpose, 1000),
  preferredStartAt: appointment?.preferredStartAt || null,
  timezone:
    cleanText(appointment?.timezone, 100) ||
    cleanText(organization?.timezone, 100) ||
    "Africa/Lagos",
  durationMinutes: Number(appointment?.durationMinutes || 30),
  appointmentStatus:
    cleanText(appointment?.status, 40) || "requested",
});

const eventVersion = ({ appointment, eventType }) => {
  if (eventType === "requested") {
    return new Date(
      appointment.requestedAt || appointment.updatedAt || Date.now()
    ).getTime();
  }

  if (eventType === "confirmed") {
    return new Date(
      appointment.confirmedAt || appointment.updatedAt || Date.now()
    ).getTime();
  }

  if (eventType === "rescheduled") {
    return new Date(
      appointment.rescheduledAt || appointment.updatedAt || Date.now()
    ).getTime();
  }

  if (eventType === "completed") {
    return new Date(
      appointment.completedAt || appointment.updatedAt || Date.now()
    ).getTime();
  }

  if (eventType === "no_show") {
    return new Date(
      appointment.noShowAt || appointment.updatedAt || Date.now()
    ).getTime();
  }

  if (eventType === "cancelled") {
    return new Date(
      appointment.cancelledAt || appointment.updatedAt || Date.now()
    ).getTime();
  }

  return new Date(
    appointment.preferredStartAt || appointment.updatedAt || Date.now()
  ).getTime();
};

const dedupeKeyFor = ({
  appointment,
  eventType,
  recipientKind,
}) =>
  [
    String(appointment._id),
    eventType,
    recipientKind,
    eventVersion({ appointment, eventType }),
  ].join(":");

const resolveAppointmentContext = async (appointmentInput) => {
  const appointment =
    appointmentInput && appointmentInput._id
      ? appointmentInput
      : await Appointment.findById(appointmentInput);

  if (!appointment) {
    return null;
  }

  const organization = await Organization.findById(
    appointment.organizationId
  );

  if (!organization) {
    return null;
  }

  let owner = null;
  if (organization.ownerUser) {
    owner = await User.findById(organization.ownerUser)
      .select("name email emailVerified")
      .lean();
  }

  return {
    appointment,
    organization,
    owner,
  };
};

const recipientsForEvent = ({
  appointment,
  owner,
  eventType,
  actor,
}) => {
  const recipients = [];
  const visitorEmail = normalizeEmail(appointment.email);
  const ownerEmail = normalizeEmail(owner?.email);

  const add = (recipientKind, email) => {
    if (!email) return;
    if (
      recipients.some(
        (entry) =>
          entry.recipientKind === recipientKind &&
          entry.email === email
      )
    ) {
      return;
    }
    recipients.push({ recipientKind, email });
  };

  if (eventType === "requested") {
    add("owner", ownerEmail);
    add("visitor", visitorEmail);
    return recipients;
  }

  if (eventType === "confirmed") {
    add("visitor", visitorEmail);
    return recipients;
  }

  if (eventType === "rescheduled") {
    add("visitor", visitorEmail);
    add("owner", ownerEmail);
    return recipients;
  }

  if (["completed", "no_show"].includes(eventType)) {
    add("visitor", visitorEmail);
    add("owner", ownerEmail);
    return recipients;
  }

  if (eventType === "cancelled") {
    if (actor === "visitor") {
      add("owner", ownerEmail);
      add("visitor", visitorEmail);
    } else {
      add("visitor", visitorEmail);
      add("owner", ownerEmail);
    }
    return recipients;
  }

  if (eventType === "reminder_24h") {
    add("visitor", visitorEmail);
    add("owner", ownerEmail);
  }

  return recipients;
};

const buildNotificationCopy = (notification) => {
  const snapshot = notification.snapshot || {};
  const businessName =
    snapshot.businessName || "the business";
  const visitorName = snapshot.visitorName || "Visitor";
  const time = formatAppointmentTime({
    preferredStartAt: snapshot.preferredStartAt,
    timezone: snapshot.timezone,
  });
  const duration = Number(snapshot.durationMinutes || 30);
  const purpose = snapshot.purpose
    ? `<p><strong>Purpose:</strong> ${escapeHtml(snapshot.purpose)}</p>`
    : "";
  const details = `
    <p><strong>Time:</strong> ${escapeHtml(time)}</p>
    <p><strong>Timezone:</strong> ${escapeHtml(
      snapshot.timezone || "Africa/Lagos"
    )}</p>
    <p><strong>Duration:</strong> ${duration} minutes</p>
    ${purpose}
  `;

  if (notification.eventType === "requested") {
    if (notification.recipientKind === "owner") {
      return {
        subject: `New appointment request — ${businessName}`,
        text: `${visitorName} requested an appointment for ${time}.`,
        html: `<h2>New appointment request</h2><p>${escapeHtml(
          visitorName
        )} requested a meeting with ${escapeHtml(
          businessName
        )}.</p>${details}<p>The request is not confirmed until you approve it in TengaAgent.</p>`,
      };
    }

    return {
      subject: `Appointment request received — ${businessName}`,
      text: `Your appointment request for ${time} was received and is awaiting confirmation.`,
      html: `<h2>We received your appointment request</h2><p>${escapeHtml(
        businessName
      )} has received your preferred meeting time.</p>${details}<p>This is still a request until the business confirms it.</p>`,
    };
  }

  if (notification.eventType === "confirmed") {
    return {
      subject: `Appointment confirmed — ${businessName}`,
      text: `Your appointment with ${businessName} is confirmed for ${time}.`,
      html: `<h2>Your appointment is confirmed</h2><p>Your meeting with ${escapeHtml(
        businessName
      )} is confirmed.</p>${details}`,
    };
  }

  if (notification.eventType === "rescheduled") {
    const audience =
      notification.recipientKind === "owner"
        ? `${visitorName}'s appointment`
        : "Your appointment";
    return {
      subject: `Appointment rescheduled — ${businessName}`,
      text: `${audience} is now scheduled for ${time}.`,
      html: `<h2>Appointment time changed</h2><p>${escapeHtml(
        audience
      )} with ${escapeHtml(
        businessName
      )} has been moved.</p>${details}`,
    };
  }

  if (notification.eventType === "completed") {
    const subject = `Appointment completed — ${businessName}`;
    const text =
      notification.recipientKind === "owner"
        ? `${visitorName}'s appointment for ${time} was marked completed.`
        : `Your appointment with ${businessName} for ${time} was marked completed.`;
    const message =
      notification.recipientKind === "owner"
        ? `${escapeHtml(visitorName)}'s appointment has been closed as completed.`
        : `Your appointment with ${escapeHtml(
            businessName
          )} has been closed as completed.`;

    return {
      subject,
      text,
      html: `<h2>Appointment completed</h2><p>${message}</p>${details}`,
    };
  }

  if (notification.eventType === "no_show") {
    const subject = `Appointment marked no-show — ${businessName}`;
    const text =
      notification.recipientKind === "owner"
        ? `${visitorName}'s appointment for ${time} was marked as a no-show.`
        : `Your appointment with ${businessName} for ${time} was recorded as a no-show. If this seems incorrect, contact the business.`;
    const message =
      notification.recipientKind === "owner"
        ? `${escapeHtml(visitorName)}'s appointment has been closed as a no-show.`
        : `Your appointment with ${escapeHtml(
            businessName
          )} was recorded as a no-show. If this seems incorrect, please contact the business.`;

    return {
      subject,
      text,
      html: `<h2>Appointment marked no-show</h2><p>${message}</p>${details}`,
    };
  }

  if (notification.eventType === "cancelled") {
    return {
      subject: `Appointment cancelled — ${businessName}`,
      text: `The appointment scheduled for ${time} has been cancelled.`,
      html: `<h2>Appointment cancelled</h2><p>The appointment with ${escapeHtml(
        businessName
      )} has been cancelled.</p>${details}`,
    };
  }

  return {
    subject: `Upcoming appointment reminder — ${businessName}`,
    text: `Reminder: your appointment is scheduled for ${time}.`,
    html: `<h2>Upcoming appointment reminder</h2><p>This is a reminder about the upcoming appointment with ${escapeHtml(
      businessName
    )}.</p>${details}`,
  };
};

const createOutboxRecord = async ({
  appointment,
  organization,
  eventType,
  recipientKind,
  recipientEmail,
  actor,
}) => {
  const dedupeKey = dedupeKeyFor({
    appointment,
    eventType,
    recipientKind,
  });

  return AppointmentNotification.findOneAndUpdate(
    { dedupeKey },
    {
      $setOnInsert: {
        organizationId: appointment.organizationId,
        agentId: appointment.agentId,
        appointmentId: appointment._id,
        eventType,
        recipientKind,
        recipientEmail,
        actor: actor || "system",
        dedupeKey,
        status: "pending",
        scheduledFor: new Date(),
        snapshot: snapshotFor({
          appointment,
          organization,
        }),
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    }
  );
};

const deliverNotification = async (notificationInput) => {
  const notification =
    notificationInput && notificationInput._id
      ? notificationInput
      : await AppointmentNotification.findById(notificationInput);

  if (!notification) return null;
  if (["sent", "superseded"].includes(notification.status)) {
    return notification;
  }
  if (notification.attempts >= MAX_DELIVERY_ATTEMPTS) {
    return notification;
  }

  const settings = getEmailSettings();
  if (!settings.configured) {
    notification.status = "pending";
    notification.lastError = "Email service is not configured";
    await notification.save();
    return notification;
  }

  notification.status = "sending";
  notification.attempts = Number(notification.attempts || 0) + 1;
  notification.lastAttemptAt = new Date();
  notification.lastError = "";
  await notification.save();

  try {
    const copy = buildNotificationCopy(notification);
    await sendBrandedEmail({
      to: notification.recipientEmail,
      subject: copy.subject,
      text: copy.text,
      html: copy.html,
      previewText: copy.subject,
    });

    notification.status = "sent";
    notification.sentAt = new Date();
    notification.lastError = "";
    await notification.save();
    return notification;
  } catch (error) {
    notification.status = "failed";
    notification.lastError = cleanText(
      error?.message || "Email delivery failed",
      1000
    );
    await notification.save();
    return notification;
  }
};

const dispatchOutboxRecords = (records) => {
  if (!Array.isArray(records) || records.length === 0) {
    return;
  }

  const run = () => {
    Promise.allSettled(
      records.map((record) => deliverNotification(record._id))
    ).catch(() => {});
  };

  if (typeof setImmediate === "function") {
    setImmediate(run);
  } else {
    setTimeout(run, 0);
  }
};

const supersedeOldReminders = async (appointmentId) =>
  AppointmentNotification.updateMany(
    {
      appointmentId,
      eventType: "reminder_24h",
      status: { $in: ["pending", "failed"] },
    },
    {
      $set: {
        status: "superseded",
        lastError: "Appointment time or status changed before delivery",
      },
    }
  );

const queueAppointmentEventNotifications = async ({
  appointment: appointmentInput,
  eventType,
  actor = "system",
  dispatch = true,
}) => {
  const context = await resolveAppointmentContext(appointmentInput);
  if (!context) return [];

  const { appointment, organization, owner } = context;

  if (
    ["rescheduled", "completed", "no_show", "cancelled"].includes(eventType)
  ) {
    await supersedeOldReminders(appointment._id);
  }

  const recipients = recipientsForEvent({
    appointment,
    owner,
    eventType,
    actor,
  });

  const records = [];
  for (const recipient of recipients) {
    const record = await createOutboxRecord({
      appointment,
      organization,
      eventType,
      recipientKind: recipient.recipientKind,
      recipientEmail: recipient.email,
      actor,
    });
    records.push(record);
  }

  if (dispatch) {
    dispatchOutboxRecords(records);
  }

  return records;
};

const deliverPendingAppointmentNotifications = async ({
  limit = DELIVERY_BATCH_SIZE,
} = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 1, 1), 100);
  const records = await AppointmentNotification.find({
    status: { $in: ["pending", "failed"] },
    attempts: { $lt: MAX_DELIVERY_ATTEMPTS },
    scheduledFor: { $lte: new Date() },
  })
    .sort({ createdAt: 1 })
    .limit(safeLimit);

  for (const record of records) {
    await deliverNotification(record);
  }

  return records.length;
};

const queueDueAppointmentReminders = async ({
  now = new Date(),
  limit = 100,
  dispatch = true,
} = {}) => {
  const horizon = new Date(now.getTime() + REMINDER_WINDOW_MS);
  const appointments = await Appointment.find({
    status: "confirmed",
    preferredStartAt: {
      $gt: now,
      $lte: horizon,
    },
  })
    .sort({ preferredStartAt: 1 })
    .limit(Math.min(Math.max(Number(limit) || 1, 1), 250));

  let queued = 0;
  for (const appointment of appointments) {
    const records = await queueAppointmentEventNotifications({
      appointment,
      eventType: "reminder_24h",
      actor: "system",
      dispatch,
    });
    queued += records.length;
  }

  return {
    appointments: appointments.length,
    queued,
  };
};

const runAppointmentNotificationSweep = async ({
  logger = console,
} = {}) => {
  try {
    const reminders = await queueDueAppointmentReminders({
      dispatch: false,
    });
    const delivered =
      await deliverPendingAppointmentNotifications();

    if (reminders.queued > 0 || delivered > 0) {
      logger?.log?.("[tengaagent-appointment-notifications]", {
        reminderAppointments: reminders.appointments,
        queued: reminders.queued,
        attempted: delivered,
      });
    }

    return {
      ...reminders,
      delivered,
    };
  } catch (error) {
    logger?.error?.(
      "[tengaagent-appointment-notifications] sweep failed",
      error?.message || error
    );
    return null;
  }
};

const startAppointmentNotificationScheduler = ({
  logger = console,
} = {}) => {
  if (schedulerStarted || process.env.NODE_ENV === "test") {
    return false;
  }

  schedulerStarted = true;

  reminderStartupTimer = setTimeout(() => {
    runAppointmentNotificationSweep({ logger }).catch(() => {});
  }, SWEEP_INITIAL_DELAY_MS);
  reminderStartupTimer.unref?.();

  reminderInterval = setInterval(() => {
    runAppointmentNotificationSweep({ logger }).catch(() => {});
  }, SWEEP_INTERVAL_MS);
  reminderInterval.unref?.();

  return true;
};

const stopAppointmentNotificationScheduler = () => {
  if (reminderStartupTimer) {
    clearTimeout(reminderStartupTimer);
    reminderStartupTimer = null;
  }
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
  schedulerStarted = false;
};

module.exports = {
  buildNotificationCopy,
  deliverNotification,
  deliverPendingAppointmentNotifications,
  queueAppointmentEventNotifications,
  queueDueAppointmentReminders,
  runAppointmentNotificationSweep,
  startAppointmentNotificationScheduler,
  stopAppointmentNotificationScheduler,
  supersedeOldReminders,
};
