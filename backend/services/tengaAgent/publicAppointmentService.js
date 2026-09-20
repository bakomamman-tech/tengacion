const Appointment = require(
  "../../models/tengaAgent/Appointment"
);
const {
  checkAppointmentAvailability,
} = require("./availabilityService");
const {
  withBookingConfirmationLock,
} = require("./bookingConfirmationLockService");
const {
  queueAppointmentEventNotifications,
} = require("./appointmentNotificationService");

const cleanText = (value, max) =>
  String(value || "")
    .trim()
    .slice(0, max);

const parsePreferredStart = (value) => {
  const parsed = new Date(value);

  if (!value || Number.isNaN(parsed.getTime())) {
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

const parseDuration = (value, fallback = 30) => {
  const duration =
    value === undefined ||
    value === null ||
    value === ""
      ? Number(fallback || 30)
      : Number(value);

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

const queueAppointmentEventSafely = async (payload) => {
  try {
    return await queueAppointmentEventNotifications(payload);
  } catch (error) {
    console.error(
      "[tengaagent-appointment-notifications] queue failed",
      error?.message || error
    );
    return [];
  }
};

const appointmentScope = ({
  organizationId,
  agentId,
  conversationId,
  sessionKey,
}) => ({
  organizationId,
  agentId,
  conversationId,
  sessionKey: cleanText(sessionKey, 160),
});

const findPublicSessionAppointment = async (context) =>
  Appointment.findOne(appointmentScope(context));

const reschedulePublicSessionAppointment = async ({
  organizationId,
  agentId,
  conversationId,
  sessionKey,
  preferredStartAt,
  timezone,
  durationMinutes,
}) => {
  const scope = appointmentScope({
    organizationId,
    agentId,
    conversationId,
    sessionKey,
  });
  const seed = await Appointment.findOne(scope)
    .select({ agentId: 1 })
    .lean();

  if (!seed) {
    return null;
  }

  const mutation = await withBookingConfirmationLock({
    organizationId,
    agentId: seed.agentId,
    task: async () => {
      const appointment =
        await Appointment.findOne(scope);

      if (!appointment) {
        return {
          appointment: null,
          changed: false,
        };
      }

      if (
        !["requested", "confirmed"].includes(
          appointment.status
        )
      ) {
        throw new Error(
          `${appointment.status} appointments cannot be rescheduled.`
        );
      }

      const nextStart = parsePreferredStart(
        preferredStartAt
      );
      const nextDuration = parseDuration(
        durationMinutes,
        appointment.durationMinutes
      );
      const nextTimezone = cleanText(
        timezone ||
          appointment.timezone ||
          "Africa/Lagos",
        100
      );

      if (!nextTimezone) {
        throw new Error(
          "Timezone is required when rescheduling an appointment."
        );
      }

      const unchanged =
        new Date(
          appointment.preferredStartAt
        ).getTime() === nextStart.getTime() &&
        Number(
          appointment.durationMinutes || 30
        ) === nextDuration &&
        appointment.timezone === nextTimezone;

      if (unchanged) {
        return {
          appointment,
          changed: false,
        };
      }

      const availability =
        await checkAppointmentAvailability({
          organizationId,
          agentId: appointment.agentId,
          startAt: nextStart,
          durationMinutes: nextDuration,
          excludeAppointmentId:
            appointment._id,
        });

      if (!availability.available) {
        throw new Error(
          "That appointment time is no longer available. Choose another slot."
        );
      }

      if (
        appointment.status === "confirmed" &&
        availability.externalCalendarState ===
          "unavailable"
      ) {
        throw new Error(
          "External calendar availability could not be verified. Please try again before changing this confirmed appointment."
        );
      }

      appointment.preferredStartAt = nextStart;
      appointment.durationMinutes = nextDuration;
      appointment.timezone = nextTimezone;
      appointment.availabilitySource =
        availability.source;
      appointment.rescheduledAt = new Date();
      appointment.rescheduleCount =
        Number(appointment.rescheduleCount || 0) + 1;

      if (appointment.status === "confirmed") {
        appointment.availabilityState =
          "confirmed_free";
        appointment.availabilityCheckedAt =
          new Date();
      } else {
        const scheduleChecked =
          availability.scheduleEnabled === true;

        appointment.availabilityState =
          scheduleChecked
            ? "available_at_request"
            : "not_checked";
        appointment.availabilityCheckedAt =
          scheduleChecked ? new Date() : null;
      }

      await appointment.save();
      return {
        appointment,
        changed: true,
      };
    },
  });

  if (mutation?.appointment && mutation.changed) {
    await queueAppointmentEventSafely({
      appointment: mutation.appointment,
      eventType: "rescheduled",
      actor: "visitor",
    });
  }

  return mutation?.appointment || null;
};

const cancelPublicSessionAppointment = async ({
  organizationId,
  agentId,
  conversationId,
  sessionKey,
}) => {
  const scope = appointmentScope({
    organizationId,
    agentId,
    conversationId,
    sessionKey,
  });
  const seed = await Appointment.findOne(scope)
    .select({ agentId: 1 })
    .lean();

  if (!seed) {
    return null;
  }

  const mutation = await withBookingConfirmationLock({
    organizationId,
    agentId: seed.agentId,
    task: async () => {
      const appointment =
        await Appointment.findOne(scope);

      if (!appointment) {
        return {
          appointment: null,
          changed: false,
        };
      }

      if (appointment.status === "completed") {
        throw new Error(
          "Completed appointments cannot be cancelled."
        );
      }

      if (appointment.status === "cancelled") {
        return {
          appointment,
          changed: false,
        };
      }

      appointment.status = "cancelled";
      appointment.cancelledAt = new Date();
      appointment.cancelledBy = "visitor";
      await appointment.save();
      return {
        appointment,
        changed: true,
      };
    },
  });

  if (mutation?.appointment && mutation.changed) {
    await queueAppointmentEventSafely({
      appointment: mutation.appointment,
      eventType: "cancelled",
      actor: "visitor",
    });
  }

  return mutation?.appointment || null;
};

module.exports = {
  cancelPublicSessionAppointment,
  findPublicSessionAppointment,
  reschedulePublicSessionAppointment,
};
