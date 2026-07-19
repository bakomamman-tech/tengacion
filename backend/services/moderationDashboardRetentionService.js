const Album = require("../models/Album");
const Book = require("../models/Book");
const Message = require("../models/Message");
const ModerationCase = require("../models/ModerationCase");
const Post = require("../models/Post");
const Story = require("../models/Story");
const Track = require("../models/Track");
const Video = require("../models/Video");

const ONE_HOUR_MS = 60 * 60 * 1000;
const DEFAULT_RETENTION_MS = Math.max(
  60 * 1000,
  Number(process.env.MODERATION_DASHBOARD_RETENTION_MS || ONE_HOUR_MS)
);
const DEFAULT_SWEEP_INTERVAL_MS = Math.max(
  60 * 1000,
  Number(process.env.MODERATION_DASHBOARD_SWEEP_INTERVAL_MS || 60 * 1000)
);
const TERMINAL_DASHBOARD_STATUSES = [
  "approved",
  "ALLOW",
  "rejected",
  "BLOCK_EXPLICIT_ADULT",
  "BLOCK_SUSPECTED_CHILD_EXPLOITATION",
  "BLOCK_EXTREME_GORE",
  "BLOCK_ANIMAL_CRUELTY",
  "BLOCK_REPEAT_VIOLATOR",
];
const LINKED_CONTENT_MODELS = [Album, Book, Message, Post, Story, Track, Video];

const buildExpiredDashboardQuery = ({ now = new Date(), retentionMs = DEFAULT_RETENTION_MS } = {}) => {
  const cutoff = new Date(now.getTime() - Math.max(60 * 1000, Number(retentionMs) || DEFAULT_RETENTION_MS));
  return {
    status: { $in: TERMINAL_DASHBOARD_STATUSES },
    workflowState: "RESOLVED",
    $expr: {
      $lte: [
        { $ifNull: ["$reviewedAt", { $ifNull: ["$updatedAt", "$createdAt"] }] },
        cutoff,
      ],
    },
  };
};

const purgeExpiredModerationDashboardRecords = async ({
  now = new Date(),
  retentionMs = DEFAULT_RETENTION_MS,
  logger = console,
} = {}) => {
  const expiredCases = await ModerationCase.find(
    buildExpiredDashboardQuery({ now, retentionMs })
  ).select("_id").lean();
  const caseIds = expiredCases.map((caseDoc) => caseDoc._id);
  if (caseIds.length === 0) {
    return { deletedCount: 0, clearedReferences: 0 };
  }

  const referenceResults = await Promise.all(
    LINKED_CONTENT_MODELS.map((Model) =>
      Model.updateMany(
        { moderationCaseId: { $in: caseIds } },
        { $set: { moderationCaseId: null } }
      ).catch(() => ({ modifiedCount: 0 }))
    )
  );
  const deleteResult = await ModerationCase.deleteMany({ _id: { $in: caseIds } });
  const result = {
    deletedCount: Number(deleteResult.deletedCount || 0),
    clearedReferences: referenceResults.reduce(
      (total, entry) => total + Number(entry.modifiedCount || 0),
      0
    ),
  };
  logger?.log?.("[moderation-dashboard-retention] Removed expired resolved records.", result);
  return result;
};

let retentionTimer = null;
const startModerationDashboardRetention = ({ logger = console } = {}) => {
  if (retentionTimer) return retentionTimer;
  purgeExpiredModerationDashboardRecords({ logger }).catch((error) => {
    logger?.error?.("[moderation-dashboard-retention] Initial cleanup failed:", error?.message || error);
  });
  retentionTimer = setInterval(() => {
    purgeExpiredModerationDashboardRecords({ logger }).catch((error) => {
      logger?.error?.("[moderation-dashboard-retention] Cleanup failed:", error?.message || error);
    });
  }, DEFAULT_SWEEP_INTERVAL_MS);
  retentionTimer.unref?.();
  return retentionTimer;
};

const stopModerationDashboardRetention = () => {
  if (!retentionTimer) return;
  clearInterval(retentionTimer);
  retentionTimer = null;
};

module.exports = {
  DEFAULT_RETENTION_MS,
  TERMINAL_DASHBOARD_STATUSES,
  buildExpiredDashboardQuery,
  purgeExpiredModerationDashboardRecords,
  startModerationDashboardRetention,
  stopModerationDashboardRetention,
};
