const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MODERATION_ENABLED = "false";
process.env.REQUIRE_EMAIL_OTP = "false";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-kadahive-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "kadahive_test_secret_12345678901234567890";

const app = require("../app");
const User = require("../models/User");

let mongod;
let sequence = 0;

const registerAccount = async ({ institutionSlug = "kadahive", prefix = "member" } = {}) => {
  sequence += 1;
  const suffix = `${prefix}${sequence}`;
  const payload = {
    name: `Kada Member ${sequence}`,
    username: suffix,
    email: `${suffix}@example.com`,
    phone: `+23480612${String(1000 + sequence).slice(-4)}`,
    country: "Nigeria",
    stateOfOrigin: "Kaduna",
    dob: "1995-04-18",
    password: "StrongPassword123!",
    institutionSlug,
  };
  if (!institutionSlug) delete payload.institutionSlug;

  const response = await request(app).post("/api/auth/register").send(payload).expect(201);
  return { ...response.body, payload };
};

describe("Kadahive institution portal", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create({
      instance: { launchTimeout: 60000 },
    });
    await mongoose.connect(mongod.getUri(), {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
    });
  });

  beforeEach(async () => {
    sequence = 0;
    await mongoose.connection.db.dropDatabase();
  });

  afterAll(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.dropDatabase();
      }
    } finally {
      await mongoose.disconnect().catch(() => null);
      if (mongod) await mongod.stop();
    }
  });

  test("registers a scoped member and serves the member workspace", async () => {
    const account = await registerAccount();

    expect(account.user.institutionMemberships).toEqual([
      expect.objectContaining({
        institution: "kadahive",
        role: "member",
        status: "active",
      }),
    ]);

    const dashboard = await request(app)
      .get("/api/kadahive/me")
      .set("Authorization", `Bearer ${account.token}`)
      .expect(200);

    expect(dashboard.body).toMatchObject({
      success: true,
      scope: "member",
      membership: {
        institution: "kadahive",
        role: "member",
        status: "active",
      },
      stats: {
        availableResources: 3,
      },
    });
    expect(dashboard.body.events).toHaveLength(3);
    expect(dashboard.body.resources).toHaveLength(3);
  });

  test("lets an existing Tengacion user join Kadahive without creating another account", async () => {
    const account = await registerAccount({ institutionSlug: "", prefix: "existing" });

    await request(app)
      .get("/api/kadahive/me")
      .set("Authorization", `Bearer ${account.token}`)
      .expect(403);

    const joined = await request(app)
      .post("/api/kadahive/membership/join")
      .set("Authorization", `Bearer ${account.token}`)
      .expect(201);

    expect(joined.body).toMatchObject({
      success: true,
      scope: "member",
      membership: {
        institution: "kadahive",
        role: "member",
      },
    });
    expect(await User.countDocuments({ email: account.payload.email })).toBe(1);
  });

  test("keeps institution administration scoped and supports managed content and bookings", async () => {
    const adminAccount = await registerAccount({ prefix: "kadaadmin" });
    const memberAccount = await registerAccount({ prefix: "booker" });

    await User.updateOne(
      { _id: adminAccount.user._id, "institutionMemberships.institution": "kadahive" },
      {
        $set: {
          "institutionMemberships.$.role": "admin",
          "institutionMemberships.$.status": "active",
        },
      }
    );

    const createdEvent = await request(app)
      .post("/api/kadahive/admin/events")
      .set("Authorization", `Bearer ${adminAccount.token}`)
      .send({
        title: "Kaduna Builder Meetup",
        summary: "Founders, developers and mentors meet to build and exchange ideas.",
        category: "community",
        status: "published",
        startsAt: "2030-08-14T09:00:00.000Z",
        endsAt: "2030-08-14T14:00:00.000Z",
        capacity: 80,
      })
      .expect(201);

    await request(app)
      .post("/api/kadahive/admin/events")
      .set("Authorization", `Bearer ${memberAccount.token}`)
      .send({
        title: "Not allowed",
        summary: "A member must not create institution content.",
      })
      .expect(403);

    const booking = await request(app)
      .post("/api/kadahive/bookings")
      .set("Authorization", `Bearer ${memberAccount.token}`)
      .send({
        space: "meeting-room",
        startsAt: "2030-08-20T10:00:00.000Z",
        durationHours: 2,
        attendees: 6,
        purpose: "Startup product review",
      })
      .expect(201);

    const overview = await request(app)
      .get("/api/kadahive/admin/overview")
      .set("Authorization", `Bearer ${adminAccount.token}`)
      .expect(200);

    expect(overview.body).toMatchObject({
      scope: "institution_admin",
      stats: {
        totalMembers: 2,
        adminMembers: 1,
        pendingBookings: 1,
      },
    });
    expect(overview.body.events.some((event) => event._id === createdEvent.body.event._id)).toBe(
      true
    );

    await request(app)
      .patch(`/api/kadahive/admin/bookings/${booking.body.booking._id}`)
      .set("Authorization", `Bearer ${adminAccount.token}`)
      .send({ status: "approved", adminNote: "Meeting room one reserved." })
      .expect(200)
      .expect((response) => {
        expect(response.body.booking.status).toBe("approved");
      });
  });

  test("lets Tengacion global admins appoint a Kadahive administrator", async () => {
    const platformAdmin = await registerAccount({ institutionSlug: "", prefix: "platform" });
    const member = await registerAccount({ prefix: "promote" });
    await User.updateOne({ _id: platformAdmin.user._id }, { $set: { role: "admin" } });

    const updated = await request(app)
      .patch(`/api/kadahive/admin/members/${member.user._id}`)
      .set("Authorization", `Bearer ${platformAdmin.token}`)
      .send({ role: "admin" })
      .expect(200);

    expect(updated.body.member).toMatchObject({
      _id: member.user._id,
      role: "admin",
      status: "active",
    });
  });
});
