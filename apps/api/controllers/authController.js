const AuthService = require("../services/authService");
const catchAsync = require("../utils/catchAsync");
const {
  disconnectSessionSockets,
  disconnectUserSockets,
  disconnectUserSessionsExcept,
} = require("../../../backend/utils/realtimeSessions");
const {
  setRefreshCookie,
  clearRefreshCookie,
  setStepUpCookie,
  clearStepUpCookie,
  REFRESH_COOKIE_NAME,
} = require("../../../backend/services/authTokens");
const { getCookieValue } = require("../../../backend/utils/requestCookies");
const {
  ensureOnboardingReminderMessage,
} = require("../../../backend/services/onboardingReminderService");

const applyAuthCookies = (res, payload = {}) => {
  if (payload?.refreshToken) {
    setRefreshCookie(res, payload.refreshToken);
  }
  if (payload?.stepUpToken) {
    setStepUpCookie(res, payload.stepUpToken);
  }
  if (payload?.clearStepUp) {
    clearStepUpCookie(res);
  }
};

const clearAuthCookies = (res) => {
  clearRefreshCookie(res);
  clearStepUpCookie(res);
};

exports.checkUsername = catchAsync(async (req, res) => {
  const result = await AuthService.checkUsername(req.query.username);
  res.json(result);
});

exports.requestOtp = catchAsync(async (req, res) => {
  const payload = await AuthService.requestOtp(req.body.email);
  res.json(payload);
});

exports.verifyOtp = catchAsync(async (req, res) => {
  const payload = await AuthService.verifyOtp({
    email: req.body.email,
    otp: req.body.otp,
  });
  res.json(payload);
});

exports.register = catchAsync(async (req, res) => {
  const payload = await AuthService.register({
    ...req.body,
    sessionMeta: {
      deviceName: req.body?.deviceName || "",
      ip: req.ip || req.headers["x-forwarded-for"] || "",
      userAgent: req.headers["user-agent"] || "",
      headers: req.headers,
    },
  });
  if (!payload?.stepUpToken) {
    payload.clearStepUp = true;
  }
  applyAuthCookies(res, payload);
  res.status(201).json(payload);
});

exports.login = catchAsync(async (req, res) => {
  const payload = await AuthService.login({
    email: req.body.email,
    password: req.body.password,
    sessionMeta: {
      deviceName: req.body?.deviceName || "",
      ip: req.ip || req.headers["x-forwarded-for"] || "",
      userAgent: req.headers["user-agent"] || "",
      headers: req.headers,
    },
  });
  if (!payload?.challengeRequired) {
    if (!payload?.stepUpToken) {
      payload.clearStepUp = true;
    }
    applyAuthCookies(res, payload);
  }
  res.json(payload);
});

exports.refresh = catchAsync(async (req, res) => {
  const refreshToken =
    req.body?.token ||
    getCookieValue(req.headers.cookie || "", REFRESH_COOKIE_NAME);
  const payload = await AuthService.refreshSession({ refreshToken });
  applyAuthCookies(res, payload);
  res.json(payload);
});

exports.verifyAuthChallenge = catchAsync(async (req, res) => {
  const payload = await AuthService.verifyAuthChallenge({
    challengeToken: req.body?.challengeToken,
    code: req.body?.code,
  });
  applyAuthCookies(res, payload);
  res.json(payload);
});

exports.getProfile = catchAsync(async (req, res) => {
  res.set("Cache-Control", "no-store");
  const user = await AuthService.getProfile(req.user.id);
  await ensureOnboardingReminderMessage({
    userId: req.user.id,
    io: req.app.get("io"),
    onlineUsers: req.app.get("onlineUsers"),
  }).catch((error) => {
    console.error("Onboarding reminder failed:", error);
  });
  res.json({ user });
});

exports.requestEmailVerification = catchAsync(async (req, res) => {
  const payload = await AuthService.requestEmailVerification({
    userId: req.user?.id,
    email: req.body?.email,
  });
  res.json(payload);
});

exports.confirmEmailVerification = catchAsync(async (req, res) => {
  const payload = await AuthService.confirmEmailVerification(req.query?.token);
  res.json(payload);
});

exports.forgotPassword = catchAsync(async (req, res) => {
  const payload = await AuthService.forgotPassword(req.body?.email);
  res.json(payload);
});

exports.resetPassword = catchAsync(async (req, res) => {
  const payload = await AuthService.resetPassword({
    token: req.body?.token,
    newPassword: req.body?.newPassword,
  });
  disconnectUserSockets(req.app, payload.userId, {
    code: "PASSWORD_RESET",
    message: "Your password was reset. Please login again.",
  });
  clearAuthCookies(res);
  res.json({ success: true });
});

exports.changePassword = catchAsync(async (req, res) => {
  const payload = await AuthService.changePassword({
    userId: req.user.id,
    oldPassword: req.body?.oldPassword,
    newPassword: req.body?.newPassword,
  });
  disconnectUserSockets(req.app, payload.userId, {
    code: "PASSWORD_CHANGED",
    message: "Your password changed. Please login again.",
  });
  clearAuthCookies(res);
  res.json({ success: true });
});

exports.getMfaStatus = catchAsync(async (req, res) => {
  const payload = await AuthService.getMfaStatus(req.user.id);
  res.json(payload);
});

exports.beginTwoFactorSetup = catchAsync(async (req, res) => {
  const payload = await AuthService.beginTwoFactorSetup({ userId: req.user.id });
  res.json(payload);
});

exports.verifyTwoFactorSetup = catchAsync(async (req, res) => {
  const payload = await AuthService.verifyTwoFactorSetup({
    userId: req.user.id,
    code: req.body?.code,
  });
  res.json(payload);
});

exports.enableEmailTwoFactor = catchAsync(async (req, res) => {
  const payload = await AuthService.enableEmailTwoFactor({
    userId: req.user.id,
  });
  res.json(payload);
});

exports.disableTwoFactor = catchAsync(async (req, res) => {
  const payload = await AuthService.disableTwoFactor({
    userId: req.user.id,
    password: req.body?.password,
    code: req.body?.code,
  });
  clearStepUpCookie(res);
  res.json(payload);
});

exports.verifyStepUp = catchAsync(async (req, res) => {
  const payload = await AuthService.verifyStepUp({
    userId: req.user.id,
    sessionId: req.user.sessionId || "",
    code: req.body?.code,
    challengeToken: req.body?.challengeToken,
  });
  applyAuthCookies(res, payload);
  if (payload?.stepUpToken) {
    res.json({ success: true });
    return;
  }
  res.json(payload);
});

exports.listSessions = catchAsync(async (req, res) => {
  const payload = await AuthService.listSessions(req.user.id);
  res.json({ data: payload });
});

exports.revokeSession = catchAsync(async (req, res) => {
  const sessionId = req.params.sessionId || req.user.sessionId || "";
  if (!sessionId) {
    res.status(400).json({ error: "Session id is required" });
    return;
  }
  const payload = await AuthService.revokeSession({
    userId: req.user.id,
    sessionId,
  });
  disconnectSessionSockets(req.app, payload.sessionId, {
    code: "SESSION_REVOKED",
    message: "This session was logged out.",
  });
  if (!req.params.sessionId || sessionId === req.user.sessionId) {
    clearAuthCookies(res);
  }
  res.json({ success: true });
});

exports.revokeAllSessions = catchAsync(async (req, res) => {
  const payload = await AuthService.revokeAllSessions({
    userId: req.user.id,
    exceptSessionId: req.user.sessionId || "",
  });
  disconnectUserSessionsExcept(req.app, payload.userId, payload.exceptSessionId, {
    code: "SESSIONS_REVOKED",
    message: "Your other sessions were logged out.",
  });
  res.json({ success: true });
});
