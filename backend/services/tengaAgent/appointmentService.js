const mongoose = require("mongoose");

const Appointment = require(
  "../../models/tengaAgent/Appointment"
);
const Organization = require(
  "../../models/tengaAgent/Organization"
);
const {
  checkAppointmentAvailability,
} = require(
  "./availabilityService"
);

const APPOINTMENT_STATUSES = [
  "requested",
  "confirmed",
  "completed",
  "cancelled",
];

const APPOINTMENT_TRANSITIONS = {
  requested: new Set([
    "requested",
    "confirmed",
    "cancelled",
  ]),
  confirmed: new Set([
    "confirmed",
    "completed",
    "cancelled",
  ]),
  completed: new Set([
    "completed",
  ]),
  cancelled: new Set([
    "cancelled",
  ]),
};

const cleanText = (value, max) =>
  String(value || "")
    .trim()
    .slice(0, max);

const normalizeEmail = (value) =>
  cleanText(value, 254)
    .toLowerCase();

const isValidEmail = (value) =>
  !value ||
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  );

const parsePreferredStart = (value) => {
  const parsed = new Date(value);

  if (
    !value ||
    Number.isNaN(parsed.getTime())
  ) {
    throw new Error(
      "A valid preferred appointment time is required."
    );
  }

  if (
    parsed.getTime() <=
    Date.now() + 5 * 60 * 1000
  ) {
    throw new Error(
      "Preferred appointment time must be in the future."
    );
  }

  return parsed;
};

const parseDuration = (value) => {
  const duration = Number(value) || 30;

  if (
    !Number.isFinite(duration) ||
    duration < 15 ||
    duration > 180
  ) {
    throw new Error(
      "Appointment duration must be between 15 and 180 minutes."
    );
  }

  return Math.round(duration);
};

const captureAppointmentRequest = async ({
  organizationId,
  agentId,
  conversationId,
  sessionKey,
  name,
  email,
  phone,
  company,
  purpose,
  notes,
  preferredStartAt,
  timezone,
  durationMinutes,
  source = "web",
  consentToContact,
}) => {
  if (
    !organizationId ||
    !agentId ||
    !conversationId ||
    !sessionKey
  ) {
    throw new Error(
      "Appointment context is incomplete."
    );
  }

  const cleanEmail = normalizeEmail(email);
  const cleanPhone = cleanText(phone, 40);

  if (!cleanEmail && !cleanPhone) {
    throw new Error(
      "Provide an email address or phone number for the appointment."
    );
  }

  if (!isValidEmail(cleanEmail)) {
    throw new Error(
      "Enter a valid email address."
    );
  }

  if (consentToContact !== true) {
    throw new Error(
      "Consent to contact is required for an appointment request."
    );
  }

  const requestedStart =
    parsePreferredStart(
      preferredStartAt
    );
  const duration =
    parseDuration(durationMinutes);

  const cleanTimezone = cleanText(
    timezone || "Africa/Lagos",
    100
  );

  if (!cleanTimezone) {
    throw new Error(
      "Timezone is required for an appointment request."
    );
  }

  const existing =
    await Appointment.findOne({
      organizationId,
      agentId,
      conversationId,
    });

  if (
    existing &&
    existing.status !== "requested"
  ) {
    throw new Error(
      "This appointment request can no longer be changed."
    );
  }

  const availability =
    await checkAppointmentAvailability({
      organizationId,
      agentId,
      startAt: requestedStart,
      durationMinutes: duration,
      excludeAppointmentId: existing?._id,
    });

  if (!availability.available) {
    throw new Error(
      "That appointment time is no longer available. Choose another slot."
    );
  }

  const scheduleChecked =
    availability.scheduleEnabled === true;

  return Appointment.findOneAndUpdate(
    {
      organizationId,
      agentId,
      conversationId,
    },
    {
      $set: {
        sessionKey:
          cleanText(sessionKey, 160),
        name:
          cleanText(name, 120),
        email:
          cleanEmail,
        phone:
          cleanPhone,
        company:
          cleanText(company, 160),
        purpose:
          cleanText(purpose, 1000),
        notes:
          cleanText(notes, 2000),
        preferredStartAt:
          requestedStart,
        timezone:
          cleanTimezone,
        durationMinutes:
          duration,
        source:
          cleanText(source, 40) || "web",
        consentToContact:
          true,
        requestedAt:
          new Date(),
        availabilityState:
          scheduleChecked
            ? "available_at_request"
            : "not_checked",
        availabilitySource:
          availability.source,
        availabilityCheckedAt:
          scheduleChecked ? new Date() : null,
        confirmedAt: null,
      },
      $setOnInsert: {
        status:
          "requested",
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );
};

const findOwnerOrganization = async (
  userId
) => {
  if (!userId) {
    return null;
  }

  return Organization.findOne({
    ownerUser: userId,
    status: {
      $ne: "closed",
    },
  }).sort({
    createdAt: 1,
  });
};

const listOwnerAppointments = async ({
  userId,
  limit = 50,
}) => {
  const organization =
    await findOwnerOrganization(
      userId
    );

  if (!organization) {
    return null;
  }

  const safeLimit = Math.min(
    Math.max(Number(limit) || 50, 1),
    100
  );

  const appointments =
    await Appointment.find({
      organizationId:
        organization._id,
    })
      .sort({
        preferredStartAt: 1,
        createdAt: -1,
      })
      .limit(safeLimit)
      .lean();

  return {
    organization,
    appointments,
  };
};

const updateOwnerAppointmentStatus = async ({
  userId,
  appointmentId,
  status,
}) => {
  const organization =
    await findOwnerOrganization(
      userId
    );

  if (!organization) {
    return {
      workspaceFound: false,
      appointment: null,
    };
  }

  const normalizedStatus =
    cleanText(status, 40)
      .toLowerCase();

  if (
    !APPOINTMENT_STATUSES.includes(
      normalizedStatus
    )
  ) {
    throw new Error(
      "Unsupported appointment status."
    );
  }

  if (
    !mongoose.Types.ObjectId.isValid(
      appointmentId
    )
  ) {
    return {
      workspaceFound: true,
      appointment: null,
    };
  }

  const appointment =
    await Appointment.findOne({
      _id: appointmentId,
      organizationId:
        organization._id,
    });

  if (!appointment) {
    return {
      workspaceFound: true,
      appointment: null,
    };
  }

  const allowed =
    APPOINTMENT_TRANSITIONS[
      appointment.status
    ];

  if (
    !allowed ||
    !allowed.has(normalizedStatus)
  ) {
    throw new Error(
      `Appointment cannot move from ${appointment.status} to ${normalizedStatus}.`
    );
  }

  if (
    appointment.status === "requested" &&
    normalizedStatus === "confirmed"
  ) {
    const availability =
      await checkAppointmentAvailability({
        organizationId:
          organization._id,
        agentId:
          appointment.agentId,
        startAt:
          appointment.preferredStartAt,
        durationMinutes:
          appointment.durationMinutes,
        excludeAppointmentId:
          appointment._id,
      });

    appointment.availabilitySource =
      availability.source;
    appointment.availabilityCheckedAt =
      new Date();

    if (!availability.available) {
      appointment.availabilityState =
        "conflict_at_confirmation";
      await appointment.save();

      throw new Error(
        "That appointment time is no longer available. Choose another slot before confirming."
      );
    }

    appointment.status = "confirmed";
    appointment.availabilityState =
      "confirmed_free";
    appointment.confirmedAt = new Date();
    await appointment.save();
  } else if (
    appointment.status !==
    normalizedStatus
  ) {
    appointment.status =
      normalizedStatus;
    await appointment.save();
  }

  return {
    workspaceFound: true,
    appointment,
  };
};

module.exports = {
  APPOINTMENT_STATUSES,
  captureAppointmentRequest,
  listOwnerAppointments,
  updateOwnerAppointmentStatus,
};
