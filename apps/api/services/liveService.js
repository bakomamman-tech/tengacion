const crypto = require("crypto");
const LiveSession = require("../../../backend/models/LiveSession");
const User = require("../../../backend/models/User");
const ApiError = require("../utils/ApiError");
const {
  createLiveToken,
  deleteLiveRoom,
} = require("../../../backend/services/livekitService");

const MAX_TITLE_LENGTH = 120;
const MAX_LIVE_SECONDS_PER_DAY = 30;
const MAX_LIVE_MS_PER_DAY = MAX_LIVE_SECONDS_PER_DAY * 1000;
const quotaTimers = new Map();
let quotaSweepInterval = null;

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

const toDate = (value) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getUtcDayBounds = (date = new Date()) => {
  const current = toDate(date) || new Date();
  const start = new Date(
    Date.UTC(
      current.getUTCFullYear(),
      current.getUTCMonth(),
      current.getUTCDate()
    )
  );
  const end = new Date(
    Date.UTC(
      current.getUTCFullYear(),
      current.getUTCMonth(),
      current.getUTCDate() + 1
    )
  );
  return { start, end };
};

const getSessionQuotaExpiresAt = (session) => {
  const explicitExpiry = toDate(session?.quotaExpiresAt);
  if (explicitExpiry) {
    return explicitExpiry;
  }

  const startedAt = toDate(session?.startedAt);
  if (!startedAt) {
    return null;
  }

  return new Date(startedAt.getTime() + MAX_LIVE_MS_PER_DAY);
};

const isSessionQuotaExpired = (session, now = new Date()) => {
  const expiresAt = getSessionQuotaExpiresAt(session);
  if (!expiresAt) {
    return false;
  }
  return expiresAt.getTime() <= toDate(now).getTime();
};

const buildQuotaSnapshot = (session, { now = new Date(), usedMsToday = null } = {}) => {
  const expiresAt = getSessionQuotaExpiresAt(session);
  const currentNow = toDate(now) || new Date();
  const remainingMilliseconds =
    session?.status === "active" && expiresAt
      ? Math.max(0, expiresAt.getTime() - currentNow.getTime())
      : 0;

  return {
    maxSecondsPerDay: MAX_LIVE_SECONDS_PER_DAY,
    maxMillisecondsPerDay: MAX_LIVE_MS_PER_DAY,
    usedMillisecondsToday: usedMsToday,
    usedSecondsToday:
      usedMsToday == null ? null : Math.floor(Number(usedMsToday) / 1000),
    remainingMilliseconds,
    remainingSeconds: Math.max(0, Math.ceil(remainingMilliseconds / 1000)),
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
  };
};

const clearQuotaTimer = (roomName) => {
  const existing = quotaTimers.get(roomName);
  if (existing) {
    clearTimeout(existing);
  }
  quotaTimers.delete(roomName);
};

const armQuotaTimer = (session) => {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  if (!session?.roomName || session.status !== "active") {
    return;
  }

  const expiresAt = getSessionQuotaExpiresAt(session);
  if (!expiresAt) {
    return;
  }

  clearQuotaTimer(session.roomName);

  const delay = expiresAt.getTime() - Date.now();
  if (delay <= 0) {
    void LiveService.expireSessionByRoom(session.roomName, {
      reason: "quota",
    });
    return;
  }

  const timer = setTimeout(() => {
    quotaTimers.delete(session.roomName);
    void LiveService.expireSessionByRoom(session.roomName, {
      reason: "quota",
    });
  }, delay);

  timer.unref?.();
  quotaTimers.set(session.roomName, timer);
};

const toPublicSession = (session, { now = new Date(), usedMsToday = null } = {}) => ({
  id: session._id.toString(),
  roomName: session.roomName,
  title: session.title || "Live now",
  status: session.status,
  viewerCount: Number(session.viewerCount) || 0,
  startedAt: session.startedAt,
  endedAt: session.endedAt,
  quota: buildQuotaSnapshot(session, { now, usedMsToday }),
  host: {
    userId: session.hostUserId.toString(),
    name: session.hostName,
    username: session.hostUsername,
    avatar: session.hostAvatar,
  },
});

class LiveService {
  static async calculateUsedLiveMs(userId, now = new Date()) {
    const current = toDate(now) || new Date();
    const { start, end } = getUtcDayBounds(current);
    const sessions = await LiveSession.find({
      hostUserId: userId,
      startedAt: { $lt: end },
      $or: [{ status: "active" }, { endedAt: { $gte: start } }],
    }).select("startedAt endedAt status");

    const currentMs = current.getTime();
    const dayStartMs = start.getTime();
    const dayEndMs = end.getTime();

    return sessions.reduce((total, session) => {
      const sessionStart = toDate(session.startedAt)?.getTime();
      const sessionEnd = toDate(session.endedAt)?.getTime() ?? currentMs;

      if (!Number.isFinite(sessionStart)) {
        return total;
      }

      const overlapStart = Math.max(sessionStart, dayStartMs);
      const overlapEnd = Math.min(sessionEnd, currentMs, dayEndMs);
      if (overlapEnd <= overlapStart) {
        return total;
      }

      return total + (overlapEnd - overlapStart);
    }, 0);
  }

  static async getUserQuota(userId, now = new Date()) {
    const usedMillisecondsToday = await LiveService.calculateUsedLiveMs(userId, now);
    const remainingMillisecondsToday = Math.max(
      0,
      MAX_LIVE_MS_PER_DAY - usedMillisecondsToday
    );
    const { end: resetAt } = getUtcDayBounds(now);

    return {
      maxSecondsPerDay: MAX_LIVE_SECONDS_PER_DAY,
      maxMillisecondsPerDay: MAX_LIVE_MS_PER_DAY,
      usedMillisecondsToday,
      usedSecondsToday: Math.floor(usedMillisecondsToday / 1000),
      remainingMillisecondsToday,
      remainingSecondsToday: Math.max(
        0,
        Math.ceil(remainingMillisecondsToday / 1000)
      ),
      canGoLive: remainingMillisecondsToday > 0,
      resetAt: resetAt.toISOString(),
    };
  }

  static async getHostActiveSession(userId) {
    const session = await LiveSession.findOne({
      hostUserId: userId,
      status: "active",
    }).sort({ startedAt: -1 });

    if (!session) {
      return null;
    }

    if (isSessionQuotaExpired(session)) {
      await LiveService.expireSessionByRoom(session.roomName, {
        reason: "quota",
      });
      return null;
    }

    armQuotaTimer(session);
    return session;
  }

  static async expireSessionByRoom(roomName, { reason = "quota", endedAt = new Date() } = {}) {
    const session = await LiveService.findSessionByRoom(roomName);
    if (!session) {
      return null;
    }

    const currentEndedAt = toDate(endedAt) || new Date();
    if (session.status === "ended") {
      clearQuotaTimer(session.roomName);
      return session;
    }

    session.status = "ended";
    session.endedAt = currentEndedAt;
    if (!session.quotaExpiresAt && session.startedAt) {
      const startedAt = toDate(session.startedAt);
      if (startedAt) {
        session.quotaExpiresAt = new Date(startedAt.getTime() + MAX_LIVE_MS_PER_DAY);
      }
    }
    await session.save();
    clearQuotaTimer(session.roomName);

    try {
      await deleteLiveRoom(session.roomName);
    } catch (error) {
      console.warn("Failed to delete expired live room", {
        roomName: session.roomName,
        reason,
        message: error.message,
      });
    }

    return session;
  }

  static async sweepExpiredSessions() {
    const now = new Date();
    const expiredSessions = await LiveSession.find({
      status: "active",
      $or: [
        { quotaExpiresAt: { $lte: now } },
        {
          quotaExpiresAt: { $exists: false },
          startedAt: { $lte: new Date(Date.now() - MAX_LIVE_MS_PER_DAY) },
        },
      ],
    }).select("roomName");

    await Promise.all(
      expiredSessions.map((session) =>
        LiveService.expireSessionByRoom(session.roomName, {
          reason: "quota",
          endedAt: now,
        })
      )
    );
  }

  static async createSession({ userId, title }) {
    const host = await User.findById(userId);
    if (!host) {
      throw ApiError.notFound("Host profile not found");
    }

    const activeSession = await LiveService.getHostActiveSession(host._id);
    if (activeSession) {
      if (isSessionQuotaExpired(activeSession)) {
        await LiveService.expireSessionByRoom(activeSession.roomName, {
          reason: "quota",
        });
      } else {
        throw ApiError.conflict("You already have an active live session");
      }
    }

    const usedMillisecondsToday = await LiveService.calculateUsedLiveMs(host._id);
    const remainingMillisecondsToday = Math.max(
      0,
      MAX_LIVE_MS_PER_DAY - usedMillisecondsToday
    );
    if (remainingMillisecondsToday <= 0) {
      throw ApiError.tooManyRequests(
        "You have used your 30 seconds of live time for today"
      );
    }

    const startedAt = new Date();
    const session = await LiveSession.create({
      hostUserId: host._id,
      hostName: host.name || host.username || "Creator",
      hostUsername: host.username || "",
      hostAvatar: host.avatar || "",
      roomName: makeRoomName(userId),
      title: slugifyTitle(title || `${host.username}'s Live`),
      status: "active",
      quotaExpiresAt: new Date(startedAt.getTime() + remainingMillisecondsToday),
      quotaLimitMs: remainingMillisecondsToday,
      startedAt,
    });

    armQuotaTimer(session);

    return session;
  }

  static toPublic(session) {
    if (!session) {
      return null;
    }
    return toPublicSession(session);
  }

  static async listActiveSessions() {
    await LiveService.sweepExpiredSessions().catch(() => {});
    const sessions = await LiveSession.find({ status: "active" }).sort({
      startedAt: -1,
    });
    return sessions.map((session) => {
      armQuotaTimer(session);
      return toPublicSession(session);
    });
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

  static async getActiveSessionByRoom(roomName) {
    const session = await LiveService.findSessionByRoom(roomName);
    if (session.status !== "active") {
      clearQuotaTimer(session.roomName);
      throw ApiError.badRequest("Live session is no longer active");
    }

    if (isSessionQuotaExpired(session)) {
      await LiveService.expireSessionByRoom(session.roomName, {
        reason: "quota",
      });
      throw ApiError.tooManyRequests(
        "This live session has reached the 30-second daily limit"
      );
    }

    armQuotaTimer(session);
    return session;
  }

  static async endSession({ userId, roomName }) {
    const session = await LiveService.findSessionByRoom(roomName);
    if (session.hostUserId.toString() !== userId.toString()) {
      throw ApiError.forbidden("Only the host can end this session");
    }

    if (session.status === "ended") {
      clearQuotaTimer(session.roomName);
      return session;
    }

    return LiveService.expireSessionByRoom(roomName, {
      reason: "manual",
    });
  }

  static async createToken({
    identity,
    name,
    roomName,
    canPublish = false,
    ttl = "2h",
  }) {
    if (!roomName) {
      throw ApiError.badRequest("Room name is required");
    }
    return createLiveToken({
      identity,
      name,
      roomName,
      canPublish,
      ttl,
    });
  }

  static async incrementViewerCount({ roomName, delta = 1 }) {
    const session = await LiveService.getActiveSessionByRoom(roomName);
    session.viewerCount = Math.max(0, Number(session.viewerCount || 0) + Number(delta));
    await session.save();
    return session;
  }
}

module.exports = LiveService;

if (process.env.NODE_ENV !== "test") {
  const startQuotaSweep = () => {
    if (quotaSweepInterval) {
      return;
    }

    quotaSweepInterval = setInterval(() => {
      LiveService.sweepExpiredSessions().catch(() => {});
    }, 1000);

    quotaSweepInterval.unref?.();
  };

  startQuotaSweep();
}
