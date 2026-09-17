const mongoose = require("mongoose");

const Appointment = require("../../models/tengaAgent/Appointment");
const FollowUpActivity = require("../../models/tengaAgent/FollowUpActivity");
const Organization = require("../../models/tengaAgent/Organization");

const TERMINAL_APPOINTMENT_STATUSES = ["completed", "no_show"];
const NEXT_ACTIONS = ["email", "call", "reschedule", "wait", "close"];
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_REPLY_WINDOW_MS = DAY_MS;
const CONTACT_FATIGUE_WINDOW_MS = 7 * DAY_MS;
const CONTACT_FATIGUE_COOLDOWN_MS = 72 * 60 * 60 * 1000;
const DELIVERY_RETRY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

const findOwnerOrganization = async (userId) => {
  if (!userId) return null;

  return Organization.findOne({
    ownerUser: userId,
    status: { $ne: "closed" },
  }).sort({ createdAt: 1 });
};

const canEmailAppointment = (appointment) =>
  Boolean(appointment?.email && appointment?.consentToContact);

const hasPhone = (appointment) => Boolean(String(appointment?.phone || "").trim());

const activityTime = (activity) => {
  const value = activity?.occurredAt || activity?.sentAt || activity?.attemptedAt || activity?.createdAt;
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isSuccessfulContact = (activity) =>
  activity?.status === "sent" || activity?.status === "logged";

const actionLabel = (action) =>
  ({
    email: "Send an email",
    call: "Call the customer",
    reschedule: "Reschedule the follow-up",
    wait: "Wait before contacting again",
    close: "Close the follow-up",
  })[action] || action;

const makeRecommendation = ({
  action,
  rationale,
  reasonCodes,
  signals,
  strength = "moderate",
  waitUntil = null,
  now,
}) => ({
  action,
  label: actionLabel(action),
  rationale,
  reasonCodes,
  strength,
  waitUntil,
  signals,
  recommendedAt: now,
  advisoryOnly: true,
});

const buildSignals = ({ appointment, activities, now }) => {
  const ordered = [...activities].sort((left, right) => {
    const rightTime = activityTime(right)?.getTime() || 0;
    const leftTime = activityTime(left)?.getTime() || 0;
    return rightTime - leftTime;
  });

  const latestActivity = ordered[0] || null;
  const latestInbound = ordered.find((activity) => activity.direction === "inbound") || null;
  const latestOutbound = ordered.find((activity) => activity.direction === "outbound") || null;
  const latestSuccessfulOutbound = ordered.find(
    (activity) => activity.direction === "outbound" && isSuccessfulContact(activity)
  ) || null;
  const latestFailedEmail = ordered.find(
    (activity) => activity.channel === "email" && activity.status === "failed"
  ) || null;

  const cutoff = now.getTime() - CONTACT_FATIGUE_WINDOW_MS;
  const recentSuccessfulOutboundCount = ordered.filter((activity) => {
    const occurredAt = activityTime(activity);
    return (
      activity.direction === "outbound" &&
      isSuccessfulContact(activity) &&
      occurredAt &&
      occurredAt.getTime() >= cutoff
    );
  }).length;

  const followUpAt = appointment?.followUpAt ? new Date(appointment.followUpAt) : null;
  const followUpDue = Boolean(
    followUpAt && !Number.isNaN(followUpAt.getTime()) && followUpAt.getTime() <= now.getTime()
  );

  return {
    activityCount: ordered.length,
    canEmail: canEmailAppointment(appointment),
    hasPhone: hasPhone(appointment),
    followUpDue,
    followUpAt: followUpAt && !Number.isNaN(followUpAt.getTime()) ? followUpAt : null,
    latestActivity,
    latestActivityAt: activityTime(latestActivity),
    latestInbound,
    latestInboundAt: activityTime(latestInbound),
    latestOutbound,
    latestOutboundAt: activityTime(latestOutbound),
    latestSuccessfulOutbound,
    latestSuccessfulOutboundAt: activityTime(latestSuccessfulOutbound),
    latestFailedEmail,
    latestFailedEmailAt: activityTime(latestFailedEmail),
    recentSuccessfulOutboundCount,
  };
};

const serializeSignals = (signals) => ({
  activityCount: signals.activityCount,
  canEmail: signals.canEmail,
  hasPhone: signals.hasPhone,
  followUpDue: signals.followUpDue,
  followUpAt: signals.followUpAt,
  latestActivity: signals.latestActivity
    ? {
        channel: signals.latestActivity.channel,
        direction: signals.latestActivity.direction,
        status: signals.latestActivity.status,
        occurredAt: signals.latestActivityAt,
      }
    : null,
  latestInboundAt: signals.latestInboundAt,
  latestOutboundAt: signals.latestOutboundAt,
  recentSuccessfulOutboundCount: signals.recentSuccessfulOutboundCount,
});

const recommendNextFollowUpAction = ({ appointment, activities = [], now = new Date() }) => {
  const signals = buildSignals({ appointment, activities, now });
  const serializedSignals = serializeSignals(signals);
  const disposition = appointment?.outcomeDisposition || "unreviewed";

  if (!appointment?.followUpNeeded) {
    return makeRecommendation({
      action: "close",
      rationale: "This follow-up is already marked complete, so no further outreach is required.",
      reasonCodes: ["FOLLOW_UP_COMPLETE"],
      signals: serializedSignals,
      strength: "strong",
      now,
    });
  }

  if (disposition === "not_interested") {
    return makeRecommendation({
      action: "close",
      rationale: "The recorded meeting outcome says the customer is not interested. Closing the follow-up avoids unnecessary outreach unless you have new information.",
      reasonCodes: ["OUTCOME_NOT_INTERESTED"],
      signals: serializedSignals,
      strength: "strong",
      now,
    });
  }

  if (disposition === "converted") {
    return makeRecommendation({
      action: "close",
      rationale: "The meeting is recorded as converted. Close this sales follow-up unless you intentionally want to schedule a separate post-sale touchpoint.",
      reasonCodes: ["OUTCOME_CONVERTED"],
      signals: serializedSignals,
      strength: "strong",
      now,
    });
  }

  if (disposition === "reschedule_requested") {
    return makeRecommendation({
      action: "reschedule",
      rationale: "The recorded outcome says the customer requested another time, so the next step is to choose a new follow-up date instead of sending another message now.",
      reasonCodes: ["OUTCOME_RESCHEDULE_REQUESTED"],
      signals: serializedSignals,
      strength: "strong",
      now,
    });
  }

  if (!signals.followUpDue && signals.followUpAt) {
    return makeRecommendation({
      action: "wait",
      rationale: "The follow-up is not due yet. Waiting preserves the timing already chosen by the owner.",
      reasonCodes: ["FOLLOW_UP_NOT_DUE"],
      signals: serializedSignals,
      strength: "strong",
      waitUntil: signals.followUpAt,
      now,
    });
  }

  const inboundIsNewest = Boolean(
    signals.latestInboundAt &&
      (!signals.latestOutboundAt || signals.latestInboundAt.getTime() > signals.latestOutboundAt.getTime())
  );

  if (inboundIsNewest) {
    if (signals.hasPhone) {
      return makeRecommendation({
        action: "call",
        rationale: "The most recent logged contact is inbound. A direct call is the fastest owner-controlled way to respond while the customer is engaged.",
        reasonCodes: ["LATEST_CONTACT_INBOUND", "PHONE_AVAILABLE"],
        signals: serializedSignals,
        strength: "strong",
        now,
      });
    }
    if (signals.canEmail) {
      return makeRecommendation({
        action: "email",
        rationale: "The most recent logged contact is inbound and email outreach is permitted, so a reviewed email reply is the clearest available response.",
        reasonCodes: ["LATEST_CONTACT_INBOUND", "EMAIL_AVAILABLE"],
        signals: serializedSignals,
        strength: "strong",
        now,
      });
    }
  }

  const failedEmailIsNewest = Boolean(
    signals.latestFailedEmailAt &&
      (!signals.latestActivityAt || signals.latestFailedEmailAt.getTime() >= signals.latestActivityAt.getTime())
  );

  if (failedEmailIsNewest) {
    if (signals.hasPhone) {
      return makeRecommendation({
        action: "call",
        rationale: "The latest email delivery failed and a phone number is available. Calling avoids repeatedly retrying a channel that just failed.",
        reasonCodes: ["LATEST_EMAIL_FAILED", "PHONE_AVAILABLE"],
        signals: serializedSignals,
        strength: "strong",
        now,
      });
    }

    const retryAt = new Date(signals.latestFailedEmailAt.getTime() + DELIVERY_RETRY_COOLDOWN_MS);
    if (retryAt.getTime() > now.getTime()) {
      return makeRecommendation({
        action: "wait",
        rationale: "The latest email delivery failed and there is no alternate phone channel. Wait briefly before deciding whether to retry email or update the customer contact details.",
        reasonCodes: ["LATEST_EMAIL_FAILED", "NO_ALTERNATE_PHONE"],
        signals: serializedSignals,
        strength: "moderate",
        waitUntil: retryAt,
        now,
      });
    }
  }

  if (signals.recentSuccessfulOutboundCount >= 3 && signals.latestSuccessfulOutboundAt) {
    const coolDownUntil = new Date(
      signals.latestSuccessfulOutboundAt.getTime() + CONTACT_FATIGUE_COOLDOWN_MS
    );
    if (coolDownUntil.getTime() > now.getTime() && !inboundIsNewest) {
      return makeRecommendation({
        action: "wait",
        rationale: "Several outbound contacts were already logged recently without a newer inbound response. Waiting reduces the risk of over-contacting the customer.",
        reasonCodes: ["RECENT_OUTBOUND_CONTACT_FATIGUE"],
        signals: serializedSignals,
        strength: "strong",
        waitUntil: coolDownUntil,
        now,
      });
    }
  }

  if (signals.latestSuccessfulOutboundAt && !inboundIsNewest) {
    const responseWindowUntil = new Date(
      signals.latestSuccessfulOutboundAt.getTime() + RECENT_REPLY_WINDOW_MS
    );
    if (responseWindowUntil.getTime() > now.getTime()) {
      return makeRecommendation({
        action: "wait",
        rationale: "A successful outbound contact was logged within the last 24 hours and there is no newer inbound response. Give the customer time to reply before another touch.",
        reasonCodes: ["RECENT_SUCCESSFUL_OUTBOUND"],
        signals: serializedSignals,
        strength: "strong",
        waitUntil: responseWindowUntil,
        now,
      });
    }
  }

  if (appointment?.status === "no_show") {
    if (signals.hasPhone) {
      return makeRecommendation({
        action: "call",
        rationale: "The appointment is marked no-show and a phone number is available. A short call is the most direct way to confirm whether the customer still wants to continue.",
        reasonCodes: ["APPOINTMENT_NO_SHOW", "PHONE_AVAILABLE"],
        signals: serializedSignals,
        strength: "strong",
        now,
      });
    }
    if (signals.canEmail) {
      return makeRecommendation({
        action: "email",
        rationale: "The appointment is marked no-show and email outreach is permitted. A concise owner-reviewed email can ask whether the customer wants to reschedule.",
        reasonCodes: ["APPOINTMENT_NO_SHOW", "EMAIL_AVAILABLE"],
        signals: serializedSignals,
        strength: "strong",
        now,
      });
    }
  }

  if (disposition === "qualified" && signals.canEmail) {
    return makeRecommendation({
      action: "email",
      rationale: "The opportunity is recorded as qualified and the follow-up is due. A personalized owner-reviewed email is the strongest available next touch.",
      reasonCodes: ["OUTCOME_QUALIFIED", "FOLLOW_UP_DUE", "EMAIL_AVAILABLE"],
      signals: serializedSignals,
      strength: "strong",
      now,
    });
  }

  if (signals.canEmail) {
    return makeRecommendation({
      action: "email",
      rationale: "The follow-up is due and email outreach is available with recorded consent. Use the composer or write a message, then review it before sending.",
      reasonCodes: ["FOLLOW_UP_DUE", "EMAIL_AVAILABLE"],
      signals: serializedSignals,
      strength: "moderate",
      now,
    });
  }

  if (signals.hasPhone) {
    return makeRecommendation({
      action: "call",
      rationale: "The follow-up is due and no permitted email channel is available, but a phone number is stored. A manual owner call is the clearest next option.",
      reasonCodes: ["FOLLOW_UP_DUE", "PHONE_AVAILABLE", "EMAIL_UNAVAILABLE"],
      signals: serializedSignals,
      strength: "moderate",
      now,
    });
  }

  return makeRecommendation({
    action: "wait",
    rationale: "The follow-up is due, but TengaAgent does not have a permitted email channel or a phone number. Review or update the customer contact details before taking an outreach action.",
    reasonCodes: ["FOLLOW_UP_DUE", "NO_CONTACT_CHANNEL"],
    signals: serializedSignals,
    strength: "contextual",
    now,
  });
};

const activitiesByAppointment = async ({ organizationId, appointmentIds }) => {
  if (!appointmentIds.length) return new Map();

  const activities = await FollowUpActivity.find({
    organizationId,
    appointmentId: { $in: appointmentIds },
  })
    .select(
      "appointmentId channel direction status occurredAt attemptedAt sentAt createdAt"
    )
    .sort({ occurredAt: -1, createdAt: -1, _id: -1 })
    .lean();

  const result = new Map();
  for (const activity of activities) {
    const key = String(activity.appointmentId);
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(activity);
  }
  return result;
};

const recommendationsForAppointments = async ({
  organizationId,
  appointments,
  now = new Date(),
}) => {
  const appointmentList = Array.isArray(appointments) ? appointments : [];
  const histories = await activitiesByAppointment({
    organizationId,
    appointmentIds: appointmentList.map((appointment) => appointment._id),
  });

  const result = new Map();
  for (const appointment of appointmentList) {
    result.set(
      String(appointment._id),
      recommendNextFollowUpAction({
        appointment,
        activities: histories.get(String(appointment._id)) || [],
        now,
      })
    );
  }
  return result;
};

const getOwnerFollowUpRecommendation = async ({
  userId,
  appointmentId,
  now = new Date(),
}) => {
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
  }).lean();

  if (!appointment) {
    return { workspaceFound: true, organization, appointment: null };
  }

  const activities = await FollowUpActivity.find({
    organizationId: organization._id,
    appointmentId: appointment._id,
  })
    .select("channel direction status occurredAt attemptedAt sentAt createdAt")
    .sort({ occurredAt: -1, createdAt: -1, _id: -1 })
    .lean();

  return {
    workspaceFound: true,
    organization,
    appointment,
    recommendation: recommendNextFollowUpAction({ appointment, activities, now }),
  };
};

module.exports = {
  NEXT_ACTIONS,
  getOwnerFollowUpRecommendation,
  recommendNextFollowUpAction,
  recommendationsForAppointments,
};
