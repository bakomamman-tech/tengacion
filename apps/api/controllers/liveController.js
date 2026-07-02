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
const { LIVE_STREAM_RECORDING } = require("../../../backend/config/uploadLimits");

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

const getSessionTokenTtl = (sessionPayload) => {
  if (sessionPayload?.quota?.unlimited) {
    return "24h";
  }

  const remainingMilliseconds = Math.max(
    1,
    Number(sessionPayload?.quota?.remainingMilliseconds) || 0
  );
  return `${Math.max(1, Math.ceil(remainingMilliseconds / 1000))}s`;
};

exports.createLiveSession = catchAsync(async (req, res) => {
  const { title } = req.body || {};
  let session = null;
  try {
    LiveService.assertCanPublishLive(req.user);
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
      ttl: getSessionTokenTtl(sessionPayload),
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
    if (session?.roomName) {
      await LiveService.expireSessionByRoom(session.roomName, {
        reason: "token_failure",
      }).catch(() => null);
    }
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
    const publishAccess = publish
      ? LiveService.assertCanPublishLive(req.user)
      : null;
    const livekit = ensureValidLivekitConfig();

    const user = await User.findById(req.user.id);
    if (!user) {
      throw ApiError.unauthorized("User not found");
    }

    const existingSession = await LiveService.findSessionByRoom(roomName);
    if (publish && existingSession.hostUserId.toString() !== req.user.id.toString()) {
      throw ApiError.forbidden("Only the host can publish");
    }
    const session = await LiveService.getActiveSessionByRoom(roomName, {
      quotaExempt: Boolean(publishAccess?.quotaExempt),
    });

    const sessionPayload = LiveService.toPublic(session);

    const token = await LiveService.createToken({
      identity: req.user.id,
      name: user.name || user.username || "Guest",
      roomName,
      canPublish: Boolean(publish),
      ttl: getSessionTokenTtl(sessionPayload),
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
  const wantsPublishAccess = ["1", "true", "yes"].includes(
    String(req.query?.publish || "").trim().toLowerCase()
  );
  const liveAccess = req.user?.id ? LiveService.getLiveAccess(req.user) : null;
  if (wantsPublishAccess && liveAccess && !liveAccess.canPublish) {
    const quota = await LiveService.getUserQuota(req.user.id, new Date(), {
      quotaExempt: Boolean(liveAccess.quotaExempt),
    }).catch(() => null);
    res.json({
      recording: LIVE_STREAM_RECORDING,
      liveAccess,
      quota: quota
        ? {
            ...quota,
            canGoLive: false,
            blockedReason: liveAccess.message,
          }
        : {
            canGoLive: false,
            blockedReason: liveAccess.message,
          },
      activeSession: null,
    });
    return;
  }

  const livekit = ensureValidLivekitConfig();
  const payload = {
    ...livekit,
    recording: LIVE_STREAM_RECORDING,
  };

  if (req.user?.id) {
    const [quota, activeSession] = await Promise.all([
      LiveService.getUserQuota(req.user.id, new Date(), {
        quotaExempt: Boolean(liveAccess?.quotaExempt),
      }),
      LiveService.getHostActiveSession(req.user.id, {
        quotaExempt: Boolean(liveAccess?.quotaExempt),
      }),
    ]);
    payload.liveAccess = liveAccess;
    payload.quota =
      liveAccess && !liveAccess.canPublish
        ? {
            ...quota,
            canGoLive: false,
            blockedReason: liveAccess.message,
          }
        : quota;
    payload.activeSession =
      liveAccess && !liveAccess.canPublish
        ? null
        : activeSession
          ? LiveService.toPublic(activeSession)
          : null;
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
