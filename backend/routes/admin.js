const express = require("express");
const fs = require("fs");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const requireStepUp = require("../middleware/requireStepUp");
const requirePermissions = require("../middleware/requirePermissions");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const Post = require("../models/Post");
const Message = require("../models/Message");
const Report = require("../models/Report");
const AdminComplaint = require("../models/AdminComplaint");
const UserStrike = require("../models/UserStrike");
const ModerationCase = require("../models/ModerationCase");
const CreatorProfile = require("../models/CreatorProfile");
const Track = require("../models/Track");
const Album = require("../models/Album");
const Book = require("../models/Book");
const Video = require("../models/Video");
const Purchase = require("../models/Purchase");
const {
  listAdminSchoolTuitionPayments,
} = require("../services/schoolTuitionPaymentService");
const { writeAuditLog } = require("../services/auditLogService");
const { createNotification } = require("../services/notificationService");
const { disconnectUserSockets } = require("../utils/realtimeSessions");
const { buildAdminDashboard } = require("../services/adminDashboardService");
const { sendModerationMessengerWarning } = require("../services/moderationMessengerService");
const { notifyCreatorPublishedPaidContent } = require("../services/fanReturnPathService");
const {
  applyModerationAction,
  getModerationItem,
  listModerationItems,
  resolvePrivateMediaPath,
} = require("../services/uploadModerationService");
const {
  banUserAccount,
  suspendUserAccount,
} = require("../services/moderationService");
const {
  buildCreatorFinanceRepository,
} = require("../services/creatorFinanceRepositoryService");
const {
  buildFinanceAssuranceClose,
} = require("../services/financeAssuranceCloseService");
const {
  buildAssuranceDashboard,
} = require("../services/assuranceDashboardService");
const {
  buildCapitalReadiness,
} = require("../services/capitalReadinessService");
const {
  listAdminCreatorPayoutRequests,
  updateCreatorPayoutRequestStatus,
} = require("../services/creatorPayoutRequestService");
const {
  createCreatorPayoutBatch,
  exportCreatorPayoutBatch,
  listCreatorPayoutBatches,
  reconcileCreatorPayoutBatch,
} = require("../services/creatorPayoutBatchService");
const {
  listAdminWithdrawals,
  retryWithdrawalTransfer,
} = require("../services/withdrawalService");
const {
  buildRevenueLedgerSummary,
} = require("../services/revenueLedgerService");
const {
  buildOverview,
  buildUserGrowth,
  buildContentUploads,
  buildRevenueAnalytics,
  buildCommerceOperationsAnalytics,
  buildEngagementAnalytics,
  buildMessagesOverview,
  buildTopCreators,
  buildTopContent,
  buildRecentActivity,
  buildSystemAlerts,
  buildReliabilityHealth,
  buildReportsSummary,
  backfillDailyAnalytics,
  logAnalyticsEvent,
} = require("../services/analyticsService");
const {
  buildProductScorecard,
} = require("../services/productScorecardService");
const {
  buildFanRetentionCohorts,
} = require("../services/fanRetentionCohortService");
const {
  buildRecommendationDiagnostics,
  updateRecommendationPolicy,
} = require("../services/recommendationGovernanceService");
const {
  buildExecutiveOperatingDashboard,
} = require("../services/executiveOperatingDashboardService");
const {
  buildLaunchGrowthOperatingSystem,
  createRevenueCampaign,
  enrollCreatorLifecycleProgram,
  preflightPayoutAutomation,
  updateCreatorLifecycleEnrollment,
  updateRevenueCampaign,
} = require("../services/launchGrowthOperatingService");
const {
  buildScaleEvidenceOperatingSystem,
  createCalendarEntry,
  createExpansionBet,
  createPartnerPilot,
  updateCalendarEntry,
  updateExpansionBet,
  updatePartnerPilot,
  upsertSloPolicy,
} = require("../services/scaleEvidenceOperatingService");
const {
  buildExpansionPlatformOperatingSystem,
  createAutomationSuggestion,
  createExpansionExperiment,
  createGovernanceDecision,
  reviewAutomationSuggestion,
  reviewCreatorLaunchPlan,
  updateExpansionExperiment,
  updateGovernanceDecision,
} = require("../services/expansionPlatformOperatingService");
const {
  buildEcosystemNetworkOperatingSystem,
  createCommunityLoop,
  createCreatorServiceEnrollment,
  createMarketReadinessReview,
  createPartnerIntegration,
  updateCommunityLoop,
  updateCreatorServiceEnrollment,
  updateMarketReadinessReview,
  updatePartnerIntegration,
} = require("../services/ecosystemNetworkOperatingService");
const {
  buildNetworkIntelligenceOperatingSystem,
  createAutomationRegistryEntry,
  createCreatorIntelligencePrompt,
  createIntelligenceProduct,
  createMetricContract,
  createNetworkProgram,
  createPartnerGraduation,
  createPredictiveWarning,
  updateAutomationRegistryEntry,
  updateIntelligenceProduct,
  updateMetricContract,
  updateNetworkProgram,
  updatePartnerGraduation,
  updatePredictiveWarning,
} = require("../services/networkIntelligenceOperatingService");
const {
  buildAutomationOrchestrationOperatingSystem,
  createAutomationRun,
  createWorkflowDefinition,
  createWorkflowRun,
  transitionAutomationControl,
  updateAutomationRun,
  updateWorkflowDefinition,
  updateWorkflowRun,
  upsertResilienceObjective,
} = require("../services/automationOrchestrationOperatingService");
const {
  buildResilienceAssuranceAuditOperatingSystem,
  createAssuranceControl,
  createAssuranceEvidencePack,
  createAuditControlTest,
  createAuditDomain,
  createAuditFinding,
  createResilienceDrill,
  createResilienceIncident,
  updateAssuranceControl,
  updateAssuranceEvidencePack,
  updateAuditControlTest,
  updateAuditDomain,
  updateAuditFinding,
  updateResilienceDrill,
  updateResilienceIncident,
  upsertResilienceGate,
} = require("../services/resilienceAssuranceAuditOperatingService");
const { buildReadinessPayload } = require("../services/healthService");
const {
  getStorageActionCatalog,
  getStorageOverview,
  previewCleanup,
  runCleanup,
} = require("../services/storageMaintenanceService");
const {
  refundPurchase,
  DEFAULT_STUCK_PENDING_MINUTES,
  buildPurchaseAdminDetail,
  buildTransactionListItem,
  reconcilePurchase,
} = require("../services/paymentOpsService");
const { normalizeMediaValue } = require("../utils/userMedia");
const { mediaDocumentToUrl } = require("../utils/cloudinaryMedia");
const { sanitizePhoneValue } = require("../utils/profileFields");

const router = express.Router();

let rateLimit;
try {
  rateLimit = require("express-rate-limit");
} catch (_error) {
  console.warn("express-rate-limit not installed; admin route rate limiting disabled");
  rateLimit = () => (_req, _res, next) => next();
}

const ADMIN_ROLES = ["admin", "super_admin"];
const SUPER_ADMIN_ROLES = ["super_admin"];
const ADMIN_MANAGEABLE_ROLES = new Set(["user"]);
const adminMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.user?.id ? `user:${req.user.id}` : rateLimit.ipKeyGenerator(req.ip || ""),
  message: { error: "Too many admin actions. Please try again later." },
});

const toId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);
const clamp = (value, min, max, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
};
const getAnalyticsFilters = (req) => ({
  range: String(req.query.range || "30d").trim().toLowerCase(),
  startDate: String(req.query.startDate || "").trim(),
  endDate: String(req.query.endDate || "").trim(),
  category: String(req.query.category || "all").trim().toLowerCase(),
  interval: String(req.query.interval || "daily").trim().toLowerCase(),
});
const normalizeComplaintStatus = (value = "") => {
  const next = String(value || "").trim().toLowerCase();
  return ["open", "reviewing", "resolved", "dismissed"].includes(next) ? next : "";
};
const avatarToUrl = (avatar) => normalizeMediaValue(avatar).url;
const mapComplaint = (entry = {}) => {
  const metadata =
    entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
      ? entry.metadata
      : {};

  return {
    _id: toId(entry._id),
    subject: String(entry.subject || ""),
    category: String(entry.category || "general"),
    details: String(entry.details || ""),
    sourcePath: String(entry.sourcePath || ""),
    sourceLabel: String(entry.sourceLabel || ""),
    priority: String(entry.priority || "medium"),
    priorityScore: Number(entry.priorityScore || 0),
    status: String(entry.status || "open"),
    adminNote: String(entry.adminNote || ""),
    createdAt: entry.createdAt || null,
    updatedAt: entry.updatedAt || null,
    reviewedAt: entry.reviewedAt || null,
    resolvedAt: entry.resolvedAt || null,
    reporter: entry.reporterId
      ? {
          _id: toId(entry.reporterId._id || entry.reporterId),
          name: String(entry.reporterId.name || ""),
          username: String(entry.reporterId.username || ""),
          avatar: avatarToUrl(entry.reporterId.avatar),
        }
      : null,
    publicReporter: metadata.publicReport
      ? {
          name: String(metadata.reporterName || ""),
          email: String(metadata.reporterEmail || ""),
          sourceUrl: String(metadata.sourceUrl || ""),
          rightsOwner: String(metadata.rightsOwner || ""),
          workTitle: String(metadata.workTitle || ""),
        }
      : null,
    reviewedBy: entry.reviewedBy
      ? {
          _id: toId(entry.reviewedBy._id || entry.reviewedBy),
          name: String(entry.reviewedBy.name || ""),
          username: String(entry.reviewedBy.username || ""),
          email: String(entry.reviewedBy.email || ""),
        }
      : null,
  };
};

const toAdminUserDTO = (user, requesterRole = "admin") => ({
  _id: toId(user._id),
  displayName: user.name || "",
  username: user.username || "",
  email: ["admin", "super_admin"].includes(String(requesterRole || "").toLowerCase())
    ? user.email || ""
    : "",
  phone: sanitizePhoneValue(user.phone),
  role: user.role || "user",
  isBanned: Boolean(user.isBanned),
  isDeleted: Boolean(user.isDeleted),
  status: user.isDeleted ? "deleted" : user.isBanned ? "banned" : "active",
  createdAt: user.createdAt,
  lastLoginAt: user.lastLogin || null,
});

const canManageTarget = ({ actorRole, targetRole }) => {
  const normalizedActor = String(actorRole || "").toLowerCase();
  const normalizedTarget = String(targetRole || "").toLowerCase();
  if (normalizedActor === "super_admin") return true;
  if (normalizedActor !== "admin") return false;
  return ADMIN_MANAGEABLE_ROLES.has(normalizedTarget);
};

const assertCanManageTarget = ({ actorRole, target, res }) => {
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return false;
  }

  if (!canManageTarget({ actorRole, targetRole: target.role })) {
    res.status(403).json({ error: "Forbidden to manage this user" });
    return false;
  }

  return true;
};

const applyAdminUserSafetyAction = async ({
  req,
  res,
  targetId,
  action,
  reason,
}) => {
  if (!isValidId(targetId)) {
    res.status(400).json({ error: "Invalid user id" });
    return null;
  }

  const target = await User.findById(targetId);
  if (toId(target?._id) === req.user.id) {
    res.status(400).json({ error: `You cannot ${action} yourself` });
    return null;
  }

  if (!assertCanManageTarget({ actorRole: req.user.role, target, res })) {
    return null;
  }

  const normalizedReason = String(reason || "").trim() || "Moderation action";

  if (action === "suspend") {
    await suspendUserAccount({
      targetUserId: target._id,
      actorId: req.user.id,
      reason: normalizedReason,
      req,
    });
  } else if (action === "ban") {
    await banUserAccount({
      targetUserId: target._id,
      actorId: req.user.id,
      reason: normalizedReason,
      req,
    });
  } else {
    res.status(400).json({ error: "Unsupported user action" });
    return null;
  }

  await writeAuditLog({
    req,
    actorId: req.user.id,
    action: `admin.user.${action}`,
    targetType: "User",
    targetId: toId(target._id),
    reason: normalizedReason,
    metadata: {
      action,
    },
  });

  await sendModerationMessengerWarning({
    req,
    actor: req.user,
    recipientId: target._id,
    action: action === "ban" ? "ban_user" : "suspend_user",
    reason: normalizedReason,
    scope: "user",
    clientSeed: toId(target._id),
  }).catch(() => null);

  if (action === "ban") {
    await logAnalyticsEvent({
      type: "account_banned",
      userId: target._id,
      actorRole: target.role,
      targetId: target._id,
      targetType: "user",
      metadata: { reason: normalizedReason, bannedBy: req.user.id },
    }).catch(() => null);
  }

  return target;
};

const applyUploadModerationRouteAction = async ({ req, res, itemId, action }) => {
  if (!isValidId(itemId)) {
    res.status(400).json({ error: "Invalid moderation item id" });
    return null;
  }

  const item = await applyModerationAction({
    itemId,
    action,
    reason: req.body?.reason || "",
    actor: req.user,
    req,
  });

  return item;
};

const STRIKE_RULES = {
  temporaryMute: 3,
  temporaryBan: 5,
  permanentBan: 7,
};

const applyUserStrikes = async ({ targetUserId, reportId, count = 1, reason = "" }) => {
  if (!targetUserId) return { strikeCount: 0, action: "" };
  const strike = await UserStrike.findOneAndUpdate(
    { userId: targetUserId },
    {
      $inc: { count: Number(count) || 1 },
      $push: {
        history: {
          reportId,
          count: Number(count) || 1,
          reason: String(reason || "").slice(0, 300),
          createdAt: new Date(),
        },
      },
      $set: { lastActionAt: new Date() },
    },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );
  const target = await User.findById(targetUserId);
  if (!target) return { strikeCount: Number(strike.count) || 0, action: "" };

  const total = Number(strike.count) || 0;
  let action = "";
  if (total >= STRIKE_RULES.permanentBan) {
    target.isBanned = true;
    target.isActive = false;
    target.banReason = "Permanent ban due to repeated policy violations";
    action = "permanent_ban";
  } else if (total >= STRIKE_RULES.temporaryBan) {
    target.isBanned = true;
    target.banReason = "Temporary ban due to policy violations";
    action = "temporary_ban";
  } else if (total >= STRIKE_RULES.temporaryMute) {
    action = "temporary_mute";
  }
  await target.save();
  if (action === "permanent_ban" || action === "temporary_ban") {
    await logAnalyticsEvent({
      type: "account_banned",
      userId: target._id,
      actorRole: target.role,
      targetId: target._id,
      targetType: "user",
      metadata: { action, reason: target.banReason || reason || "" },
    }).catch(() => null);
  }
  return { strikeCount: total, action };
};

router.use(auth, requireRole(ADMIN_ROLES));
router.use("/moderation", require("./moderation"));
router.use("/news", require("./newsAdmin.routes"));
router.use("/assistant", require("./adminAssistant"));
router.use("/marketplace", require("./marketplaceAdminRoutes"));
router.use("/raffle", require("./adminRaffle"));
router.use("/millionaire", require("./adminMillionaire"));
router.use("/bright-future-academy", require("./adminBrightFutureAcademy"));
router.use("/top-up-promo", require("./adminTopUpPromo"));

router.get("/system/readiness", async (_req, res) => {
  try {
    const payload = await buildReadinessPayload();
    return res.set("Cache-Control", "no-store").json(payload);
  } catch (err) {
    return res
      .status(500)
      .set("Cache-Control", "no-store")
      .json({ error: err.message || "Failed to load system readiness" });
  }
});

router.get("/assurance/dashboard", async (req, res) => {
  try {
    return res.json(await buildAssuranceDashboard(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res
      .status(code)
      .json({ error: err.message || "Failed to load assurance dashboard" });
  }
});

router.get("/capital/readiness", async (req, res) => {
  try {
    return res.json(await buildCapitalReadiness({
      ...getAnalyticsFilters(req),
      startingCashBalance: req.query.startingCashBalance,
    }));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res
      .status(code)
      .json({ error: err.message || "Failed to load capital readiness" });
  }
});

const resolveBookManuscriptUrl = (book = {}) =>
  mediaDocumentToUrl(book.contentMedia, book.contentUrl || book.fileUrl || "");

const resolveBookPreviewUrl = (book = {}) =>
  mediaDocumentToUrl(book.previewMedia, book.previewUrl || "");

const resolveBookCoverUrl = (book = {}) =>
  mediaDocumentToUrl(book.coverMedia, book.coverImageUrl || book.coverUrl || "");

const resolveAlbumCoverUrl = (album = {}) =>
  mediaDocumentToUrl(album.coverMedia, album.coverUrl || "");

const resolveAlbumTracks = (album = {}) =>
  (Array.isArray(album.tracks) ? album.tracks : [])
    .slice()
    .sort((left, right) => Number(left?.order || 0) - Number(right?.order || 0))
    .map((track, index) => ({
      title: String(track?.title || `Track ${index + 1}`),
      order: Number(track?.order || index + 1),
      audioUrl: mediaDocumentToUrl(track?.trackMedia, track?.trackUrl || ""),
      previewUrl: mediaDocumentToUrl(track?.previewMedia, track?.previewUrl || ""),
      duration: Number(track?.duration || 0),
    }));

const resolveTrackAudioUrl = (track = {}) =>
  mediaDocumentToUrl(track.audioMedia, track.audioUrl || track.fullAudioUrl || track.videoUrl || "");

const resolveTrackPreviewUrl = (track = {}) =>
  mediaDocumentToUrl(
    track.previewMedia,
    track.previewUrl || track.previewSampleUrl || track.previewClipUrl || ""
  );

const resolveTrackCoverUrl = (track = {}) =>
  mediaDocumentToUrl(track.coverMedia, track.coverImageUrl || track.coverUrl || "");

const resolveVideoUrl = (video = {}) =>
  mediaDocumentToUrl(video.videoMedia, video.videoUrl || "");

const resolveVideoPreviewUrl = (video = {}) =>
  mediaDocumentToUrl(video.previewClipMedia, video.previewClipUrl || "");

const resolveVideoCoverUrl = (video = {}) =>
  mediaDocumentToUrl(video.coverMedia, video.coverImageUrl || "");

const resolveContentStatus = (row = {}) => {
  const status = String(row.publishedStatus || row.status || "").trim().toLowerCase();
  if (status) return status;
  return row.isPublished === false ? "draft" : "published";
};

const toAdminTrackReviewDTO = (track = {}) => {
  const creator = track.creatorId && typeof track.creatorId === "object" ? track.creatorId : null;
  const creatorUser = creator?.userId && typeof creator.userId === "object" ? creator.userId : null;
  const isPodcast = String(track.kind || "").toLowerCase() === "podcast";
  const audioUrl = resolveTrackAudioUrl(track);
  const previewUrl = resolveTrackPreviewUrl(track);

  return {
    id: toId(track._id),
    type: isPodcast ? "podcast" : "track",
    title: String(track.title || (isPodcast ? "Untitled Podcast" : "Untitled Track")),
    artistName: String(track.artistName || ""),
    description: String(track.description || ""),
    status: resolveContentStatus(track),
    publishedStatus: resolveContentStatus(track),
    copyrightScanStatus: String(track.copyrightScanStatus || "pending_scan"),
    verificationNotes: String(track.verificationNotes || ""),
    reviewRequired: Boolean(track.reviewRequired),
    moderationStatus: String(track.moderationStatus || "ALLOW"),
    price: Number(track.price || track.priceNGN || 0),
    currency: String(track.currency || "NGN"),
    genre: String(track.genre || ""),
    audioAvailable: Boolean(audioUrl),
    previewAvailable: Boolean(previewUrl),
    audioUrl,
    previewUrl,
    coverImageUrl: resolveTrackCoverUrl(track),
    createdAt: track.createdAt || null,
    updatedAt: track.updatedAt || null,
    creator: creator
      ? {
          id: toId(creator._id),
          displayName: String(creator.displayName || creator.fullName || ""),
          username: String(creatorUser?.username || ""),
          userId: toId(creatorUser?._id || creator.userId),
          email: String(creatorUser?.email || ""),
        }
      : null,
  };
};

const toAdminAlbumReviewDTO = (album = {}) => {
  const creator = album.creatorId && typeof album.creatorId === "object" ? album.creatorId : null;
  const creatorUser = creator?.userId && typeof creator.userId === "object" ? creator.userId : null;
  const tracks = resolveAlbumTracks(album);

  return {
    id: toId(album._id),
    type: "album",
    title: String(album.title || "Untitled Album"),
    description: String(album.description || ""),
    releaseType: String(album.releaseType || album.contentType || "album"),
    status: resolveContentStatus(album),
    publishedStatus: resolveContentStatus(album),
    copyrightScanStatus: String(album.copyrightScanStatus || "pending_scan"),
    verificationNotes: String(album.verificationNotes || ""),
    reviewRequired: Boolean(album.reviewRequired),
    moderationStatus: String(album.moderationStatus || "ALLOW"),
    price: Number(album.price || album.priceNGN || 0),
    currency: String(album.currency || "NGN"),
    coverImageUrl: resolveAlbumCoverUrl(album),
    tracks,
    tracksAvailable: tracks.length > 0 && tracks.every((track) => Boolean(track.audioUrl)),
    totalTracks: Number(album.totalTracks || tracks.length),
    createdAt: album.createdAt || null,
    updatedAt: album.updatedAt || null,
    creator: creator
      ? {
          id: toId(creator._id),
          displayName: String(creator.displayName || creator.fullName || ""),
          username: String(creatorUser?.username || ""),
          userId: toId(creatorUser?._id || creator.userId),
          email: String(creatorUser?.email || ""),
        }
      : null,
  };
};

const toAdminBookReviewDTO = (book = {}) => {
  const creator = book.creatorId && typeof book.creatorId === "object" ? book.creatorId : null;
  const creatorUser = creator?.userId && typeof creator.userId === "object" ? creator.userId : null;

  return {
    id: toId(book._id),
    type: "book",
    title: String(book.title || "Untitled Book"),
    authorName: String(book.authorName || ""),
    subtitle: String(book.subtitle || ""),
    description: String(book.description || ""),
    status: resolveContentStatus(book),
    publishedStatus: resolveContentStatus(book),
    copyrightScanStatus: String(book.copyrightScanStatus || "pending_scan"),
    verificationNotes: String(book.verificationNotes || ""),
    reviewRequired: Boolean(book.reviewRequired),
    moderationStatus: String(book.moderationStatus || "ALLOW"),
    price: Number(book.price || book.priceNGN || 0),
    currency: String(book.currency || "NGN"),
    genre: String(book.genre || ""),
    language: String(book.language || ""),
    fileFormat: String(book.fileFormat || ""),
    manuscriptUrl: resolveBookManuscriptUrl(book),
    previewUrl: resolveBookPreviewUrl(book),
    coverImageUrl: resolveBookCoverUrl(book),
    createdAt: book.createdAt || null,
    updatedAt: book.updatedAt || null,
    creator: creator
      ? {
          id: toId(creator._id),
          displayName: String(creator.displayName || creator.fullName || ""),
          username: String(creatorUser?.username || ""),
          userId: toId(creatorUser?._id || creator.userId),
          email: String(creatorUser?.email || ""),
        }
      : null,
  };
};

const toAdminVideoReviewDTO = (video = {}) => {
  const creator =
    video.creatorProfileId && typeof video.creatorProfileId === "object"
      ? video.creatorProfileId
      : null;
  const creatorUser = creator?.userId && typeof creator.userId === "object" ? creator.userId : null;
  const videoUrl = resolveVideoUrl(video);

  return {
    id: toId(video._id),
    type: "video",
    title: String(video.caption || "Untitled Video"),
    description: String(video.description || ""),
    status: resolveContentStatus(video),
    publishedStatus: resolveContentStatus(video),
    copyrightScanStatus: String(video.copyrightScanStatus || "pending_scan"),
    verificationNotes: String(video.verificationNotes || ""),
    reviewRequired: Boolean(video.reviewRequired),
    moderationStatus: String(video.moderationStatus || "pending"),
    visibility: String(video.visibility || "private"),
    videoAvailable: Boolean(videoUrl),
    videoUrl,
    previewClipUrl: resolveVideoPreviewUrl(video),
    coverImageUrl: resolveVideoCoverUrl(video),
    durationSec: Number(video.durationSec || 0),
    videoFormat: String(video.videoFormat || ""),
    price: Number(video.price || 0),
    currency: "NGN",
    createdAt: video.createdAt || video.time || null,
    updatedAt: video.updatedAt || video.time || null,
    creator: creator
      ? {
          id: toId(creator._id),
          displayName: String(creator.displayName || creator.fullName || video.name || ""),
          username: String(creatorUser?.username || video.username || ""),
          userId: toId(creatorUser?._id || creator.userId || video.userId),
          email: String(creatorUser?.email || ""),
        }
      : {
          id: toId(video.creatorProfileId),
          displayName: String(video.name || ""),
          username: String(video.username || ""),
          userId: toId(video.userId),
          email: "",
        },
  };
};

router.get("/users", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const role = String(req.query.role || "").trim().toLowerCase();
    const banned = String(req.query.banned || "").trim().toLowerCase();
    const requesterRole = String(req.user?.role || "admin").toLowerCase();

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (requesterRole !== "super_admin") {
      if (role && role !== "user") {
        return res.status(403).json({ error: "Forbidden" });
      }
      query.role = "user";
    } else if (role) {
      query.role = role;
    }
    if (banned === "true" || banned === "false") {
      query.isBanned = banned === "true";
    }

    const [rows, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "_id name username email role lastLogin isBanned isDeleted createdAt"
        )
        .lean(),
      User.countDocuments(query),
    ]);

    return res.json({
      page,
      limit,
      total,
      users: rows.map((row) => toAdminUserDTO(row, requesterRole)),
    });
  } catch (err) {
    console.error("Admin users list error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const user = await User.findById(req.params.id)
      .select(
        "_id name username email phone role lastLogin isActive isBanned banReason bannedAt isDeleted deletedAt forcePasswordReset tokenVersion followers following createdAt updatedAt"
      )
      .lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!assertCanManageTarget({ actorRole: req.user.role, target: user, res })) {
      return;
    }

    const [postsCount] = await Promise.all([
      Post.countDocuments({ author: user._id }).catch(() => 0),
    ]);

    const requesterRole = String(req.user?.role || "admin").toLowerCase();
    return res.json({
      ...toAdminUserDTO(user, requesterRole),
      isActive: Boolean(user.isActive),
      bannedReason: user.banReason || "",
      bannedAt: user.bannedAt || null,
      deletedAt: user.deletedAt || null,
      forcePasswordReset: Boolean(user.forcePasswordReset),
      stats: {
        postsCount: Number(postsCount) || 0,
        followersCount: Array.isArray(user.followers) ? user.followers.length : 0,
        followingCount: Array.isArray(user.following) ? user.following.length : 0,
      },
    });
  } catch (err) {
    console.error("Admin user detail error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.patch(
  "/users/:id",
  requireStepUp({ adminOnly: true }),
  adminMutationLimiter,
  async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const actorId = req.user.id;
    const actorRole = String(req.user.role || "user");
    const target = await User.findById(req.params.id);
    if (toId(target?._id) === req.user.id) {
      return res.status(400).json({ error: "You cannot modify your own admin account here" });
    }
    if (!assertCanManageTarget({ actorRole, target, res })) {
      return;
    }

    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const allowedFields = ["name", "username", "phone", "country", "bio", "isActive"];
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(payload, field)) {
        target[field] = payload[field];
      }
    }

    if (Object.prototype.hasOwnProperty.call(payload, "role")) {
      if (!SUPER_ADMIN_ROLES.includes(actorRole)) {
        return res.status(403).json({ error: "Only super_admin can change roles" });
      }
      const nextRole = String(payload.role || "").trim();
      if (!["user", "admin", "super_admin", "artist", "moderator"].includes(nextRole)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      target.role = nextRole;
    }

    await target.save();
    if (!target.isActive) {
      disconnectUserSockets(req.app, target._id, {
        code: "ACCOUNT_INACTIVE",
        message: "Your account was disabled. Please contact support.",
      });
    }
    await writeAuditLog({
      req,
      actorId,
      action: "admin.user.update",
      targetType: "User",
      targetId: toId(target._id),
      reason: String(req.body?.reason || ""),
      metadata: { fields: Object.keys(payload || {}) },
    });

    return res.json({
      success: true,
      user: toAdminUserDTO(target.toObject ? target.toObject() : target, req.user?.role),
    });
  } catch (err) {
    console.error("Admin user update error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post("/users/:id/suspend", requireStepUp({ adminOnly: true }), adminMutationLimiter, async (req, res) => {
  try {
    const target = await applyAdminUserSafetyAction({
      req,
      res,
      targetId: req.params.id,
      action: "suspend",
      reason: req.body?.reason || "",
    });
    if (!target) {
      return;
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin suspend error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post("/users/:id/ban", requireStepUp({ adminOnly: true }), adminMutationLimiter, async (req, res) => {
  try {
    const target = await applyAdminUserSafetyAction({
      req,
      res,
      targetId: req.params.id,
      action: "ban",
      reason: req.body?.reason || "",
    });
    if (!target) {
      return;
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin ban error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post(
  "/users/:id/unban",
  requireStepUp({ adminOnly: true }),
  adminMutationLimiter,
  async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const target = await User.findById(req.params.id);
    if (!assertCanManageTarget({ actorRole: req.user.role, target, res })) {
      return;
    }

    target.isBanned = false;
    target.banReason = "";
    target.bannedAt = null;
    target.bannedBy = null;
    if (!target.isSuspended) {
      target.isActive = true;
    }
    await target.save();

    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.user.unban",
      targetType: "User",
      targetId: toId(target._id),
      reason: String(req.body?.reason || ""),
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin unban error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post(
  "/users/:id/unsuspend",
  requireStepUp({ adminOnly: true }),
  adminMutationLimiter,
  async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const target = await User.findById(req.params.id);
    if (!assertCanManageTarget({ actorRole: req.user.role, target, res })) {
      return;
    }

    target.isSuspended = false;
    target.suspendedAt = null;
    target.suspendedUntil = null;
    target.suspensionReason = "";
    target.tokenVersion = (Number(target.tokenVersion) || 0) + 1;
    if (!target.isBanned) {
      target.isActive = true;
    }
    await target.save();

    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.user.unsuspend",
      targetType: "User",
      targetId: toId(target._id),
      reason: String(req.body?.reason || ""),
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin unsuspend error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post(
  "/users/:id/force-logout",
  requireStepUp({ adminOnly: true }),
  adminMutationLimiter,
  async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const target = await User.findById(req.params.id);
    if (toId(target?._id) === req.user.id) {
      return res.status(400).json({ error: "Use normal logout for your current session" });
    }
    if (!assertCanManageTarget({ actorRole: req.user.role, target, res })) {
      return;
    }
    target.forceLogoutAt = new Date();
    target.tokenVersion = (Number(target.tokenVersion) || 0) + 1;
    await target.save();
    disconnectUserSockets(req.app, target._id, {
      code: "ADMIN_FORCE_LOGOUT",
      message: "An administrator logged out your account.",
    });

    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.user.force_logout",
      targetType: "User",
      targetId: toId(target._id),
      reason: String(req.body?.reason || ""),
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin force logout error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post(
  "/users/:id/reset-password",
  requireStepUp({ adminOnly: true }),
  adminMutationLimiter,
  async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const target = await User.findById(req.params.id);
    if (!assertCanManageTarget({ actorRole: req.user.role, target, res })) {
      return;
    }
    target.forcePasswordReset = true;
    await target.save();

    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.user.reset_password_flag",
      targetType: "User",
      targetId: toId(target._id),
      reason: String(req.body?.reason || ""),
    });

    return res.json({ success: true, forcePasswordReset: true });
  } catch (err) {
    console.error("Admin reset-password error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.delete(
  "/users/:id",
  requireStepUp({ adminOnly: true }),
  adminMutationLimiter,
  async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const target = await User.findById(req.params.id);
    if (toId(target?._id) === req.user.id) {
      return res.status(400).json({ error: "You cannot delete your own account here" });
    }
    if (!assertCanManageTarget({ actorRole: req.user.role, target, res })) {
      return;
    }

    const uid = toId(target._id);
    target.isDeleted = true;
    target.deletedAt = new Date();
    target.isActive = false;
    target.isBanned = true;
    target.banReason = "Soft deleted by admin";
    target.tokenVersion = (Number(target.tokenVersion) || 0) + 1;
    if (!target.username.startsWith("deleted_")) {
      target.username = `deleted_${uid.slice(-8)}_${Date.now()}`;
    }
    if (!target.email.startsWith("deleted+")) {
      target.email = `deleted+${uid.slice(-8)}@tengacion.local`;
    }
    await target.save();
    disconnectUserSockets(req.app, target._id, {
      code: "ACCOUNT_DELETED",
      message: "This account is no longer available.",
    });

    await User.updateMany(
      {},
      {
        $pull: {
          friends: target._id,
          friendRequests: target._id,
          followers: target._id,
          following: target._id,
          blockedUsers: target._id,
          blocks: target._id,
          mutes: target._id,
          restricts: target._id,
          hiddenStoriesFrom: target._id,
        },
      }
    );

    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.user.soft_delete",
      targetType: "User",
      targetId: uid,
      reason: String(req.body?.reason || ""),
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin soft-delete error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/moderation/items", async (req, res) => {
  try {
    const payload = await listModerationItems({
      status: String(req.query.status || "").trim(),
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search || "",
    });
    return res.json(payload);
  } catch (err) {
    const code = err?.status || 500;
    return res.status(code).json({ error: err.message || "Failed to load moderation items" });
  }
});

router.get("/moderation/items/:id", async (req, res) => {
  try {
    const payload = await getModerationItem(req.params.id);
    return res.json(payload);
  } catch (err) {
    const code = err?.status || 500;
    return res.status(code).json({ error: err.message || "Failed to load moderation item" });
  }
});

router.get("/moderation/items/:id/preview", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid moderation item id" });
    }

    const item = await ModerationCase.findById(req.params.id)
      .select("_id fileUrl mimeType media")
      .lean();
    if (!item) {
      return res.status(404).json({ error: "Moderation item not found" });
    }

    const fileUrl = String(item.fileUrl || item.media?.[0]?.sourceUrl || item.media?.[0]?.previewUrl || "").trim();
    if (!fileUrl.startsWith("private://")) {
      return res.status(404).json({ error: "Preview unavailable" });
    }

    const filePath = resolvePrivateMediaPath(fileUrl);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Preview unavailable" });
    }

    res.set("Cache-Control", "no-store");
    const mimeType = String(item.mimeType || item.media?.[0]?.mimeType || "application/octet-stream");
    res.type(mimeType);
    return res.sendFile(filePath);
  } catch (err) {
    const code = err?.status || 500;
    return res.status(code).json({ error: err.message || "Failed to load preview" });
  }
});

router.post("/moderation/items/:id/approve", async (req, res) => {
  try {
    const item = await applyUploadModerationRouteAction({
      req,
      res,
      itemId: req.params.id,
      action: "approve",
    });
    if (!item) {
      return;
    }
    return res.json({ success: true, item });
  } catch (err) {
    const code = err?.status || 500;
    return res.status(code).json({ error: err.message || "Failed to approve item" });
  }
});

router.post("/moderation/items/:id/reject", async (req, res) => {
  try {
    const item = await applyUploadModerationRouteAction({
      req,
      res,
      itemId: req.params.id,
      action: "reject",
    });
    if (!item) {
      return;
    }
    return res.json({ success: true, item });
  } catch (err) {
    const code = err?.status || 500;
    return res.status(code).json({ error: err.message || "Failed to reject item" });
  }
});

router.post("/moderation/items/:id/remove", async (req, res) => {
  try {
    const item = await applyUploadModerationRouteAction({
      req,
      res,
      itemId: req.params.id,
      action: "remove",
    });
    if (!item) {
      return;
    }
    return res.json({ success: true, item });
  } catch (err) {
    const code = err?.status || 500;
    return res.status(code).json({ error: err.message || "Failed to remove item" });
  }
});

router.post("/moderation/items/:id/quarantine", async (req, res) => {
  try {
    const item = await applyUploadModerationRouteAction({
      req,
      res,
      itemId: req.params.id,
      action: "quarantine",
    });
    if (!item) {
      return;
    }
    return res.json({ success: true, item });
  } catch (err) {
    const code = err?.status || 500;
    return res.status(code).json({ error: err.message || "Failed to quarantine item" });
  }
});

router.get("/audit-logs", requirePermissions(["view_audit_logs"]), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 30));
    const skip = (page - 1) * limit;
    const action = String(req.query.action || "").trim();
    const targetType = String(req.query.targetType || "").trim();
    const actorId = String(req.query.actorId || "").trim();

    const query = {};
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;
    if (isValidId(actorId)) query.actorId = new mongoose.Types.ObjectId(actorId);

    const [rows, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("actorId", "_id name username role")
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    return res.json({
      page,
      limit,
      total,
      logs: rows.map((row) => ({
        _id: toId(row._id),
        actor: row.actorId
          ? {
              _id: toId(row.actorId._id),
              name: row.actorId.name || "",
              username: row.actorId.username || "",
              role: row.actorId.role || "user",
            }
          : null,
        action: row.action || "",
        targetType: row.targetType || "",
        targetId: row.targetId || "",
        reason: row.reason || "",
        ip: row.ip || "",
        userAgent: row.userAgent || "",
        createdAt: row.createdAt,
      })),
    });
  } catch (err) {
    console.error("Admin audit logs error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/reports", requirePermissions(["view_moderation_queue"]), async (req, res) => {
  try {
    const status = String(req.query.status || "").trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const query = {};
    if (status) {
      query.status = status;
    }

    const [rows, total] = await Promise.all([
      Report.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("reporterId", "_id name username")
        .populate("assignedTo", "_id name username role")
        .lean(),
      Report.countDocuments(query),
    ]);
    return res.json({
      page,
      limit,
      total,
      reports: rows,
    });
  } catch (err) {
    console.error("Admin reports list error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/reports/:id", requirePermissions(["view_moderation_queue"]), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid report id" });
    }
    const report = await Report.findById(req.params.id)
      .populate("reporterId", "_id name username")
      .populate("assignedTo", "_id name username role")
      .lean();
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    return res.json(report);
  } catch (err) {
    console.error("Admin report detail error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.patch(
  "/reports/:id",
  requirePermissions(["view_moderation_queue"]),
  adminMutationLimiter,
  async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid report id" });
    }
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    const nextStatus = String(req.body?.status || "").trim();
    if (nextStatus && ["open", "reviewing", "actioned", "dismissed"].includes(nextStatus)) {
      report.status = nextStatus;
    }
    if (req.body?.assignedTo && isValidId(req.body.assignedTo)) {
      report.assignedTo = req.body.assignedTo;
    } else if (!report.assignedTo) {
      report.assignedTo = req.user.id;
    }
    if (req.body?.actionTaken !== undefined) {
      report.actionTaken = String(req.body.actionTaken || "").slice(0, 500);
    }
    await report.save();
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.report.update",
      targetType: "Report",
      targetId: toId(report._id),
      reason: String(req.body?.reason || ""),
      metadata: { status: report.status },
    });
    return res.json({ success: true, report });
  } catch (err) {
    console.error("Admin report update error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post(
  "/moderation/action",
  requirePermissions(["view_moderation_queue"]),
  adminMutationLimiter,
  async (req, res) => {
  try {
    const action = String(req.body?.action || "").trim().toLowerCase();
    const targetType = String(req.body?.targetType || "").trim().toLowerCase();
    const targetId = String(req.body?.targetId || "").trim();
    const reportId = String(req.body?.reportId || "").trim();
    const reason = String(req.body?.reason || "").trim();
    const strikes = Math.max(0, Number(req.body?.strikes) || 1);

    if (!action || !targetType || !targetId) {
      return res.status(400).json({ error: "action, targetType and targetId are required" });
    }

    let targetUserId = "";
    if (targetType === "user") {
      targetUserId = targetId;
    } else if (targetType === "post") {
      const post = await Post.findById(targetId).select("author");
      targetUserId = toId(post?.author);
      if (action === "delete_post" && post) {
        await Post.deleteOne({ _id: targetId });
      }
    } else if (targetType === "comment") {
      const post = await Post.findOne({ "comments._id": targetId });
      const comment = post?.comments?.find((entry) => toId(entry._id) === targetId);
      targetUserId = toId(comment?.author);
      if (action === "delete_comment" && post) {
        post.comments = (post.comments || []).filter((entry) => toId(entry._id) !== targetId);
        post.commentsCount = post.comments.length;
        await post.save();
      }
    } else if (targetType === "message") {
      const message = await Message.findById(targetId).select("senderId");
      targetUserId = toId(message?.senderId);
      if (action === "delete_message" && message) {
        await Message.deleteOne({ _id: targetId });
      }
    }

    if (["ban", "mute", "warn"].includes(action) && isValidId(targetUserId)) {
      const user = await User.findById(targetUserId);
      if (user) {
        if (action === "ban") {
          user.isBanned = true;
          user.banReason = reason || "Moderation action";
          user.bannedAt = new Date();
        }
        if (action === "mute") {
          user.forcePasswordReset = false;
        }
        await user.save();
      }
    }

    const strikeResult = isValidId(targetUserId)
      ? await applyUserStrikes({
          targetUserId,
          reportId: isValidId(reportId) ? reportId : null,
          count: strikes,
          reason: reason || action,
        })
      : { strikeCount: 0, action: "" };

    if (isValidId(reportId)) {
      await Report.findByIdAndUpdate(reportId, {
        status: "actioned",
        actionTaken: `${action}${strikeResult.action ? ` + ${strikeResult.action}` : ""}`,
        strikesApplied: {
          userId: isValidId(targetUserId) ? targetUserId : null,
          count: strikes,
        },
        assignedTo: req.user.id,
      });
    }

    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.moderation.action",
      targetType,
      targetId,
      reason,
      metadata: {
        action,
        reportId: isValidId(reportId) ? reportId : "",
        strikes,
        strikeCount: strikeResult.strikeCount,
      },
    });

    return res.json({
      success: true,
      strikeCount: strikeResult.strikeCount,
      autoAction: strikeResult.action,
    });
  } catch (err) {
    console.error("Admin moderation action error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/books/:bookId/review", async (req, res) => {
  try {
    const { bookId } = req.params;
    if (!isValidId(bookId)) {
      return res.status(400).json({ error: "Invalid book id" });
    }

    const book = await Book.findById(bookId)
      .populate({
        path: "creatorId",
        select: "displayName fullName userId",
        populate: { path: "userId", select: "_id name username email" },
      })
      .lean();
    if (!book || book.archivedAt) {
      return res.status(404).json({ error: "Book not found" });
    }

    return res.json({ book: toAdminBookReviewDTO(book) });
  } catch (err) {
    console.error("Admin book review detail error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post("/books/:bookId/approve", adminMutationLimiter, async (req, res) => {
  try {
    const { bookId } = req.params;
    if (!isValidId(bookId)) {
      return res.status(400).json({ error: "Invalid book id" });
    }

    const book = await Book.findById(bookId);
    if (!book || book.archivedAt) {
      return res.status(404).json({ error: "Book not found" });
    }

    const previousStatus = resolveContentStatus(book);
    if (book.publishedStatus === "blocked" || book.copyrightScanStatus === "blocked") {
      return res.status(409).json({ error: "Blocked books must be cleared before approval" });
    }
    if (previousStatus === "draft") {
      return res.status(409).json({ error: "Draft books must be submitted for review before approval" });
    }
    if (
      previousStatus === "published" ||
      (previousStatus !== "under_review" && !book.reviewRequired)
    ) {
      return res.status(409).json({ error: "Only books submitted for review can be approved" });
    }

    const manuscriptUrl = resolveBookManuscriptUrl(book);
    if (!manuscriptUrl) {
      return res.status(400).json({ error: "Book manuscript is missing" });
    }

    const previousScanStatus = String(book.copyrightScanStatus || "pending_scan");
    const reason = String(req.body?.reason || req.body?.note || "Admin approved manuscript").trim();
    const adminLine = `Admin approved manuscript${reason ? `: ${reason}` : ""}`;
    const existingNotes = String(book.verificationNotes || "").trim();

    book.publishedStatus = "published";
    book.isPublished = true;
    book.reviewRequired = false;
    book.copyrightScanStatus = "passed";
    book.moderationStatus = "ALLOW";
    book.verificationNotes = existingNotes
      ? `${existingNotes} ${adminLine}`.slice(0, 2000)
      : adminLine.slice(0, 2000);

    await book.save();

    const creatorProfile = await CreatorProfile.findById(book.creatorId)
      .select("displayName fullName userId")
      .lean();
    const creatorUserId = toId(creatorProfile?.userId);

    await Promise.all([
      writeAuditLog({
        req,
        actorId: req.user.id,
        action: "admin.book.approve",
        targetType: "Book",
        targetId: toId(book._id),
        reason,
        metadata: {
          title: book.title || "",
          previousStatus,
          nextStatus: "published",
          previousScanStatus,
          nextScanStatus: "passed",
          creatorId: toId(book.creatorId),
        },
      }),
      logAnalyticsEvent({
        type: "book_approved",
        userId: req.user.id,
        actorRole: req.user.role || "admin",
        targetId: book._id,
        targetType: "book",
        contentType: "book",
        metadata: {
          creatorId: toId(book.creatorId),
          title: book.title || "",
          previousStatus,
          price: Number(book.price || 0),
        },
      }).catch(() => null),
      creatorUserId
        ? createNotification({
            recipient: creatorUserId,
            sender: req.user.id,
            type: "system",
            text: `${book.title || "Your book"} has been approved and is now available for purchase.`,
            entity: {
              id: book._id,
              model: "Book",
            },
            metadata: {
              eventType: "book_approved",
              creatorId: toId(book.creatorId),
              itemType: "book",
              itemId: toId(book._id),
              link: `/books/${toId(book._id)}`,
              dedupeKey: `book_approved:${toId(book._id)}`,
            },
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (creatorProfile && Number(book.price || 0) > 0) {
      await notifyCreatorPublishedPaidContent({
        req,
        creatorProfile,
        itemType: "book",
        itemId: book._id,
        title: book.title,
        price: Number(book.price || 0),
      }).catch(() => null);
    }

    const hydrated = await Book.findById(book._id)
      .populate({
        path: "creatorId",
        select: "displayName fullName userId",
        populate: { path: "userId", select: "_id name username email" },
      })
      .lean();

    return res.json({
      success: true,
      book: toAdminBookReviewDTO(hydrated),
    });
  } catch (err) {
    console.error("Admin book approval error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post("/albums/:albumId/publish", adminMutationLimiter, async (req, res) => {
  try {
    const { albumId } = req.params;
    if (!isValidId(albumId)) {
      return res.status(400).json({ error: "Invalid album id" });
    }

    const album = await Album.findById(albumId);
    if (!album || album.archivedAt) {
      return res.status(404).json({ error: "Album not found" });
    }

    const previousStatus = resolveContentStatus(album);
    if (previousStatus === "blocked" || album.copyrightScanStatus === "blocked") {
      return res.status(409).json({ error: "Blocked albums must be cleared before approval" });
    }
    if (previousStatus === "draft") {
      return res.status(409).json({ error: "Draft albums must be submitted for review before approval" });
    }
    if (
      previousStatus === "published" ||
      (previousStatus !== "under_review" && !album.reviewRequired)
    ) {
      return res.status(409).json({ error: "Only albums submitted for review can be approved" });
    }

    const albumTracks = resolveAlbumTracks(album);
    if (!albumTracks.length || albumTracks.some((track) => !track.audioUrl)) {
      return res.status(400).json({ error: "Album tracks are missing" });
    }

    const previousScanStatus = String(album.copyrightScanStatus || "pending_scan");
    const reason = String(req.body?.reason || req.body?.note || "Admin approved album").trim();
    const adminLine = `Admin approved ${album.releaseType === "ep" ? "EP" : "album"}${reason ? `: ${reason}` : ""}`;
    const existingNotes = String(album.verificationNotes || "").trim();

    album.publishedStatus = "published";
    album.status = "published";
    album.isPublished = true;
    album.reviewRequired = false;
    album.copyrightScanStatus = "passed";
    album.moderationStatus = "ALLOW";
    album.verificationNotes = existingNotes
      ? `${existingNotes} ${adminLine}`.slice(0, 2000)
      : adminLine.slice(0, 2000);

    await album.save();

    const creatorProfile = await CreatorProfile.findById(album.creatorId)
      .select("displayName fullName userId")
      .lean();
    const creatorUserId = toId(creatorProfile?.userId);
    const itemLabel = album.releaseType === "ep" ? "EP" : "album";

    await Promise.all([
      writeAuditLog({
        req,
        actorId: req.user.id,
        action: "admin.album.publish",
        targetType: "Album",
        targetId: toId(album._id),
        reason,
        metadata: {
          title: album.title || "",
          releaseType: album.releaseType || "album",
          previousStatus,
          nextStatus: "published",
          previousScanStatus,
          nextScanStatus: "passed",
          creatorId: toId(album.creatorId),
        },
      }),
      logAnalyticsEvent({
        type: "album_approved",
        userId: req.user.id,
        actorRole: req.user.role || "admin",
        targetId: album._id,
        targetType: "album",
        contentType: album.releaseType === "ep" ? "ep" : "album",
        metadata: {
          creatorId: toId(album.creatorId),
          title: album.title || "",
          releaseType: album.releaseType || "album",
          previousStatus,
          price: Number(album.price || 0),
          tracksCount: albumTracks.length,
        },
      }).catch(() => null),
      creatorUserId
        ? createNotification({
            recipient: creatorUserId,
            sender: req.user.id,
            type: "system",
            text: `${album.title || `Your ${itemLabel}`} has been approved and is now published.`,
            entity: {
              id: album._id,
              model: "Album",
            },
            metadata: {
              eventType: "album_published_by_admin",
              creatorId: toId(album.creatorId),
              itemType: "album",
              itemId: toId(album._id),
              link: `/albums/${toId(album._id)}`,
              dedupeKey: `album_published_by_admin:${toId(album._id)}`,
            },
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (creatorProfile && Number(album.price || 0) > 0) {
      await notifyCreatorPublishedPaidContent({
        req,
        creatorProfile,
        itemType: "album",
        itemId: album._id,
        title: album.title,
        price: Number(album.price || 0),
      }).catch(() => null);
    }

    const hydrated = await Album.findById(album._id)
      .populate({
        path: "creatorId",
        select: "displayName fullName userId",
        populate: { path: "userId", select: "_id name username email" },
      })
      .lean();

    return res.json({
      success: true,
      album: toAdminAlbumReviewDTO(hydrated),
    });
  } catch (err) {
    console.error("Admin album publish error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post("/tracks/:trackId/publish", adminMutationLimiter, async (req, res) => {
  try {
    const { trackId } = req.params;
    if (!isValidId(trackId)) {
      return res.status(400).json({ error: "Invalid track id" });
    }

    const track = await Track.findById(trackId);
    if (!track || track.archivedAt) {
      return res.status(404).json({ error: "Track not found" });
    }

    const previousStatus = resolveContentStatus(track);
    if (track.publishedStatus === "blocked" || track.copyrightScanStatus === "blocked") {
      return res.status(409).json({ error: "Blocked tracks must be cleared before publishing" });
    }
    if (previousStatus === "draft") {
      return res.status(409).json({ error: "Draft tracks must be submitted for review before approval" });
    }
    if (
      previousStatus === "published" ||
      (previousStatus !== "under_review" && !track.reviewRequired)
    ) {
      return res.status(409).json({ error: "Only tracks submitted for review can be approved" });
    }

    const audioUrl = resolveTrackAudioUrl(track);
    const previewUrl = resolveTrackPreviewUrl(track);
    if (!audioUrl) {
      return res.status(400).json({ error: "Track audio is missing" });
    }

    const previousScanStatus = String(track.copyrightScanStatus || "pending_scan");
    const reason = String(req.body?.reason || req.body?.note || "Admin approved track").trim();
    const adminLine = `Admin approved track${reason ? `: ${reason}` : ""}`;
    const existingNotes = String(track.verificationNotes || "").trim();

    track.publishedStatus = "published";
    track.isPublished = true;
    track.reviewRequired = false;
    track.copyrightScanStatus = "passed";
    track.moderationStatus = "ALLOW";
    track.verificationNotes = existingNotes
      ? `${existingNotes} ${adminLine}`.slice(0, 2000)
      : adminLine.slice(0, 2000);

    await track.save();

    const creatorProfile = await CreatorProfile.findById(track.creatorId)
      .select("displayName fullName userId")
      .lean();
    const creatorUserId = toId(creatorProfile?.userId);
    const isPodcast = String(track.kind || "").toLowerCase() === "podcast";

    await Promise.all([
      writeAuditLog({
        req,
        actorId: req.user.id,
        action: "admin.track.publish",
        targetType: "Track",
        targetId: toId(track._id),
        reason,
        metadata: {
          title: track.title || "",
          previousStatus,
          nextStatus: "published",
          previousScanStatus,
          nextScanStatus: "passed",
          creatorId: toId(track.creatorId),
          kind: track.kind || "music",
        },
      }),
      logAnalyticsEvent({
        type: isPodcast ? "podcast_approved" : "track_approved",
        userId: req.user.id,
        actorRole: req.user.role || "admin",
        targetId: track._id,
        targetType: "track",
        contentType: isPodcast ? "podcast" : "music",
        metadata: {
          creatorId: toId(track.creatorId),
          title: track.title || "",
          previousStatus,
          price: Number(track.price || 0),
        },
      }).catch(() => null),
      creatorUserId
        ? createNotification({
            recipient: creatorUserId,
            sender: req.user.id,
            type: "system",
            text: `${track.title || "Your track"} has been approved and is now published.`,
            entity: {
              id: track._id,
              model: "Track",
            },
            metadata: {
              eventType: "track_published_by_admin",
              creatorId: toId(track.creatorId),
              itemType: "track",
              itemId: toId(track._id),
              link: `/tracks/${toId(track._id)}`,
              dedupeKey: `track_published_by_admin:${toId(track._id)}`,
            },
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (creatorUserId) {
      const existingPost = await Post.exists({ "audio.trackId": track._id }).catch(() => null);
      if (!existingPost) {
        await Post.create({
          author: creatorUserId,
          text: `${track.title || "New audio"} is now available.`,
          tags: isPodcast ? ["podcast"] : ["track", "music"],
          audio: {
            trackId: track._id,
            url: audioUrl,
            previewUrl,
            title: track.title,
            durationSec: Number.isFinite(track.durationSec) ? track.durationSec : 0,
            coverImageUrl: resolveTrackCoverUrl(track),
          },
          privacy: "public",
        }).catch((err) => {
          console.error("Failed to create feed post for admin-published track:", err);
        });
      }
    }

    if (creatorProfile && Number(track.price || 0) > 0) {
      await notifyCreatorPublishedPaidContent({
        req,
        creatorProfile,
        itemType: "track",
        itemId: track._id,
        title: track.title,
        price: Number(track.price || 0),
      }).catch(() => null);
    }

    const hydrated = await Track.findById(track._id)
      .populate({
        path: "creatorId",
        select: "displayName fullName userId",
        populate: { path: "userId", select: "_id name username email" },
      })
      .lean();

    return res.json({
      success: true,
      track: toAdminTrackReviewDTO(hydrated),
    });
  } catch (err) {
    console.error("Admin track publish error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post("/videos/:videoId/publish", adminMutationLimiter, async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!isValidId(videoId)) {
      return res.status(400).json({ error: "Invalid video id" });
    }

    const video = await Video.findById(videoId);
    if (!video || video.archivedAt) {
      return res.status(404).json({ error: "Video not found" });
    }

    const previousStatus = resolveContentStatus(video);
    const moderationStatus = String(video.moderationStatus || "").trim().toUpperCase();
    const isBlocked =
      previousStatus === "blocked" ||
      String(video.copyrightScanStatus || "").toLowerCase() === "blocked" ||
      String(video.visibility || "").toLowerCase() === "blocked" ||
      String(video.storageStage || "").toLowerCase() === "quarantine" ||
      moderationStatus.startsWith("BLOCK_") ||
      ["REJECTED", "QUARANTINED"].includes(moderationStatus);

    if (isBlocked) {
      return res.status(409).json({ error: "Blocked videos must be cleared before approval" });
    }
    if (previousStatus === "draft") {
      return res.status(409).json({ error: "Draft videos must be submitted for review before approval" });
    }
    if (
      previousStatus === "published" ||
      (previousStatus !== "under_review" && !video.reviewRequired)
    ) {
      return res.status(409).json({ error: "Only videos submitted for review can be approved" });
    }

    const videoUrl = resolveVideoUrl(video);
    if (!videoUrl) {
      return res.status(400).json({ error: "Video media is missing" });
    }

    const previousScanStatus = String(video.copyrightScanStatus || "pending_scan");
    const reason = String(req.body?.reason || req.body?.note || "Admin approved video").trim();
    const adminLine = `Admin approved video${reason ? `: ${reason}` : ""}`;
    const existingNotes = String(video.verificationNotes || "").trim();

    video.publishedStatus = "published";
    video.isPublished = true;
    video.visibility = "public";
    video.reviewRequired = false;
    video.copyrightScanStatus = "passed";
    video.moderationStatus = "ALLOW";
    video.reviewedBy = req.user.id;
    video.reviewedAt = new Date();
    video.verificationNotes = existingNotes
      ? `${existingNotes} ${adminLine}`.slice(0, 2000)
      : adminLine.slice(0, 2000);

    await video.save();

    const creatorProfile = isValidId(video.creatorProfileId)
      ? await CreatorProfile.findById(video.creatorProfileId)
          .select("displayName fullName userId")
          .lean()
      : null;
    const fallbackUserId = isValidId(video.userId) ? toId(video.userId) : "";
    const creatorUserId = toId(creatorProfile?.userId) || fallbackUserId;

    await Promise.all([
      writeAuditLog({
        req,
        actorId: req.user.id,
        action: "admin.video.publish",
        targetType: "Video",
        targetId: toId(video._id),
        reason,
        metadata: {
          title: video.caption || "",
          previousStatus,
          nextStatus: "published",
          previousScanStatus,
          nextScanStatus: "passed",
          creatorId: toId(video.creatorProfileId),
        },
      }),
      logAnalyticsEvent({
        type: "video_approved",
        userId: req.user.id,
        actorRole: req.user.role || "admin",
        targetId: video._id,
        targetType: "video",
        contentType: "video",
        metadata: {
          creatorId: toId(video.creatorProfileId),
          title: video.caption || "",
          previousStatus,
          price: Number(video.price || 0),
        },
      }).catch(() => null),
      creatorUserId && isValidId(creatorUserId)
        ? createNotification({
            recipient: creatorUserId,
            sender: req.user.id,
            type: "system",
            text: `${video.caption || "Your video"} has been approved and is now published.`,
            entity: {
              id: video._id,
              model: "Video",
            },
            metadata: {
              eventType: "video_published_by_admin",
              creatorId: toId(video.creatorProfileId),
              itemType: "video",
              itemId: toId(video._id),
              link: "/creator/music",
              dedupeKey: `video_published_by_admin:${toId(video._id)}`,
            },
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (creatorProfile && Number(video.price || 0) > 0) {
      await notifyCreatorPublishedPaidContent({
        req,
        creatorProfile,
        itemType: "video",
        itemId: video._id,
        title: video.caption || "Music video",
        price: Number(video.price || 0),
      }).catch(() => null);
    }

    const hydrated = await Video.findById(video._id)
      .populate({
        path: "creatorProfileId",
        select: "displayName fullName userId",
        populate: { path: "userId", select: "_id name username email" },
      })
      .lean();

    return res.json({
      success: true,
      video: toAdminVideoReviewDTO(hydrated),
    });
  } catch (err) {
    console.error("Admin video publish error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/content", async (req, res) => {
  try {
    const page = clamp(req.query.page, 1, 500, 1);
    const limit = clamp(req.query.limit, 1, 100, 20);
    const skip = (page - 1) * limit;
    const category = String(req.query.category || "all").trim().toLowerCase();
    const statusFilter = String(req.query.status || "all").trim().toLowerCase();

    const items = [];
    const pushRows = (rows, type, getTitle, getCreatedAt, getMetric, getExtra = () => ({})) => {
      for (const row of rows) {
        const status = resolveContentStatus(row);
        items.push({
          id: toId(row._id),
          type,
          title: getTitle(row),
          createdAt: getCreatedAt(row),
          metricValue: getMetric(row),
          status,
          publishedStatus: status,
          moderationStatus: row.moderationStatus || "ALLOW",
          reviewRequired: Boolean(row.reviewRequired),
          sensitiveType: row.sensitiveType || "",
          sensitiveContent: Boolean(row.sensitiveContent),
          ...getExtra(row),
        });
      }
    };

    if (["all", "music", "tracks"].includes(category)) {
      pushRows(
        await Track.find({ archivedAt: null, kind: { $ne: "podcast" } }).sort({ createdAt: -1 }).limit(200).lean(),
        "track",
        (row) => row.title || "Untitled Track",
        (row) => row.createdAt,
        (row) => Number(row.playsCount || row.playCount || 0),
        (row) => ({
          artistName: row.artistName || "",
          description: row.description || "",
          copyrightScanStatus: row.copyrightScanStatus || "pending_scan",
          audioAvailable: Boolean(resolveTrackAudioUrl(row)),
          previewAvailable: Boolean(resolveTrackPreviewUrl(row)),
          audioUrl: resolveTrackPreviewUrl(row) || resolveTrackAudioUrl(row) || "",
          price: Number(row.price || row.priceNGN || 0),
          currency: row.currency || "NGN",
        })
      );
    }
    if (["all", "albums"].includes(category)) {
      pushRows(
        await Album.find({ archivedAt: null }).sort({ createdAt: -1 }).limit(200).lean(),
        "album",
        (row) => row.title || "Untitled Album",
        (row) => row.createdAt,
        (row) => Number(row.playCount || 0),
        (row) => {
          const tracks = resolveAlbumTracks(row);
          return {
            description: row.description || "",
            releaseType: row.releaseType || row.contentType || "album",
            copyrightScanStatus: row.copyrightScanStatus || "pending_scan",
            verificationNotes: row.verificationNotes || "",
            coverImageUrl: resolveAlbumCoverUrl(row),
            tracks,
            tracksAvailable: tracks.length > 0 && tracks.every((track) => Boolean(track.audioUrl)),
            totalTracks: Number(row.totalTracks || tracks.length),
            price: Number(row.price || row.priceNGN || 0),
            currency: row.currency || "NGN",
            creator: {
              id: toId(row.creatorId),
            },
          };
        }
      );
    }
    if (["all", "books"].includes(category)) {
      pushRows(
        await Book.find({ archivedAt: null }).sort({ createdAt: -1 }).limit(200).lean(),
        "book",
        (row) => row.title || "Untitled Book",
        (row) => row.createdAt,
        (row) => Number(row.downloadCount || row.purchaseCount || 0),
        (row) => ({
          authorName: row.authorName || "",
          copyrightScanStatus: row.copyrightScanStatus || "pending_scan",
          manuscriptAvailable: Boolean(resolveBookManuscriptUrl(row)),
          price: Number(row.price || row.priceNGN || 0),
          currency: row.currency || "NGN",
        })
      );
    }
    if (["all", "podcasts"].includes(category)) {
      pushRows(
        await Track.find({ archivedAt: null, kind: "podcast" }).sort({ createdAt: -1 }).limit(200).lean(),
        "podcast",
        (row) => row.title || "Untitled Podcast",
        (row) => row.createdAt,
        (row) => Number(row.playsCount || row.playCount || 0),
        (row) => ({
          artistName: row.artistName || row.authorName || "",
          description: row.description || "",
          copyrightScanStatus: row.copyrightScanStatus || "pending_scan",
          audioAvailable: Boolean(resolveTrackAudioUrl(row)),
          previewAvailable: Boolean(resolveTrackPreviewUrl(row)),
          audioUrl: resolveTrackPreviewUrl(row) || resolveTrackAudioUrl(row) || "",
          price: Number(row.price || row.priceNGN || 0),
          currency: row.currency || "NGN",
        })
      );
    }
    if (["all", "videos"].includes(category)) {
      pushRows(
        await Video.find({ archivedAt: null }).sort({ time: -1 }).limit(200).lean(),
        "video",
        (row) => row.caption || "Untitled Video",
        (row) => row.time || row.createdAt,
        (row) => Number(row.viewsCount || 0),
        (row) => ({
          description: row.description || "",
          copyrightScanStatus: row.copyrightScanStatus || "pending_scan",
          verificationNotes: row.verificationNotes || "",
          visibility: row.visibility || "private",
          videoAvailable: Boolean(resolveVideoUrl(row)),
          videoUrl: resolveVideoUrl(row),
          previewClipUrl: resolveVideoPreviewUrl(row),
          coverImageUrl: resolveVideoCoverUrl(row),
          durationSec: Number(row.durationSec || 0),
          videoFormat: row.videoFormat || "",
          price: Number(row.price || 0),
          currency: "NGN",
          creator: {
            id: toId(row.creatorProfileId),
            displayName: String(row.name || ""),
            username: String(row.username || ""),
            userId: toId(row.userId),
          },
        })
      );
    }

    const filteredItems = items.filter((entry) => {
      if (!statusFilter || statusFilter === "all") {
        return true;
      }
      if (statusFilter === "review_required") {
        return Boolean(entry.reviewRequired);
      }
      return String(entry.status || "").toLowerCase() === statusFilter;
    });

    const rows = filteredItems
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(skip, skip + limit);

    return res.json({ page, limit, total: filteredItems.length, items: rows });
  } catch (err) {
    console.error("Admin content list error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/transactions", async (req, res) => {
  try {
    const page = clamp(req.query.page, 1, 500, 1);
    const limit = clamp(req.query.limit, 1, 100, 20);
    const skip = (page - 1) * limit;
    const status = String(req.query.status || "").trim().toLowerCase();
    const attention = String(req.query.attention || "").trim().toLowerCase();
    const olderThanMinutes = clamp(
      req.query.olderThanMinutes,
      1,
      7 * 24 * 60,
      DEFAULT_STUCK_PENDING_MINUTES
    );
    const query = status ? { status } : {};

    if (attention === "stuck") {
      query.status = status || { $in: ["pending", "abandoned"] };
      query.updatedAt = {
        $lte: new Date(Date.now() - (olderThanMinutes * 60 * 1000)),
      };
    }

    const [rows, total] = await Promise.all([
      Purchase.find(query)
        .sort({ paidAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Purchase.countDocuments(query),
    ]);

    return res.json({
      page,
      limit,
      total,
      olderThanMinutes,
      attention,
      transactions: rows.map((row) =>
        buildTransactionListItem({
          purchase: row,
          olderThanMinutes,
        })
      ),
    });
  } catch (err) {
    console.error("Admin transactions list error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/tuition-payments", async (req, res) => {
  try {
    const payload = await listAdminSchoolTuitionPayments({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      schoolSlug: req.query.schoolSlug,
      childClass: req.query.childClass,
      search: req.query.search,
    });
    return res.json(payload);
  } catch (err) {
    console.error("Admin tuition payments list error:", req.requestId, err);
    return res.status(err?.status || 500).json({
      error: err?.status ? err.message : "Internal Server Error",
      requestId: req.requestId,
    });
  }
});

router.get("/transactions/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid transaction id" });
    }

    const purchase = await Purchase.findById(req.params.id).lean();
    if (!purchase) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const olderThanMinutes = clamp(
      req.query.olderThanMinutes,
      1,
      7 * 24 * 60,
      DEFAULT_STUCK_PENDING_MINUTES
    );

    return res.json(await buildPurchaseAdminDetail({ purchase, olderThanMinutes }));
  } catch (err) {
    console.error("Admin transaction detail error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post(
  "/transactions/:id/reconcile",
  requireStepUp({ adminOnly: true }),
  async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(400).json({ error: "Invalid transaction id" });
      }

      const purchase = await Purchase.findById(req.params.id);
      if (!purchase) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      const reason = String(req.body?.reason || "admin_reconcile").trim().slice(0, 120);
      const result = await reconcilePurchase({
        req,
        purchase,
        actorUserId: req.user.id,
        actorRole: req.user?.role || "admin",
        source: "admin_reconcile",
        reason,
      });

      const updatedPurchase = await Purchase.findById(purchase._id).lean();
      await writeAuditLog({
        actorId: req.user.id,
        action: "purchase_reconcile",
        targetType: "purchase",
        targetId: toId(purchase._id),
        reason,
        ip: req.ip,
        userAgent: req.get("user-agent") || "",
        metadata: {
          providerRef: purchase.providerRef || "",
          previousStatus: purchase.status || "",
          nextStatus: updatedPurchase?.status || purchase.status || "",
          success: Boolean(result?.success),
          accessGranted: Boolean(result?.accessGranted),
        },
      }).catch(() => null);

      return res.json({
        success: Boolean(result?.success),
        accessGranted: Boolean(result?.accessGranted),
        reason: result?.reason || "",
        transaction: updatedPurchase
          ? buildTransactionListItem({
              purchase: updatedPurchase,
              olderThanMinutes: DEFAULT_STUCK_PENDING_MINUTES,
            })
          : null,
      });
    } catch (err) {
      const code = err?.status || 500;
      return res.status(code).json({ error: err.message || "Failed to reconcile transaction" });
    }
  }
);

router.post(
  "/transactions/:id/refund",
  requireStepUp({ adminOnly: true }),
  async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(400).json({ error: "Invalid transaction id" });
      }

      const purchase = await Purchase.findById(req.params.id);
      if (!purchase) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      const reason = String(req.body?.reason || "admin_refund").trim().slice(0, 120);
      const result = await refundPurchase({
        req,
        purchase,
        actorUserId: req.user.id,
        actorRole: req.user?.role || "admin",
        reason,
      });

      const updatedPurchase = await Purchase.findById(purchase._id).lean();
      await writeAuditLog({
        actorId: req.user.id,
        action: "purchase_refund",
        targetType: "purchase",
        targetId: toId(purchase._id),
        reason,
        ip: req.ip,
        userAgent: req.get("user-agent") || "",
        metadata: {
          providerRef: purchase.providerRef || "",
          previousStatus: purchase.status || "",
          nextStatus: updatedPurchase?.status || "refunded",
          walletCreatedCount: Number(result?.walletResult?.createdCount || 0),
        },
      }).catch(() => null);

      return res.json({
        success: true,
        transaction: updatedPurchase
          ? buildTransactionListItem({
              purchase: updatedPurchase,
              olderThanMinutes: DEFAULT_STUCK_PENDING_MINUTES,
            })
          : null,
      });
    } catch (err) {
      const code = err?.status || 500;
      return res.status(code).json({ error: err.message || "Failed to refund transaction" });
    }
  }
);

router.get("/finance/creator-earnings", async (req, res) => {
  try {
    return res.json(await buildCreatorFinanceRepository(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res
      .status(code)
      .json({ error: err.message || "Failed to load creator earnings repository" });
  }
});

router.get("/finance/assurance-close", async (req, res) => {
  try {
    return res.json(await buildFinanceAssuranceClose(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res
      .status(code)
      .json({ error: err.message || "Failed to load finance assurance close" });
  }
});

router.get("/finance/payout-requests", async (req, res) => {
  try {
    return res.json(await listAdminCreatorPayoutRequests({
      status: req.query.status || "",
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    }));
  } catch (err) {
    const code = err?.status || 500;
    return res
      .status(code)
      .json({ error: err.message || "Failed to load creator payout requests" });
  }
});

router.get("/finance/payout-batches", async (req, res) => {
  try {
    return res.json(await listCreatorPayoutBatches({
      status: req.query.status || "",
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    }));
  } catch (err) {
    const code = err?.status || 500;
    return res
      .status(code)
      .json({ error: err.message || "Failed to load creator payout batches" });
  }
});

router.get("/finance/withdrawals", async (req, res) => {
  try {
    return res.json(await listAdminWithdrawals({
      status: req.query.status || "",
      ownerType: req.query.ownerType || "",
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    }));
  } catch (err) {
    const code = err?.status || 500;
    return res
      .status(code)
      .json({ error: err.message || "Failed to load withdrawals", details: err?.details || undefined });
  }
});

router.post(
  "/finance/withdrawals/:id/retry",
  requireStepUp({ adminOnly: true }),
  async (req, res) => {
    try {
      const result = await retryWithdrawalTransfer({
        withdrawalId: req.params.id,
        adminUserId: req.user.id,
      });

      await writeAuditLog({
        actorId: req.user.id,
        action: "withdrawal_paystack_retry",
        targetType: "withdrawal",
        targetId: result.withdrawal.id,
        reason: req.body?.note || "Retry Paystack withdrawal after business activation review",
        ip: req.ip,
        userAgent: req.get("user-agent") || "",
        metadata: {
          ownerType: result.withdrawal.ownerType || "",
          ownerId: result.withdrawal.ownerId || "",
          userId: result.withdrawal.userId || "",
          amount: Number(result.withdrawal.amount || 0),
          currency: result.withdrawal.currency || "NGN",
          reference: result.withdrawal.reference || "",
          status: result.withdrawal.status || "",
          providerTransferCode: result.withdrawal.providerTransferCode || "",
        },
      }).catch(() => null);

      return res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      const code = err?.status || 500;
      return res.status(code).json({
        error: err.message || "Failed to retry withdrawal",
        details: err?.details || undefined,
      });
    }
  }
);

router.post(
  "/finance/payout-batches",
  requireStepUp({ adminOnly: true }),
  async (req, res) => {
    try {
      const result = await createCreatorPayoutBatch({
        requestIds: Array.isArray(req.body?.requestIds) ? req.body.requestIds : [],
        adminUserId: req.user.id,
        adminRole: req.user?.role || "admin",
        note: req.body?.note || "",
        provider: req.body?.provider || "manual_bank_export",
      });

      await writeAuditLog({
        actorId: req.user.id,
        action: "creator_payout_batch_create",
        targetType: "creator_payout_batch",
        targetId: result.batch.id,
        reason: req.body?.note || "Payout batch created",
        ip: req.ip,
        userAgent: req.get("user-agent") || "",
        metadata: {
          batchReference: result.batch.batchReference || "",
          requestIds: result.batch.requestIds || [],
          itemCount: Number(result.batch.itemCount || 0),
          totalAmount: Number(result.batch.totalAmount || 0),
          currency: result.batch.currency || "NGN",
          provider: result.batch.provider || "",
        },
      }).catch(() => null);

      return res.status(201).json({
        success: true,
        ...result,
      });
    } catch (err) {
      const code = err?.status || 500;
      return res.status(code).json({
        error: err.message || "Failed to create payout batch",
        details: err?.details || undefined,
      });
    }
  }
);

router.post(
  "/finance/payout-batches/:id/export",
  requireStepUp({ adminOnly: true }),
  async (req, res) => {
    try {
      const result = await exportCreatorPayoutBatch({
        batchId: req.params.id,
        adminUserId: req.user.id,
        adminRole: req.user?.role || "admin",
        note: req.body?.note || "",
        providerResponse: req.body?.providerResponse || {},
      });

      await writeAuditLog({
        actorId: req.user.id,
        action: "creator_payout_batch_export",
        targetType: "creator_payout_batch",
        targetId: result.batch.id,
        reason: req.body?.note || "Payout batch exported",
        ip: req.ip,
        userAgent: req.get("user-agent") || "",
        metadata: {
          batchReference: result.batch.batchReference || "",
          itemCount: Number(result.batch.itemCount || 0),
          totalAmount: Number(result.batch.totalAmount || 0),
          currency: result.batch.currency || "NGN",
          provider: result.batch.provider || "",
          exportFilename: result.providerExport?.filename || "",
        },
      }).catch(() => null);

      return res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      const code = err?.status || 500;
      return res.status(code).json({
        error: err.message || "Failed to export payout batch",
        details: err?.details || undefined,
      });
    }
  }
);

router.post(
  "/finance/payout-batches/:id/reconcile",
  requireStepUp({ adminOnly: true }),
  async (req, res) => {
    try {
      const result = await reconcileCreatorPayoutBatch({
        batchId: req.params.id,
        outcomes: Array.isArray(req.body?.outcomes) ? req.body.outcomes : [],
        adminUserId: req.user.id,
        adminRole: req.user?.role || "admin",
        note: req.body?.note || "",
        providerResponse: req.body?.providerResponse || {},
      });

      await writeAuditLog({
        actorId: req.user.id,
        action: "creator_payout_batch_reconcile",
        targetType: "creator_payout_batch",
        targetId: result.batch.id,
        reason: req.body?.note || "Payout batch reconciled",
        ip: req.ip,
        userAgent: req.get("user-agent") || "",
        metadata: {
          batchReference: result.batch.batchReference || "",
          status: result.batch.status || "",
          paidCount: Number(result.batch.reconciliationSummary?.paidCount || 0),
          failedCount: Number(result.batch.reconciliationSummary?.failedCount || 0),
          pendingCount: Number(result.batch.reconciliationSummary?.pendingCount || 0),
          resultCount: Array.isArray(result.results) ? result.results.length : 0,
        },
      }).catch(() => null);

      return res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      const code = err?.status || 500;
      return res.status(code).json({
        error: err.message || "Failed to reconcile payout batch",
        details: err?.details || undefined,
      });
    }
  }
);

router.patch(
  "/finance/payout-requests/:id/status",
  requireStepUp({ adminOnly: true }),
  async (req, res) => {
    try {
      const result = await updateCreatorPayoutRequestStatus({
        requestId: req.params.id,
        status: req.body?.status,
        adminUserId: req.user.id,
        adminRole: req.user?.role || "admin",
        adminNote: req.body?.adminNote || "",
        creatorMessage: req.body?.creatorMessage || "",
        payoutReference: req.body?.payoutReference || "",
      });

      await writeAuditLog({
        actorId: req.user.id,
        action: "creator_payout_request_status_update",
        targetType: "creator_payout_request",
        targetId: result.request.id,
        reason: req.body?.adminNote || `Status changed to ${result.request.status}`,
        ip: req.ip,
        userAgent: req.get("user-agent") || "",
        metadata: {
          previousStatus: result.previousStatus || "",
          nextStatus: result.request.status || "",
          creatorProfileId: result.request.creatorProfileId || "",
          creatorUserId: result.request.creatorUserId || "",
          amount: Number(result.request.amount || 0),
          currency: result.request.currency || "NGN",
          requestReference: result.request.requestReference || "",
          payoutReference: result.request.payoutReference || "",
          walletEntryCreated: Boolean(result.walletEntryCreated),
          revenueLedgerCreatedCount: Number(result.revenueLedgerCreatedCount || 0),
        },
      }).catch(() => null);

      if (result.request.creatorUserId && req.body?.creatorMessage) {
        await createNotification({
          recipient: result.request.creatorUserId,
          sender: req.user.id,
          type: "system",
          text: req.body.creatorMessage,
          entity: {
            type: "creator_payout_request",
            id: result.request.id,
          },
          metadata: {
            dedupeKey: `creator-payout-request:${result.request.id}:${result.request.status}`,
            requestReference: result.request.requestReference || "",
            status: result.request.status || "",
          },
        }).catch(() => null);
      }

      return res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      const code = err?.status || 500;
      return res.status(code).json({
        error: err.message || "Failed to update creator payout request",
        details: err?.details || undefined,
      });
    }
  }
);

router.get("/finance/revenue-ledger", async (req, res) => {
  try {
    return res.json(await buildRevenueLedgerSummary({
      ...getAnalyticsFilters(req),
      limit: req.query.limit,
    }));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res
      .status(code)
      .json({ error: err.message || "Failed to load revenue ledger" });
  }
});

router.get("/creators/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid creator id" });
    }

    const creator = await CreatorProfile.findById(req.params.id).populate("userId", "_id name username email avatar").lean();
    if (!creator) {
      return res.status(404).json({ error: "Creator not found" });
    }

    const [tracks, podcasts, albums, books, videos, revenueRows] = await Promise.all([
      Track.countDocuments({ creatorId: creator._id, kind: { $ne: "podcast" }, archivedAt: null }),
      Track.countDocuments({ creatorId: creator._id, kind: "podcast", archivedAt: null }),
      Album.countDocuments({ creatorId: creator._id, archivedAt: null }),
      Book.countDocuments({ creatorId: creator._id, archivedAt: null }),
      Video.countDocuments({ creatorProfileId: creator._id, archivedAt: null }),
      Purchase.aggregate([
        { $match: { creatorId: creator._id, status: "paid" } },
        { $group: { _id: null, revenue: { $sum: "$amount" }, purchases: { $sum: 1 } } },
      ]),
    ]);

    return res.json({
      _id: toId(creator._id),
      displayName: creator.displayName || "",
      bio: creator.bio || "",
      tagline: creator.tagline || "",
      genres: Array.isArray(creator.genres) ? creator.genres : [],
      links: Array.isArray(creator.links) ? creator.links : [],
      user: creator.userId
        ? {
            _id: toId(creator.userId._id),
            name: creator.userId.name || "",
            username: creator.userId.username || "",
            email: creator.userId.email || "",
            avatar: avatarToUrl(creator.userId.avatar),
          }
        : null,
      stats: {
        tracks,
        podcasts,
        albums,
        books,
        videos,
        totalRevenue: Number(revenueRows[0]?.revenue || 0),
        purchases: Number(revenueRows[0]?.purchases || 0),
      },
    });
  } catch (err) {
    console.error("Admin creator detail error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post(
  "/analytics/backfill",
  requireRole(SUPER_ADMIN_ROLES),
  requireStepUp({ adminOnly: true }),
  adminMutationLimiter,
  async (req, res) => {
  try {
    const startDate = String(req.body?.startDate || "").trim();
    const endDate = String(req.body?.endDate || "").trim();
    const docs = await backfillDailyAnalytics({ startDate, endDate });
    return res.json({ success: true, count: docs.length });
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to backfill analytics" });
  }
});

router.get("/dashboard", async (req, res) => {
  try {
    return res.json(await buildAdminDashboard(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    console.error("Admin dashboard error:", req.requestId, err);
    return res.status(code).json({ error: err.message || "Failed to load admin dashboard" });
  }
});

router.get("/analytics/overview", async (req, res) => {
  try {
    return res.json(await buildOverview(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    console.error("Admin analytics overview error:", req.requestId, err);
    return res.status(code).json({ error: err.message || "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/analytics/user-growth", async (req, res) => {
  try {
    return res.json(await buildUserGrowth(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load user growth analytics" });
  }
});

router.get("/analytics/content-uploads", async (req, res) => {
  try {
    return res.json(await buildContentUploads(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load content upload analytics" });
  }
});

router.get("/analytics/revenue", async (req, res) => {
  try {
    return res.json(await buildRevenueAnalytics(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load revenue analytics" });
  }
});

router.get("/analytics/commerce-ops", async (req, res) => {
  try {
    return res.json(await buildCommerceOperationsAnalytics(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load commerce operations analytics" });
  }
});

router.get("/analytics/product-scorecard", async (req, res) => {
  try {
    return res.json(await buildProductScorecard(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    console.error("Admin product scorecard error:", req.requestId, err);
    return res
      .status(code)
      .json({ error: err.message || "Failed to load the product scorecard" });
  }
});

router.get("/analytics/fan-retention", async (req, res) => {
  try {
    return res.json(await buildFanRetentionCohorts(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load fan retention cohorts" });
  }
});

router.get("/analytics/recommendations", async (req, res) => {
  try {
    return res.json(await buildRecommendationDiagnostics(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load recommendation diagnostics" });
  }
});

router.get("/analytics/executive-operating-dashboard", async (req, res) => {
  try {
    return res.json(await buildExecutiveOperatingDashboard(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load the executive operating dashboard" });
  }
});

router.get("/analytics/launch-growth-operating-system", async (req, res) => {
  try {
    return res.json(await buildLaunchGrowthOperatingSystem(getAnalyticsFilters(req)));
  } catch (err) {
    const code = Number(err?.status || 0) || (/invalid/i.test(String(err?.message || "")) ? 400 : 500);
    console.error("Admin launch growth operating system error:", req.requestId, err);
    return res.status(code).json({
      error: err.message || "Failed to load the launch growth operating system",
      details: err?.details || undefined,
      requestId: req.requestId,
    });
  }
});

router.post("/finance/payout-automation/preflight", adminMutationLimiter, async (req, res) => {
  try {
    const result = await preflightPayoutAutomation({
      requestIds: req.body?.requestIds,
      limit: req.body?.limit,
    });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.payout_automation.preflight",
      targetType: "CreatorPayoutRequest",
      targetId: "batch_candidates",
      reason: "Controlled payout automation preflight",
      metadata: {
        evaluated: result.decisions.length,
        candidates: result.candidateRequestIds.length,
        moneyMovementAuthorized: false,
      },
    });
    return res.json(result);
  } catch (err) {
    const code = Number(err?.status || 0) || 500;
    return res.status(code).json({
      error: err.message || "Failed to preflight payout requests",
      details: err?.details || undefined,
    });
  }
});

router.post("/growth/creator-programs/enroll", adminMutationLimiter, async (req, res) => {
  try {
    const enrollment = await enrollCreatorLifecycleProgram({
      creatorProfileId: req.body?.creatorProfileId,
      programKey: req.body?.programKey,
      ownerName: req.body?.ownerName,
      ownerRole: req.body?.ownerRole,
      adminNote: req.body?.adminNote,
      adminUserId: req.user.id,
    });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.creator_lifecycle.enroll",
      targetType: "CreatorLifecycleEnrollment",
      targetId: enrollment.id,
      reason: enrollment.adminNote || enrollment.entryReason,
      metadata: {
        creatorProfileId: enrollment.creatorProfileId,
        programKey: enrollment.programKey,
        status: enrollment.status,
      },
    });
    return res.status(201).json({ success: true, enrollment });
  } catch (err) {
    const code = Number(err?.status || 0)
      || (Number(err?.code || 0) === 11000 ? 409 : 0)
      || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to enroll creator", details: err?.details || undefined });
  }
});

router.patch("/growth/creator-programs/:enrollmentId", adminMutationLimiter, async (req, res) => {
  try {
    const enrollment = await updateCreatorLifecycleEnrollment({
      enrollmentId: req.params.enrollmentId,
      updates: req.body || {},
      adminUserId: req.user.id,
    });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.creator_lifecycle.update",
      targetType: "CreatorLifecycleEnrollment",
      targetId: enrollment.id,
      reason: enrollment.adminNote || "Creator lifecycle enrollment updated",
      metadata: { programKey: enrollment.programKey, status: enrollment.status },
    });
    return res.json({ success: true, enrollment });
  } catch (err) {
    const code = Number(err?.status || 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to update creator lifecycle enrollment", details: err?.details || undefined });
  }
});

router.post("/growth/revenue-campaigns", adminMutationLimiter, async (req, res) => {
  try {
    const campaign = await createRevenueCampaign({ payload: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.revenue_campaign.create",
      targetType: "RevenueCampaign",
      targetId: campaign.id,
      reason: "Reversible revenue campaign created",
      metadata: {
        campaignKey: campaign.campaignKey,
        type: campaign.type,
        ledgerTrackingKey: campaign.ledgerTrackingKey,
      },
    });
    return res.status(201).json({ success: true, campaign });
  } catch (err) {
    const code = Number(err?.status || 0)
      || (Number(err?.code || 0) === 11000 ? 409 : 0)
      || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to create revenue campaign", details: err?.details || undefined });
  }
});

router.patch("/growth/revenue-campaigns/:campaignId", adminMutationLimiter, async (req, res) => {
  try {
    const campaign = await updateRevenueCampaign({
      campaignId: req.params.campaignId,
      updates: req.body || {},
      adminUserId: req.user.id,
    });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.revenue_campaign.update",
      targetType: "RevenueCampaign",
      targetId: campaign.id,
      reason: String(req.body?.reason || "Campaign configuration updated").trim(),
      metadata: {
        campaignKey: campaign.campaignKey,
        status: campaign.status,
        readinessState: campaign.readinessState,
      },
    });
    return res.json({ success: true, campaign });
  } catch (err) {
    const code = Number(err?.status || 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to update revenue campaign", details: err?.details || undefined });
  }
});

router.get("/analytics/scale-evidence-operating-system", async (req, res) => {
  try {
    return res.json(await buildScaleEvidenceOperatingSystem(getAnalyticsFilters(req)));
  } catch (err) {
    const code = Number(err?.status || 0) || (/invalid/i.test(String(err?.message || "")) ? 400 : 500);
    console.error("Admin scale evidence operating system error:", req.requestId, err);
    return res.status(code).json({
      error: err.message || "Failed to load the scale evidence operating system",
      details: err?.details || undefined,
      requestId: req.requestId,
    });
  }
});

router.post("/growth/calendar", adminMutationLimiter, async (req, res) => {
  try {
    const entry = await createCalendarEntry({ payload: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.growth_calendar.create",
      targetType: "GrowthCalendarEntry",
      targetId: entry.id,
      reason: "Four-week growth calendar entry created",
      metadata: { entryKey: entry.entryKey, type: entry.type, reportingKey: entry.reportingKey },
    });
    return res.status(201).json({ success: true, entry });
  } catch (err) {
    const code = Number(err?.status || 0) || (Number(err?.code || 0) === 11000 ? 409 : 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to create calendar entry", details: err?.details || undefined });
  }
});

router.patch("/growth/calendar/:entryId", adminMutationLimiter, async (req, res) => {
  try {
    const entry = await updateCalendarEntry({ entryId: req.params.entryId, updates: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.growth_calendar.update",
      targetType: "GrowthCalendarEntry",
      targetId: entry.id,
      reason: String(req.body?.reason || "Growth calendar entry updated").trim(),
      metadata: { entryKey: entry.entryKey, status: entry.status, readinessState: entry.readinessState },
    });
    return res.json({ success: true, entry });
  } catch (err) {
    const code = Number(err?.status || 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to update calendar entry", details: err?.details || undefined });
  }
});

router.patch("/reliability/slo-policies/:key", adminMutationLimiter, async (req, res) => {
  try {
    const policy = await upsertSloPolicy({ key: req.params.key, payload: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.slo_policy.update",
      targetType: "ProductionSloPolicy",
      targetId: policy.key,
      reason: String(req.body?.reason || "").trim(),
      metadata: { targetPercent: policy.targetPercent, windowDays: policy.windowDays, errorBudgetMinutes: policy.errorBudgetMinutes },
    });
    return res.json({ success: true, policy });
  } catch (err) {
    const code = Number(err?.status || 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to update SLO policy", details: err?.details || undefined });
  }
});

router.post("/partnerships/pilots", adminMutationLimiter, async (req, res) => {
  try {
    const pilot = await createPartnerPilot({ payload: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.partner_pilot.create",
      targetType: "PartnerPilot",
      targetId: pilot.id,
      reason: "Bounded partner pilot created",
      metadata: { pilotKey: pilot.pilotKey, type: pilot.type, sponsored: pilot.sponsored, disclosureLabel: pilot.disclosureLabel },
    });
    return res.status(201).json({ success: true, pilot });
  } catch (err) {
    const code = Number(err?.status || 0) || (Number(err?.code || 0) === 11000 ? 409 : 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to create partner pilot", details: err?.details || undefined });
  }
});

router.patch("/partnerships/pilots/:pilotId", adminMutationLimiter, async (req, res) => {
  try {
    const pilot = await updatePartnerPilot({ pilotId: req.params.pilotId, updates: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.partner_pilot.update",
      targetType: "PartnerPilot",
      targetId: pilot.id,
      reason: String(req.body?.reason || "Partner pilot updated").trim(),
      metadata: { pilotKey: pilot.pilotKey, status: pilot.status, sponsored: pilot.sponsored, disclosureLabel: pilot.disclosureLabel },
    });
    return res.json({ success: true, pilot });
  } catch (err) {
    const code = Number(err?.status || 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to update partner pilot", details: err?.details || undefined });
  }
});

router.post("/growth/expansion-bets", adminMutationLimiter, async (req, res) => {
  try {
    const bet = await createExpansionBet({ payload: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.expansion_bet.create",
      targetType: "ExpansionBet",
      targetId: bet.id,
      reason: "Expansion bet created in research state",
      metadata: { betKey: bet.betKey, marketOrSegment: bet.marketOrSegment, costCap: bet.costCap, currency: bet.currency },
    });
    return res.status(201).json({ success: true, bet });
  } catch (err) {
    const code = Number(err?.status || 0) || (Number(err?.code || 0) === 11000 ? 409 : 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to create expansion bet", details: err?.details || undefined });
  }
});

router.patch("/growth/expansion-bets/:betId", adminMutationLimiter, async (req, res) => {
  try {
    const operatingSystem = await buildScaleEvidenceOperatingSystem({ range: "30d" });
    const expansionPaused = Boolean(operatingSystem.sloBudgets?.summary?.expansionPaused);
    const bet = await updateExpansionBet({ betId: req.params.betId, updates: req.body || {}, adminUserId: req.user.id, expansionPaused });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.expansion_bet.update",
      targetType: "ExpansionBet",
      targetId: bet.id,
      reason: String(req.body?.reason || "Expansion bet updated").trim(),
      metadata: { betKey: bet.betKey, state: bet.state, recommendedState: bet.recommendedState, expansionPaused },
    });
    return res.json({ success: true, bet });
  } catch (err) {
    const code = Number(err?.status || 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to update expansion bet", details: err?.details || undefined });
  }
});

router.get("/analytics/expansion-platform-operating-system", async (req, res) => {
  try {
    return res.json(await buildExpansionPlatformOperatingSystem(getAnalyticsFilters(req)));
  } catch (err) {
    const code = Number(err?.status || 0) || (/invalid/i.test(String(err?.message || "")) ? 400 : 500);
    console.error("Admin expansion platform operating system error:", req.requestId, err);
    return res.status(code).json({
      error: err.message || "Failed to load the expansion platform operating system",
      details: err?.details || undefined,
      requestId: req.requestId,
    });
  }
});

router.get("/analytics/ecosystem-network-operating-system", async (req, res) => {
  try {
    return res.json(await buildEcosystemNetworkOperatingSystem(getAnalyticsFilters(req)));
  } catch (err) {
    const code = Number(err?.status || 0) || (/invalid/i.test(String(err?.message || "")) ? 400 : 500);
    console.error("Admin ecosystem network operating system error:", req.requestId, err);
    return res.status(code).json({
      error: err.message || "Failed to load the ecosystem network operating system",
      details: err?.details || undefined,
      requestId: req.requestId,
    });
  }
});

router.get("/analytics/network-intelligence-operating-system", async (req, res) => {
  try {
    return res.json(await buildNetworkIntelligenceOperatingSystem(getAnalyticsFilters(req)));
  } catch (err) {
    const code = Number(err?.status || 0) || (/invalid/i.test(String(err?.message || "")) ? 400 : 500);
    console.error("Admin network intelligence operating system error:", req.requestId, err);
    return res.status(code).json({
      error: err.message || "Failed to load the network intelligence operating system",
      details: err?.details || undefined,
      requestId: req.requestId,
    });
  }
});

router.get("/analytics/automation-orchestration-operating-system", async (req, res) => {
  try {
    return res.json(await buildAutomationOrchestrationOperatingSystem(getAnalyticsFilters(req)));
  } catch (err) {
    const code = Number(err?.status || 0) || (/invalid/i.test(String(err?.message || "")) ? 400 : 500);
    console.error("Admin automation orchestration operating system error:", req.requestId, err);
    return res.status(code).json({
      error: err.message || "Failed to load the automation and orchestration operating system",
      details: err?.details || undefined,
      requestId: req.requestId,
    });
  }
});

router.get("/analytics/resilience-assurance-audit-operating-system", async (req, res) => {
  try {
    return res.json(await buildResilienceAssuranceAuditOperatingSystem(getAnalyticsFilters(req)));
  } catch (err) {
    const code = Number(err?.status || 0) || (/invalid/i.test(String(err?.message || "")) ? 400 : 500);
    console.error("Admin resilience assurance audit operating system error:", req.requestId, err);
    return res.status(code).json({
      error: err.message || "Failed to load the resilience, assurance, and audit operating system",
      details: err?.details || undefined,
      requestId: req.requestId,
    });
  }
});

const handleNetworkIntelligenceMutation = async ({ req, res, operation, successKey, action, targetType, created = false, metadata = {} }) => {
  try {
    const result = await operation();
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action,
      targetType,
      targetId: result.id,
      reason: String(req.body?.reason || `${targetType} created`).trim(),
      metadata: typeof metadata === "function" ? metadata(result) : metadata,
    });
    return res.status(created ? 201 : 200).json({ success: true, [successKey]: result });
  } catch (err) {
    const code = Number(err?.status || 0) || (Number(err?.code || 0) === 11000 ? 409 : 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || `Failed to update ${targetType}`, details: err?.details || undefined });
  }
};

router.post("/growth/network-programs", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, created: true, successKey: "program", action: "admin.network_program.create", targetType: "NetworkProgramEnrollment",
  operation: () => createNetworkProgram({ payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ programKey: row.programKey, programType: row.programType, status: row.status, creatorConsentRecorded: row.creatorConsentRecorded }),
}));

router.patch("/growth/network-programs/:programId", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "program", action: "admin.network_program.update", targetType: "NetworkProgramEnrollment",
  operation: () => updateNetworkProgram({ programId: req.params.programId, updates: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ programKey: row.programKey, status: row.status, outcomeEvidenceState: row.outcome?.evidenceState }),
}));

router.post("/partnerships/graduations", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, created: true, successKey: "graduation", action: "admin.partner_graduation.create", targetType: "PartnerAccessGraduation",
  operation: () => createPartnerGraduation({ payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ currentLevel: row.currentLevel, proposedLevel: row.proposedLevel, status: row.status, fanLevelRowsExposed: false }),
}));

router.patch("/partnerships/graduations/:graduationId", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "graduation", action: "admin.partner_graduation.update", targetType: "PartnerAccessGraduation",
  operation: () => updatePartnerGraduation({ graduationId: req.params.graduationId, updates: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ proposedLevel: row.proposedLevel, status: row.status, readyGates: row.summary?.ready, humanApprovalRecorded: row.humanApprovalRecorded }),
}));

router.post("/intelligence/metric-contracts", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, created: true, successKey: "contract", action: "admin.metric_contract.create", targetType: "MetricContract",
  operation: () => createMetricContract({ payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ metricKey: row.metricKey, trustState: row.trustState, canDriveDecision: row.canDriveDecision }),
}));

router.patch("/intelligence/metric-contracts/:contractId", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "contract", action: "admin.metric_contract.update", targetType: "MetricContract",
  operation: () => updateMetricContract({ contractId: req.params.contractId, updates: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ metricKey: row.metricKey, trustState: row.trustState, canDriveDecision: row.canDriveDecision }),
}));

router.post("/intelligence/products", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, created: true, successKey: "product", action: "admin.intelligence_product.create", targetType: "IntelligenceProduct",
  operation: () => createIntelligenceProduct({ payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ productKey: row.productKey, audience: row.audience, status: row.status, qualityState: row.qualityState }),
}));

router.patch("/intelligence/products/:productId", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "product", action: "admin.intelligence_product.update", targetType: "IntelligenceProduct",
  operation: () => updateIntelligenceProduct({ productId: req.params.productId, updates: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ productKey: row.productKey, audience: row.audience, status: row.status, qualityState: row.qualityState }),
}));

router.post("/intelligence/creator-prompts", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, created: true, successKey: "prompt", action: "admin.creator_intelligence_prompt.create", targetType: "CreatorIntelligencePrompt",
  operation: () => createCreatorIntelligencePrompt({ payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ promptKey: row.promptKey, status: row.status, sourceMetricKeys: row.sourceMetricKeys, confidence: row.confidence }),
}));

router.post("/intelligence/predictive-warnings", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, created: true, successKey: "warning", action: "admin.predictive_warning.create", targetType: "PredictiveWarning",
  operation: () => createPredictiveWarning({ payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ warningKey: row.warningKey, warningType: row.warningType, status: row.status, decisionAuthority: row.decisionAuthority }),
}));

router.patch("/intelligence/predictive-warnings/:warningId", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "warning", action: "admin.predictive_warning.update", targetType: "PredictiveWarning",
  operation: () => updatePredictiveWarning({ warningId: req.params.warningId, updates: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ warningKey: row.warningKey, warningType: row.warningType, status: row.status, decisionAuthority: row.decisionAuthority }),
}));

router.post("/operations/automation-registry", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, created: true, successKey: "automation", action: "admin.automation_registry.create", targetType: "AutomationRegistryEntry",
  operation: () => createAutomationRegistryEntry({ payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ automationKey: row.automationKey, state: row.state, riskLevel: row.riskLevel, executionAuthority: row.executionAuthority }),
}));

router.patch("/operations/automation-registry/:automationId", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "automation", action: "admin.automation_registry.update", targetType: "AutomationRegistryEntry",
  operation: () => updateAutomationRegistryEntry({ automationId: req.params.automationId, updates: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ automationKey: row.automationKey, state: row.state, riskLevel: row.riskLevel, executionAuthority: row.executionAuthority }),
}));

router.patch("/operations/automation-control-plane/:automationId", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "automation", action: "admin.automation_control.transition", targetType: "AutomationRegistryEntry",
  operation: () => transitionAutomationControl({ automationId: req.params.automationId, updates: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ automationKey: row.automationKey, state: row.state, riskClass: row.riskClass, scaleDecision: row.scaleDecision, executionAuthority: row.executionAuthority }),
}));

router.post("/operations/automation-runs", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, created: true, successKey: "run", action: "admin.automation_run.create", targetType: "AutomationRun",
  operation: () => createAutomationRun({ payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ automationKey: row.automationKey, riskClass: row.riskClass, status: row.status, humanReviewRequired: row.humanReviewRequired }),
}));

router.patch("/operations/automation-runs/:runId", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "run", action: "admin.automation_run.update", targetType: "AutomationRun",
  operation: () => updateAutomationRun({ runId: req.params.runId, updates: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ automationKey: row.automationKey, status: row.status, reviewDecision: row.review?.decision }),
}));

router.post("/orchestration/workflow-definitions", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, created: true, successKey: "definition", action: "admin.workflow_definition.create", targetType: "WorkflowDefinition",
  operation: () => createWorkflowDefinition({ payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ workflowKey: row.workflowKey, workflowDomain: row.workflowDomain, lifecycle: row.lifecycle }),
}));

router.patch("/orchestration/workflow-definitions/:definitionId", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "definition", action: "admin.workflow_definition.update", targetType: "WorkflowDefinition",
  operation: () => updateWorkflowDefinition({ definitionId: req.params.definitionId, updates: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ workflowKey: row.workflowKey, lifecycle: row.lifecycle, reviewDecision: row.reviewDecision }),
}));

router.post("/orchestration/workflow-runs", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, created: true, successKey: "run", action: "admin.workflow_run.create", targetType: "WorkflowRun",
  operation: () => createWorkflowRun({ payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ workflowKey: row.workflowKey, currentState: row.currentState, humanReviewRequired: row.humanReviewRequired }),
}));

router.patch("/orchestration/workflow-runs/:runId", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "run", action: "admin.workflow_run.update", targetType: "WorkflowRun",
  operation: () => updateWorkflowRun({ runId: req.params.runId, updates: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ workflowKey: row.workflowKey, currentState: row.currentState, approvalStatus: row.approval?.status }),
}));

router.put("/reliability/resilience-objectives/:flowKey", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "objective", action: "admin.resilience_objective.upsert", targetType: "ResilienceObjective",
  operation: () => upsertResilienceObjective({ flowKey: req.params.flowKey, payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ flowKey: row.flowKey, status: row.status, recoveryPriority: row.recoveryPriority, humanReviewRecorded: row.humanReviewRecorded }),
}));

router.post("/resilience/incidents", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, created: true, successKey: "incident", action: "admin.resilience_incident.create", targetType: "ResilienceIncident",
  operation: () => createResilienceIncident({ payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ incidentKey: row.incidentKey, incidentClass: row.incidentClass, severity: row.severity, degradedMode: row.degradedMode, status: row.status }),
}));

router.patch("/resilience/incidents/:incidentId", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "incident", action: "admin.resilience_incident.update", targetType: "ResilienceIncident",
  operation: () => updateResilienceIncident({ incidentId: req.params.incidentId, updates: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ incidentKey: row.incidentKey, severity: row.severity, degradedMode: row.degradedMode, status: row.status }),
}));

router.post("/resilience/drills", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, created: true, successKey: "drill", action: "admin.resilience_drill.create", targetType: "ResilienceDrill",
  operation: () => createResilienceDrill({ payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ drillKey: row.drillKey, scenarioKey: row.scenarioKey, domain: row.domain, status: row.status, observed: row.observed }),
}));

router.patch("/resilience/drills/:drillId", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "drill", action: "admin.resilience_drill.update", targetType: "ResilienceDrill",
  operation: () => updateResilienceDrill({ drillId: req.params.drillId, updates: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ drillKey: row.drillKey, status: row.status, observed: row.observed, humanReviewRecorded: row.humanReviewRecorded }),
}));

router.put("/resilience/gates/:gateKey", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "gate", action: "admin.resilience_gate.upsert", targetType: "ResilienceGate",
  operation: () => upsertResilienceGate({ gateKey: req.params.gateKey, payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ gateKey: row.gateKey, status: row.status, humanApprovalRecorded: row.humanApprovalRecorded }),
}));

router.post("/assurance/controls", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, created: true, successKey: "control", action: "admin.assurance_control.create", targetType: "AssuranceControl",
  operation: () => createAssuranceControl({ payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ controlKey: row.controlKey, status: row.status, evidenceFreshness: row.evidenceFreshness, exceptionSeverity: row.exceptionSeverity }),
}));

router.patch("/assurance/controls/:controlId", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "control", action: "admin.assurance_control.update", targetType: "AssuranceControl",
  operation: () => updateAssuranceControl({ controlId: req.params.controlId, updates: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ controlKey: row.controlKey, status: row.status, evidenceFreshness: row.evidenceFreshness, humanReviewRecorded: row.humanReviewRecorded }),
}));

router.post("/assurance/evidence-packs", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, created: true, successKey: "pack", action: "admin.assurance_evidence_pack.create", targetType: "AssuranceEvidencePack",
  operation: () => createAssuranceEvidencePack({ payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ packKey: row.packKey, packType: row.packType, readinessState: row.readinessState, sharingLevel: row.sharingLevel }),
}));

router.patch("/assurance/evidence-packs/:packId", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "pack", action: "admin.assurance_evidence_pack.update", targetType: "AssuranceEvidencePack",
  operation: () => updateAssuranceEvidencePack({ packId: req.params.packId, updates: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ packKey: row.packKey, readinessState: row.readinessState, evidenceFreshness: row.evidenceFreshness, externalShareApproved: row.externalShareApproved }),
}));

router.post("/audit/domains", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, created: true, successKey: "domain", action: "admin.audit_domain.create", targetType: "AuditDomain",
  operation: () => createAuditDomain({ payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ domainKey: row.domainKey, riskScore: row.riskScore, readinessState: row.readinessState, selectedForFirstAudit: row.selectedForFirstAudit }),
}));

router.patch("/audit/domains/:domainId", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "domain", action: "admin.audit_domain.update", targetType: "AuditDomain",
  operation: () => updateAuditDomain({ domainId: req.params.domainId, updates: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ domainKey: row.domainKey, readinessState: row.readinessState, evidenceState: row.evidenceState, ownerSignoffRecorded: row.ownerSignoffRecorded }),
}));

router.post("/audit/control-tests", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, created: true, successKey: "test", action: "admin.audit_control_test.create", targetType: "AuditControlTest",
  operation: () => createAuditControlTest({ payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ testKey: row.testKey, domainKey: row.domainKey, controlKey: row.controlKey, result: row.result, sampleSize: row.sampleSize }),
}));

router.patch("/audit/control-tests/:testId", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "test", action: "admin.audit_control_test.update", targetType: "AuditControlTest",
  operation: () => updateAuditControlTest({ testId: req.params.testId, updates: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ testKey: row.testKey, result: row.result, retestRequired: row.retestRequired, evidenceState: row.evidenceState }),
}));

router.post("/audit/findings", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, created: true, successKey: "finding", action: "admin.audit_finding.create", targetType: "AuditFinding",
  operation: () => createAuditFinding({ payload: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ findingKey: row.findingKey, domainKey: row.domainKey, severity: row.severity, status: row.status, retestState: row.retestState }),
}));

router.patch("/audit/findings/:findingId", adminMutationLimiter, (req, res) => handleNetworkIntelligenceMutation({
  req, res, successKey: "finding", action: "admin.audit_finding.update", targetType: "AuditFinding",
  operation: () => updateAuditFinding({ findingId: req.params.findingId, updates: req.body || {}, adminUserId: req.user.id }),
  metadata: (row) => ({ findingKey: row.findingKey, severity: row.severity, status: row.status, retestState: row.retestState, riskAccepted: row.acceptedRisk?.accepted }),
}));

router.post("/growth/creator-services", adminMutationLimiter, async (req, res) => {
  try {
    const enrollment = await createCreatorServiceEnrollment({ payload: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.creator_service.enroll",
      targetType: "CreatorServiceEnrollment",
      targetId: enrollment.id,
      reason: "Controlled creator service candidate created",
      metadata: { programKey: enrollment.programKey, status: enrollment.status, serviceTier: enrollment.serviceTier },
    });
    return res.status(201).json({ success: true, enrollment });
  } catch (err) {
    const code = Number(err?.status || 0) || (Number(err?.code || 0) === 11000 ? 409 : 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to create creator service enrollment", details: err?.details || undefined });
  }
});

router.patch("/growth/creator-services/:enrollmentId", adminMutationLimiter, async (req, res) => {
  try {
    const enrollment = await updateCreatorServiceEnrollment({ enrollmentId: req.params.enrollmentId, updates: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.creator_service.update",
      targetType: "CreatorServiceEnrollment",
      targetId: enrollment.id,
      reason: String(req.body?.reason || "").trim(),
      metadata: { programKey: enrollment.programKey, status: enrollment.status, completionRate: enrollment.progress?.completionRate },
    });
    return res.json({ success: true, enrollment });
  } catch (err) {
    const code = Number(err?.status || 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to update creator service enrollment", details: err?.details || undefined });
  }
});

router.post("/growth/community-loops", adminMutationLimiter, async (req, res) => {
  try {
    const communityLoop = await createCommunityLoop({ payload: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.community_loop.create",
      targetType: "CommunityLoopProgram",
      targetId: communityLoop.id,
      reason: "Controlled fan community loop created",
      metadata: { loopKey: communityLoop.loopKey, loopType: communityLoop.loopType, status: communityLoop.status, privateFanRowsExposed: false },
    });
    return res.status(201).json({ success: true, communityLoop });
  } catch (err) {
    const code = Number(err?.status || 0) || (Number(err?.code || 0) === 11000 ? 409 : 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to create community loop", details: err?.details || undefined });
  }
});

router.patch("/growth/community-loops/:loopId", adminMutationLimiter, async (req, res) => {
  try {
    const communityLoop = await updateCommunityLoop({ loopId: req.params.loopId, updates: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.community_loop.update",
      targetType: "CommunityLoopProgram",
      targetId: communityLoop.id,
      reason: String(req.body?.reason || "").trim(),
      metadata: { loopKey: communityLoop.loopKey, status: communityLoop.status, guardrailState: communityLoop.guardrailState, privateFanRowsExposed: false },
    });
    return res.json({ success: true, communityLoop });
  } catch (err) {
    const code = Number(err?.status || 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to update community loop", details: err?.details || undefined });
  }
});

router.post("/partnerships/integrations", adminMutationLimiter, async (req, res) => {
  try {
    const integration = await createPartnerIntegration({ payload: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.partner_integration.create",
      targetType: "PartnerIntegration",
      targetId: integration.id,
      reason: "Scoped partner integration requested",
      metadata: { integrationKey: integration.integrationKey, level: integration.level, status: integration.status, fanLevelRowsExposed: false },
    });
    return res.status(201).json({ success: true, integration });
  } catch (err) {
    const code = Number(err?.status || 0) || (Number(err?.code || 0) === 11000 ? 409 : 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to create partner integration", details: err?.details || undefined });
  }
});

router.patch("/partnerships/integrations/:integrationId", adminMutationLimiter, async (req, res) => {
  try {
    const integration = await updatePartnerIntegration({ integrationId: req.params.integrationId, updates: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.partner_integration.update",
      targetType: "PartnerIntegration",
      targetId: integration.id,
      reason: String(req.body?.reason || "").trim(),
      metadata: { integrationKey: integration.integrationKey, level: integration.level, status: integration.status, accessState: integration.accessState },
    });
    return res.json({ success: true, integration });
  } catch (err) {
    const code = Number(err?.status || 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to update partner integration", details: err?.details || undefined });
  }
});

router.post("/growth/market-readiness", adminMutationLimiter, async (req, res) => {
  try {
    const market = await createMarketReadinessReview({ payload: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.market_readiness.create",
      targetType: "MarketReadinessReview",
      targetId: market.id,
      reason: "Multi-market readiness review created",
      metadata: { marketKey: market.marketKey, state: market.state, controlledLaunchEligible: market.controlledLaunchEligible },
    });
    return res.status(201).json({ success: true, market });
  } catch (err) {
    const code = Number(err?.status || 0) || (Number(err?.code || 0) === 11000 ? 409 : 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to create market readiness review", details: err?.details || undefined });
  }
});

router.patch("/growth/market-readiness/:marketId", adminMutationLimiter, async (req, res) => {
  try {
    const market = await updateMarketReadinessReview({ marketId: req.params.marketId, updates: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.market_readiness.update",
      targetType: "MarketReadinessReview",
      targetId: market.id,
      reason: String(req.body?.reason || "").trim(),
      metadata: { marketKey: market.marketKey, state: market.state, readyGates: market.summary?.ready, controlledLaunchEligible: market.controlledLaunchEligible },
    });
    return res.json({ success: true, market });
  } catch (err) {
    const code = Number(err?.status || 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to update market readiness review", details: err?.details || undefined });
  }
});

router.patch("/growth/creator-launch-plans/:planId/review", adminMutationLimiter, async (req, res) => {
  try {
    const plan = await reviewCreatorLaunchPlan({
      planId: req.params.planId,
      adminUserId: req.user.id,
      decision: req.body?.decision,
      note: req.body?.note,
    });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.creator_launch_plan.review",
      targetType: "CreatorLaunchPlan",
      targetId: plan.id,
      reason: String(req.body?.note || "").trim(),
      metadata: { planKey: plan.planKey, decision: req.body?.decision, status: plan.status, riskLevel: plan.riskLevel },
    });
    return res.json({ success: true, plan });
  } catch (err) {
    const code = Number(err?.status || 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to review creator launch plan", details: err?.details || undefined });
  }
});

router.post("/growth/experiments", adminMutationLimiter, async (req, res) => {
  try {
    const experiment = await createExpansionExperiment({ payload: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.expansion_experiment.create",
      targetType: "ExpansionExperiment",
      targetId: experiment.id,
      reason: "Governed expansion experiment created in draft state",
      metadata: { experimentKey: experiment.experimentKey, primaryMetric: experiment.primaryMetric, guardrails: experiment.guardrailMetrics },
    });
    return res.status(201).json({ success: true, experiment });
  } catch (err) {
    const code = Number(err?.status || 0) || (Number(err?.code || 0) === 11000 ? 409 : 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to create expansion experiment", details: err?.details || undefined });
  }
});

router.patch("/growth/experiments/:experimentId", adminMutationLimiter, async (req, res) => {
  try {
    const experiment = await updateExpansionExperiment({ experimentId: req.params.experimentId, updates: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.expansion_experiment.update",
      targetType: "ExpansionExperiment",
      targetId: experiment.id,
      reason: String(req.body?.reason || "Experiment configuration updated").trim(),
      metadata: { experimentKey: experiment.experimentKey, status: experiment.status, dataQualityState: experiment.dataQualityState, decision: experiment.decision },
    });
    return res.json({ success: true, experiment });
  } catch (err) {
    const code = Number(err?.status || 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to update expansion experiment", details: err?.details || undefined });
  }
});

router.post("/operations/automation-suggestions", adminMutationLimiter, async (req, res) => {
  try {
    const suggestion = await createAutomationSuggestion({ payload: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.automation_suggestion.create",
      targetType: "AutomationSuggestion",
      targetId: suggestion.id,
      reason: "Suggestion-only operations automation record created",
      metadata: { suggestionType: suggestion.suggestionType, confidence: suggestion.confidence, authorizesSensitiveAction: false },
    });
    return res.status(201).json({ success: true, suggestion });
  } catch (err) {
    const code = Number(err?.status || 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to create automation suggestion", details: err?.details || undefined });
  }
});

router.patch("/operations/automation-suggestions/:suggestionId", adminMutationLimiter, async (req, res) => {
  try {
    const suggestion = await reviewAutomationSuggestion({ suggestionId: req.params.suggestionId, decision: req.body?.decision, reason: req.body?.reason, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.automation_suggestion.review",
      targetType: "AutomationSuggestion",
      targetId: suggestion.id,
      reason: String(req.body?.reason || "").trim(),
      metadata: { suggestionType: suggestion.suggestionType, status: suggestion.status, authorizesSensitiveAction: false },
    });
    return res.json({ success: true, suggestion });
  } catch (err) {
    const code = Number(err?.status || 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to review automation suggestion", details: err?.details || undefined });
  }
});

router.post("/governance/decisions", adminMutationLimiter, async (req, res) => {
  try {
    const decision = await createGovernanceDecision({ payload: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.governance_decision.create",
      targetType: "GovernanceDecision",
      targetId: decision.id,
      reason: "Expiring governance decision opened",
      metadata: { decisionKey: decision.decisionKey, workflowType: decision.workflowType, riskLevel: decision.riskLevel, requiredReviewRoles: decision.requiredReviewRoles },
    });
    return res.status(201).json({ success: true, decision });
  } catch (err) {
    const code = Number(err?.status || 0) || (Number(err?.code || 0) === 11000 ? 409 : 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to create governance decision", details: err?.details || undefined });
  }
});

router.patch("/governance/decisions/:decisionId", adminMutationLimiter, async (req, res) => {
  try {
    const decision = await updateGovernanceDecision({ decisionId: req.params.decisionId, updates: req.body || {}, adminUserId: req.user.id });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.governance_decision.update",
      targetType: "GovernanceDecision",
      targetId: decision.id,
      reason: String(req.body?.reason || "Governance review updated").trim(),
      metadata: { decisionKey: decision.decisionKey, workflowType: decision.workflowType, status: decision.status, approvedRoles: decision.approvedRoles, missingReviewRoles: decision.missingReviewRoles },
    });
    return res.json({ success: true, decision });
  } catch (err) {
    const code = Number(err?.status || 0) || (err?.name === "ValidationError" ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to update governance decision", details: err?.details || undefined });
  }
});

router.patch("/analytics/recommendations/policy", adminMutationLimiter, async (req, res) => {
  try {
    const reason = String(req.body?.reason || "").trim();
    const updates = { ...req.body };
    delete updates.reason;
    const result = await updateRecommendationPolicy({
      updates,
      userId: req.user.id,
      reason,
    });
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.recommendation_policy.update",
      targetType: "RecommendationPolicy",
      targetId: "global",
      reason,
      metadata: {
        previous: result.previous,
        next: result.policy,
      },
    });
    return res.json({ success: true, policy: result.policy });
  } catch (err) {
    const code = Number(err?.status || 0) || (/invalid|required/i.test(String(err?.message || "")) ? 400 : 500);
    return res.status(code).json({ error: err.message || "Failed to update recommendation policy" });
  }
});

router.get("/analytics/engagement", async (req, res) => {
  try {
    return res.json(await buildEngagementAnalytics(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load engagement analytics" });
  }
});

router.get("/messages/overview", async (req, res) => {
  try {
    return res.json(await buildMessagesOverview(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load message analytics" });
  }
});

router.get("/messages/complaints", requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const limit = clamp(req.query.limit, 1, 50, 8);
    const page = clamp(req.query.page, 1, 1000, 1);
    const status = normalizeComplaintStatus(req.query.status);
    const query = status ? { status } : {};
    const skip = (page - 1) * limit;

    const [complaints, total, open, reviewing, resolved, dismissed, critical, high] = await Promise.all([
      AdminComplaint.find(query)
        .populate("reporterId", "_id name username avatar")
        .populate("reviewedBy", "_id name username email")
        .sort({ priorityScore: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdminComplaint.countDocuments(query),
      AdminComplaint.countDocuments({ status: "open" }),
      AdminComplaint.countDocuments({ status: "reviewing" }),
      AdminComplaint.countDocuments({ status: "resolved" }),
      AdminComplaint.countDocuments({ status: "dismissed" }),
      AdminComplaint.countDocuments({ priority: "critical" }),
      AdminComplaint.countDocuments({ priority: "high" }),
    ]);

    return res.json({
      summary: {
        total,
        open,
        reviewing,
        resolved,
        dismissed,
        critical,
        high,
      },
      complaints: complaints.map(mapComplaint),
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error("Admin complaints list error:", req.requestId, err);
    return res.status(500).json({ error: "Failed to load admin complaints" });
  }
});

router.patch(
  "/messages/complaints/:id",
  requireRole(ADMIN_ROLES),
  adminMutationLimiter,
  async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid complaint id" });
    }

    const complaint = await AdminComplaint.findById(req.params.id)
      .populate("reporterId", "_id name username avatar")
      .populate("reviewedBy", "_id name username email");
    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const nextStatus = normalizeComplaintStatus(req.body?.status) || complaint.status;
    const note = String(req.body?.adminNote || "").trim().slice(0, 1000);
    const previousStatus = String(complaint.status || "open");
    const statusChanged = nextStatus && nextStatus !== complaint.status;
    const wasClosed = ["resolved", "dismissed"].includes(String(complaint.status || "").toLowerCase());
    const willClose = ["resolved", "dismissed"].includes(nextStatus);

    if (statusChanged) {
      complaint.status = nextStatus;
      complaint.reviewedBy = req.user.id;
      complaint.reviewedAt = new Date();
      if (nextStatus === "resolved") {
        complaint.resolvedAt = new Date();
      }
    }
    if (note) {
      complaint.adminNote = note;
    }

    await complaint.save();

    if (statusChanged && willClose && !wasClosed && complaint.reporterId?._id) {
      await createNotification({
        recipient: complaint.reporterId._id,
        sender: req.user.id,
        type: "system",
        text: `Your Report To Admin message was marked ${nextStatus}.`,
        metadata: {
          previewText: note || complaint.subject,
          link: "/home",
          dedupeKey: `admin_complaint_status:${complaint._id.toString()}:${nextStatus}`,
        },
      }).catch(() => null);
    }

    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.complaint.update",
      targetType: "AdminComplaint",
      targetId: toId(complaint._id),
      reason: note || nextStatus,
      metadata: {
        previousStatus,
        newStatus: nextStatus,
      },
    }).catch(() => null);

    return res.json({ success: true, complaint: mapComplaint(complaint) });
  } catch (err) {
    console.error("Admin complaint update error:", req.requestId, err);
    return res.status(500).json({ error: "Failed to update complaint" });
  }
});

router.get("/analytics/top-creators", async (req, res) => {
  try {
    const mode = String(req.query.mode || "revenue").trim().toLowerCase();
    const limit = clamp(req.query.limit, 1, 50, 10);
    return res.json(await buildTopCreators({ ...getAnalyticsFilters(req), mode, limit }));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load top creators analytics" });
  }
});

router.get("/analytics/top-content", async (req, res) => {
  try {
    const limit = clamp(req.query.limit, 1, 50, 10);
    return res.json(await buildTopContent({ ...getAnalyticsFilters(req), limit }));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load top content analytics" });
  }
});

router.get("/analytics/recent-activity", async (req, res) => {
  try {
    return res.json(await buildRecentActivity({
      ...getAnalyticsFilters(req),
      page: req.query.page,
      limit: req.query.limit,
    }));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load recent activity" });
  }
});

router.get("/analytics/system-alerts", async (req, res) => {
  try {
    return res.json(await buildSystemAlerts(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load system alerts" });
  }
});

router.get("/analytics/reliability-health", async (req, res) => {
  try {
    return res.json(await buildReliabilityHealth(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load reliability health" });
  }
});

router.get("/analytics/reports-summary", async (req, res) => {
  try {
    return res.json(await buildReportsSummary(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load reports summary" });
  }
});

router.post(
  "/users/:id/promote-super-admin",
  requireRole(SUPER_ADMIN_ROLES),
  requireStepUp({ adminOnly: true }),
  adminMutationLimiter,
  async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(400).json({ error: "Invalid user id" });
      }
      const target = await User.findById(req.params.id);
      if (!target) return res.status(404).json({ error: "User not found" });
      if (toId(target?._id) === req.user.id) {
        return res.status(400).json({ error: "You cannot promote your own account" });
      }
      target.role = "super_admin";
      await target.save();
      await writeAuditLog({
        req,
        actorId: req.user.id,
        action: "admin.user.promote_super_admin",
        targetType: "User",
        targetId: toId(target._id),
        reason: String(req.body?.reason || ""),
      });
      return res.json({ success: true });
    } catch (err) {
      console.error("Promote super_admin error:", req.requestId, err);
      return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
    }
  }
);

router.get("/storage/overview", async (_req, res) => {
  try {
    return res.json({
      actions: getStorageActionCatalog(),
      ...(await getStorageOverview()),
    });
  } catch (err) {
    console.error("Admin storage overview error:", err);
    return res.status(500).json({ error: err.message || "Failed to load storage overview" });
  }
});

router.post("/storage/cleanup/preview", async (req, res) => {
  try {
    const actions = req.body?.actions || [];
    return res.json(await previewCleanup(actions));
  } catch (err) {
    console.error("Admin storage cleanup preview error:", err);
    return res.status(500).json({ error: err.message || "Failed to preview storage cleanup" });
  }
});

router.post(
  "/storage/cleanup/run",
  requireStepUp({ adminOnly: true }),
  adminMutationLimiter,
  async (req, res) => {
  try {
    const actions = req.body?.actions || [];
    const dryRun = Boolean(req.body?.dryRun);
    return res.json(await runCleanup(actions, { dryRun }));
  } catch (err) {
    console.error("Admin storage cleanup run error:", err);
    return res.status(500).json({ error: err.message || "Failed to run storage cleanup" });
  }
});

module.exports = router;
