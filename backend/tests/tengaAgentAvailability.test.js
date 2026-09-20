process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  "mongodb://127.0.0.1:27017/tengaagent-availability-test";
process.env.JWT_SECRET =
  "tengaagent-availability-test-secret";
process.env.OPENAI_API_KEY = "";

const mongoose = require("mongoose");
const {
  MongoMemoryServer,
} = require("mongodb-memory-server");

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
  getOwnerAvailabilitySchedule,
  getPublicAvailability,
  saveOwnerAvailabilitySchedule,
} = require(
  "../services/tengaAgent/availabilityService"
);
const {
  createOrUpdateOwnerWorkspace,
} = require(
  "../services/tengaAgent/ownerWorkspaceService"
);

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});

const createOwner = async (name) => {
  const userId = new mongoose.Types.ObjectId();
  const workspace = await createOrUpdateOwnerWorkspace({
    userId,
    name,
    industry: "Services",
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
  date,
  overrides = {}
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
    ...overrides,
  });

const requestAppointment = ({
  owner,
  startAt,
  conversationId = new mongoose.Types.ObjectId(),
  sessionKey = "availability-session",
}) =>
  captureAppointmentRequest({
    organizationId: owner.organization._id,
    agentId: owner.agent._id,
    conversationId,
    sessionKey,
    name: "Availability Visitor",
    email: "visitor@example.com",
    purpose: "Product discussion",
    preferredStartAt: startAt.toISOString(),
    timezone: "UTC",
    durationMinutes: 30,
    source: "web",
    consentToContact: true,
  });

describe("TengaAgent availability service", () => {
  it("keeps owner availability settings tenant scoped", async () => {
    const ownerA = await createOwner("Alpha Schedule");
    const ownerB = await createOwner("Beta Schedule");
    const slot = futureSlot();

    await enableScheduleFor(ownerA, slot, {
      minimumNoticeMinutes: 120,
    });

    const scheduleA =
      await getOwnerAvailabilitySchedule({
        userId: ownerA.userId,
      });
    const scheduleB =
      await getOwnerAvailabilitySchedule({
        userId: ownerB.userId,
      });

    expect(scheduleA.schedule.enabled).toBe(true);
    expect(
      scheduleA.schedule.minimumNoticeMinutes
    ).toBe(120);
    expect(scheduleB.schedule.enabled).toBe(false);
    expect(scheduleB.schedule.weeklyHours).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dayOfWeek: 1,
          startMinutes: 540,
          endMinutes: 1020,
        }),
      ])
    );
  });

  it("returns slots only inside weekly hours and removes confirmed conflicts", async () => {
    const owner = await createOwner("Slot Academy");
    const slot = futureSlot();
    await enableScheduleFor(owner, slot);

    await Appointment.create({
      organizationId: owner.organization._id,
      agentId: owner.agent._id,
      conversationId: new mongoose.Types.ObjectId(),
      sessionKey: "confirmed-busy",
      email: "busy@example.com",
      preferredStartAt: slot,
      timezone: "UTC",
      durationMinutes: 30,
      status: "confirmed",
      consentToContact: true,
    });

    const from = new Date(slot);
    from.setUTCHours(8, 0, 0, 0);
    const to = new Date(slot);
    to.setUTCHours(12, 0, 0, 0);

    const availability = await getPublicAvailability({
      organization: owner.organization,
      agent: owner.agent,
      from: from.toISOString(),
      to: to.toISOString(),
      durationMinutes: 30,
      now: new Date(
        from.getTime() - 24 * 60 * 60 * 1000
      ),
    });

    const starts = availability.slots.map(
      (entry) =>
        new Date(entry.startAt).toISOString()
    );

    const nine = new Date(slot);
    nine.setUTCHours(9, 0, 0, 0);
    const elevenThirty = new Date(slot);
    elevenThirty.setUTCHours(11, 30, 0, 0);

    expect(availability.enabled).toBe(true);
    expect(starts).toContain(nine.toISOString());
    expect(starts).toContain(
      elevenThirty.toISOString()
    );
    expect(starts).not.toContain(slot.toISOString());
    expect(starts).toHaveLength(5);
  });

  it("rejects an appointment request outside enabled weekly availability", async () => {
    const owner = await createOwner("Hours Academy");
    const slot = futureSlot({ hour: 18 });
    await enableScheduleFor(owner, slot);

    await expect(
      requestAppointment({ owner, startAt: slot })
    ).rejects.toThrow(
      /no longer available/i
    );
  });

  it("allows competing requests but prevents the second confirmation from double booking", async () => {
    const owner = await createOwner("Race Academy");
    const slot = futureSlot({ hour: 10 });
    await enableScheduleFor(owner, slot);

    const first = await requestAppointment({
      owner,
      startAt: slot,
      conversationId: new mongoose.Types.ObjectId(),
      sessionKey: "race-first",
    });
    const second = await requestAppointment({
      owner,
      startAt: slot,
      conversationId: new mongoose.Types.ObjectId(),
      sessionKey: "race-second",
    });

    expect(first.availabilityState).toBe(
      "available_at_request"
    );
    expect(second.availabilityState).toBe(
      "available_at_request"
    );

    const confirmed =
      await updateOwnerAppointmentStatus({
        userId: owner.userId,
        appointmentId: first._id,
        status: "confirmed",
      });

    expect(confirmed.appointment.status).toBe(
      "confirmed"
    );
    expect(
      confirmed.appointment.availabilityState
    ).toBe("confirmed_free");

    await expect(
      updateOwnerAppointmentStatus({
        userId: owner.userId,
        appointmentId: second._id,
        status: "confirmed",
      })
    ).rejects.toThrow(/no longer available/i);

    const conflicted = await Appointment.findById(
      second._id
    );
    expect(conflicted.status).toBe("requested");
    expect(conflicted.availabilityState).toBe(
      "conflict_at_confirmation"
    );
  });

  it("keeps request-only businesses compatible while still blocking confirmed conflicts", async () => {
    const owner = await createOwner("Request Only");
    const slot = futureSlot({ hour: 7 });

    const first = await requestAppointment({
      owner,
      startAt: slot,
      sessionKey: "request-only-first",
    });

    expect(first.availabilityState).toBe(
      "not_checked"
    );
    expect(first.availabilitySource).toBe(
      "request_only"
    );

    await updateOwnerAppointmentStatus({
      userId: owner.userId,
      appointmentId: first._id,
      status: "confirmed",
    });

    await expect(
      requestAppointment({
        owner,
        startAt: slot,
        conversationId: new mongoose.Types.ObjectId(),
        sessionKey: "request-only-second",
      })
    ).rejects.toThrow(/no longer available/i);
  });
});
