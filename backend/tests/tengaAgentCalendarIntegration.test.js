process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  "mongodb://127.0.0.1:27017/tengaagent-calendar-integration-test";
process.env.JWT_SECRET =
  "tengaagent-calendar-integration-test-secret";
process.env.OPENAI_API_KEY = "";
process.env.TENGAAGENT_CALENDAR_ENCRYPTION_KEY =
  "tengaagent-calendar-test-encryption-key-2026";
process.env.GOOGLE_CALENDAR_CLIENT_ID =
  "google-calendar-test-client";
process.env.GOOGLE_CALENDAR_CLIENT_SECRET =
  "google-calendar-test-secret";
process.env.GOOGLE_CALENDAR_REDIRECT_URI =
  "http://localhost:5173/tengaagent";
process.env.MICROSOFT_CALENDAR_CLIENT_ID =
  "microsoft-calendar-test-client";
process.env.MICROSOFT_CALENDAR_CLIENT_SECRET =
  "microsoft-calendar-test-secret";
process.env.MICROSOFT_CALENDAR_TENANT = "common";
process.env.MICROSOFT_CALENDAR_REDIRECT_URI =
  "http://localhost:5173/tengaagent";

const mongoose = require("mongoose");
const {
  MongoMemoryServer,
} = require("mongodb-memory-server");

const CalendarConnection = require(
  "../models/tengaAgent/CalendarConnection"
);
const Appointment = require(
  "../models/tengaAgent/Appointment"
);
const {
  captureAppointmentRequest,
  updateOwnerAppointmentStatus,
} = require(
  "../services/tengaAgent/appointmentService"
);
const {
  decryptJson,
  encryptJson,
} = require(
  "../services/tengaAgent/calendarCryptoService"
);
const {
  getPublicAvailability,
  saveOwnerAvailabilitySchedule,
} = require(
  "../services/tengaAgent/availabilityService"
);
const {
  startOwnerCalendarConnection,
} = require(
  "../services/tengaAgent/calendarConnectionService"
);
const {
  createOrUpdateOwnerWorkspace,
} = require(
  "../services/tengaAgent/ownerWorkspaceService"
);

let mongod;
let originalFetch;

beforeAll(async () => {
  originalFetch = global.fetch;
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  global.fetch = originalFetch;
});

afterAll(async () => {
  global.fetch = originalFetch;
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});

const createOwner = async () => {
  const userId = new mongoose.Types.ObjectId();
  const workspace = await createOrUpdateOwnerWorkspace({
    userId,
    name: "Calendar Academy",
    industry: "Education",
    countryCode: "NG",
    timezone: "UTC",
  });

  return { userId, ...workspace };
};

const futureSlot = ({
  daysAhead = 7,
  hour = 10,
  minute = 0,
} = {}) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
};

const enableScheduleFor = async (
  owner,
  date
) =>
  saveOwnerAvailabilitySchedule({
    userId: owner.userId,
    enabled: true,
    timezone: "UTC",
    minimumNoticeMinutes: 0,
    bookingHorizonDays: 30,
    slotStepMinutes: 30,
    defaultDurationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    weeklyHours: [
      {
        dayOfWeek: date.getUTCDay(),
        startMinutes: 9 * 60,
        endMinutes: 12 * 60,
      },
    ],
  });

const connectProvider = async (
  owner,
  provider
) => {
  const expiresAt = new Date(
    Date.now() + 60 * 60 * 1000
  );

  return CalendarConnection.create({
    organizationId: owner.organization._id,
    agentId: owner.agent._id,
    provider,
    status: "active",
    calendarId: "primary",
    displayName:
      provider === "google"
        ? "Google Calendar"
        : "Microsoft Outlook",
    scopes:
      provider === "google"
        ? [
            "https://www.googleapis.com/auth/calendar.freebusy",
          ]
        : ["Calendars.ReadBasic"],
    encryptedCredentials: encryptJson({
      accessToken: `${provider}-test-access-token`,
      refreshToken: `${provider}-test-refresh-token`,
      tokenType: "Bearer",
      expiresAt: expiresAt.toISOString(),
    }),
    tokenExpiresAt: expiresAt,
  });
};

const requestAppointment = ({
  owner,
  startAt,
}) =>
  captureAppointmentRequest({
    organizationId: owner.organization._id,
    agentId: owner.agent._id,
    conversationId: new mongoose.Types.ObjectId(),
    sessionKey: `calendar-${Date.now()}-${Math.random()}`,
    name: "Calendar Visitor",
    email: "calendar@example.com",
    purpose: "Calendar integration test",
    preferredStartAt: startAt.toISOString(),
    timezone: "UTC",
    durationMinutes: 30,
    source: "web",
    consentToContact: true,
  });

describe("TengaAgent external calendar integration", () => {
  it("creates an owner-bound Google OAuth authorization URL with encrypted state and PKCE", async () => {
    const owner = await createOwner();

    const result =
      await startOwnerCalendarConnection({
        userId: owner.userId,
        provider: "google",
      });

    const url = new URL(result.authorizationUrl);
    const state = url.searchParams.get("state");
    const payload = decryptJson(state);

    expect(url.origin).toBe(
      "https://accounts.google.com"
    );
    expect(url.searchParams.get("response_type")).toBe(
      "code"
    );
    expect(
      url.searchParams.get("code_challenge_method")
    ).toBe("S256");
    expect(url.searchParams.get("scope")).toContain(
      "calendar.freebusy"
    );
    expect(payload.provider).toBe("google");
    expect(String(payload.userId)).toBe(
      String(owner.userId)
    );
    expect(String(payload.organizationId)).toBe(
      String(owner.organization._id)
    );
    expect(String(payload.agentId)).toBe(
      String(owner.agent._id)
    );
    expect(payload.codeVerifier).toBeTruthy();
  });

  it("creates a Microsoft OAuth URL using read-only calendar access and the common tenant", async () => {
    const owner = await createOwner();

    const result =
      await startOwnerCalendarConnection({
        userId: owner.userId,
        provider: "microsoft",
      });

    const url = new URL(result.authorizationUrl);
    const state = url.searchParams.get("state");
    const payload = decryptJson(state);

    expect(url.origin).toBe(
      "https://login.microsoftonline.com"
    );
    expect(url.pathname).toContain(
      "/common/oauth2/v2.0/authorize"
    );
    expect(url.searchParams.get("scope")).toContain(
      "Calendars.ReadBasic"
    );
    expect(url.searchParams.get("scope")).toContain(
      "offline_access"
    );
    expect(
      url.searchParams.get("code_challenge_method")
    ).toBe("S256");
    expect(payload.provider).toBe("microsoft");
    expect(String(payload.userId)).toBe(
      String(owner.userId)
    );
  });

  it("removes Google Calendar busy periods from public TengaAgent slots", async () => {
    const owner = await createOwner();
    const slot = futureSlot({ hour: 10 });
    await enableScheduleFor(owner, slot);
    await connectProvider(owner, "google");

    global.fetch = jest.fn(async (url) => {
      expect(String(url)).toContain(
        "googleapis.com/calendar/v3/freeBusy"
      );

      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            calendars: {
              primary: {
                busy: [
                  {
                    start: slot.toISOString(),
                    end: new Date(
                      slot.getTime() +
                        30 * 60 * 1000
                    ).toISOString(),
                  },
                ],
              },
            },
          }),
      };
    });

    const from = new Date(slot);
    from.setUTCHours(9, 0, 0, 0);
    const to = new Date(slot);
    to.setUTCHours(12, 0, 0, 0);

    const availability =
      await getPublicAvailability({
        organization: owner.organization,
        agent: owner.agent,
        from: from.toISOString(),
        to: to.toISOString(),
        durationMinutes: 30,
        now: new Date(
          from.getTime() -
            24 * 60 * 60 * 1000
        ),
      });

    const starts = availability.slots.map(
      (entry) =>
        new Date(entry.startAt).toISOString()
    );

    expect(availability.enabled).toBe(true);
    expect(availability.externalCalendar).toEqual(
      expect.objectContaining({
        state: "verified",
        providers: ["google"],
      })
    );
    expect(starts).not.toContain(
      slot.toISOString()
    );
    expect(starts).toHaveLength(5);
  });

  it("uses Microsoft calendarView busy state while leaving free events bookable", async () => {
    const owner = await createOwner();
    const slot = futureSlot({ hour: 10 });
    const freeSlot = new Date(
      slot.getTime() + 30 * 60 * 1000
    );
    await enableScheduleFor(owner, slot);
    await connectProvider(owner, "microsoft");

    global.fetch = jest.fn(async (url) => {
      expect(String(url)).toContain(
        "graph.microsoft.com/v1.0/me/calendar/calendarView"
      );

      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            value: [
              {
                showAs: "busy",
                isCancelled: false,
                start: {
                  dateTime: slot.toISOString(),
                  timeZone: "UTC",
                },
                end: {
                  dateTime: new Date(
                    slot.getTime() +
                      30 * 60 * 1000
                  ).toISOString(),
                  timeZone: "UTC",
                },
              },
              {
                showAs: "free",
                isCancelled: false,
                start: {
                  dateTime: freeSlot.toISOString(),
                  timeZone: "UTC",
                },
                end: {
                  dateTime: new Date(
                    freeSlot.getTime() +
                      30 * 60 * 1000
                  ).toISOString(),
                  timeZone: "UTC",
                },
              },
            ],
          }),
      };
    });

    const from = new Date(slot);
    from.setUTCHours(9, 0, 0, 0);
    const to = new Date(slot);
    to.setUTCHours(12, 0, 0, 0);

    const availability =
      await getPublicAvailability({
        organization: owner.organization,
        agent: owner.agent,
        from: from.toISOString(),
        to: to.toISOString(),
        durationMinutes: 30,
        now: new Date(
          from.getTime() -
            24 * 60 * 60 * 1000
        ),
      });

    const starts = availability.slots.map(
      (entry) =>
        new Date(entry.startAt).toISOString()
    );

    expect(availability.externalCalendar).toEqual(
      expect.objectContaining({
        state: "verified",
        providers: ["microsoft"],
      })
    );
    expect(starts).not.toContain(
      slot.toISOString()
    );
    expect(starts).toContain(
      freeSlot.toISOString()
    );
    expect(starts).toHaveLength(5);
  });

  it("falls back to manual requests and keeps a failed connected calendar fail-closed until recovery or disconnect", async () => {
    const owner = await createOwner();
    const slot = futureSlot({ hour: 10 });
    await enableScheduleFor(owner, slot);
    await connectProvider(owner, "google");

    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({
          error: {
            message: "invalid calendar authorization",
          },
        }),
    }));

    const from = new Date(slot);
    from.setUTCHours(9, 0, 0, 0);
    const to = new Date(slot);
    to.setUTCHours(12, 0, 0, 0);

    const publicAvailability =
      await getPublicAvailability({
        organization: owner.organization,
        agent: owner.agent,
        from: from.toISOString(),
        to: to.toISOString(),
        durationMinutes: 30,
        now: new Date(
          from.getTime() -
            24 * 60 * 60 * 1000
        ),
      });

    expect(publicAvailability.enabled).toBe(false);
    expect(publicAvailability.source).toBe(
      "request_only"
    );
    expect(
      publicAvailability.externalCalendar.state
    ).toBe("unavailable");

    const failedConnection =
      await CalendarConnection.findOne({
        organizationId: owner.organization._id,
        agentId: owner.agent._id,
        provider: "google",
      });
    expect(failedConnection.status).toBe("error");

    const appointment = await requestAppointment({
      owner,
      startAt: slot,
    });

    expect(appointment.status).toBe("requested");
    expect(appointment.availabilityState).toBe(
      "not_checked"
    );
    expect(appointment.availabilitySource).toBe(
      "request_only"
    );

    await expect(
      updateOwnerAppointmentStatus({
        userId: owner.userId,
        appointmentId: appointment._id,
        status: "confirmed",
      })
    ).rejects.toThrow(
      /external calendar availability could not be verified/i
    );

    const stored = await Appointment.findById(
      appointment._id
    );
    expect(stored.status).toBe("requested");
  });
});
