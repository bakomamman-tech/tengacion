const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MODERATION_ENABLED = "false";
process.env.REQUIRE_EMAIL_OTP = "false";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-summer-bootcamp-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "summer_bootcamp_test_secret_123456789012345";

const app = require("../app");
const SummerBootcampRegistration = require("../models/SummerBootcampRegistration");
const User = require("../models/User");

let mongod;

const buildPayload = (overrides = {}) => ({
  account: {
    username: "amina_parent",
    password: "StrongPassword123!",
  },
  parent: {
    fullName: "Amina Yusuf",
    email: "amina.parent@example.com",
    phone: "+2348061201090",
    dateOfBirth: "1990-04-18",
    gender: "female",
    relationshipToStudents: "Mother",
    country: "Nigeria",
    stateOfOrigin: "Kaduna",
    city: "Kaduna",
    homeAddress: "12 Learning Avenue, Kaduna",
    occupation: "Teacher",
    preferredContactMethod: "whatsapp",
  },
  emergencyContact: {
    fullName: "Musa Yusuf",
    phone: "+2348090000000",
    relationship: "Uncle",
  },
  household: {
    learningDevice: "computer",
    internetReliability: "mostly_reliable",
    schedulePreference: "weekday_afternoon",
    goals:
      "We want our child to become more confident with numbers, reading and practical technology skills.",
  },
  students: [
    {
      fullName: "Zara Yusuf",
      preferredName: "Zara",
      dateOfBirth: "2015-06-12",
      gender: "female",
      currentSchool: "Kurah Tech and Arts Academy",
      classLevel: "Primary 5",
      learningTracks: ["abacus_math", "tech_skills"],
      learningGoals: "Build confidence in mental maths and create a first coding project.",
      additionalNeeds: "None",
    },
  ],
  consent: {
    guardianAuthority: true,
    virtualLearning: true,
    childDataProcessing: true,
    profilePhotoUse: true,
    feeAcknowledged: true,
    termsAccepted: true,
    communicationsAccepted: true,
  },
  ...overrides,
});

const submitRegistration = (
  payload = buildPayload(),
  token = "",
  studentPhotoCount = payload.students.length
) => {
  let submission = request(app)
    .post("/api/summer-bootcamp/register")
    .field("payload", JSON.stringify(payload))
    .attach("parentPhoto", Buffer.from("parent-photo"), {
      filename: "parent.png",
      contentType: "image/png",
    });

  payload.students.slice(0, studentPhotoCount).forEach((student, index) => {
    submission = submission.attach(
      "studentPhotos",
      Buffer.from(`student-photo-${student.fullName}`),
      {
        filename: `student-${index + 1}.png`,
        contentType: "image/png",
      }
    );
  });

  return token ? submission.set("Authorization", `Bearer ${token}`) : submission;
};

describe("Summer Bootcamp registration", () => {
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

  test("creates the parent account, links the family application, and protects child photos", async () => {
    const response = await submitRegistration().expect(201);

    expect(response.body).toMatchObject({
      success: true,
      createdAccount: true,
      user: {
        name: "Amina Yusuf",
        username: "amina_parent",
        email: "amina.parent@example.com",
      },
      application: {
        campaignSlug: "summer-bootcamp-2026",
        status: "submitted",
        parent: {
          fullName: "Amina Yusuf",
        },
        programme: {
          feePerParticipantNgn: 50000,
          standardTotalNgn: 50000,
          participantCount: 1,
          familyRateNegotiable: false,
        },
      },
    });
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.application.referenceCode).toMatch(/^TGSB-2026-[A-F0-9]{8}$/);
    expect(response.body.application.students).toHaveLength(1);

    const [user, registration] = await Promise.all([
      User.findOne({ email: "amina.parent@example.com" }).lean(),
      SummerBootcampRegistration.findOne({ "parent.normalizedEmail": "amina.parent@example.com" }).lean(),
    ]);
    expect(user).toBeTruthy();
    expect(user.avatar.url).toMatch(/^\/api\/media\/[a-f\d]{24}$/i);
    expect(String(registration.parentUserId)).toBe(String(user._id));
    expect(registration.students[0].photo.fileId).toMatch(/^[a-f\d]{24}$/i);

    const childPhotoUrl = response.body.application.students[0].photoUrl;
    await request(app).get(childPhotoUrl).expect(401);
    const photoResponse = await request(app)
      .get(childPhotoUrl)
      .set("Authorization", `Bearer ${response.body.token}`)
      .expect(200);
    expect(photoResponse.headers["content-type"]).toMatch(/^image\//);
    expect(photoResponse.headers["cache-control"]).toContain("private");
  });

  test("marks a three-child application as eligible for a negotiated family rate", async () => {
    const firstStudent = buildPayload().students[0];
    const payload = buildPayload({
      students: [
        firstStudent,
        {
          ...firstStudent,
          fullName: "Musa Yusuf",
          preferredName: "Musa",
          dateOfBirth: "2013-03-22",
        },
        {
          ...firstStudent,
          fullName: "Aisha Yusuf",
          preferredName: "Aisha",
          dateOfBirth: "2017-09-09",
        },
      ],
    });

    const response = await submitRegistration(payload).expect(201);

    expect(response.body.application.students).toHaveLength(3);
    expect(response.body.application.programme).toMatchObject({
      feePerParticipantNgn: 50000,
      standardTotalNgn: 150000,
      participantCount: 3,
      familyRateNegotiable: true,
    });
    expect(response.body.application.programme.startsOn).toBe("2026-08-01T00:00:00.000Z");
    expect(response.body.application.programme.endsOn).toBe("2026-08-30T23:59:59.999Z");
  });

  test("rejects students below the advertised minimum age before creating an account", async () => {
    const payload = buildPayload({
      students: [
        {
          ...buildPayload().students[0],
          dateOfBirth: new Date().toISOString().slice(0, 10),
        },
      ],
    });

    const response = await submitRegistration(payload).expect(400);
    expect(response.body.error).toContain("between 5 and 18 years old");
    expect(await User.countDocuments({})).toBe(0);
    expect(await SummerBootcampRegistration.countDocuments({})).toBe(0);
  });

  test("rejects applications containing more than three students", async () => {
    const firstStudent = buildPayload().students[0];
    const payload = buildPayload({
      students: [
        firstStudent,
        { ...firstStudent, fullName: "Musa Yusuf" },
        { ...firstStudent, fullName: "Aisha Yusuf" },
        { ...firstStudent, fullName: "Bello Yusuf" },
      ],
    });

    const response = await submitRegistration(payload, "", 3).expect(400);

    expect(response.body.error).toBe("Register between one and three students.");
    expect(await User.countDocuments({})).toBe(0);
    expect(await SummerBootcampRegistration.countDocuments({})).toBe(0);
  });

  test("does not create a second application for the same signed-in parent", async () => {
    const first = await submitRegistration().expect(201);
    const second = await submitRegistration(buildPayload(), first.body.token).expect(409);

    expect(second.body.error).toContain("already exists");
    expect(await User.countDocuments({})).toBe(1);
    expect(await SummerBootcampRegistration.countDocuments({})).toBe(1);
  });
});
