const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
require("../../apps/api/config/env");

const User = require("../models/User");
const {
  SessionAuthError,
  authenticateAccessToken,
} = require("../services/sessionAuth");

let mongod;

const issueSessionToken = async (userId, { tokenVersion = 0, revoked = false } = {}) => {
  const sessionId = new mongoose.Types.ObjectId().toString();
  await User.updateOne(
    { _id: userId },
    {
      $push: {
        sessions: {
          sessionId,
          createdAt: new Date(),
          lastSeenAt: new Date(),
          revokedAt: revoked ? new Date() : null,
        },
      },
      $set: {
        tokenVersion,
      },
    }
  );

  return {
    sessionId,
    token: jwt.sign(
      {
        id: userId.toString(),
        tv: tokenVersion,
        sid: sessionId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    ),
  };
};

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

describe("sessionAuth", () => {
  test("accepts a token only when tokenVersion and sessionId are still valid", async () => {
    const user = await User.create({
      name: "Socket User",
      username: "socket_user",
      email: "socket@test.com",
      password: "Password123!",
    });

    const { token, sessionId } = await issueSessionToken(user._id);
    const authContext = await authenticateAccessToken(token);

    expect(authContext.userId).toBe(user._id.toString());
    expect(authContext.sessionId).toBe(sessionId);
    expect(authContext.tokenVersion).toBe(0);
  });

  test("rejects revoked sessions", async () => {
    const user = await User.create({
      name: "Revoked User",
      username: "revoked_user",
      email: "revoked@test.com",
      password: "Password123!",
    });

    const { token } = await issueSessionToken(user._id, { revoked: true });

    await expect(authenticateAccessToken(token)).rejects.toMatchObject({
      name: "SessionAuthError",
      code: "SESSION_REVOKED",
      statusCode: 401,
    });
  });

  test("rejects token version mismatches", async () => {
    const user = await User.create({
      name: "Version User",
      username: "version_user",
      email: "version@test.com",
      password: "Password123!",
      tokenVersion: 2,
    });

    const sessionId = new mongoose.Types.ObjectId().toString();
    await User.updateOne(
      { _id: user._id },
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

    const staleToken = jwt.sign(
      {
        id: user._id.toString(),
        tv: 1,
        sid: sessionId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    await expect(authenticateAccessToken(staleToken)).rejects.toBeInstanceOf(
      SessionAuthError
    );
    await expect(authenticateAccessToken(staleToken)).rejects.toMatchObject({
      code: "TOKEN_VERSION_MISMATCH",
      statusCode: 401,
    });
  });

  test("rejects sessions issued before password change or forced logout markers", async () => {
    const user = await User.create({
      name: "Revoked Session User",
      username: "revoked_session_user",
      email: "revoked-session@test.com",
      password: "Password123!",
    });

    const { token } = await issueSessionToken(user._id);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordChangedAt: new Date(Date.now() + 60 * 1000),
        },
      }
    );

    await expect(authenticateAccessToken(token)).rejects.toMatchObject({
      code: "PASSWORD_CHANGED",
      statusCode: 401,
    });

    await User.updateOne(
      { _id: user._id },
      {
        $unset: { passwordChangedAt: 1 },
        $set: {
          forceLogoutAt: new Date(Date.now() + 60 * 1000),
        },
      }
    );

    await expect(authenticateAccessToken(token)).rejects.toMatchObject({
      code: "FORCE_LOGOUT",
      statusCode: 401,
    });
  });

  test("rejects sessions when the user must reauthenticate", async () => {
    const user = await User.create({
      name: "Reauth User",
      username: "reauth_user",
      email: "reauth@test.com",
      password: "Password123!",
      mustReauth: true,
    });

    const { token } = await issueSessionToken(user._id);

    await expect(authenticateAccessToken(token)).rejects.toMatchObject({
      code: "MUST_REAUTH",
      statusCode: 401,
    });
  });
});
