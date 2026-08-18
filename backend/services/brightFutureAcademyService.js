const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const { config: environment } = require("../config/env");
const { QUESTIONS, SUBJECT_DEFINITIONS } = require("../data/brightFutureQuestionBank");
const BrightFutureCompetitionConfig = require("../models/BrightFutureCompetitionConfig");
const BrightFutureCounter = require("../models/BrightFutureCounter");
const BrightFutureExamAttempt = require("../models/BrightFutureExamAttempt");
const BrightFutureParticipant = require("../models/BrightFutureParticipant");
const BrightFutureQuestion = require("../models/BrightFutureQuestion");
const { BRIGHT_FUTURE_CLASS_LEVELS } = require("../models/BrightFutureParticipant");

const COMPETITION_KEY = "default";
const CANDIDATE_TOKEN_AUDIENCE = "bright-future-academy";
const CANDIDATE_TOKEN_ISSUER = "tengacion";
const COMPLETED_ATTEMPT_STATUSES = ["completed", "auto_submitted"];
const ANSWER_TRANSPORT_GRACE_MS = 1_500;
const SUBJECT_SCORE_KEYS = Object.freeze({
  mathematics: "mathematics",
  english: "english",
  basic_science_technology: "basicScienceTechnology",
  social_studies: "socialStudies",
});
const NIGERIAN_STATES = new Set([
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Federal Capital Territory",
  "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers",
  "Sokoto", "Taraba", "Yobe", "Zamfara",
]);
const NAME_PATTERN = /^[\p{L}][\p{L}' -]*$/u;

class BrightFutureError extends Error {
  constructor(message, { status = 400, code = "bright_future_error", payload = null } = {}) {
    super(message);
    this.name = "BrightFutureError";
    this.status = status;
    this.statusCode = status;
    this.code = code;
    this.payload = payload;
    this.isOperational = true;
  }
}

const cleanText = (value = "", maxLength = 160) =>
  String(value || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);

const normalizePhone = (value = "") => {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length === 13) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+234${digits.slice(1)}`;
  if (digits.length >= 7 && digits.length <= 15) return `+${digits}`;
  return "";
};

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeCandidateId = (value = "") => cleanText(value, 30).toUpperCase();
const participantFullName = (participant = {}) =>
  [participant.firstName, participant.middleName, participant.lastName].filter(Boolean).join(" ");
const publicDisplayName = (participant = {}) =>
  `${cleanText(participant.firstName, 50)} ${cleanText(participant.lastName, 50).slice(0, 1)}.`.trim();
const maskCandidateId = (candidateId = "") => {
  const value = String(candidateId || "");
  return value.length > 4 ? `${value.slice(0, -4)}••${value.slice(-2)}` : value;
};
const toId = (value) => String(value?._id || value || "");
const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const randomShuffle = (items = []) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const buildValidationError = (details) =>
  new BrightFutureError("Please correct the highlighted registration details.", {
    status: 422,
    code: "validation_failed",
    payload: { details },
  });

const validateProfile = (payload = {}) => {
  const data = {
    firstName: cleanText(payload.firstName, 50),
    middleName: cleanText(payload.middleName, 50),
    lastName: cleanText(payload.lastName, 50),
    gender: cleanText(payload.gender, 20).toLowerCase(),
    classLevel: cleanText(payload.classLevel, 30),
    schoolName: cleanText(payload.schoolName, 160),
    state: cleanText(payload.state, 80),
    lga: cleanText(payload.lga, 100),
    age: Number(payload.age),
    guardianPhone: normalizePhone(payload.guardianPhone),
    studentPhone: payload.studentPhone ? normalizePhone(payload.studentPhone) : "",
  };
  const details = {};
  for (const field of ["firstName", "lastName"]) {
    if (data[field].length < 2 || !NAME_PATTERN.test(data[field])) {
      details[field] = "Use 2–50 letters; spaces, hyphens and apostrophes are allowed.";
    }
  }
  if (data.middleName && (data.middleName.length < 2 || !NAME_PATTERN.test(data.middleName))) {
    details.middleName = "Use letters, spaces, hyphens or apostrophes.";
  }
  if (!["female", "male"].includes(data.gender)) details.gender = "Choose a gender.";
  if (!BRIGHT_FUTURE_CLASS_LEVELS.includes(data.classLevel)) details.classLevel = "Choose a valid class.";
  if (data.schoolName.length < 2) details.schoolName = "Enter the school name.";
  if (!NIGERIAN_STATES.has(data.state)) details.state = "Choose a valid Nigerian state or the FCT.";
  if (data.lga.length < 2) details.lga = "Enter the Local Government Area.";
  if (!Number.isInteger(data.age) || data.age < 5 || data.age > 20) details.age = "Age must be from 5 to 20.";
  if (!data.guardianPhone) details.guardianPhone = "Enter a valid parent or guardian phone number.";
  if (payload.studentPhone && !data.studentPhone) details.studentPhone = "Enter a valid phone number or leave it blank.";
  if (Object.keys(details).length) throw buildValidationError(details);
  return data;
};

const secureDigest = (value = "") =>
  crypto.createHmac("sha256", environment.JWT_SECRET).update(String(value)).digest("hex");

const safePhoneMatches = (left = "", right = "") => {
  const leftDigest = Buffer.from(secureDigest(left));
  const rightDigest = Buffer.from(secureDigest(right));
  return leftDigest.length === rightDigest.length && crypto.timingSafeEqual(leftDigest, rightDigest);
};

const issueCandidateToken = (participant) =>
  jwt.sign(
    { participantId: toId(participant), candidateId: participant.candidateId, scope: "bright_future_candidate" },
    environment.JWT_SECRET,
    { audience: CANDIDATE_TOKEN_AUDIENCE, issuer: CANDIDATE_TOKEN_ISSUER, expiresIn: "8h" }
  );

const verifyCandidateToken = (token = "") => {
  try {
    const decoded = jwt.verify(token, environment.JWT_SECRET, {
      audience: CANDIDATE_TOKEN_AUDIENCE,
      issuer: CANDIDATE_TOKEN_ISSUER,
    });
    if (decoded.scope !== "bright_future_candidate" || !mongoose.Types.ObjectId.isValid(decoded.participantId)) {
      throw new Error("Invalid candidate scope");
    }
    return decoded;
  } catch (_error) {
    throw new BrightFutureError("Your candidate session has expired. Sign in again.", {
      status: 401,
      code: "candidate_session_invalid",
    });
  }
};

const getCompetitionConfig = async () =>
  BrightFutureCompetitionConfig.findOneAndUpdate(
    { key: COMPETITION_KEY },
    { $setOnInsert: { key: COMPETITION_KEY } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );

const serializePublicConfig = (entry) => ({
  competitionStatus: entry.competitionStatus,
  registrationOpen: Boolean(entry.registrationOpen),
  examinationOpen: Boolean(entry.examinationOpen),
  leaderboardVisible: Boolean(entry.leaderboardVisible),
  winnerVisible: Boolean(entry.winnerVisible),
  detailedResultsVisible: Boolean(entry.detailedResultsVisible),
  questionTimerSeconds: Number(entry.questionTimerSeconds || 50),
  allowedViolations: Number(entry.allowedViolations || 3),
});

const ensureQuestionBankSeeded = async () => {
  const operations = QUESTIONS.map((question) => ({
    updateOne: {
      filter: { questionId: question.questionId },
      update: { $setOnInsert: question },
      upsert: true,
    },
  }));
  await BrightFutureQuestion.bulkWrite(operations, { ordered: false });
  return BrightFutureQuestion.find({}).sort({ subject: 1, order: 1 });
};

const nextCandidateId = async (now = new Date()) => {
  const year = now.getUTCFullYear();
  const counter = await BrightFutureCounter.findOneAndUpdate(
    { key: `bfa-${year}` },
    { $inc: { sequence: 1 } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );
  return `BFA-${year}-${String(counter.sequence).padStart(6, "0")}`;
};

const serializeCandidate = (participant) => ({
  id: toId(participant),
  candidateId: participant.candidateId,
  firstName: participant.firstName,
  middleName: participant.middleName || "",
  lastName: participant.lastName,
  fullName: participantFullName(participant),
  gender: participant.gender,
  age: participant.age,
  classLevel: participant.classLevel,
  schoolName: participant.schoolName,
  state: participant.state,
  lga: participant.lga,
  registrationTimestamp: participant.registrationTimestamp,
  status: participant.status,
  competitionStatus: participant.competitionStatus,
  examStarted: Boolean(participant.examStarted),
  examCompleted: Boolean(participant.examCompleted),
  resultAvailable: Boolean(participant.examCompleted),
  ranking: participant.ranking || null,
});

const registerParticipant = async (payload, { ip = "", userAgent = "", now = new Date() } = {}) => {
  const competition = await getCompetitionConfig();
  if (!competition.registrationOpen) {
    throw new BrightFutureError("Registration is not open at the moment.", { status: 403, code: "registration_closed" });
  }
  const data = validateProfile(payload);
  const duplicateKey = secureDigest([
    data.firstName.toLowerCase(), data.lastName.toLowerCase(), data.guardianPhone, data.schoolName.toLowerCase(),
  ].join("|"));
  const existing = await BrightFutureParticipant.findOne({ duplicateKey }).select("+duplicateKey");
  if (existing) {
    throw new BrightFutureError("A matching registration already exists. Use Returning Student access instead.", {
      status: 409,
      code: "duplicate_registration",
    });
  }
  const candidateId = await nextCandidateId(now);
  try {
    const participant = await BrightFutureParticipant.create({
      ...data,
      candidateId,
      duplicateKey,
      registrationTimestamp: now,
      registrationMetadata: {
        ipHash: ip ? secureDigest(ip) : "",
        userAgent: cleanText(userAgent, 240),
      },
    });
    return {
      candidate: serializeCandidate(participant),
      candidateToken: issueCandidateToken(participant),
      competition: serializePublicConfig(competition),
    };
  } catch (error) {
    if (error?.code === 11000) {
      throw new BrightFutureError("A matching registration already exists. Use Returning Student access instead.", {
        status: 409,
        code: "duplicate_registration",
      });
    }
    throw error;
  }
};

const loginParticipant = async ({ candidateId, guardianPhone } = {}) => {
  const normalizedId = normalizeCandidateId(candidateId);
  const normalizedPhone = normalizePhone(guardianPhone);
  if (!/^BFA-\d{4}-\d{6}$/.test(normalizedId) || !normalizedPhone) {
    throw new BrightFutureError("Enter a valid Candidate ID and guardian phone number.", { status: 422, code: "invalid_login" });
  }
  const participant = await BrightFutureParticipant.findOne({ candidateId: normalizedId }).select("+guardianPhone");
  if (!participant || !safePhoneMatches(participant.guardianPhone, normalizedPhone)) {
    throw new BrightFutureError("Candidate ID or guardian phone number is incorrect.", { status: 401, code: "invalid_candidate_credentials" });
  }
  if (participant.status !== "active") {
    throw new BrightFutureError("This candidate account is not currently active. Contact the competition administrator.", {
      status: 403,
      code: "candidate_disabled",
    });
  }
  return {
    candidate: serializeCandidate(participant),
    candidateToken: issueCandidateToken(participant),
    competition: serializePublicConfig(await getCompetitionConfig()),
  };
};

const getParticipantById = async (participantId) => {
  const participant = await BrightFutureParticipant.findById(participantId);
  if (!participant) throw new BrightFutureError("Candidate record was not found.", { status: 404, code: "candidate_not_found" });
  if (participant.status !== "active") throw new BrightFutureError("This candidate account is disabled.", { status: 403, code: "candidate_disabled" });
  return participant;
};

const updateParticipantProfile = async (participantId, payload = {}) => {
  const participant = await BrightFutureParticipant.findById(participantId).select("+guardianPhone +studentPhone +duplicateKey");
  if (!participant) throw new BrightFutureError("Candidate record was not found.", { status: 404, code: "candidate_not_found" });
  if (participant.status !== "active") throw new BrightFutureError("This candidate account is disabled.", { status: 403, code: "candidate_disabled" });
  if (participant.examStarted) {
    throw new BrightFutureError("Profile details are locked after the examination begins.", { status: 409, code: "profile_locked" });
  }
  const current = participant.toObject();
  const data = validateProfile({
    ...current,
    ...payload,
    guardianPhone: current.guardianPhone || payload.guardianPhone,
  });
  for (const field of ["firstName", "middleName", "lastName", "gender", "age", "classLevel", "schoolName", "state", "lga", "studentPhone"]) {
    participant[field] = data[field];
  }
  participant.duplicateKey = secureDigest([
    data.firstName.toLowerCase(), data.lastName.toLowerCase(), participant.guardianPhone, data.schoolName.toLowerCase(),
  ].join("|"));
  await participant.save();
  return serializeCandidate(participant);
};

const buildAttemptQuestions = (questionDocs) => {
  const labelBySubject = new Map(SUBJECT_DEFINITIONS.map((entry) => [entry.key, entry.label]));
  let order = 0;
  return SUBJECT_DEFINITIONS.flatMap((subject) => {
    const source = randomShuffle(questionDocs.filter((question) => question.subject === subject.key));
    if (source.length !== 10) {
      throw new BrightFutureError(`The ${subject.label} question bank is not ready.`, {
        status: 503,
        code: "question_bank_unavailable",
      });
    }
    return source.map((question) => {
      order += 1;
      const optionOrder = randomShuffle([0, 1, 2, 3, 4]);
      return {
        questionId: question.questionId,
        subject: question.subject,
        subjectLabel: labelBySubject.get(question.subject),
        prompt: question.prompt,
        options: optionOrder.map((index) => question.options[index]),
        correctPresentedIndex: optionOrder.indexOf(question.correctIndex),
        order,
      };
    });
  });
};

const secureAttemptQuery = (query) =>
  query.select("+questions.correctPresentedIndex +questions.correct +questions.idempotencyKey");

const currentQuestionPayload = (attempt, now = new Date()) => {
  if (attempt.status !== "in_progress" || attempt.currentQuestionIndex >= attempt.questions.length) return null;
  const question = attempt.questions[attempt.currentQuestionIndex];
  const millisecondsRemaining = Math.max(0, new Date(question.deadlineAt).getTime() - now.getTime());
  return {
    id: question.questionId,
    subject: question.subject,
    subjectLabel: question.subjectLabel,
    number: question.order,
    subjectQuestionNumber: ((question.order - 1) % 10) + 1,
    totalQuestions: 40,
    prompt: question.prompt,
    options: question.options,
    presentedAt: question.presentedAt,
    deadlineAt: question.deadlineAt,
    secondsRemaining: Math.ceil(millisecondsRemaining / 1000),
  };
};

const serializeAttempt = (attempt, now = new Date()) => ({
  id: toId(attempt),
  status: attempt.status,
  attemptNumber: attempt.attemptNumber,
  currentQuestionIndex: attempt.currentQuestionIndex,
  answeredCount: attempt.questions.filter((question) => question.answeredAt || question.unanswered).length,
  totalQuestions: 40,
  progressPercentage: Math.round((attempt.currentQuestionIndex / 40) * 100),
  violationCount: attempt.violationCount,
  allowedViolations: attempt.allowedViolations,
  startedAt: attempt.startedAt,
  serverNow: now,
  currentQuestion: currentQuestionPayload(attempt, now),
  completedAt: attempt.completedAt,
  submissionReason: attempt.submissionReason,
});

const rankingTuple = (participant) => [
  Number(participant.totalScore || 0),
  Number(participant.subjectScores?.mathematics || 0),
  Number(participant.subjectScores?.english || 0),
  Number(participant.totalTimeUsed || 0),
];
const sameRankTuple = (left, right) =>
  left && right && left[0] === right[0] && left[1] === right[1] && left[2] === right[2] && left[3] === right[3];

const recalculateRankings = async () => {
  const participants = await BrightFutureParticipant.find({ status: "active", examCompleted: true })
    .sort({ totalScore: -1, "subjectScores.mathematics": -1, "subjectScores.english": -1, totalTimeUsed: 1, examCompletedAt: 1 });
  let previousTuple = null;
  let currentRank = 0;
  const ranked = participants.map((participant, index) => {
    const tuple = rankingTuple(participant);
    if (!sameRankTuple(tuple, previousTuple)) currentRank = index + 1;
    previousTuple = tuple;
    return { participant, rank: currentRank, tuple };
  });
  const leaders = ranked.filter((entry) => entry.rank === 1);
  const competition = await getCompetitionConfig();
  const winnerLabel = competition.competitionStatus === "results_published" ? "champion" : "leader";
  if (ranked.length) {
    await BrightFutureParticipant.bulkWrite(ranked.map(({ participant, rank }) => ({
      updateOne: {
        filter: { _id: participant._id },
        update: {
          $set: {
            ranking: rank,
            winnerStatus: rank === 1 ? (leaders.length > 1 ? "tied" : winnerLabel) : "none",
          },
        },
      },
    })));
    await BrightFutureExamAttempt.bulkWrite(ranked.map(({ participant, rank }) => ({
      updateOne: { filter: { _id: participant.latestAttemptId }, update: { $set: { rank } } },
    })));
  }
  return ranked;
};

const finalizeAttempt = async (attempt, participant, reason, now = new Date()) => {
  if (COMPLETED_ATTEMPT_STATUSES.includes(attempt.status)) return attempt;
  for (let index = attempt.currentQuestionIndex; index < attempt.questions.length; index += 1) {
    const question = attempt.questions[index];
    if (!question.answeredAt && !question.unanswered) {
      question.unanswered = true;
      question.timedOut = reason === "time_expired";
      question.responseTimeMs = question.presentedAt
        ? Math.min(attempt.timerSeconds * 1000, Math.max(0, now.getTime() - new Date(question.presentedAt).getTime()))
        : 0;
    }
  }
  const scores = { mathematics: 0, english: 0, basicScienceTechnology: 0, socialStudies: 0 };
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalUnanswered = 0;
  let totalResponseMs = 0;
  for (const question of attempt.questions) {
    if (question.unanswered || question.selectedPresentedIndex === null || question.selectedPresentedIndex === undefined) {
      totalUnanswered += 1;
    } else if (question.correct) {
      totalCorrect += 1;
      scores[SUBJECT_SCORE_KEYS[question.subject]] += 1;
    } else {
      totalWrong += 1;
    }
    totalResponseMs += Number(question.responseTimeMs || 0);
  }
  attempt.status = reason === "violation_limit" ? "auto_submitted" : "completed";
  attempt.currentQuestionIndex = 40;
  attempt.completedAt = now;
  attempt.submissionReason = reason;
  attempt.subjectScores = scores;
  attempt.totalScore = totalCorrect;
  attempt.percentage = Math.round((totalCorrect / 40) * 10000) / 100;
  attempt.totalCorrect = totalCorrect;
  attempt.totalWrong = totalWrong;
  attempt.totalUnanswered = totalUnanswered;
  attempt.totalTimeUsed = Math.round(totalResponseMs / 1000);
  attempt.averageResponseTime = Math.round((totalResponseMs / 40 / 1000) * 100) / 100;
  await attempt.save();

  participant.examCompleted = true;
  participant.examCompletedAt = now;
  participant.competitionStatus = attempt.status === "auto_submitted" ? "auto_submitted" : "completed";
  participant.subjectScores = scores;
  participant.totalScore = attempt.totalScore;
  participant.percentage = attempt.percentage;
  participant.totalCorrect = totalCorrect;
  participant.totalWrong = totalWrong;
  participant.totalUnanswered = totalUnanswered;
  participant.totalTimeUsed = attempt.totalTimeUsed;
  participant.averageResponseTime = attempt.averageResponseTime;
  participant.violationCount = attempt.violationCount;
  participant.violationEvents = attempt.violationEvents;
  participant.submissionReason = reason;
  participant.retakeAuthorized = false;
  await participant.save();
  await recalculateRankings();
  const refreshed = await BrightFutureExamAttempt.findById(attempt._id);
  return refreshed || attempt;
};

const settleExpiredAttempt = async (attempt, participant, now = new Date()) => {
  if (attempt.status !== "in_progress") return attempt;
  let changed = false;
  while (attempt.currentQuestionIndex < attempt.questions.length) {
    const question = attempt.questions[attempt.currentQuestionIndex];
    if (!question.deadlineAt || new Date(question.deadlineAt).getTime() > now.getTime()) break;
    const previousDeadline = new Date(question.deadlineAt);
    question.unanswered = true;
    question.timedOut = true;
    question.responseTimeMs = attempt.timerSeconds * 1000;
    attempt.currentQuestionIndex += 1;
    changed = true;
    if (attempt.currentQuestionIndex < attempt.questions.length) {
      const next = attempt.questions[attempt.currentQuestionIndex];
      next.presentedAt = previousDeadline;
      next.deadlineAt = new Date(previousDeadline.getTime() + attempt.timerSeconds * 1000);
    }
  }
  if (attempt.currentQuestionIndex >= attempt.questions.length) {
    return finalizeAttempt(attempt, participant, "time_expired", now);
  }
  if (changed) await attempt.save();
  return attempt;
};

const loadLatestAttempt = async (participant) => {
  if (!participant.latestAttemptId) return null;
  return secureAttemptQuery(BrightFutureExamAttempt.findById(participant.latestAttemptId));
};

const startExam = async (participantId, { now = new Date() } = {}) => {
  const participant = await getParticipantById(participantId);
  const competition = await getCompetitionConfig();
  if (!competition.examinationOpen) {
    throw new BrightFutureError("The examination is not open at the moment.", { status: 403, code: "examination_closed" });
  }
  let existing = await loadLatestAttempt(participant);
  if (existing?.status === "in_progress") {
    existing = await settleExpiredAttempt(existing, participant, now);
    return { attempt: serializeAttempt(existing, now), candidate: serializeCandidate(participant) };
  }
  if (participant.examCompleted && !participant.retakeAuthorized) {
    throw new BrightFutureError("This official examination has already been completed.", { status: 409, code: "attempt_completed" });
  }
  if (participant.examStarted && !participant.retakeAuthorized) {
    throw new BrightFutureError("This candidate has already used the official attempt.", { status: 409, code: "attempt_already_used" });
  }
  const questions = await ensureQuestionBankSeeded();
  const activeQuestions = questions.filter((question) => question.active);
  const attemptQuestions = buildAttemptQuestions(activeQuestions);
  attemptQuestions[0].presentedAt = now;
  attemptQuestions[0].deadlineAt = new Date(now.getTime() + competition.questionTimerSeconds * 1000);
  const attemptNumber = Math.max(1, Number(participant.attemptNumber || 0) + 1);
  let attempt;
  try {
    attempt = await BrightFutureExamAttempt.create({
      participantId: participant._id,
      candidateId: participant.candidateId,
      attemptNumber,
      questions: attemptQuestions,
      timerSeconds: competition.questionTimerSeconds,
      allowedViolations: competition.allowedViolations,
      startedAt: now,
    });
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }
    attempt = await secureAttemptQuery(
      BrightFutureExamAttempt.findOne({ participantId: participant._id, attemptNumber })
    );
    if (!attempt) {
      throw new BrightFutureError("The examination is already being opened in another session. Try resuming it.", {
        status: 409,
        code: "attempt_start_conflict",
      });
    }
  }
  participant.examStarted = true;
  participant.examStartedAt = now;
  participant.examCompleted = false;
  participant.examCompletedAt = null;
  participant.attemptNumber = attemptNumber;
  participant.latestAttemptId = attempt._id;
  participant.competitionStatus = "in_progress";
  participant.retakeAuthorized = false;
  await participant.save();
  return { attempt: serializeAttempt(attempt, now), candidate: serializeCandidate(participant) };
};

const getExamState = async (participantId, { now = new Date() } = {}) => {
  const participant = await getParticipantById(participantId);
  let attempt = await loadLatestAttempt(participant);
  if (!attempt) throw new BrightFutureError("Start the examination before requesting a question.", { status: 409, code: "exam_not_started" });
  attempt = await settleExpiredAttempt(attempt, participant, now);
  return { attempt: serializeAttempt(attempt, now), candidate: serializeCandidate(participant) };
};

const submitAnswer = async (participantId, { questionId, selectedOptionIndex, idempotencyKey }, { now = new Date() } = {}) => {
  const participant = await getParticipantById(participantId);
  let attempt = await loadLatestAttempt(participant);
  if (!attempt) throw new BrightFutureError("No examination attempt was found.", { status: 404, code: "attempt_not_found" });
  const previousMatch = attempt.questions.find((question) => question.idempotencyKey && question.idempotencyKey === cleanText(idempotencyKey, 100));
  if (previousMatch) return { attempt: serializeAttempt(attempt, now), accepted: true, idempotent: true };
  const pendingQuestion = attempt.status === "in_progress"
    ? attempt.questions[attempt.currentQuestionIndex]
    : null;
  const withinAnswerTransportGrace = pendingQuestion?.deadlineAt
    && now.getTime() <= new Date(pendingQuestion.deadlineAt).getTime() + ANSWER_TRANSPORT_GRACE_MS;
  if (!withinAnswerTransportGrace) {
    attempt = await settleExpiredAttempt(attempt, participant, now);
  }
  if (attempt.status !== "in_progress") return { attempt: serializeAttempt(attempt, now), accepted: false, completed: true };
  const question = attempt.questions[attempt.currentQuestionIndex];
  if (question.questionId !== cleanText(questionId, 80)) {
    throw new BrightFutureError("That question is no longer active. The latest question has been restored.", {
      status: 409,
      code: "question_changed",
      payload: { attempt: serializeAttempt(attempt, now) },
    });
  }
  const selectedIndex = Number(selectedOptionIndex);
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 4) {
    throw new BrightFutureError("Choose one of the five answer options.", { status: 422, code: "invalid_answer" });
  }
  question.selectedPresentedIndex = selectedIndex;
  question.answeredAt = now;
  question.correct = selectedIndex === question.correctPresentedIndex;
  question.unanswered = false;
  question.timedOut = false;
  question.idempotencyKey = cleanText(idempotencyKey || crypto.randomUUID(), 100);
  question.responseTimeMs = Math.min(
    attempt.timerSeconds * 1000,
    Math.max(0, now.getTime() - new Date(question.presentedAt).getTime())
  );
  const completedSubject = question.order % 10 === 0 ? question.subjectLabel : "";
  attempt.currentQuestionIndex += 1;
  if (attempt.currentQuestionIndex >= attempt.questions.length) {
    attempt = await finalizeAttempt(attempt, participant, "completed", now);
  } else {
    const next = attempt.questions[attempt.currentQuestionIndex];
    next.presentedAt = now;
    next.deadlineAt = new Date(now.getTime() + attempt.timerSeconds * 1000);
    await attempt.save();
  }
  return {
    attempt: serializeAttempt(attempt, now),
    accepted: true,
    subjectTransition: completedSubject
      ? { completedSubject, nextSubject: attempt.questions[attempt.currentQuestionIndex]?.subjectLabel || "" }
      : null,
  };
};

const recordViolation = async (participantId, payload = {}, { now = new Date() } = {}) => {
  const participant = await getParticipantById(participantId);
  let attempt = await loadLatestAttempt(participant);
  if (!attempt || attempt.status !== "in_progress") {
    return { attempt: attempt ? serializeAttempt(attempt, now) : null, recorded: false };
  }
  attempt = await settleExpiredAttempt(attempt, participant, now);
  if (attempt.status !== "in_progress") return { attempt: serializeAttempt(attempt, now), recorded: false };
  const event = {
    type: cleanText(payload.type || "window_focus_lost", 60),
    occurredAt: payload.occurredAt && !Number.isNaN(new Date(payload.occurredAt).getTime()) ? new Date(payload.occurredAt) : now,
    recordedAt: now,
    detail: cleanText(payload.detail, 240),
  };
  attempt.violationEvents.push(event);
  attempt.violationCount += 1;
  let autoSubmitted = false;
  if (attempt.violationCount >= attempt.allowedViolations) {
    attempt = await finalizeAttempt(attempt, participant, "violation_limit", now);
    autoSubmitted = true;
  } else {
    await attempt.save();
    participant.violationCount = attempt.violationCount;
    participant.violationEvents = attempt.violationEvents;
    await participant.save();
  }
  return {
    attempt: serializeAttempt(attempt, now),
    recorded: true,
    autoSubmitted,
    warningLevel: Math.min(attempt.violationCount, attempt.allowedViolations),
  };
};

const submitExam = async (participantId, { reason = "student_submit", now = new Date() } = {}) => {
  const participant = await getParticipantById(participantId);
  let attempt = await loadLatestAttempt(participant);
  if (!attempt) throw new BrightFutureError("No examination attempt was found.", { status: 404, code: "attempt_not_found" });
  attempt = await settleExpiredAttempt(attempt, participant, now);
  if (attempt.status === "in_progress") attempt = await finalizeAttempt(attempt, participant, cleanText(reason, 80), now);
  return { attempt: serializeAttempt(attempt, now), result: await getResult(participantId) };
};

const serializeResult = (participant, competition, attempt = null) => {
  const result = {
    candidate: serializeCandidate(participant),
    subjectScores: {
      mathematics: Number(participant.subjectScores?.mathematics || 0),
      english: Number(participant.subjectScores?.english || 0),
      basicScienceTechnology: Number(participant.subjectScores?.basicScienceTechnology || 0),
      socialStudies: Number(participant.subjectScores?.socialStudies || 0),
    },
    totalScore: participant.totalScore,
    maximumScore: 40,
    percentage: participant.percentage,
    totalCorrect: participant.totalCorrect,
    totalWrong: participant.totalWrong,
    totalUnanswered: participant.totalUnanswered,
    totalTimeUsed: participant.totalTimeUsed,
    averageResponseTime: participant.averageResponseTime,
    rank: participant.ranking,
    completedAt: participant.examCompletedAt,
    submissionReason: participant.submissionReason,
    detailedResultsVisible: Boolean(competition.detailedResultsVisible),
  };
  if (competition.detailedResultsVisible && attempt) {
    result.review = attempt.questions.map((question) => ({
      number: question.order,
      subjectLabel: question.subjectLabel,
      prompt: question.prompt,
      options: question.options,
      selectedOptionIndex: question.selectedPresentedIndex,
      correctOptionIndex: question.correctPresentedIndex,
      unanswered: question.unanswered,
    }));
  }
  return result;
};

async function getResult(participantId) {
  const participant = await getParticipantById(participantId);
  if (!participant.examCompleted) {
    throw new BrightFutureError("A result will be available after the examination is submitted.", { status: 409, code: "result_not_available" });
  }
  await recalculateRankings();
  const refreshed = await BrightFutureParticipant.findById(participantId);
  const competition = await getCompetitionConfig();
  const attempt = competition.detailedResultsVisible ? await loadLatestAttempt(refreshed) : null;
  return serializeResult(refreshed, competition, attempt);
}

const serializeLeaderboardEntry = (participant) => ({
  rank: participant.ranking,
  displayName: publicDisplayName(participant),
  candidateId: maskCandidateId(participant.candidateId),
  classLevel: participant.classLevel,
  schoolName: participant.schoolName,
  state: participant.state,
  score: participant.totalScore,
  percentage: participant.percentage,
  completionTime: participant.totalTimeUsed,
  winnerStatus: participant.winnerStatus,
});

const getLeaderboard = async ({ search = "", page = 1, limit = 25 } = {}) => {
  const competition = await getCompetitionConfig();
  if (!competition.leaderboardVisible) {
    throw new BrightFutureError("The competition leaderboard is not currently public.", { status: 403, code: "leaderboard_hidden" });
  }
  await recalculateRankings();
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = clamp(limit, 1, 100, 25);
  const query = { status: "active", examCompleted: true };
  const term = cleanText(search, 100);
  if (term) {
    const regex = new RegExp(escapeRegex(term), "i");
    query.$or = [{ firstName: regex }, { lastName: regex }, { candidateId: regex }, { schoolName: regex }];
  }
  const [participants, total] = await Promise.all([
    BrightFutureParticipant.find(query).sort({ ranking: 1 }).skip((safePage - 1) * safeLimit).limit(safeLimit),
    BrightFutureParticipant.countDocuments(query),
  ]);
  const leader = competition.winnerVisible
    ? await BrightFutureParticipant.findOne({ status: "active", examCompleted: true, ranking: 1 }).sort({ examCompletedAt: 1 })
    : null;
  return {
    competition: serializePublicConfig(competition),
    entries: participants.map(serializeLeaderboardEntry),
    leader: leader ? serializeLeaderboardEntry(leader) : null,
    total,
    page: safePage,
    pages: Math.max(1, Math.ceil(total / safeLimit)),
  };
};

const listPublicParticipants = async (filters = {}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = clamp(filters.limit, 1, 100, 24);
  const query = { status: "active" };
  if (BRIGHT_FUTURE_CLASS_LEVELS.includes(filters.classLevel)) query.classLevel = filters.classLevel;
  if (NIGERIAN_STATES.has(filters.state)) query.state = filters.state;
  if (filters.completed === "true" || filters.completed === true) query.examCompleted = true;
  if (filters.completed === "false" || filters.completed === false) query.examCompleted = false;
  if (filters.school) query.schoolName = new RegExp(escapeRegex(cleanText(filters.school, 100)), "i");
  const minScore = Number(filters.minScore);
  const maxScore = Number(filters.maxScore);
  if (Number.isFinite(minScore) || Number.isFinite(maxScore)) {
    query.totalScore = {};
    if (Number.isFinite(minScore)) query.totalScore.$gte = clamp(minScore, 0, 40, 0);
    if (Number.isFinite(maxScore)) query.totalScore.$lte = clamp(maxScore, 0, 40, 40);
  }
  const term = cleanText(filters.search, 100);
  if (term) {
    const regex = new RegExp(escapeRegex(term), "i");
    query.$or = [{ firstName: regex }, { lastName: regex }, { candidateId: regex }, { schoolName: regex }];
  }
  const [participants, total] = await Promise.all([
    BrightFutureParticipant.find(query).sort({ registrationTimestamp: -1 }).skip((page - 1) * limit).limit(limit),
    BrightFutureParticipant.countDocuments(query),
  ]);
  return {
    participants: participants.map((participant) => ({
      displayName: publicDisplayName(participant),
      candidateId: maskCandidateId(participant.candidateId),
      classLevel: participant.classLevel,
      schoolName: participant.schoolName,
      state: participant.state,
      completed: Boolean(participant.examCompleted),
      score: participant.examCompleted ? participant.totalScore : null,
      percentage: participant.examCompleted ? participant.percentage : null,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
};

const settleOverdueAttempts = async (now = new Date()) => {
  const attempts = await secureAttemptQuery(
    BrightFutureExamAttempt.find({ status: "in_progress", "questions.deadlineAt": { $lte: now } }).limit(100)
  );
  for (const attempt of attempts) {
    const participant = await BrightFutureParticipant.findById(attempt.participantId);
    if (participant) await settleExpiredAttempt(attempt, participant, now);
  }
};

const buildAdminOverview = async () => {
  await settleOverdueAttempts();
  const [totalRegistrations, totalCompleted, inProgress, aggregates, schools, states, classBreakdown, stateBreakdown] = await Promise.all([
    BrightFutureParticipant.countDocuments({}),
    BrightFutureParticipant.countDocuments({ examCompleted: true }),
    BrightFutureParticipant.countDocuments({ competitionStatus: "in_progress" }),
    BrightFutureParticipant.aggregate([
      { $match: { examCompleted: true } },
      { $group: { _id: null, averageScore: { $avg: "$totalScore" }, highestScore: { $max: "$totalScore" }, lowestScore: { $min: "$totalScore" }, averageCompletionTime: { $avg: "$totalTimeUsed" }, violations: { $sum: "$violationCount" }, math: { $avg: "$subjectScores.mathematics" }, english: { $avg: "$subjectScores.english" }, science: { $avg: "$subjectScores.basicScienceTechnology" }, social: { $avg: "$subjectScores.socialStudies" } } },
    ]),
    BrightFutureParticipant.distinct("schoolName"),
    BrightFutureParticipant.distinct("state"),
    BrightFutureParticipant.aggregate([{ $group: { _id: "$classLevel", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    BrightFutureParticipant.aggregate([{ $group: { _id: "$state", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 12 }]),
  ]);
  const values = aggregates[0] || {};
  const subjectAverages = {
    mathematics: Number((values.math || 0).toFixed(2)),
    english: Number((values.english || 0).toFixed(2)),
    basicScienceTechnology: Number((values.science || 0).toFixed(2)),
    socialStudies: Number((values.social || 0).toFixed(2)),
  };
  const subjectEntries = Object.entries(subjectAverages).sort((left, right) => left[1] - right[1]);
  return {
    totalRegistrations,
    totalCompleted,
    inProgress,
    completionRate: totalRegistrations ? Math.round((totalCompleted / totalRegistrations) * 10000) / 100 : 0,
    averageScore: Number((values.averageScore || 0).toFixed(2)),
    highestScore: values.highestScore || 0,
    lowestScore: values.lowestScore || 0,
    averageCompletionTime: Math.round(values.averageCompletionTime || 0),
    integrityViolations: values.violations || 0,
    schoolsRepresented: schools.length,
    statesRepresented: states.length,
    subjectAverages,
    hardestSubject: subjectEntries[0]?.[0] || "",
    highestScoringSubject: subjectEntries.at(-1)?.[0] || "",
    registrationsPerClass: classBreakdown.map((item) => ({ label: item._id, value: item.count })),
    registrationsPerState: stateBreakdown.map((item) => ({ label: item._id, value: item.count })),
  };
};

const buildAdminParticipantQuery = (filters = {}) => {
  const query = {};
  if (["active", "disabled", "withdrawn"].includes(filters.status)) query.status = filters.status;
  if (BRIGHT_FUTURE_CLASS_LEVELS.includes(filters.classLevel)) query.classLevel = filters.classLevel;
  if (filters.completed === "true" || filters.completed === true) query.examCompleted = true;
  if (filters.completed === "false" || filters.completed === false) query.examCompleted = false;
  const term = cleanText(filters.search, 100);
  if (term) {
    const regex = new RegExp(escapeRegex(term), "i");
    query.$or = [{ firstName: regex }, { middleName: regex }, { lastName: regex }, { candidateId: regex }, { schoolName: regex }, { state: regex }];
  }
  return query;
};

const serializeAdminParticipant = (participant) => ({
  ...serializeCandidate(participant),
  guardianPhone: participant.guardianPhone || "",
  studentPhone: participant.studentPhone || "",
  examStartedAt: participant.examStartedAt,
  examCompletedAt: participant.examCompletedAt,
  attemptNumber: participant.attemptNumber,
  retakeAuthorized: participant.retakeAuthorized,
  subjectScores: participant.subjectScores,
  totalScore: participant.totalScore,
  percentage: participant.percentage,
  totalCorrect: participant.totalCorrect,
  totalWrong: participant.totalWrong,
  totalUnanswered: participant.totalUnanswered,
  totalTimeUsed: participant.totalTimeUsed,
  averageResponseTime: participant.averageResponseTime,
  violationCount: participant.violationCount,
  violationEvents: participant.violationEvents,
  submissionReason: participant.submissionReason,
  winnerStatus: participant.winnerStatus,
});

const listAdminStudents = async (filters = {}) => {
  await settleOverdueAttempts();
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = clamp(filters.limit, 1, 100, 50);
  const query = buildAdminParticipantQuery(filters);
  const [students, total] = await Promise.all([
    BrightFutureParticipant.find(query).select("+guardianPhone +studentPhone +registrationMetadata.ipHash +registrationMetadata.userAgent").sort({ registrationTimestamp: -1 }).skip((page - 1) * limit).limit(limit),
    BrightFutureParticipant.countDocuments(query),
  ]);
  return { students: students.map(serializeAdminParticipant), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
};

const listAdminResults = async (filters = {}) => {
  await recalculateRankings();
  const payload = await listAdminStudents({ ...filters, completed: true });
  payload.results = payload.students.sort((left, right) => (left.ranking || 999999) - (right.ranking || 999999));
  delete payload.students;
  return payload;
};

const updateAdminStudent = async (participantId, payload = {}) => {
  if (!mongoose.Types.ObjectId.isValid(participantId)) throw new BrightFutureError("Invalid participant id.", { status: 400, code: "invalid_id" });
  const participant = await BrightFutureParticipant.findById(participantId).select("+guardianPhone +studentPhone");
  if (!participant) throw new BrightFutureError("Candidate record was not found.", { status: 404, code: "candidate_not_found" });
  if (payload.status && ["active", "disabled", "withdrawn"].includes(payload.status)) {
    participant.status = payload.status;
    if (payload.status !== "active") participant.competitionStatus = "disabled";
    else if (!participant.examStarted) participant.competitionStatus = "registered";
  }
  for (const [field, max] of Object.entries({ firstName: 50, middleName: 50, lastName: 50, schoolName: 160, state: 80, lga: 100 })) {
    if (payload[field] !== undefined) participant[field] = cleanText(payload[field], max);
  }
  if (payload.classLevel && BRIGHT_FUTURE_CLASS_LEVELS.includes(payload.classLevel)) participant.classLevel = payload.classLevel;
  if (payload.age !== undefined) participant.age = clamp(payload.age, 5, 20, participant.age);
  await participant.save();
  return serializeAdminParticipant(participant);
};

const resetAdminAttempt = async (participantId) => {
  const participant = await BrightFutureParticipant.findById(participantId);
  if (!participant) throw new BrightFutureError("Candidate record was not found.", { status: 404, code: "candidate_not_found" });
  if (participant.latestAttemptId) {
    await BrightFutureExamAttempt.updateOne(
      { _id: participant.latestAttemptId, status: "in_progress" },
      { $set: { status: "reset", completedAt: new Date(), submissionReason: "admin_reset" } }
    );
  }
  participant.examStarted = false;
  participant.examStartedAt = null;
  participant.examCompleted = false;
  participant.examCompletedAt = null;
  participant.retakeAuthorized = true;
  participant.competitionStatus = "registered";
  participant.subjectScores = {};
  participant.totalScore = 0;
  participant.percentage = 0;
  participant.totalCorrect = 0;
  participant.totalWrong = 0;
  participant.totalUnanswered = 0;
  participant.totalTimeUsed = 0;
  participant.averageResponseTime = 0;
  participant.ranking = null;
  participant.winnerStatus = "none";
  participant.submissionReason = "";
  await participant.save();
  await recalculateRankings();
  return serializeAdminParticipant(participant);
};

const updateCompetitionControls = async (payload = {}, adminUserId = null) => {
  const update = {};
  for (const field of ["registrationOpen", "examinationOpen", "leaderboardVisible", "winnerVisible", "detailedResultsVisible"]) {
    if (typeof payload[field] === "boolean") update[field] = payload[field];
  }
  const statuses = ["registration_upcoming", "registration_open", "examination_open", "examination_closed", "results_published"];
  if (statuses.includes(payload.competitionStatus)) update.competitionStatus = payload.competitionStatus;
  if (payload.questionTimerSeconds !== undefined) update.questionTimerSeconds = clamp(payload.questionTimerSeconds, 20, 180, 50);
  if (payload.allowedViolations !== undefined) update.allowedViolations = clamp(payload.allowedViolations, 1, 10, 3);
  if (adminUserId) update.updatedBy = adminUserId;
  const competition = await BrightFutureCompetitionConfig.findOneAndUpdate(
    { key: COMPETITION_KEY },
    { $set: update, $setOnInsert: { key: COMPETITION_KEY } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );
  await recalculateRankings();
  return serializePublicConfig(competition);
};

const listAdminQuestions = async () => {
  await ensureQuestionBankSeeded();
  return BrightFutureQuestion.find({}).sort({ subject: 1, order: 1 });
};

const updateAdminQuestion = async (questionId, payload = {}) => {
  await ensureQuestionBankSeeded();
  const question = await BrightFutureQuestion.findOne({ questionId: cleanText(questionId, 80) });
  if (!question) throw new BrightFutureError("Question was not found.", { status: 404, code: "question_not_found" });
  if (payload.prompt !== undefined) {
    const prompt = cleanText(payload.prompt, 1000);
    if (prompt.length < 10) throw buildValidationError({ prompt: "Question text is too short." });
    question.prompt = prompt;
  }
  if (payload.options !== undefined) {
    if (!Array.isArray(payload.options) || payload.options.length !== 5) throw buildValidationError({ options: "Provide exactly five options." });
    const options = payload.options.map((option) => cleanText(option, 300));
    if (options.some((option) => !option) || new Set(options.map((option) => option.toLowerCase())).size !== 5) {
      throw buildValidationError({ options: "All five options must be filled and distinct." });
    }
    question.options = options;
  }
  if (payload.correctIndex !== undefined) {
    const correctIndex = Number(payload.correctIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 4) throw buildValidationError({ correctIndex: "Choose a correct option from A to E." });
    question.correctIndex = correctIndex;
  }
  if (typeof payload.active === "boolean") question.active = payload.active;
  question.version += 1;
  await question.save();
  return question;
};

module.exports = {
  BrightFutureError,
  NIGERIAN_STATES: [...NIGERIAN_STATES],
  SUBJECT_DEFINITIONS,
  buildAdminOverview,
  getCompetitionConfig,
  getExamState,
  getLeaderboard,
  getParticipantById,
  getResult,
  issueCandidateToken,
  listAdminQuestions,
  listAdminResults,
  listAdminStudents,
  listPublicParticipants,
  loginParticipant,
  recordViolation,
  registerParticipant,
  resetAdminAttempt,
  serializeCandidate,
  serializePublicConfig,
  startExam,
  submitAnswer,
  submitExam,
  updateAdminQuestion,
  updateAdminStudent,
  updateCompetitionControls,
  updateParticipantProfile,
  verifyCandidateToken,
};
