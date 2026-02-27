const crypto = require("crypto");
const LiveSession = require("../../../backend/models/LiveSession");
const User = require("../../../backend/models/User");
const ApiError = require("../utils/ApiError");
const { createLiveToken } = require("../../../backend/services/livekitService");

const MAX_TITLE_LENGTH = 120;

const slugifyTitle = (value) => {
  const normalized = (value || "")
    .toString()
    .trim()
    .slice(0, MAX_TITLE_LENGTH);
  return normalized;
};

const makeRoomName = (userId) => {
  const random = crypto.randomBytes(4).toString("hex");
  return `live-${userId}-${Date.now()}-${random}`;
};

const toPublicSession = (session) => ({
  id: session._id.toString(),
  roomName: session.roomName,
  title: session.title || "Live now",
  status: session.status,
  viewerCount: Number(session.viewerCount) || 0,
  startedAt: session.startedAt,
  endedAt: session.endedAt,
  host: {
    userId: session.hostUserId.toString(),
    name: session.hostName,
    username: session.hostUsername,
    avatar: session.hostAvatar,
  },
});

class LiveService {
  static async createSession({ userId, title }) {
    const host = await User.findById(userId);
    if (!host) {
      throw ApiError.notFound("Host profile not found");
    }

    const session = await LiveSession.create({
      hostUserId: host._id,
      hostName: host.name || host.username || "Creator",
      hostUsername: host.username || "",
      hostAvatar: host.avatar || "",
      roomName: makeRoomName(userId),
      title: slugifyTitle(title || `${host.username}'s Live`),
      status: "active",
    });

    return session;
  }

  static toPublic(session) {
    if (!session) {
      return null;
    }
    return toPublicSession(session);
  }

  static async listActiveSessions() {
    const sessions = await LiveSession.find({ status: "active" }).sort({
      startedAt: -1,
    });
    return sessions.map(toPublicSession);
  }

  static async findSessionByRoom(roomName) {
    if (!roomName) {
      throw ApiError.badRequest("Room name is required");
    }
    const session = await LiveSession.findOne({ roomName });
    if (!session) {
      throw ApiError.notFound("Live session not found");
    }
    return session;
  }

  static async endSession({ userId, roomName }) {
    const session = await LiveService.findSessionByRoom(roomName);
    if (session.hostUserId.toString() !== userId.toString()) {
      throw ApiError.forbidden("Only the host can end this session");
    }

    if (session.status === "ended") {
      return session;
    }

    session.status = "ended";
    session.endedAt = new Date();
    await session.save();
    return session;
  }

  static async createToken({ identity, name, roomName, canPublish = false }) {
    if (!roomName) {
      throw ApiError.badRequest("Room name is required");
    }
    return createLiveToken({
      identity,
      name,
      roomName,
      canPublish,
    });
  }

  static async incrementViewerCount({ roomName, delta = 1 }) {
    const session = await LiveService.findSessionByRoom(roomName);
    if (session.status !== "active") {
      throw ApiError.badRequest("Live session is no longer active");
    }
    session.viewerCount = Math.max(0, Number(session.viewerCount || 0) + Number(delta));
    await session.save();
    return session;
  }
}

module.exports = LiveService;
