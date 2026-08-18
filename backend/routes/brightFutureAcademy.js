const express = require("express");
const rateLimit = require("express-rate-limit");

const {
  BrightFutureError,
  NIGERIAN_STATES,
  SUBJECT_DEFINITIONS,
  getCompetitionConfig,
  getExamState,
  getLeaderboard,
  getParticipantById,
  getResult,
  listPublicParticipants,
  loginParticipant,
  recordViolation,
  registerParticipant,
  serializeCandidate,
  serializePublicConfig,
  startExam,
  submitAnswer,
  submitExam,
  updateParticipantProfile,
  verifyCandidateToken,
} = require("../services/brightFutureAcademyService");
const { BRIGHT_FUTURE_CLASS_LEVELS } = require("../models/BrightFutureParticipant");

const router = express.Router();

const createLimiter = (max, message) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: message, code: "rate_limit_exceeded" },
});
const registrationLimiter = createLimiter(10, "Too many registration attempts. Please wait and try again.");
const loginLimiter = createLimiter(20, "Too many sign-in attempts. Please wait and try again.");
const examStartLimiter = createLimiter(20, "Too many examination start requests. Please wait.");
const examActionLimiter = createLimiter(180, "Too many examination requests. Please slow down.");
const resultLimiter = createLimiter(60, "Too many result requests. Please wait.");

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const candidateAuth = asyncRoute(async (req, _res, next) => {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    throw new BrightFutureError("Candidate access is required.", { status: 401, code: "candidate_session_required" });
  }
  req.brightFutureCandidate = verifyCandidateToken(token);
  next();
});

router.get("/settings", asyncRoute(async (_req, res) => {
  const competition = await getCompetitionConfig();
  res.set("Cache-Control", "no-store").json({
    competition: serializePublicConfig(competition),
    classLevels: BRIGHT_FUTURE_CLASS_LEVELS,
    states: NIGERIAN_STATES,
    subjects: SUBJECT_DEFINITIONS,
  });
}));

router.post("/register", registrationLimiter, asyncRoute(async (req, res) => {
  const result = await registerParticipant(req.body, {
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });
  res.status(201).set("Cache-Control", "no-store").json(result);
}));

router.post("/login", loginLimiter, asyncRoute(async (req, res) => {
  const result = await loginParticipant(req.body);
  res.set("Cache-Control", "no-store").json(result);
}));

router.get("/profile", candidateAuth, asyncRoute(async (req, res) => {
  const participant = await getParticipantById(req.brightFutureCandidate.participantId);
  res.set("Cache-Control", "no-store").json({ candidate: serializeCandidate(participant) });
}));

router.patch("/profile", candidateAuth, asyncRoute(async (req, res) => {
  const candidate = await updateParticipantProfile(req.brightFutureCandidate.participantId, req.body);
  res.set("Cache-Control", "no-store").json({ candidate });
}));

router.post("/exam/start", candidateAuth, examStartLimiter, asyncRoute(async (req, res) => {
  res.set("Cache-Control", "no-store").json(await startExam(req.brightFutureCandidate.participantId));
}));

router.get("/exam/question", candidateAuth, examActionLimiter, asyncRoute(async (req, res) => {
  res.set("Cache-Control", "no-store").json(await getExamState(req.brightFutureCandidate.participantId));
}));

router.post("/exam/answer", candidateAuth, examActionLimiter, asyncRoute(async (req, res) => {
  res.set("Cache-Control", "no-store").json(await submitAnswer(req.brightFutureCandidate.participantId, req.body));
}));

router.post("/exam/violation", candidateAuth, examActionLimiter, asyncRoute(async (req, res) => {
  res.set("Cache-Control", "no-store").json(await recordViolation(req.brightFutureCandidate.participantId, req.body));
}));

router.post("/exam/submit", candidateAuth, examActionLimiter, asyncRoute(async (req, res) => {
  res.set("Cache-Control", "no-store").json(await submitExam(req.brightFutureCandidate.participantId, { reason: req.body?.reason || "student_submit" }));
}));

router.get("/result", candidateAuth, resultLimiter, asyncRoute(async (req, res) => {
  res.set("Cache-Control", "no-store").json({ result: await getResult(req.brightFutureCandidate.participantId) });
}));

router.get("/leaderboard", asyncRoute(async (req, res) => {
  res.set("Cache-Control", "public, max-age=30").json(await getLeaderboard(req.query));
}));

router.get("/participants", asyncRoute(async (req, res) => {
  res.set("Cache-Control", "public, max-age=30").json(await listPublicParticipants(req.query));
}));

router.use((error, _req, res, next) => {
  if (error?.name === "VersionError") {
    return res.status(409).json({
      error: "The examination changed in another session. Restoring the latest saved state.",
      message: "The examination changed in another session. Restoring the latest saved state.",
      code: "attempt_changed",
    });
  }
  if (!(error instanceof BrightFutureError)) return next(error);
  return res.status(error.status || 400).json({
    error: error.message,
    message: error.message,
    code: error.code,
    ...(error.payload || {}),
  });
});

module.exports = router;
