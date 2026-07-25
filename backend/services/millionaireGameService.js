const mongoose = require("mongoose");

const MillionaireAttempt = require("../models/MillionaireAttempt");
const MillionaireParticipant = require("../models/MillionaireParticipant");
const User = require("../models/User");
const {
  PRIZE_LADDER,
  STAGES,
  getQuestionById,
  getStageByNumber,
  selectQuestionsForAttempt,
} = require("../data/millionaireQuestionBank");
const { mediaToUrl } = require("../utils/userMedia");
const {
  sanitizeCountryValue,
  sanitizePhoneValue,
  sanitizeStateValue,
} = require("../utils/profileFields");

const CAMPAIGN_SLUG = "tengacion-millionaire-2026";
const QUESTIONS_PER_STAGE = 5;
const TOTAL_QUESTIONS = 15;
const ANSWER_GRACE_MS = 3_000;
const REGISTRATION_SOURCES = new Set([
  "landing_page",
  "right_sidebar",
  "game_lobby",
  "account_creation",
]);
const PAYOUT_STATUSES = new Set(["pending", "approved", "paid", "rejected"]);
const PARTICIPANT_STATUSES = new Set(["registered", "suspended", "withdrawn"]);

class MillionaireGameError extends Error {
  constructor(message, status = 400, code = "millionaire_error", payload = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return String(value._id);
  return String(value);
};

const addSixMonths = (value = new Date()) => {
  const date = new Date(value);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 6);
  const lastDayOfTargetMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate();
  date.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  return date;
};

const isActiveAccount = (user = {}) =>
  Boolean(user?._id) &&
  user.isActive !== false &&
  user.isDeleted !== true &&
  user.isBanned !== true &&
  user.isSuspended !== true;

const buildProfileEligibility = (user = {}, participant = null) => {
  const details = {
    name: Boolean(String(user?.name || "").trim()),
    username: Boolean(String(user?.username || "").trim()),
    email: Boolean(String(user?.email || "").trim()),
    phone: Boolean(sanitizePhoneValue(user?.phone)),
    country: Boolean(sanitizeCountryValue(user?.country)),
    dateOfBirth: Boolean(toDate(user?.dob)),
    gender: Boolean(String(user?.gender || "").trim()),
  };
  const profileDetailsComplete = Object.values(details).every(Boolean);
  const profilePhotoComplete = Boolean(mediaToUrl(user?.avatar));
  const coverPhotoComplete = Boolean(mediaToUrl(user?.cover));
  const activeAccount = isActiveAccount(user);
  const registered = Boolean(participant && participant.status === "registered");

  const requirements = [
    {
      id: "registration",
      label: "Register for Tengacion Millionaire",
      complete: registered,
      path: "/millionaire/register",
    },
    {
      id: "profile",
      label: "Complete your profile information",
      complete: profileDetailsComplete,
      path: user?.username ? `/profile/${user.username}` : "/home",
      missingFields: Object.entries(details)
        .filter(([, complete]) => !complete)
        .map(([field]) => field),
    },
    {
      id: "avatar",
      label: "Upload a profile picture",
      complete: profilePhotoComplete,
      path: user?.username ? `/profile/${user.username}` : "/home",
    },
    {
      id: "cover",
      label: "Upload a cover photo",
      complete: coverPhotoComplete,
      path: user?.username ? `/profile/${user.username}` : "/home",
    },
    {
      id: "account",
      label: "Keep your Tengacion account active",
      complete: activeAccount,
      path: "/settings",
    },
  ];

  return {
    eligible:
      registered &&
      profileDetailsComplete &&
      profilePhotoComplete &&
      coverPhotoComplete &&
      activeAccount,
    registered,
    profileDetailsComplete,
    profilePhotoComplete,
    coverPhotoComplete,
    activeAccount,
    requirements,
    missingFields: requirements.flatMap((requirement) =>
      requirement.complete ? [] : [requirement.id]
    ),
  };
};

const getUserForGame = async (userId) => {
  const user = await User.findById(userId)
    .select(
      "_id name username email phone country stateOfOrigin dob gender avatar cover onboarding isActive isDeleted isBanned isSuspended"
    )
    .lean();
  if (!user) {
    throw new MillionaireGameError("User not found.", 404, "user_not_found");
  }
  return user;
};

const getQuestionTimeLimit = (question) =>
  Number(getStageByNumber(question?.stage)?.timeLimitSeconds || 30);

const getQuestionDeadline = (attempt, questionIndex) => {
  const entry = attempt?.questions?.[questionIndex];
  const question = getQuestionById(entry?.questionId);
  const presentedAt = toDate(entry?.presentedAt);
  if (!question || !presentedAt) return null;
  return new Date(presentedAt.getTime() + getQuestionTimeLimit(question) * 1000);
};

const chooseWrongLifelineIndex = (question, attempt) => {
  const optionCount = Array.isArray(question?.options) ? question.options.length : 4;
  const seed =
    Number(attempt?.currentQuestionIndex || 0) +
    Number(attempt?.correctAnswers || 0) +
    String(attempt?._id || "").length;
  let suggestedIndex = seed % optionCount;
  if (suggestedIndex === question.correctIndex) {
    suggestedIndex = (suggestedIndex + 1) % optionCount;
  }
  return suggestedIndex;
};

const serializeCurrentQuestion = (attempt, now = new Date()) => {
  if (!attempt || attempt.status !== "in_progress") return null;
  const questionIndex = Number(attempt.currentQuestionIndex || 0);
  const entry = attempt.questions?.[questionIndex];
  const question = getQuestionById(entry?.questionId);
  if (!entry || !question) return null;
  const stage = getStageByNumber(question.stage);
  const deadline = getQuestionDeadline(attempt, questionIndex);
  const secondsRemaining = deadline
    ? Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 1000))
    : stage.timeLimitSeconds;

  return {
    id: question.id,
    number: questionIndex + 1,
    totalQuestions: TOTAL_QUESTIONS,
    stage: question.stage,
    stageName: stage.name,
    stageSubtitle: stage.subtitle,
    difficulty: stage.difficulty,
    category: question.category,
    prompt: question.prompt,
    options: question.options,
    timeLimitSeconds: stage.timeLimitSeconds,
    secondsRemaining,
    presentedAt: entry.presentedAt,
  };
};

const serializeReview = (attempt) => {
  if (!attempt || attempt.status === "in_progress") return [];
  return (attempt.questions || [])
    .filter((entry) => entry.answeredAt)
    .map((entry) => {
      const question = getQuestionById(entry.questionId);
      if (!question) return null;
      return {
        number: entry.order,
        stage: entry.stage,
        category: question.category,
        prompt: question.prompt,
        options: question.options,
        selectedIndex: entry.selectedIndex,
        correctIndex: question.correctIndex,
        correctAnswer: question.options[question.correctIndex],
        correct: Boolean(entry.correct),
        timedOut: Boolean(entry.timedOut),
        explanation: question.explanation,
        lifelineSuggestedIndex: entry.lifelineSuggestedIndex,
        lifelineWasWrong:
          Number.isInteger(entry.lifelineSuggestedIndex) &&
          entry.lifelineSuggestedIndex !== question.correctIndex,
      };
    })
    .filter(Boolean);
};

const serializeAttempt = (attempt, now = new Date()) => {
  if (!attempt) return null;
  const currentQuestion = serializeCurrentQuestion(attempt, now);
  return {
    id: toId(attempt._id),
    status: attempt.status,
    currentQuestionIndex: Number(attempt.currentQuestionIndex || 0),
    correctAnswers: Number(attempt.correctAnswers || 0),
    currentPrize: Number(attempt.currentPrize || 0),
    finalPrize: Number(attempt.finalPrize || 0),
    lifelineUsed: Boolean(attempt.lifelineUsed),
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    nextEligibleAt: attempt.nextEligibleAt,
    outcomeReason: attempt.outcomeReason || "",
    payoutStatus: attempt.payoutStatus || "not_applicable",
    payoutReference: attempt.payoutReference || "",
    currentQuestion,
    review: serializeReview(attempt),
  };
};

const settleExpiredAttempt = async (attempt, now = new Date()) => {
  if (!attempt || attempt.status !== "in_progress") return attempt;
  const index = Number(attempt.currentQuestionIndex || 0);
  const deadline = getQuestionDeadline(attempt, index);
  if (!deadline || now.getTime() <= deadline.getTime() + ANSWER_GRACE_MS) {
    return attempt;
  }
  const finalPrize = Number(attempt.currentPrize || 0);
  const updated = await MillionaireAttempt.findOneAndUpdate(
    {
      _id: attempt._id,
      status: "in_progress",
      currentQuestionIndex: index,
      [`questions.${index}.answeredAt`]: null,
    },
    {
      $set: {
        [`questions.${index}.answeredAt`]: now,
        [`questions.${index}.correct`]: false,
        [`questions.${index}.timedOut`]: true,
        status: "expired",
        outcomeReason: "time_expired",
        finalPrize,
        completedAt: now,
        payoutStatus: finalPrize > 0 ? "pending" : "not_applicable",
      },
    },
    { returnDocument: "after" }
  );
  return updated || (await MillionaireAttempt.findById(attempt._id));
};

const getLatestAttempt = async (participant) => {
  if (!participant) return null;
  if (participant.lastAttemptId) {
    const linked = await MillionaireAttempt.findById(participant.lastAttemptId);
    if (linked) return linked;
  }
  return MillionaireAttempt.findOne({ participantId: participant._id }).sort({ startedAt: -1 });
};

const getMillionaireStatus = async (userId, { now = new Date() } = {}) => {
  const user = await getUserForGame(userId);
  const participant = await MillionaireParticipant.findOne({ userId });
  let attempt = await getLatestAttempt(participant);
  attempt = await settleExpiredAttempt(attempt, now);

  const eligibility = buildProfileEligibility(user, participant);
  const nextEligibleAt = toDate(participant?.nextEligibleAt || attempt?.nextEligibleAt);
  const activeAttempt = attempt?.status === "in_progress";
  const cooldownActive =
    Boolean(nextEligibleAt && nextEligibleAt.getTime() > now.getTime()) && !activeAttempt;
  const registration = participant
    ? {
        registered: true,
        participantId: toId(participant._id),
        status: participant.status,
        registeredAt: participant.registeredAt,
        playCount: Number(participant.playCount || 0),
      }
    : {
        registered: false,
        participantId: "",
        status: "",
        registeredAt: null,
        playCount: 0,
      };

  return {
    campaign: {
      slug: CAMPAIGN_SLUG,
      title: "Tengacion Millionaire",
      stages: STAGES,
      questionsPerStage: QUESTIONS_PER_STAGE,
      totalQuestions: TOTAL_QUESTIONS,
      prizeLadder: PRIZE_LADDER,
      minimumPrize: PRIZE_LADDER[0],
      maximumPrize: PRIZE_LADDER[PRIZE_LADDER.length - 1],
      replayWindowMonths: 6,
      lifelines: 1,
    },
    registration,
    eligibility,
    cooldown: {
      active: cooldownActive,
      nextEligibleAt,
      message: cooldownActive
        ? "You can play Tengacion Millionaire once every six months."
        : "",
    },
    attempt: serializeAttempt(attempt, now),
    canStart:
      eligibility.eligible &&
      !cooldownActive &&
      (!attempt || attempt.status !== "in_progress"),
    canResume: Boolean(activeAttempt),
  };
};

const registerMillionaireParticipant = async ({
  userId,
  rulesAccepted,
  prizeTermsAccepted,
  source,
} = {}) => {
  const user = await getUserForGame(userId);
  const existing = await MillionaireParticipant.findOne({ userId });
  if (existing) {
    return {
      alreadyRegistered: true,
      game: await getMillionaireStatus(userId),
    };
  }
  if (!rulesAccepted || !prizeTermsAccepted) {
    throw new MillionaireGameError(
      "Accept the game rules and prize terms to register.",
      400,
      "consent_required"
    );
  }
  if (!isActiveAccount(user)) {
    throw new MillionaireGameError(
      "This Tengacion account is not eligible for game registration.",
      403,
      "inactive_account"
    );
  }

  let participant;
  try {
    participant = await MillionaireParticipant.create({
      userId,
      registrationSource: REGISTRATION_SOURCES.has(String(source || ""))
        ? String(source)
        : "landing_page",
      registrationProfile: {
        name: user.name || "",
        username: user.username || "",
        email: user.email || "",
        phone: sanitizePhoneValue(user.phone),
        country: sanitizeCountryValue(user.country),
        stateOfOrigin: sanitizeStateValue(user.stateOfOrigin),
        dateOfBirth: toDate(user.dob),
        gender: String(user.gender || "").trim(),
      },
      consent: {
        rulesAccepted: true,
        prizeTermsAccepted: true,
        acceptedAt: new Date(),
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      participant = await MillionaireParticipant.findOne({ userId });
    } else {
      throw error;
    }
  }

  return {
    alreadyRegistered: false,
    participantId: toId(participant?._id),
    game: await getMillionaireStatus(userId),
  };
};

const buildAttemptQuestions = (questionIds, now) =>
  questionIds.map((questionId, index) => {
    const question = getQuestionById(questionId);
    return {
      questionId,
      stage: question.stage,
      order: index + 1,
      presentedAt: index === 0 ? now : null,
      answeredAt: null,
      selectedIndex: null,
      correct: null,
      timedOut: false,
      lifelineSuggestedIndex: null,
    };
  });

const startMillionaireAttempt = async (userId, { now = new Date(), random = Math.random } = {}) => {
  const user = await getUserForGame(userId);
  let participant = await MillionaireParticipant.findOne({ userId });
  if (!participant) {
    throw new MillionaireGameError(
      "Register for Tengacion Millionaire before starting.",
      403,
      "registration_required"
    );
  }

  const latest = await getLatestAttempt(participant);
  if (latest?.status === "in_progress") {
    const settled = await settleExpiredAttempt(latest, now);
    if (settled?.status === "in_progress") {
      return getMillionaireStatus(userId, { now });
    }
  }

  const eligibility = buildProfileEligibility(user, participant);
  if (!eligibility.eligible) {
    throw new MillionaireGameError(
      "Complete your profile information, profile picture and cover photo before playing.",
      403,
      "profile_incomplete",
      { eligibility }
    );
  }

  const nextEligibleAt = toDate(participant.nextEligibleAt);
  if (nextEligibleAt && nextEligibleAt.getTime() > now.getTime()) {
    throw new MillionaireGameError(
      "You can play Tengacion Millionaire only once every six months.",
      409,
      "six_month_cooldown",
      { nextEligibleAt }
    );
  }

  const attemptId = new mongoose.Types.ObjectId();
  const previousNextEligibleAt = participant.nextEligibleAt || null;
  const previousLastAttemptId = participant.lastAttemptId || null;
  const nextWindow = addSixMonths(now);
  participant = await MillionaireParticipant.findOneAndUpdate(
    {
      _id: participant._id,
      status: "registered",
      $or: [
        { nextEligibleAt: null },
        { nextEligibleAt: { $exists: false } },
        { nextEligibleAt: { $lte: now } },
      ],
    },
    {
      $set: {
        nextEligibleAt: nextWindow,
        lastAttemptId: attemptId,
      },
      $inc: { playCount: 1 },
    },
    { returnDocument: "after" }
  );

  if (!participant) {
    const current = await MillionaireParticipant.findOne({ userId }).lean();
    throw new MillionaireGameError(
      "You can play Tengacion Millionaire only once every six months.",
      409,
      "six_month_cooldown",
      { nextEligibleAt: current?.nextEligibleAt || null }
    );
  }

  try {
    const questionIds = selectQuestionsForAttempt({ random });
    await MillionaireAttempt.create({
      _id: attemptId,
      participantId: participant._id,
      userId,
      status: "in_progress",
      questions: buildAttemptQuestions(questionIds, now),
      currentQuestionIndex: 0,
      correctAnswers: 0,
      currentPrize: 0,
      finalPrize: 0,
      lifelineUsed: false,
      startedAt: now,
      nextEligibleAt: nextWindow,
      payoutStatus: "not_applicable",
    });
  } catch (error) {
    await MillionaireParticipant.updateOne(
      { _id: participant._id, lastAttemptId: attemptId },
      {
        $set: {
          nextEligibleAt: previousNextEligibleAt,
          lastAttemptId: previousLastAttemptId,
        },
        $inc: { playCount: -1 },
      }
    ).catch(() => null);
    throw error;
  }

  return getMillionaireStatus(userId, { now });
};

const answerMillionaireQuestion = async ({
  userId,
  questionId,
  selectedIndex,
  now = new Date(),
} = {}) => {
  const participant = await MillionaireParticipant.findOne({ userId });
  const attempt = await getLatestAttempt(participant);
  if (!attempt || attempt.status !== "in_progress") {
    throw new MillionaireGameError(
      "There is no active Millionaire question to answer.",
      409,
      "no_active_attempt"
    );
  }

  const index = Number(attempt.currentQuestionIndex || 0);
  const entry = attempt.questions?.[index];
  const question = getQuestionById(entry?.questionId);
  if (!entry || !question || String(questionId || "") !== question.id) {
    throw new MillionaireGameError(
      "That question is no longer active. Refresh the game.",
      409,
      "stale_question"
    );
  }

  const parsedIndex =
    selectedIndex === null || selectedIndex === undefined || selectedIndex === ""
      ? null
      : Number(selectedIndex);
  if (parsedIndex !== null && (!Number.isInteger(parsedIndex) || parsedIndex < 0 || parsedIndex > 3)) {
    throw new MillionaireGameError("Choose one of the four answers.", 400, "invalid_answer");
  }

  const deadline = getQuestionDeadline(attempt, index);
  const timedOut =
    parsedIndex === null ||
    !deadline ||
    now.getTime() > deadline.getTime() + ANSWER_GRACE_MS;
  const correct = !timedOut && parsedIndex === question.correctIndex;
  const update = {
    [`questions.${index}.answeredAt`]: now,
    [`questions.${index}.selectedIndex`]: parsedIndex,
    [`questions.${index}.correct`]: correct,
    [`questions.${index}.timedOut`]: timedOut,
  };
  let prizeUnlocked = Number(attempt.currentPrize || 0);

  if (correct) {
    prizeUnlocked = Number(PRIZE_LADDER[index] || PRIZE_LADDER[PRIZE_LADDER.length - 1]);
    update.correctAnswers = Number(attempt.correctAnswers || 0) + 1;
    update.currentPrize = prizeUnlocked;
    if (index >= TOTAL_QUESTIONS - 1) {
      update.status = "completed";
      update.outcomeReason = "all_questions_correct";
      update.finalPrize = prizeUnlocked;
      update.completedAt = now;
      update.payoutStatus = "pending";
    } else {
      update.currentQuestionIndex = index + 1;
      update[`questions.${index + 1}.presentedAt`] = now;
    }
  } else {
    const finalPrize = Number(attempt.currentPrize || 0);
    update.status = timedOut ? "expired" : "lost";
    update.outcomeReason = timedOut ? "time_expired" : "wrong_answer";
    update.finalPrize = finalPrize;
    update.completedAt = now;
    update.payoutStatus = finalPrize > 0 ? "pending" : "not_applicable";
  }

  const updated = await MillionaireAttempt.findOneAndUpdate(
    {
      _id: attempt._id,
      status: "in_progress",
      currentQuestionIndex: index,
      [`questions.${index}.answeredAt`]: null,
    },
    { $set: update },
    { returnDocument: "after" }
  );
  if (!updated) {
    throw new MillionaireGameError(
      "This answer was already processed. Refresh the game.",
      409,
      "answer_already_processed"
    );
  }

  return {
    answerResult: {
      correct,
      timedOut,
      selectedIndex: parsedIndex,
      correctIndex: question.correctIndex,
      correctAnswer: question.options[question.correctIndex],
      explanation: question.explanation,
      prizeUnlocked,
      gameOver: updated.status !== "in_progress",
    },
    game: await getMillionaireStatus(userId, { now }),
  };
};

const askMillionaireAi = async ({ userId, questionId, now = new Date() } = {}) => {
  const participant = await MillionaireParticipant.findOne({ userId });
  const attempt = await getLatestAttempt(participant);
  if (!attempt || attempt.status !== "in_progress") {
    throw new MillionaireGameError("There is no active question.", 409, "no_active_attempt");
  }
  if (attempt.lifelineUsed) {
    throw new MillionaireGameError(
      "Your Ask AI lifeline has already been used.",
      409,
      "lifeline_used"
    );
  }

  const index = Number(attempt.currentQuestionIndex || 0);
  const entry = attempt.questions?.[index];
  const question = getQuestionById(entry?.questionId);
  if (!entry || !question || question.id !== String(questionId || "")) {
    throw new MillionaireGameError(
      "That question is no longer active.",
      409,
      "stale_question"
    );
  }
  const deadline = getQuestionDeadline(attempt, index);
  if (!deadline || now.getTime() > deadline.getTime() + ANSWER_GRACE_MS) {
    await settleExpiredAttempt(attempt, now);
    throw new MillionaireGameError("Time has expired for this question.", 409, "time_expired");
  }

  const suggestedIndex = chooseWrongLifelineIndex(question, attempt);
  const updated = await MillionaireAttempt.findOneAndUpdate(
    {
      _id: attempt._id,
      status: "in_progress",
      currentQuestionIndex: index,
      lifelineUsed: false,
      [`questions.${index}.answeredAt`]: null,
    },
    {
      $set: {
        lifelineUsed: true,
        lifelineUsedAt: now,
        [`questions.${index}.lifelineSuggestedIndex`]: suggestedIndex,
      },
    },
    { returnDocument: "after" }
  );
  if (!updated) {
    throw new MillionaireGameError(
      "The lifeline could not be used on this question.",
      409,
      "lifeline_unavailable"
    );
  }

  return {
    advice: {
      suggestedIndex,
      suggestedOption: question.options[suggestedIndex],
      message: `AI leans toward ${String.fromCharCode(65 + suggestedIndex)}: ${question.options[suggestedIndex]}. Trust your own reasoning before you lock it in.`,
    },
    game: await getMillionaireStatus(userId, { now }),
  };
};

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildAdminStats = async () => {
  const [registrations, playCount, inProgress, completed, totals] = await Promise.all([
    MillionaireParticipant.countDocuments({}),
    MillionaireAttempt.countDocuments({}),
    MillionaireAttempt.countDocuments({ status: "in_progress" }),
    MillionaireAttempt.countDocuments({ status: { $in: ["completed", "lost", "expired"] } }),
    MillionaireAttempt.aggregate([
      {
        $group: {
          _id: null,
          totalAwarded: { $sum: "$finalPrize" },
          pendingAmount: {
            $sum: {
              $cond: [{ $in: ["$payoutStatus", ["pending", "approved"]] }, "$finalPrize", 0],
            },
          },
          paidAmount: {
            $sum: { $cond: [{ $eq: ["$payoutStatus", "paid"] }, "$finalPrize", 0] },
          },
          pendingCount: {
            $sum: {
              $cond: [{ $in: ["$payoutStatus", ["pending", "approved"]] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);
  const money = totals[0] || {};
  return {
    registrations,
    playCount,
    inProgress,
    completed,
    totalAwarded: Number(money.totalAwarded || 0),
    pendingAmount: Number(money.pendingAmount || 0),
    paidAmount: Number(money.paidAmount || 0),
    pendingCount: Number(money.pendingCount || 0),
  };
};

const listMillionaireParticipantsForAdmin = async ({
  search,
  participantStatus,
  attemptStatus,
  payoutStatus,
  page = 1,
  limit = 50,
} = {}) => {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
  const query = {};
  if (PARTICIPANT_STATUSES.has(String(participantStatus || ""))) {
    query.status = String(participantStatus);
  }

  const normalizedSearch = String(search || "").trim();
  if (normalizedSearch) {
    const regex = new RegExp(escapeRegex(normalizedSearch), "i");
    const matchingUsers = await User.find({
      $or: [{ name: regex }, { username: regex }, { email: regex }, { phone: regex }],
    })
      .select("_id")
      .limit(500)
      .lean();
    query.userId = { $in: matchingUsers.map((user) => user._id) };
  }

  const attemptQuery = {};
  if (["in_progress", "lost", "completed", "expired"].includes(String(attemptStatus || ""))) {
    attemptQuery.status = String(attemptStatus);
  }
  if (["not_applicable", "pending", "approved", "paid", "rejected"].includes(String(payoutStatus || ""))) {
    attemptQuery.payoutStatus = String(payoutStatus);
  }
  if (Object.keys(attemptQuery).length) {
    const matchingAttempts = await MillionaireAttempt.find(attemptQuery)
      .select("participantId")
      .lean();
    const participantIds = [...new Set(matchingAttempts.map((row) => toId(row.participantId)))];
    query._id = { $in: participantIds };
  }

  const [participants, total, stats] = await Promise.all([
    MillionaireParticipant.find(query)
      .populate(
        "userId",
        "name username email phone country stateOfOrigin dob gender avatar cover isActive isDeleted isBanned isSuspended"
      )
      .sort({ registeredAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    MillionaireParticipant.countDocuments(query),
    buildAdminStats(),
  ]);
  const participantIds = participants.map((participant) => participant._id);
  const attempts = await MillionaireAttempt.find({ participantId: { $in: participantIds } })
    .sort({ startedAt: -1 })
    .lean();
  const latestByParticipant = new Map();
  attempts.forEach((attempt) => {
    const key = toId(attempt.participantId);
    if (!latestByParticipant.has(key)) latestByParticipant.set(key, attempt);
  });

  return {
    stats,
    participants: participants.map((participant) => {
      const user = participant.userId || {};
      const latestAttempt = latestByParticipant.get(toId(participant._id)) || null;
      return {
        id: toId(participant._id),
        status: participant.status,
        registeredAt: participant.registeredAt,
        registrationSource: participant.registrationSource,
        playCount: Number(participant.playCount || 0),
        nextEligibleAt: participant.nextEligibleAt,
        user: {
          id: toId(user._id),
          name: user.name || participant.registrationProfile?.name || "",
          username: user.username || participant.registrationProfile?.username || "",
          email: user.email || participant.registrationProfile?.email || "",
          phone: user.phone || participant.registrationProfile?.phone || "",
          country: user.country || participant.registrationProfile?.country || "",
          stateOfOrigin:
            user.stateOfOrigin || participant.registrationProfile?.stateOfOrigin || "",
          avatarUrl: mediaToUrl(user.avatar),
          coverUrl: mediaToUrl(user.cover),
        },
        profileComplete: buildProfileEligibility(user, participant).eligible,
        latestAttempt: latestAttempt
          ? {
              id: toId(latestAttempt._id),
              status: latestAttempt.status,
              correctAnswers: Number(latestAttempt.correctAnswers || 0),
              finalPrize: Number(latestAttempt.finalPrize || 0),
              payoutStatus: latestAttempt.payoutStatus,
              payoutReference: latestAttempt.payoutReference || "",
              startedAt: latestAttempt.startedAt,
              completedAt: latestAttempt.completedAt,
            }
          : null,
      };
    }),
    total,
    page: safePage,
    pages: Math.max(1, Math.ceil(total / safeLimit)),
  };
};

const updateMillionairePayout = async ({
  attemptId,
  status,
  reference,
  note,
  adminUserId,
} = {}) => {
  if (!mongoose.isValidObjectId(attemptId)) {
    throw new MillionaireGameError("Invalid attempt id.", 400, "invalid_attempt_id");
  }
  const normalizedStatus = String(status || "").trim().toLowerCase();
  if (!PAYOUT_STATUSES.has(normalizedStatus)) {
    throw new MillionaireGameError("Choose a valid payout status.", 400, "invalid_payout_status");
  }
  const attempt = await MillionaireAttempt.findById(attemptId);
  if (!attempt) {
    throw new MillionaireGameError("Game attempt not found.", 404, "attempt_not_found");
  }
  if (attempt.status === "in_progress" || Number(attempt.finalPrize || 0) <= 0) {
    throw new MillionaireGameError(
      "Only completed attempts with a cash prize can be processed.",
      409,
      "payout_not_available"
    );
  }
  attempt.payoutStatus = normalizedStatus;
  attempt.payoutReference = String(reference || "").trim().slice(0, 160);
  attempt.payoutNote = String(note || "").trim().slice(0, 500);
  attempt.payoutUpdatedAt = new Date();
  attempt.payoutUpdatedBy = adminUserId || null;
  await attempt.save();
  return {
    attempt: {
      id: toId(attempt._id),
      payoutStatus: attempt.payoutStatus,
      payoutReference: attempt.payoutReference,
      payoutNote: attempt.payoutNote,
      payoutUpdatedAt: attempt.payoutUpdatedAt,
      finalPrize: Number(attempt.finalPrize || 0),
    },
  };
};

const updateMillionaireParticipantStatus = async ({
  participantId,
  status,
} = {}) => {
  if (!mongoose.isValidObjectId(participantId)) {
    throw new MillionaireGameError("Invalid participant id.", 400, "invalid_participant_id");
  }
  const normalizedStatus = String(status || "").trim().toLowerCase();
  if (!PARTICIPANT_STATUSES.has(normalizedStatus)) {
    throw new MillionaireGameError(
      "Choose a valid participant status.",
      400,
      "invalid_participant_status"
    );
  }
  const participant = await MillionaireParticipant.findByIdAndUpdate(
    participantId,
    { $set: { status: normalizedStatus } },
    { returnDocument: "after" }
  );
  if (!participant) {
    throw new MillionaireGameError("Participant not found.", 404, "participant_not_found");
  }
  return { participantId: toId(participant._id), status: participant.status };
};

module.exports = {
  CAMPAIGN_SLUG,
  MillionaireGameError,
  addSixMonths,
  answerMillionaireQuestion,
  askMillionaireAi,
  buildProfileEligibility,
  getMillionaireStatus,
  listMillionaireParticipantsForAdmin,
  registerMillionaireParticipant,
  startMillionaireAttempt,
  updateMillionaireParticipantStatus,
  updateMillionairePayout,
};
