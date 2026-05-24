const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const LiveService = require("../services/liveService");
const { ensureValidLivekitConfig } = require("../services/livekitConfig");
const User = require("../../../backend/models/User");
const { logAnalyticsEvent } = require("../../../backend/services/analyticsService");
const {
  notifyCreatorWentLive,
  setLiveReminder,
} = require("../../../backend/services/fanReturnPathService");

const emitEvent = (req, event, payload) => {
  const io = req.app.get("io");
  if (io) {
    io.emit(event, payload);
  }
};

const logLiveReliabilityEvent = (req, type, metadata = {}) =>
  logAnalyticsEvent({
    type,
    userId: req.user?.id || null,
    targetId: metadata.roomName || null,
    targetType: "live",
    contentType: "live",
    metadata,
  }).catch(() => null);

exports.createLiveSession = catchAsync(async (req, res) => {
  const { title } = req.body || {};
  let session = null;
  try {
    const livekit = ensureValidLivekitConfig();
    session = await LiveService.createSession({
      userId: req.user.id,
      title,
    });
    const sessionPayload = LiveService.toPublic(session);

    await logLiveReliabilityEvent(req, "live_session_created", {
      roomName: session.roomName,
      title: session.title,
    });

    const token = await LiveService.createToken({
      identity: req.user.id,
      name: session.hostName,
      roomName: session.roomName,
      canPublish: true,
      ttl: `${Math.max(1, sessionPayload?.quota?.remainingMilliseconds || 0)}ms`,
    });

    await logLiveReliabilityEvent(req, "live_token_issued", {
      roomName: session.roomName,
      publish: true,
    });
    await notifyCreatorWentLive({ req, session }).catch(() => null);

    res.status(201).json({
      session: sessionPayload,
      token,
      livekit,
    });

    emitEvent(req, "live:created", sessionPayload);
  } catch (error) {
    await logLiveReliabilityEvent(
      req,
      session ? "live_token_failed" : "live_session_create_failed",
      {
        roomName: session?.roomName || "",
        reason: error.message || "Live session creation failed",
      }
    );
    throw error;
  }
});

exports.endLiveSession = catchAsync(async (req, res) => {
  const { roomName } = req.body || {};
  if (!roomName) {
    throw ApiError.badRequest("Room name is required");
  }

  const session = await LiveService.endSession({
    userId: req.user.id,
    roomName,
  });

  const payload = LiveService.toPublic(session);
  res.json({ session: payload });
  emitEvent(req, "live:ended", payload);
});

exports.getActiveSessions = catchAsync(async (req, res) => {
  const sessions = await LiveService.listActiveSessions();
  res.json({ sessions });
});

exports.requestToken = catchAsync(async (req, res) => {
  const { roomName, publish = false } = req.body || {};
  try {
    if (!roomName) {
      throw ApiError.badRequest("Room name is required");
    }
    const livekit = ensureValidLivekitConfig();

    const user = await User.findById(req.user.id);
    if (!user) {
      throw ApiError.unauthorized("User not found");
    }

    const session = await LiveService.getActiveSessionByRoom(roomName);
    if (publish && session.hostUserId.toString() !== req.user.id.toString()) {
      throw ApiError.forbidden("Only the host can publish");
    }

    const sessionPayload = LiveService.toPublic(session);

    const token = await LiveService.createToken({
      identity: req.user.id,
      name: user.name || user.username || "Guest",
      roomName,
      canPublish: Boolean(publish),
      ttl: `${Math.max(1, sessionPayload?.quota?.remainingMilliseconds || 0)}ms`,
    });

    await logLiveReliabilityEvent(req, "live_token_issued", {
      roomName,
      publish: Boolean(publish),
    });

    res.json({
      token,
      session: sessionPayload,
      livekit,
    });
  } catch (error) {
    await logLiveReliabilityEvent(req, "live_token_failed", {
      roomName: roomName || "",
      publish: Boolean(publish),
      reason: error.message || "Live token request failed",
    });
    throw error;
  }
});

exports.getLiveConfig = catchAsync(async (req, res) => {
  const livekit = ensureValidLivekitConfig();
  const payload = { ...livekit };

  if (req.user?.id) {
    const [quota, activeSession] = await Promise.all([
      LiveService.getUserQuota(req.user.id),
      LiveService.getHostActiveSession(req.user.id),
    ]);
    payload.quota = quota;
    payload.activeSession = activeSession ? LiveService.toPublic(activeSession) : null;
  }

  res.json(payload);
});

exports.updateViewerCount = catchAsync(async (req, res) => {
  const { roomName, delta = 1 } = req.body || {};
  if (!roomName) {
    throw ApiError.badRequest("Room name is required");
  }

  const session = await LiveService.incrementViewerCount({
    roomName,
    delta: Number(delta) || 1,
  });

  const payload = {
    roomName: session.roomName,
    viewerCount: session.viewerCount,
  };
  res.json(payload);
  emitEvent(req, "live:viewers", payload);
});

exports.setReminder = catchAsync(async (req, res) => {
  const payload = await setLiveReminder({
    req,
    userId: req.user.id,
    creatorId: req.body?.creatorId || "",
    roomName: req.body?.roomName || "",
  });
  res.status(201).json(payload);
});
