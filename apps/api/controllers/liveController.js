const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const LiveService = require("../services/liveService");
const User = require("../../../backend/models/User");
const { config } = require("../../../backend/config/env");

const buildLivekitConfig = () => ({
  url: config.LIVEKIT_HOST || "",
  wsUrl: config.LIVEKIT_WS_URL || "",
});

const emitEvent = (req, event, payload) => {
  const io = req.app.get("io");
  if (io) {
    io.emit(event, payload);
  }
};

exports.createLiveSession = catchAsync(async (req, res) => {
  const { title } = req.body || {};
  const session = await LiveService.createSession({
    userId: req.user.id,
    title,
  });

  const token = await LiveService.createToken({
    identity: req.user.id,
    name: session.hostName,
    roomName: session.roomName,
    canPublish: true,
  });

  const payload = LiveService.toPublic(session);
  res.status(201).json({
    session: payload,
    token,
    livekit: buildLivekitConfig(),
  });

  emitEvent(req, "live:created", payload);
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
  if (!roomName) {
    throw ApiError.badRequest("Room name is required");
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    throw ApiError.unauthorized("User not found");
  }

  const session = await LiveService.findSessionByRoom(roomName);
  if (publish && session.hostUserId.toString() !== req.user.id.toString()) {
    throw ApiError.forbidden("Only the host can publish");
  }

  const token = await LiveService.createToken({
    identity: req.user.id,
    name: user.name || user.username || "Guest",
    roomName,
    canPublish: Boolean(publish),
  });

  res.json({
    token,
    session: LiveService.toPublic(session),
    livekit: buildLivekitConfig(),
  });
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
