const mongoose = require("mongoose");

const Appointment = require(
  "../../models/tengaAgent/Appointment"
);
const AvailabilitySchedule = require(
  "../../models/tengaAgent/AvailabilitySchedule"
);
const Organization = require(
  "../../models/tengaAgent/Organization"
);
const {
  getExternalCalendarBusyContext,
} = require(
  "./calendarConnectionService"
);

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PUBLIC_RANGE_DAYS = 31;
const MAX_PUBLIC_SLOTS = 240;
const WEEKDAY_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const DEFAULT_WEEKLY_HOURS = [1, 2, 3, 4, 5].map(
  (dayOfWeek) => ({
    dayOfWeek,
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
  })
);

const formatterCache = new Map();

const cleanText = (value, max) =>
  String(value || "")
    .trim()
    .slice(0, max);

const getFormatter = (timezone) => {
  if (!formatterCache.has(timezone)) {
    formatterCache.set(
      timezone,
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
    );
  }

  return formatterCache.get(timezone);
};

const isValidTimezone = (timezone) => {
  try {
    getFormatter(timezone).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const localParts = (date, timezone) => {
  const result = {};

  for (const part of getFormatter(timezone).formatToParts(date)) {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }
  }

  return {
    dayOfWeek: WEEKDAY_INDEX[result.weekday],
    year: Number(result.year),
    month: Number(result.month),
    day: Number(result.day),
    minutes:
      Number(result.hour) * 60 +
      Number(result.minute),
  };
};

const sameLocalDate = (a, b) =>
  a.year === b.year &&
  a.month === b.month &&
  a.day === b.day;

const parseBoundedInteger = (
  value,
  fallback,
  min,
  max,
  label
) => {
  const parsed =
    value === undefined || value === null || value === ""
      ? fallback
      : Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < min ||
    parsed > max
  ) {
    throw new Error(
      `${label} must be between ${min} and ${max}.`
    );
  }

  return parsed;
};

const normalizeDuration = (value, fallback = 30) =>
  parseBoundedInteger(
    value,
    fallback,
    15,
    180,
    "Appointment duration"
  );

const normalizeWeeklyHours = (value) => {
  if (!Array.isArray(value)) {
    throw new Error(
      "Weekly availability must be an array."
    );
  }

  if (value.length > 21) {
    throw new Error(
      "Weekly availability has too many windows."
    );
  }

  const windows = value.map((entry) => {
    const dayOfWeek = Number(entry?.dayOfWeek);
    const startMinutes = Number(entry?.startMinutes);
    const endMinutes = Number(entry?.endMinutes);

    if (
      !Number.isInteger(dayOfWeek) ||
      dayOfWeek < 0 ||
      dayOfWeek > 6 ||
      !Number.isInteger(startMinutes) ||
      startMinutes < 0 ||
      startMinutes > 1439 ||
      !Number.isInteger(endMinutes) ||
      endMinutes < 1 ||
      endMinutes > 1440 ||
      startMinutes >= endMinutes
    ) {
      throw new Error(
        "Each weekly availability window needs a valid day, start time and end time."
      );
    }

    return {
      dayOfWeek,
      startMinutes,
      endMinutes,
    };
  });

  windows.sort((a, b) =>
    a.dayOfWeek - b.dayOfWeek ||
    a.startMinutes - b.startMinutes
  );

  for (
    let index = 1;
    index < windows.length;
    index += 1
  ) {
    const previous = windows[index - 1];
    const current = windows[index];

    if (
      previous.dayOfWeek === current.dayOfWeek &&
      current.startMinutes < previous.endMinutes
    ) {
      throw new Error(
        "Weekly availability windows cannot overlap."
      );
    }
  }

  return windows;
};

const normalizeBlockedIntervals = (value = []) => {
  if (!Array.isArray(value)) {
    throw new Error(
      "Blocked availability intervals must be an array."
    );
  }

  if (value.length > 100) {
    throw new Error(
      "Too many blocked availability intervals."
    );
  }

  return value.map((entry) => {
    const startAt = new Date(entry?.startAt);
    const endAt = new Date(entry?.endAt);

    if (
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime()) ||
      startAt >= endAt
    ) {
      throw new Error(
        "Each blocked interval needs a valid start and end time."
      );
    }

    return {
      startAt,
      endAt,
      note: cleanText(entry?.note, 240),
    };
  });
};

const findOwnerOrganization = async (userId) => {
  if (!userId) {
    return null;
  }

  return Organization.findOne({
    ownerUser: userId,
    status: { $ne: "closed" },
  }).sort({ createdAt: 1 });
};

const scheduleDefaults = (organization) => ({
  enabled: false,
  timezone:
    organization?.timezone || "Africa/Lagos",
  source: "internal_schedule",
  minimumNoticeMinutes: 60,
  bookingHorizonDays: 30,
  slotStepMinutes: 30,
  defaultDurationMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  weeklyHours: DEFAULT_WEEKLY_HOURS,
  blockedIntervals: [],
});

const serializeAvailabilitySchedule = (
  schedule,
  organization
) => {
  const source =
    schedule || scheduleDefaults(organization);

  return {
    organizationId:
      organization?._id ||
      source.organizationId ||
      null,
    enabled: Boolean(source.enabled),
    timezone:
      source.timezone ||
      organization?.timezone ||
      "Africa/Lagos",
    source:
      source.source || "internal_schedule",
    minimumNoticeMinutes:
      Number(source.minimumNoticeMinutes ?? 60),
    bookingHorizonDays:
      Number(source.bookingHorizonDays ?? 30),
    slotStepMinutes:
      Number(source.slotStepMinutes ?? 30),
    defaultDurationMinutes:
      Number(source.defaultDurationMinutes ?? 30),
    bufferBeforeMinutes:
      Number(source.bufferBeforeMinutes ?? 0),
    bufferAfterMinutes:
      Number(source.bufferAfterMinutes ?? 0),
    weeklyHours:
      Array.isArray(source.weeklyHours) &&
      source.weeklyHours.length
        ? source.weeklyHours.map((entry) => ({
            dayOfWeek: entry.dayOfWeek,
            startMinutes: entry.startMinutes,
            endMinutes: entry.endMinutes,
          }))
        : [],
    blockedIntervals:
      Array.isArray(source.blockedIntervals)
        ? source.blockedIntervals.map((entry) => ({
            id: entry._id || null,
            startAt: entry.startAt,
            endAt: entry.endAt,
            note: entry.note || "",
          }))
        : [],
    updatedAt: source.updatedAt || null,
  };
};

const getScheduleForOrganization = async (
  organization
) => {
  const schedule = await AvailabilitySchedule.findOne({
    organizationId: organization._id,
  });

  return serializeAvailabilitySchedule(
    schedule,
    organization
  );
};

const getOwnerAvailabilitySchedule = async ({
  userId,
}) => {
  const organization =
    await findOwnerOrganization(userId);

  if (!organization) {
    return null;
  }

  const schedule =
    await getScheduleForOrganization(organization);

  return {
    organization,
    schedule,
  };
};

const saveOwnerAvailabilitySchedule = async ({
  userId,
  enabled,
  timezone,
  minimumNoticeMinutes,
  bookingHorizonDays,
  slotStepMinutes,
  defaultDurationMinutes,
  bufferBeforeMinutes,
  bufferAfterMinutes,
  weeklyHours,
  blockedIntervals,
}) => {
  const organization =
    await findOwnerOrganization(userId);

  if (!organization) {
    return null;
  }

  const existing =
    await AvailabilitySchedule.findOne({
      organizationId: organization._id,
    });

  const cleanTimezone = cleanText(
    timezone ||
      existing?.timezone ||
      organization.timezone ||
      "Africa/Lagos",
    100
  );

  if (!isValidTimezone(cleanTimezone)) {
    throw new Error(
      "Availability timezone is invalid."
    );
  }

  const normalizedWeeklyHours =
    weeklyHours === undefined
      ? existing?.weeklyHours?.length
        ? normalizeWeeklyHours(
            existing.weeklyHours
          )
        : DEFAULT_WEEKLY_HOURS
      : normalizeWeeklyHours(weeklyHours);

  const normalizedEnabled =
    enabled === undefined
      ? Boolean(existing?.enabled)
      : enabled === true;

  if (
    normalizedEnabled &&
    normalizedWeeklyHours.length === 0
  ) {
    throw new Error(
      "Add at least one weekly availability window before enabling booking availability."
    );
  }

  const normalizedBlockedIntervals =
    blockedIntervals === undefined
      ? normalizeBlockedIntervals(
          existing?.blockedIntervals || []
        )
      : normalizeBlockedIntervals(
          blockedIntervals
        );

  const schedule =
    await AvailabilitySchedule.findOneAndUpdate(
      {
        organizationId: organization._id,
      },
      {
        $set: {
          enabled: normalizedEnabled,
          timezone: cleanTimezone,
          source: "internal_schedule",
          minimumNoticeMinutes:
            parseBoundedInteger(
              minimumNoticeMinutes,
              existing?.minimumNoticeMinutes ?? 60,
              0,
              10080,
              "Minimum notice"
            ),
          bookingHorizonDays:
            parseBoundedInteger(
              bookingHorizonDays,
              existing?.bookingHorizonDays ?? 30,
              1,
              365,
              "Booking horizon"
            ),
          slotStepMinutes:
            [15, 30, 60].includes(
              Number(
                slotStepMinutes ??
                  existing?.slotStepMinutes ??
                  30
              )
            )
              ? Number(
                  slotStepMinutes ??
                    existing?.slotStepMinutes ??
                    30
                )
              : (() => {
                  throw new Error(
                    "Slot step must be 15, 30 or 60 minutes."
                  );
                })(),
          defaultDurationMinutes:
            normalizeDuration(
              defaultDurationMinutes,
              existing?.defaultDurationMinutes ?? 30
            ),
          bufferBeforeMinutes:
            parseBoundedInteger(
              bufferBeforeMinutes,
              existing?.bufferBeforeMinutes ?? 0,
              0,
              180,
              "Buffer before"
            ),
          bufferAfterMinutes:
            parseBoundedInteger(
              bufferAfterMinutes,
              existing?.bufferAfterMinutes ?? 0,
              0,
              180,
              "Buffer after"
            ),
          weeklyHours: normalizedWeeklyHours,
          blockedIntervals:
            normalizedBlockedIntervals,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

  return {
    organization,
    schedule:
      serializeAvailabilitySchedule(
        schedule,
        organization
      ),
  };
};

const rangesOverlap = (
  startA,
  endA,
  startB,
  endB
) => startA < endB && startB < endA;

const getConfirmedBusyIntervals = async ({
  organizationId,
  agentId,
  from,
  to,
  schedule,
  excludeAppointmentId,
}) => {
  const query = {
    organizationId,
    agentId,
    status: "confirmed",
    preferredStartAt: {
      $gte: new Date(
        from.getTime() -
          6 * 60 * 60 * 1000
      ),
      $lt: new Date(
        to.getTime() +
          6 * 60 * 60 * 1000
      ),
    },
  };

  if (
    excludeAppointmentId &&
    mongoose.Types.ObjectId.isValid(
      excludeAppointmentId
    )
  ) {
    query._id = {
      $ne: excludeAppointmentId,
    };
  }

  const appointments =
    await Appointment.find(query)
      .select({
        preferredStartAt: 1,
        durationMinutes: 1,
      })
      .lean();

  const before =
    Number(
      schedule?.bufferBeforeMinutes || 0
    ) *
    60 *
    1000;
  const after =
    Number(
      schedule?.bufferAfterMinutes || 0
    ) *
    60 *
    1000;

  return appointments.map((appointment) => {
    const startAt = new Date(
      new Date(
        appointment.preferredStartAt
      ).getTime() - before
    );
    const endAt = new Date(
      new Date(
        appointment.preferredStartAt
      ).getTime() +
        Number(
          appointment.durationMinutes || 30
        ) *
          60 *
          1000 +
        after
    );

    return {
      startAt,
      endAt,
      kind: "confirmed_appointment",
    };
  });
};

const withScheduleBuffers = (
  intervals,
  schedule
) => {
  const before =
    Number(
      schedule?.bufferBeforeMinutes || 0
    ) *
    60 *
    1000;
  const after =
    Number(
      schedule?.bufferAfterMinutes || 0
    ) *
    60 *
    1000;

  return intervals.map((interval) => ({
    ...interval,
    startAt: new Date(
      new Date(interval.startAt).getTime() -
        before
    ),
    endAt: new Date(
      new Date(interval.endAt).getTime() +
        after
    ),
  }));
};

const getBusyContext = async ({
  organizationId,
  agentId,
  from,
  to,
  schedule,
  excludeAppointmentId,
}) => {
  const internalBusy =
    await getConfirmedBusyIntervals({
      organizationId,
      agentId,
      from,
      to,
      schedule,
      excludeAppointmentId,
    });

  if (!schedule.enabled) {
    return {
      busyIntervals: internalBusy,
      connectedProviders: [],
      unavailableProviders: [],
    };
  }

  const external =
    await getExternalCalendarBusyContext({
      organizationId,
      agentId,
      from,
      to,
    });

  return {
    busyIntervals: [
      ...internalBusy,
      ...withScheduleBuffers(
        external.busyIntervals || [],
        schedule
      ),
    ],
    connectedProviders:
      external.connectedProviders || [],
    unavailableProviders:
      external.unavailableProviders || [],
  };
};

const isWithinWeeklyHours = ({
  startAt,
  endAt,
  schedule,
}) => {
  const start = localParts(
    startAt,
    schedule.timezone
  );
  const end = localParts(
    endAt,
    schedule.timezone
  );

  if (!sameLocalDate(start, end)) {
    return false;
  }

  return schedule.weeklyHours.some(
    (window) =>
      window.dayOfWeek === start.dayOfWeek &&
      start.minutes >= window.startMinutes &&
      end.minutes <= window.endMinutes
  );
};

const evaluateSlotAgainstContext = ({
  startAt,
  durationMinutes,
  schedule,
  busyIntervals,
  now,
}) => {
  const endAt = new Date(
    startAt.getTime() +
      durationMinutes * 60 * 1000
  );

  for (const busy of busyIntervals) {
    if (
      rangesOverlap(
        startAt,
        endAt,
        new Date(busy.startAt),
        new Date(busy.endAt)
      )
    ) {
      return {
        available: false,
        reason: busy.kind || "busy",
        endAt,
      };
    }
  }

  if (!schedule.enabled) {
    return {
      available: true,
      reason: "request_only_no_conflict",
      endAt,
    };
  }

  const minimumStart = new Date(
    now.getTime() +
      schedule.minimumNoticeMinutes *
        60 *
        1000
  );
  const latestStart = new Date(
    now.getTime() +
      schedule.bookingHorizonDays * DAY_MS
  );

  if (startAt < minimumStart) {
    return {
      available: false,
      reason: "minimum_notice",
      endAt,
    };
  }

  if (startAt > latestStart) {
    return {
      available: false,
      reason: "booking_horizon",
      endAt,
    };
  }

  if (
    !isWithinWeeklyHours({
      startAt,
      endAt,
      schedule,
    })
  ) {
    return {
      available: false,
      reason: "outside_weekly_hours",
      endAt,
    };
  }

  for (
    const blocked of
      schedule.blockedIntervals || []
  ) {
    if (
      rangesOverlap(
        startAt,
        endAt,
        new Date(blocked.startAt),
        new Date(blocked.endAt)
      )
    ) {
      return {
        available: false,
        reason: "blocked_interval",
        endAt,
      };
    }
  }

  return {
    available: true,
    reason: "available",
    endAt,
  };
};

const checkAppointmentAvailability = async ({
  organizationId,
  agentId,
  startAt,
  durationMinutes,
  excludeAppointmentId,
  now = new Date(),
}) => {
  const organization =
    await Organization.findById(
      organizationId
    );

  if (!organization) {
    throw new Error(
      "Appointment organization was not found."
    );
  }

  const schedule =
    await getScheduleForOrganization(
      organization
    );
  const normalizedStart = new Date(startAt);

  if (
    Number.isNaN(normalizedStart.getTime())
  ) {
    throw new Error(
      "A valid appointment start time is required."
    );
  }

  const duration = normalizeDuration(
    durationMinutes,
    schedule.defaultDurationMinutes
  );
  const candidateEnd = new Date(
    normalizedStart.getTime() +
      duration * 60 * 1000
  );
  const busyContext = await getBusyContext({
    organizationId,
    agentId,
    from: normalizedStart,
    to: candidateEnd,
    schedule,
    excludeAppointmentId,
  });

  if (
    busyContext.unavailableProviders.length > 0
  ) {
    const requestOnlyEvaluation =
      evaluateSlotAgainstContext({
        startAt: normalizedStart,
        durationMinutes: duration,
        schedule: {
          ...schedule,
          enabled: false,
        },
        busyIntervals:
          busyContext.busyIntervals,
        now,
      });

    return {
      ...requestOnlyEvaluation,
      scheduleEnabled: false,
      source: "request_only",
      timezone: schedule.timezone,
      durationMinutes: duration,
      externalCalendarState: "unavailable",
      externalProviders:
        busyContext.connectedProviders,
      unavailableProviders:
        busyContext.unavailableProviders,
    };
  }

  const evaluation =
    evaluateSlotAgainstContext({
      startAt: normalizedStart,
      durationMinutes: duration,
      schedule,
      busyIntervals:
        busyContext.busyIntervals,
      now,
    });

  return {
    ...evaluation,
    scheduleEnabled: schedule.enabled,
    source: schedule.enabled
      ? schedule.source
      : "request_only",
    timezone: schedule.timezone,
    durationMinutes: duration,
    externalCalendarState:
      busyContext.connectedProviders.length > 0
        ? "verified"
        : "not_connected",
    externalProviders:
      busyContext.connectedProviders,
    unavailableProviders: [],
  };
};

const parseRangeDate = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      "Availability range contains an invalid date."
    );
  }

  return parsed;
};

const availabilityRules = (schedule) => ({
  minimumNoticeMinutes:
    schedule.minimumNoticeMinutes,
  bookingHorizonDays:
    schedule.bookingHorizonDays,
  slotStepMinutes:
    schedule.slotStepMinutes,
});

const getPublicAvailability = async ({
  organization,
  agent,
  from,
  to,
  durationMinutes,
  now = new Date(),
}) => {
  const schedule =
    await getScheduleForOrganization(
      organization
    );
  const duration = normalizeDuration(
    durationMinutes,
    schedule.defaultDurationMinutes
  );

  if (!schedule.enabled) {
    return {
      enabled: false,
      source: "request_only",
      timezone: schedule.timezone,
      durationMinutes: duration,
      slots: [],
      rules: availabilityRules(schedule),
      externalCalendar: {
        state: "not_checked",
        providers: [],
        unavailableProviders: [],
      },
    };
  }

  const earliest = new Date(
    now.getTime() +
      schedule.minimumNoticeMinutes *
        60 *
        1000
  );
  const horizon = new Date(
    now.getTime() +
      schedule.bookingHorizonDays * DAY_MS
  );
  let rangeStart = parseRangeDate(
    from,
    earliest
  );
  let rangeEnd = parseRangeDate(
    to,
    new Date(
      rangeStart.getTime() +
        14 * DAY_MS
    )
  );

  if (rangeStart < earliest) {
    rangeStart = earliest;
  }

  if (rangeEnd > horizon) {
    rangeEnd = horizon;
  }

  const maxEnd = new Date(
    rangeStart.getTime() +
      MAX_PUBLIC_RANGE_DAYS * DAY_MS
  );

  if (rangeEnd > maxEnd) {
    rangeEnd = maxEnd;
  }

  if (rangeEnd <= rangeStart) {
    return {
      enabled: true,
      source: schedule.source,
      timezone: schedule.timezone,
      durationMinutes: duration,
      slots: [],
      rules: availabilityRules(schedule),
      externalCalendar: {
        state: "not_checked",
        providers: [],
        unavailableProviders: [],
      },
    };
  }

  const busyContext = await getBusyContext({
    organizationId: organization._id,
    agentId: agent._id,
    from: rangeStart,
    to: rangeEnd,
    schedule,
  });

  if (
    busyContext.unavailableProviders.length > 0
  ) {
    return {
      enabled: false,
      source: "request_only",
      timezone: schedule.timezone,
      durationMinutes: duration,
      slots: [],
      rules: availabilityRules(schedule),
      externalCalendar: {
        state: "unavailable",
        providers:
          busyContext.connectedProviders,
        unavailableProviders:
          busyContext.unavailableProviders,
      },
    };
  }

  const slots = [];
  const fifteenMinutes =
    15 * 60 * 1000;
  let cursor = new Date(
    Math.ceil(
      rangeStart.getTime() /
        fifteenMinutes
    ) * fifteenMinutes
  );

  while (
    cursor < rangeEnd &&
    slots.length < MAX_PUBLIC_SLOTS
  ) {
    const parts = localParts(
      cursor,
      schedule.timezone
    );

    if (
      parts.minutes %
        schedule.slotStepMinutes ===
      0
    ) {
      const evaluation =
        evaluateSlotAgainstContext({
          startAt: cursor,
          durationMinutes: duration,
          schedule,
          busyIntervals:
            busyContext.busyIntervals,
          now,
        });

      if (
        evaluation.available &&
        evaluation.endAt <= rangeEnd
      ) {
        slots.push({
          startAt: new Date(cursor),
          endAt: evaluation.endAt,
        });
      }
    }

    cursor = new Date(
      cursor.getTime() + fifteenMinutes
    );
  }

  return {
    enabled: true,
    source: schedule.source,
    timezone: schedule.timezone,
    durationMinutes: duration,
    slots,
    rules: availabilityRules(schedule),
    externalCalendar: {
      state:
        busyContext.connectedProviders.length > 0
          ? "verified"
          : "not_connected",
      providers:
        busyContext.connectedProviders,
      unavailableProviders: [],
    },
  };
};

module.exports = {
  DEFAULT_WEEKLY_HOURS,
  checkAppointmentAvailability,
  getOwnerAvailabilitySchedule,
  getPublicAvailability,
  normalizeWeeklyHours,
  saveOwnerAvailabilitySchedule,
  serializeAvailabilitySchedule,
};
