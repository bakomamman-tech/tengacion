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
    emailOrUsername: req.body.emailOrUsername,
    password: req.body.password,
  });
  res.json(payload);
});

exports.getProfile = catchAsync(async (req, res) => {
  const user = await AuthService.getProfile(req.user.id);
  res.json(user);
});
