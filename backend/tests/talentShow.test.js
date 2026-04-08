const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-talent-show-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "talent_show_test_secret_123456789012345";

const app = require("../app");
const TalentShowApplication = require("../models/TalentShowApplication");
const User = require("../models/User");

let mongod;

const issueSessionToken = async (userId) => {
  const sessionId = new mongoose.Types.ObjectId().toString();
  await User.updateOne(
    { _id: userId },
    {
      $push: {
        sessions: {
          sessionId,
          createdAt: new Date(),
          lastSeenAt: new Date(),
        },
      },
    }
  );

  return jwt.sign(
    {
      id: userId.toString(),
      tv: 0,
      sid: sessionId,
    },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
};

const createUser = async ({ role = "user", email = "contestant@example.com", username = "contestant" } = {}) =>
  User.create({
    name: "Contestant Example",
    username,
    email,
    password: "Password123!",
    role,
    isVerified: true,
    emailVerified: true,
  });

const createPayload = (overrides = {}) => ({
  fullName: "Aisha Bello",
  stageName: "Aisha Blaze",
  email: "aisha@example.com",
  phone: "+2348000000000",
  gender: "female",
  dateOfBirth: "2000-05-16",
  country: "Nigeria",
  stateOfOrigin: "Kaduna",
  city: "Kaduna",
  talentCategory: "singer",
  talentCategoryOther: "",
  bio: "I am a live performer with stage experience across school shows, church programmes, and community events.",
  experienceLevel: "Regular performer",
  socialHandle: "@aishablaze",
  ...overrides,
});

describe("talent show application routes", () => {
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
      if (mongod) {
        await mongod.stop();
      }
    }
  });

  test("public submissions are created once and updated on re-submit", async () => {
    const response = await request(app)
      .post("/api/talent-show/kaduna-got-talent/application")
      .send(createPayload())
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      created: true,
    });
    expect(await TalentShowApplication.countDocuments({})).toBe(1);

    const updateResponse = await request(app)
      .post("/api/talent-show/kaduna-got-talent/application")
      .send(
        createPayload({
          bio: "I sing Afro-fusion, soul and worship music, and I have headlined several youth concerts in Kaduna.",
          experienceLevel: "Professional performer",
        })
      )
      .expect(200);

    expect(updateResponse.body).toMatchObject({
      success: true,
      created: false,
    });
    expect(await TalentShowApplication.countDocuments({})).toBe(1);

    const stored = await TalentShowApplication.findOne({ normalizedEmail: "aisha@example.com" }).lean();
    expect(stored.experienceLevel).toBe("Professional performer");
    expect(String(stored.bio || "")).toContain("Afro-fusion");
  });

  test("authenticated users can load their existing application", async () => {
    const user = await createUser();
    const token = await issueSessionToken(user._id);

    await request(app)
      .post("/api/talent-show/kaduna-got-talent/application")
      .set("Authorization", `Bearer ${token}`)
      .send(
        createPayload({
          email: user.email,
          fullName: user.name,
        })
      )
      .expect(201);

    const response = await request(app)
      .get("/api/talent-show/kaduna-got-talent/application")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.application).toMatchObject({
      fullName: user.name,
      email: user.email,
      talentCategory: "singer",
    });
  });

  test("admin users can list submitted applications", async () => {
    const admin = await createUser({
      role: "admin",
      email: "admin-talent@example.com",
      username: "admin_talent",
    });
    const adminToken = await issueSessionToken(admin._id);

    await TalentShowApplication.create({
      showSlug: "kaduna-got-talent",
      showTitle: "Kaduna Got Talent",
      fullName: "Musa Audu",
      email: "musa@example.com",
      normalizedEmail: "musa@example.com",
      phone: "+2348011111111",
      gender: "male",
      dateOfBirth: new Date("1998-02-10"),
      country: "Nigeria",
      stateOfOrigin: "Kaduna",
      city: "Zaria",
      talentCategory: "comedian",
      bio: "I perform stand-up comedy focused on family, school life, and everyday Northern Nigerian experiences.",
      status: "submitted",
    });

    const response = await request(app)
      .get("/api/talent-show/kaduna-got-talent/applications")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.applications[0]).toMatchObject({
      fullName: "Musa Audu",
      talentCategory: "comedian",
      city: "Zaria",
    });
  });
});
