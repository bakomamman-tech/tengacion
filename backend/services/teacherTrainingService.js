const TeacherTrainingAttempt = require("../models/TeacherTrainingAttempt");
const User = require("../models/User");
const {
  MODULES,
  PASS_MARK_PERCENT,
  QUESTIONS_PER_MODULE,
  QUESTION_TIME_LIMIT_SECONDS,
  getModuleByCode,
  getQuestionById,
  serializeModuleContent,
} = require("../data/teacherTrainingCatalog");

const CAMPAIGN_ID = "kurah-teachers-training-2026";
const WAT_TIME_ZONE = "Africa/Lagos";

class TeacherTrainingError extends Error {
  constructor(message, status = 400, code = "teacher_training_error", payload = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

const toId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return String(value._id);
  return String(value);
};

const shuffle = (values, random = Math.random) => {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomValue = Math.max(0, Math.min(0.999999999, Number(random()) || 0));
    const swapIndex = Math.floor(randomValue * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

const getPerformanceBand = (score = 0) => {
  const value = Number(score || 0);
  if (value >= 85) return { id: "distinction", label: "Distinction", message: "Exceptional professional mastery." };
  if (value >= 75) return { id: "strong", label: "Strong", message: "Strong and dependable understanding." };
  if (value >= PASS_MARK_PERCENT) return { id: "pass", label: "Pass", message: "Required standard achieved." };
  if (value >= 40) return { id: "developing", label: "Developing", message: "Further guided study is required." };
  return { id: "support", label: "Intensive support", message: "A structured improvement plan is required." };
};

const getCampaignAccess = () => ({
  opensAt: null,
  deadlineAt: null,
  finalResultsReleaseAt: null,
  timeZone: WAT_TIME_ZONE,
  isPreview: false,
  isOpen: true,
  isClosed: false,
  finalResultsReleased: true,
});

const getQuestionDeadline = (entry) => {
  if (!entry?.presentedAt) return null;
  return new Date(
    new Date(entry.presentedAt).getTime() + QUESTION_TIME_LIMIT_SECONDS * 1000
  );
};

const completeAttempt = (attempt, completedAt) => {
  attempt.status = "completed";
  attempt.currentQuestionIndex = QUESTIONS_PER_MODULE;
  attempt.scorePercent = Math.round(
    (Number(attempt.correctAnswers || 0) / QUESTIONS_PER_MODULE) * 100
  );
  attempt.completedAt = completedAt || new Date();
};

const settleExpiredAttempt = async (attempt, now = new Date()) => {
  if (!attempt || attempt.status !== "in_progress") return attempt;
  const nowTime = new Date(now).getTime();
  let changed = false;

  while (
    attempt.status === "in_progress" &&
    Number(attempt.currentQuestionIndex || 0) < attempt.questions.length
  ) {
    const index = Number(attempt.currentQuestionIndex || 0);
    const entry = attempt.questions[index];
    const deadline = getQuestionDeadline(entry);
    if (!deadline || nowTime < deadline.getTime()) {
      break;
    }

    entry.answeredAt = deadline;
    entry.selectedIndex = null;
    entry.selectedOriginalIndex = null;
    entry.correct = false;
    entry.timedOut = true;
    attempt.timedOutAnswers = Number(attempt.timedOutAnswers || 0) + 1;
    attempt.currentQuestionIndex = index + 1;
    changed = true;

    if (attempt.currentQuestionIndex >= attempt.questions.length) {
      completeAttempt(attempt, deadline);
      break;
    }

    const nextEntry = attempt.questions[attempt.currentQuestionIndex];
    if (!nextEntry.presentedAt) {
      nextEntry.presentedAt = deadline;
    }
  }

  if (changed) {
    await attempt.save();
  }
  return attempt;
};

const serializeCurrentQuestion = (attempt, now = new Date()) => {
  if (!attempt || attempt.status !== "in_progress") return null;
  const index = Number(attempt.currentQuestionIndex || 0);
  const state = attempt.questions[index];
  const source = getQuestionById(state?.questionId);
  if (!state || !source) return null;
  const deadline = getQuestionDeadline(state);
  const remainingMs = deadline
    ? Math.max(0, deadline.getTime() - new Date(now).getTime())
    : QUESTION_TIME_LIMIT_SECONDS * 1000;

  return {
    id: source.id,
    number: index + 1,
    totalQuestions: QUESTIONS_PER_MODULE,
    prompt: source.prompt,
    readingFocus: source.readingFocus || "",
    options: state.optionOrder.map((optionIndex) => source.options[optionIndex]),
    timeLimitSeconds: QUESTION_TIME_LIMIT_SECONDS,
    secondsRemaining: Math.max(0, Math.ceil(remainingMs / 1000)),
    expiresAt: deadline,
    presentedAt: state.presentedAt,
  };
};

const serializeAttempt = (attempt, now = new Date()) => {
  if (!attempt) return null;
  const completed = attempt.status === "completed";
  return {
    id: toId(attempt._id),
    moduleCode: attempt.moduleCode,
    status: attempt.status,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    currentQuestionIndex: Number(attempt.currentQuestionIndex || 0),
    answeredQuestions: (attempt.questions || []).filter((entry) => entry.answeredAt).length,
    correctAnswers: completed ? Number(attempt.correctAnswers || 0) : null,
    timedOutAnswers: completed ? Number(attempt.timedOutAnswers || 0) : null,
    scorePercent: completed ? Number(attempt.scorePercent || 0) : null,
    performance: completed ? getPerformanceBand(attempt.scorePercent) : null,
    passed: completed ? Number(attempt.scorePercent || 0) >= PASS_MARK_PERCENT : null,
    currentQuestion: serializeCurrentQuestion(attempt, now),
  };
};

const getUserForTraining = async (userId) => {
  const user = await User.findById(userId)
    .select("_id name username email role isActive isDeleted isBanned isSuspended")
    .lean();
  if (!user) {
    throw new TeacherTrainingError("User not found.", 404, "user_not_found");
  }
  if (
    user.isActive === false ||
    user.isDeleted === true ||
    user.isBanned === true ||
    user.isSuspended === true
  ) {
    throw new TeacherTrainingError(
      "This account cannot participate in the training.",
      403,
      "account_unavailable"
    );
  }
  return user;
};

const buildFinalResult = (attempts) => {
  const completed = attempts.filter((attempt) => attempt.status === "completed");
  const correctAnswers = completed.reduce(
    (total, attempt) => total + Number(attempt.correctAnswers || 0),
    0
  );
  const possibleAnswers = MODULES.length * QUESTIONS_PER_MODULE;
  const scorePercent = Math.round((correctAnswers / possibleAnswers) * 100);
  const completedAllModules = completed.length === MODULES.length;
  const passed = completedAllModules && scorePercent >= PASS_MARK_PERCENT;

  return {
    scorePercent,
    correctAnswers,
    possibleAnswers,
    completedModules: completed.length,
    totalModules: MODULES.length,
    completedAllModules,
    passed,
    performance: getPerformanceBand(scorePercent),
    salaryIncrementEligible: passed,
    nextTermEligible: passed,
  };
};

const getTeacherTrainingAdminTracker = async ({
  search = "",
  status = "all",
} = {}) => {
  const attempts = await TeacherTrainingAttempt.find({ campaignId: CAMPAIGN_ID })
    .populate({
      path: "userId",
      select: "_id name username email role isActive isDeleted isBanned isSuspended",
    })
    .sort({ startedAt: 1 })
    .lean();
  const participantMap = new Map();

  attempts.forEach((attempt) => {
    const user = attempt.userId;
    const userId = toId(user?._id);
    if (!userId) return;
    if (!participantMap.has(userId)) {
      participantMap.set(userId, { user, attempts: [] });
    }
    participantMap.get(userId).attempts.push(attempt);
  });

  const participants = [...participantMap.values()].map(({ user, attempts: userAttempts }) => {
    const result = buildFinalResult(userAttempts);
    const completedAttempts = userAttempts.filter((attempt) => attempt.status === "completed");
    const startedTimes = userAttempts
      .map((attempt) => new Date(attempt.startedAt || attempt.createdAt || 0).getTime())
      .filter(Number.isFinite);
    const activityTimes = userAttempts
      .flatMap((attempt) => [attempt.updatedAt, attempt.completedAt, attempt.startedAt])
      .map((value) => new Date(value || 0).getTime())
      .filter(Number.isFinite);
    const trackerStatus = result.completedAllModules
      ? result.salaryIncrementEligible
        ? "eligible"
        : "benchmark_not_met"
      : "in_progress";
    const attemptByCode = new Map(
      userAttempts.map((attempt) => [attempt.moduleCode, attempt])
    );

    return {
      id: toId(user._id),
      name: user.name || user.username || "Staff member",
      username: user.username || "",
      email: user.email || "",
      accountStatus:
        user.isDeleted || user.isBanned || user.isSuspended || user.isActive === false
          ? "restricted"
          : "active",
      attended: true,
      startedAt: startedTimes.length ? new Date(Math.min(...startedTimes)) : null,
      lastActivityAt: activityTimes.length ? new Date(Math.max(...activityTimes)) : null,
      completedModules: result.completedModules,
      inProgressModules: userAttempts.filter((attempt) => attempt.status === "in_progress").length,
      totalModules: result.totalModules,
      progressPercent: Math.round((result.completedModules / result.totalModules) * 100),
      scorePercent: result.scorePercent,
      averageCompletedScore: completedAttempts.length
        ? Math.round(
            completedAttempts.reduce(
              (total, attempt) => total + Number(attempt.scorePercent || 0),
              0
            ) / completedAttempts.length
          )
        : 0,
      correctAnswers: result.correctAnswers,
      possibleAnswers: result.possibleAnswers,
      completedAllModules: result.completedAllModules,
      passedBenchmark: result.passed,
      salaryIncrementEligible: result.salaryIncrementEligible,
      trackerStatus,
      performance: result.performance,
      modules: MODULES.map((module) => {
        const attempt = attemptByCode.get(module.code);
        return {
          code: module.code,
          title: module.title,
          status: attempt?.status || "not_started",
          scorePercent:
            attempt?.status === "completed" ? Number(attempt.scorePercent || 0) : null,
          passed:
            attempt?.status === "completed"
              ? Number(attempt.scorePercent || 0) >= PASS_MARK_PERCENT
              : null,
          startedAt: attempt?.startedAt || null,
          completedAt: attempt?.completedAt || null,
        };
      }),
    };
  });

  const normalizedSearch = String(search || "").trim().toLowerCase();
  const normalizedStatus = [
    "all",
    "in_progress",
    "completed",
    "eligible",
    "benchmark_not_met",
  ].includes(String(status || "").trim().toLowerCase())
    ? String(status || "").trim().toLowerCase()
    : "all";
  const visibleParticipants = participants
    .filter((participant) => {
      const matchesSearch =
        !normalizedSearch ||
        `${participant.name} ${participant.username} ${participant.email}`
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesStatus =
        normalizedStatus === "all" ||
        (normalizedStatus === "completed" && participant.completedAllModules) ||
        participant.trackerStatus === normalizedStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((left, right) => {
      if (left.salaryIncrementEligible !== right.salaryIncrementEligible) {
        return left.salaryIncrementEligible ? -1 : 1;
      }
      if (left.completedModules !== right.completedModules) {
        return right.completedModules - left.completedModules;
      }
      return new Date(right.lastActivityAt || 0) - new Date(left.lastActivityAt || 0);
    });

  return {
    generatedAt: new Date(),
    campaign: {
      id: CAMPAIGN_ID,
      title: "Staff Teachers Online Training",
      academy: "Kurah Tech and Arts Academy",
      mode: "Self-paced and virtual",
      moduleCount: MODULES.length,
      deadlineAt: null,
      isOpen: true,
    },
    benchmark: {
      label: "Salary increment benchmark",
      passMarkPercent: PASS_MARK_PERCENT,
      requiresAllModules: true,
    },
    summary: {
      totalParticipants: participants.length,
      inProgress: participants.filter((participant) => !participant.completedAllModules).length,
      completedAll: participants.filter((participant) => participant.completedAllModules).length,
      benchmarkPassed: participants.filter(
        (participant) => participant.salaryIncrementEligible
      ).length,
      benchmarkNotMet: participants.filter(
        (participant) =>
          participant.completedAllModules && !participant.salaryIncrementEligible
      ).length,
    },
    filters: {
      search: String(search || "").trim(),
      status: normalizedStatus,
      returned: visibleParticipants.length,
    },
    participants: visibleParticipants,
  };
};

const buildTrainingPayload = async (userId, { now = new Date() } = {}) => {
  const user = await getUserForTraining(userId);
  let attempts = await TeacherTrainingAttempt.find({
    userId,
    campaignId: CAMPAIGN_ID,
  }).sort({ startedAt: 1 });

  for (const attempt of attempts) {
    await settleExpiredAttempt(attempt, now);
  }

  attempts = await TeacherTrainingAttempt.find({
    userId,
    campaignId: CAMPAIGN_ID,
  }).sort({ startedAt: 1 });
  const attemptByCode = new Map(attempts.map((attempt) => [attempt.moduleCode, attempt]));
  const completedModules = attempts.filter((attempt) => attempt.status === "completed").length;
  const access = getCampaignAccess(now);

  return {
    campaign: {
      id: CAMPAIGN_ID,
      title: "Staff Teachers Online Training",
      academy: "Kurah Tech and Arts Academy",
      mode: "Self-paced and virtual",
      passMarkPercent: PASS_MARK_PERCENT,
      moduleCount: MODULES.length,
      questionsPerModule: QUESTIONS_PER_MODULE,
      questionTimeLimitSeconds: QUESTION_TIME_LIMIT_SECONDS,
      requirement:
        "Complete all modules at your own pace and achieve at least 60% cumulatively.",
      access,
    },
    participant: {
      id: toId(user._id),
      name: user.name || user.username || "Teacher",
      username: user.username || "",
      email: user.email || "",
      attended: attempts.length > 0,
    },
    progress: {
      completedModules,
      totalModules: MODULES.length,
      percent: Math.round((completedModules / MODULES.length) * 100),
      activeModuleCode:
        attempts.find((attempt) => attempt.status === "in_progress")?.moduleCode || "",
    },
    modules: MODULES.map((module) => ({
      ...serializeModuleContent(module),
      attempt: serializeAttempt(attemptByCode.get(module.code), now),
    })),
    finalResult: buildFinalResult(attempts),
  };
};

const getTeacherTrainingStatus = (userId, options = {}) =>
  buildTrainingPayload(userId, options);

const startTeacherTrainingAssessment = async (
  { userId, moduleCode },
  { now = new Date(), random = Math.random } = {}
) => {
  await getUserForTraining(userId);
  const module = getModuleByCode(moduleCode);
  if (!module) {
    throw new TeacherTrainingError("Training module not found.", 404, "module_not_found");
  }

  const existing = await TeacherTrainingAttempt.findOne({
    userId,
    campaignId: CAMPAIGN_ID,
    moduleCode: module.code,
  });
  if (existing) {
    await settleExpiredAttempt(existing, now);
    if (existing.status === "completed") {
      throw new TeacherTrainingError(
        "This module assessment has already been completed.",
        409,
        "assessment_completed",
        { moduleCode: module.code }
      );
    }
    return buildTrainingPayload(userId, { now });
  }

  const selectedQuestions = shuffle(module.assessment, random);
  const questionStates = selectedQuestions.map((entry, index) => ({
    questionId: entry.id,
    optionOrder: shuffle([0, 1, 2, 3], random),
    presentedAt: index === 0 ? now : null,
  }));

  try {
    await TeacherTrainingAttempt.create({
      userId,
      campaignId: CAMPAIGN_ID,
      moduleCode: module.code,
      status: "in_progress",
      questions: questionStates,
      currentQuestionIndex: 0,
      startedAt: now,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }

  return buildTrainingPayload(userId, { now });
};

const answerTeacherTrainingQuestion = async (
  { userId, moduleCode, questionId, selectedIndex },
  { now = new Date() } = {}
) => {
  await getUserForTraining(userId);
  const module = getModuleByCode(moduleCode);
  if (!module) {
    throw new TeacherTrainingError("Training module not found.", 404, "module_not_found");
  }

  let attempt = await TeacherTrainingAttempt.findOne({
    userId,
    campaignId: CAMPAIGN_ID,
    moduleCode: module.code,
  });
  if (!attempt) {
    throw new TeacherTrainingError(
      "Start this module assessment before answering.",
      409,
      "assessment_not_started"
    );
  }

  attempt = await settleExpiredAttempt(attempt, now);
  if (attempt.status !== "in_progress") {
    throw new TeacherTrainingError(
      "This assessment is already complete.",
      409,
      "assessment_completed",
      { training: await buildTrainingPayload(userId, { now }) }
    );
  }

  const index = Number(attempt.currentQuestionIndex || 0);
  const state = attempt.questions[index];
  if (!state || state.questionId !== String(questionId || "").trim()) {
    throw new TeacherTrainingError(
      "This question is no longer active.",
      409,
      "question_changed",
      { training: await buildTrainingPayload(userId, { now }) }
    );
  }

  const choice =
    selectedIndex === null || selectedIndex === undefined || selectedIndex === ""
      ? null
      : Number(selectedIndex);
  if (choice !== null && (!Number.isInteger(choice) || choice < 0 || choice > 3)) {
    throw new TeacherTrainingError(
      "Select one answer from A to D.",
      400,
      "invalid_answer"
    );
  }

  const source = getQuestionById(state.questionId);
  const deadline = getQuestionDeadline(state);
  const receivedLate =
    !deadline || new Date(now).getTime() >= new Date(deadline).getTime();
  const timedOut = choice === null || receivedLate;
  const originalIndex = timedOut ? null : state.optionOrder[choice];
  const correct = !timedOut && originalIndex === source.correctIndex;

  state.answeredAt = receivedLate ? deadline || now : now;
  state.selectedIndex = timedOut ? null : choice;
  state.selectedOriginalIndex = originalIndex;
  state.correct = Boolean(correct);
  state.timedOut = Boolean(timedOut);
  attempt.correctAnswers = Number(attempt.correctAnswers || 0) + (correct ? 1 : 0);
  attempt.timedOutAnswers = Number(attempt.timedOutAnswers || 0) + (timedOut ? 1 : 0);
  attempt.currentQuestionIndex = index + 1;

  if (attempt.currentQuestionIndex >= attempt.questions.length) {
    completeAttempt(attempt, state.answeredAt || now);
  } else {
    attempt.questions[attempt.currentQuestionIndex].presentedAt =
      state.answeredAt || now;
  }
  await attempt.save();

  return {
    answerResult: {
      recorded: true,
      timedOut,
      moduleCompleted: attempt.status === "completed",
    },
    training: await buildTrainingPayload(userId, { now }),
  };
};

module.exports = {
  CAMPAIGN_ID,
  TeacherTrainingError,
  answerTeacherTrainingQuestion,
  getCampaignAccess,
  getPerformanceBand,
  getTeacherTrainingAdminTracker,
  getTeacherTrainingStatus,
  settleExpiredAttempt,
  startTeacherTrainingAssessment,
};
