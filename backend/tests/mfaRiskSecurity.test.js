const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";
require("../../apps/api/config/env");

jest.mock("../utils/sendOtpEmail", () => jest.fn().mockResolvedValue(undefined));
jest.mock("../utils/sendSecurityEmail", () => jest.fn().mockResolvedValue(undefined));

const app = require("../app");
const AuthService = require("../../apps/api/services/authService");
const User = require("../models/User");
const sendSecurityEmail = require("../utils/sendSecurityEmail");
const { totp } = require("../utils/totp");

let mongod;

const extractLastEmailCode = () => {
  const lastCall = sendSecurityEmail.mock.calls[sendSecurityEmail.mock.calls.length - 1] || [];
  const payload = lastCall[0] || {};
  const html = String(payload.html || "");
  const match = html.match(/(\d{6})/);
  return match ? match[1] : "";
};

const makeSessionMeta = ({
  deviceName = "Google Chrome on Windows",
  ip = "102.89.1.10",
  userAgent = "Mozilla/5.0 Chrome/123.0",
  country = "NG",
  city = "Lagos",
} = {}) => ({
  deviceName,
  ip,
  userAgent,
  headers: {
    "x-country-code": country,
    "x-vercel-ip-city": city,
  },
});

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
  jest.clearAllMocks();
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

describe("MFA and suspicious-login security", () => {
  test("requires TOTP verification after MFA is enabled", async () => {
    const user = await User.create({
      name: "MFA User",
      username: "mfa_user",
      email: "mfa@test.com",
      password: "Password123!",
    });

    const setup = await AuthService.beginTwoFactorSetup({ userId: user._id.toString() });
    const setupCode = totp({ secret: setup.secret });
    const status = await AuthService.verifyTwoFactorSetup({
      userId: user._id.toString(),
      code: setupCode,
    });

    expect(status).toMatchObject({
      enabled: true,
      method: "totp",
    });

    const challenge = await AuthService.login({
      email: "mfa@test.com",
      password: "Password123!",
      sessionMeta: makeSessionMeta(),
    });

    expect(challenge).toMatchObject({
      challengeRequired: true,
    });
    expect(challenge.challenge.method).toBe("totp");

    const verifiedLogin = await AuthService.verifyAuthChallenge({
      challengeToken: challenge.challenge.token,
      code: totp({ secret: setup.secret }),
    });

    expect(verifiedLogin.token).toBeTruthy();
    expect(verifiedLogin.stepUpToken).toBeTruthy();
    expect(verifiedLogin.user?.twoFactor).toMatchObject({
      enabled: true,
      method: "totp",
    });
  });

  test("forces an email challenge for suspicious logins from a new device and country", async () => {
    await User.create({
      name: "Risk User",
      username: "risk_user",
      email: "risk@test.com",
      password: "Password123!",
    });

    const safeLogin = await AuthService.login({
      email: "risk@test.com",
      password: "Password123!",
      sessionMeta: makeSessionMeta(),
    });

    expect(safeLogin.challengeRequired).toBeUndefined();
    expect(safeLogin.token).toBeTruthy();

    const riskyLogin = await AuthService.login({
      email: "risk@test.com",
      password: "Password123!",
      sessionMeta: makeSessionMeta({
        deviceName: "Safari on Mac",
        ip: "8.8.8.8",
        userAgent: "Mozilla/5.0 Safari/17.0",
        country: "US",
        city: "New York",
      }),
    });

    expect(riskyLogin).toMatchObject({
      challengeRequired: true,
    });
    expect(riskyLogin.challenge.method).toBe("email");
    expect(riskyLogin.challenge.riskReasons).toEqual(
      expect.arrayContaining(["new_device", "new_ip", "new_country", "impossible_travel"])
    );
    expect(sendSecurityEmail).toHaveBeenCalled();
  });

  test("supports email-code MFA for login and step-up verification", async () => {
    const user = await User.create({
      name: "Email MFA User",
      username: "email_mfa_user",
      email: "emailmfa@test.com",
      password: "Password123!",
      emailVerified: true,
      isVerified: true,
    });

    const enabled = await AuthService.enableEmailTwoFactor({
      userId: user._id.toString(),
    });

    expect(enabled).toMatchObject({
      enabled: true,
      method: "email",
    });

    const challenge = await AuthService.login({
      email: "emailmfa@test.com",
      password: "Password123!",
      sessionMeta: makeSessionMeta(),
    });

    expect(challenge).toMatchObject({
      challengeRequired: true,
    });
    expect(challenge.challenge.method).toBe("email");

    const loginCode = extractLastEmailCode();
    expect(loginCode).toMatch(/^\d{6}$/);

    const verifiedLogin = await AuthService.verifyAuthChallenge({
      challengeToken: challenge.challenge.token,
      code: loginCode,
    });

    expect(verifiedLogin.token).toBeTruthy();
    expect(verifiedLogin.stepUpToken).toBeTruthy();
    expect(verifiedLogin.user?.twoFactor).toMatchObject({
      enabled: true,
      method: "email",
    });

    const stepUpChallenge = await AuthService.verifyStepUp({
      userId: user._id.toString(),
      sessionId: verifiedLogin.sessionId,
    });

    expect(stepUpChallenge).toMatchObject({
      challengeRequired: true,
    });
    expect(stepUpChallenge.challenge.method).toBe("email");

    const stepUpCode = extractLastEmailCode();
    expect(stepUpCode).toMatch(/^\d{6}$/);

    const stepUpVerified = await AuthService.verifyStepUp({
      userId: user._id.toString(),
      sessionId: verifiedLogin.sessionId,
      challengeToken: stepUpChallenge.challenge.token,
      code: stepUpCode,
    });

    expect(stepUpVerified.stepUpToken).toBeTruthy();
  });

  test("accepts admin authenticator setup codes over the HTTP challenge flow", async () => {
    await User.create({
      name: "Admin Setup User",
      username: "admin_setup_user",
      email: "adminsetup@test.com",
      password: "Password123!",
      role: "admin",
      emailVerified: true,
      isVerified: true,
    });

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "adminsetup@test.com",
      password: "Password123!",
      deviceName: "Google Chrome on Windows",
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toMatchObject({
      challengeRequired: true,
    });
    expect(loginResponse.body.challenge.purpose).toBe("mfa_setup");
    expect(loginResponse.body.challenge.method).toBe("totp");

    const secret = loginResponse.body.challenge?.setup?.secret;
    const challengeToken = loginResponse.body.challenge?.token;
    const verifyResponse = await request(app).post("/api/auth/challenge/verify").send({
      challengeToken,
      code: totp({ secret }),
    });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body?.user?.twoFactor).toMatchObject({
      enabled: true,
      method: "totp",
    });
    expect(verifyResponse.body?.token).toBeTruthy();
  });
});
