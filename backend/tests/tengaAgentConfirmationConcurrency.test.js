process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  "mongodb://127.0.0.1:27017/tengaagent-confirmation-concurrency-test";
process.env.JWT_SECRET =
  "tengaagent-confirmation-concurrency-test-secret";
process.env.OPENAI_API_KEY = "";

const mongoose = require("mongoose");
const {
  MongoMemoryServer,
} = require("mongodb-memory-server");

const Appointment = require(
  "../models/tengaAgent/Appointment"
);
const BookingConfirmationLock = require(
  "../models/tengaAgent/BookingConfirmationLock"
);
const {
  captureAppointmentRequest,
  updateOwnerAppointmentStatus,
} = require(
  "../services/tengaAgent/appointmentService"
);
const {
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

const futureSlot = () => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 7);
  date.setUTCHours(10, 0, 0, 0);
  return date;
};

const createOwner = async () => {
  const userId = new mongoose.Types.ObjectId();
  const workspace = await createOrUpdateOwnerWorkspace({
    userId,
    name: "Concurrent Booking Academy",
    industry: "Services",
    countryCode: "NG",
    timezone: "UTC",
  });

  return {
    userId,
    ...workspace,
  };
};

const requestAppointment = ({
  owner,
  startAt,
  sessionKey,
}) =>
  captureAppointmentRequest({
    organizationId: owner.organization._id,
    agentId: owner.agent._id,
    conversationId: new mongoose.Types.ObjectId(),
    sessionKey,
    name: "Concurrent Visitor",
    email: `${sessionKey}@example.com`,
    purpose: "Concurrent confirmation test",
    preferredStartAt: startAt.toISOString(),
    timezone: "UTC",
    durationMinutes: 30,
    source: "web",
    consentToContact: true,
  });

describe("TengaAgent appointment confirmation concurrency", () => {
  it("serializes simultaneous confirmations so only one overlapping appointment is confirmed", async () => {
    const owner = await createOwner();
    const slot = futureSlot();

    await saveOwnerAvailabilitySchedule({
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
          dayOfWeek: slot.getUTCDay(),
          startMinutes: 9 * 60,
          endMinutes: 12 * 60,
        },
      ],
    });

    const first = await requestAppointment({
      owner,
      startAt: slot,
      sessionKey: "concurrent-first",
    });
    const second = await requestAppointment({
      owner,
      startAt: slot,
      sessionKey: "concurrent-second",
    });

    const results = await Promise.allSettled([
      updateOwnerAppointmentStatus({
        userId: owner.userId,
        appointmentId: first._id,
        status: "confirmed",
      }),
      updateOwnerAppointmentStatus({
        userId: owner.userId,
        appointmentId: second._id,
        status: "confirmed",
      }),
    ]);

    const fulfilled = results.filter(
      (entry) => entry.status === "fulfilled"
    );
    const rejected = results.filter(
      (entry) => entry.status === "rejected"
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(
      fulfilled[0].value.appointment.status
    ).toBe("confirmed");
    expect(
      rejected[0].reason.message
    ).toMatch(/no longer available/i);

    const appointments = await Appointment.find({
      _id: {
        $in: [first._id, second._id],
      },
    }).lean();

    expect(
      appointments.filter(
        (entry) => entry.status === "confirmed"
      )
    ).toHaveLength(1);

    const conflicted = appointments.find(
      (entry) => entry.status === "requested"
    );

    expect(conflicted).toBeTruthy();
    expect(conflicted.availabilityState).toBe(
      "conflict_at_confirmation"
    );

    const locks =
      await BookingConfirmationLock.find({}).lean();

    expect(locks).toHaveLength(1);
    expect(locks[0].ownerToken).toBe("");
    expect(
      new Date(locks[0].lockedUntil).getTime()
    ).toBeLessThanOrEqual(Date.now());
  });
});
