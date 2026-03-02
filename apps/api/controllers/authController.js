const AuthService = require("../services/authService");
const catchAsync = require("../utils/catchAsync");

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
  const payload = await AuthService.register(req.body);
  res.status(201).json(payload);
});

exports.login = catchAsync(async (req, res) => {
  const payload = await AuthService.login({
    emailOrUsername: req.body.emailOrUsername || req.body.email || req.body.username,
    password: req.body.password,
    sessionMeta: {
      deviceName: req.body?.deviceName || "",
      ip: req.ip || req.headers["x-forwarded-for"] || "",
      userAgent: req.headers["user-agent"] || "",
    },
  });
  res.json(payload);
});

exports.getProfile = catchAsync(async (req, res) => {
  const user = await AuthService.getProfile(req.user.id);
  res.json(user);
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
  res.json(payload);
});

exports.changePassword = catchAsync(async (req, res) => {
  const payload = await AuthService.changePassword({
    userId: req.user.id,
    oldPassword: req.body?.oldPassword,
    newPassword: req.body?.newPassword,
  });
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
  res.json(payload);
});

exports.revokeAllSessions = catchAsync(async (req, res) => {
  const payload = await AuthService.revokeAllSessions({
    userId: req.user.id,
    exceptSessionId: req.user.sessionId || "",
  });
  res.json(payload);
});
