const mongoose = require("mongoose");

const {
  DAY_MS,
  auditLogRetentionDays,
  analyticsEventRetentionDays,
  moderationDecisionRetentionDays,
  newsFeedImpressionRetentionDays,
  newsIngestionJobRetentionDays,
  notificationReadRetentionDays,
  notificationUnreadRetentionDays,
  recommendationLogRetentionDays,
  tempUploadRetentionDays,
} = require("../config/storage");

const AnalyticsEvent = require("../models/AnalyticsEvent");
const AuthChallenge = require("../models/AuthChallenge");
const AuditLog = require("../models/AuditLog");
const MediaHash = require("../models/MediaHash");
const ModerationCase = require("../models/ModerationCase");
const ModerationDecisionLog = require("../models/ModerationDecisionLog");
const NewsFeedImpression = require("../models/NewsFeedImpression");
const NewsIngestionJob = require("../models/NewsIngestionJob");
const NewsPublisherContract = require("../models/NewsPublisherContract");
const Notification = require("../models/Notification");
const Otp = require("../models/Otp");
const Post = require("../models/Post");
const RecommendationLog = require("../models/RecommendationLog");
const Report = require("../models/Report");
const Story = require("../models/Story");
const Message = require("../models/Message");
const User = require("../models/User");
const UserStrike = require("../models/UserStrike");
const { getMediaAuditSummary } = require("./mediaAuditService");
const { deleteStoredMedia } = require("./storageQuarantineService");

const STORAGE_WASTE_PATTERNS = [
  /base64/i,
  /buffer/i,
  /raw/i,
  /payload/i,
  /snapshot/i,
  /response/i,
  /request/i,
  /history/i,
  /log/i,
  /metadata/i,
  /thumbnail/i,
  /preview/i,
  /duplicate/i,
  /derived/i,
  /full.?user/i,
  /user.?snapshot/i,
];

const ACTIONS = [
  {
    key: "staleNotifications",
    label: "Stale notifications",
    description: "Delete old read notifications and any unread notifications that are past their retention window.",
  },
  {
    key: "expiredAuthArtifacts",
    label: "Expired auth artifacts",
    description: "Clear expired OTPs, auth challenges, revoked sessions, and user token hashes that are already past expiry.",
  },
  {
    key: "staleLogs",
    label: "Stale logs",
    description: "Delete expired audit, analytics, moderation, recommendation, and news ingestion logs.",
  },
  {
    key: "temporaryUploads",
    label: "Temporary uploads",
    description: "Delete abandoned temporary moderation uploads and their private media files after the retention window.",
  },
  {
    key: "orphanedMedia",
    label: "Orphaned media",
    description: "Delete media-hash records that no longer belong to a live moderation case.",
  },
  {
    key: "duplicateMedia",
    label: "Duplicate media",
    description: "Remove exact duplicate media-hash records while keeping the newest document for each case/hash pair.",
  },
  {
    key: "demoData",
    label: "Test/demo data",
    description: "Remove obvious test or demo users and their related social content.",
  },
];

const ACTION_MAP = new Map(ACTIONS.map((entry) => [entry.key, entry]));
const DEFAULT_SAFE_ACTIONS = ACTIONS.filter((entry) => entry.key !== "demoData").map((entry) => entry.key);
const INDEX_SYNC_MODELS = [
  Message,
  Notification,
  Otp,
  AuditLog,
  AnalyticsEvent,
  RecommendationLog,
  ModerationDecisionLog,
  NewsFeedImpression,
  NewsIngestionJob,
  NewsPublisherContract,
];

const modelByCollectionName = () =>
  new Map(
    mongoose.modelNames().map((modelName) => {
      const model = mongoose.model(modelName);
      return [model.collection.name, model];
    })
  );

const toId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const buildCutoffDate = (days = 0) => new Date(Date.now() - Math.max(0, Number(days) || 0) * DAY_MS);

const toInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const collectWasteFieldsFromValue = (value, pathPrefix = "", depth = 0, results = new Set()) => {
  if (depth > 2 || value === null || value === undefined) {
    return results;
  }

  const prefix = String(pathPrefix || "").trim();
  if (typeof value === "string") {
    if (value.length > 500 && prefix) {
      results.add(prefix);
    }
    return results;
  }

  if (Array.isArray(value)) {
    if (value.length > 8 && prefix) {
      results.add(prefix);
    }
    for (let index = 0; index < Math.min(value.length, 4); index += 1) {
      collectWasteFieldsFromValue(value[index], `${prefix}[${index}]`, depth + 1, results);
    }
    return results;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length > 12 && prefix) {
      results.add(prefix);
    }

    for (const [key, raw] of entries.slice(0, 10)) {
      const nextPath = prefix ? `${prefix}.${key}` : key;
      if (STORAGE_WASTE_PATTERNS.some((pattern) => pattern.test(key))) {
        results.add(nextPath);
      }
      if (typeof raw === "string" && raw.length > 500) {
        results.add(nextPath);
      } else if (Array.isArray(raw) && raw.length > 8) {
        results.add(nextPath);
      } else if (raw && typeof raw === "object") {
        collectWasteFieldsFromValue(raw, nextPath, depth + 1, results);
      }
    }
  }

  return results;
};

const detectLikelyWasteFieldsFromSchema = (model) => {
  if (!model?.schema?.paths) {
    return [];
  }

  const fields = new Set();
  for (const [pathName, schemaType] of Object.entries(model.schema.paths)) {
    if (pathName === "_id" || pathName === "__v") {
      continue;
    }

    if (STORAGE_WASTE_PATTERNS.some((pattern) => pattern.test(pathName))) {
      fields.add(pathName);
    }

    if (schemaType?.instance === "Mixed") {
      fields.add(pathName);
    }

    if (schemaType?.instance === "Array" && schemaType?.caster?.instance === "Mixed") {
      fields.add(pathName);
    }
  }

  return Array.from(fields).slice(0, 12);
};

const sampleLargestDocs = async (collection, limit = 3) => {
  const pipeline = [
    {
      $project: {
        _id: 1,
        docSizeBytes: { $bsonSize: "$$ROOT" },
        doc: "$$ROOT",
      },
    },
    { $sort: { docSizeBytes: -1 } },
    { $limit: Math.max(1, limit) },
  ];

  try {
    return await collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
  } catch {
    return [];
  }
};

const buildCollectionOverview = async (collectionName, model = null) => {
  const db = mongoose.connection.db;
  const collection = db.collection(collectionName);
  const stats = await db.command({ collStats: collectionName, scale: 1 }).catch(() => null);
  const indexes = await collection.indexes().catch(() => []);
  const sampleDocs = await sampleLargestDocs(collection, 3);

  const sampleWasteFields = new Set();
  for (const entry of sampleDocs) {
    const docWaste = collectWasteFieldsFromValue(entry?.doc || entry, "", 0, new Set());
    for (const field of docWaste) {
      sampleWasteFields.add(field);
    }
  }

  const likelyWasteFields = [
    ...detectLikelyWasteFieldsFromSchema(model),
    ...Array.from(sampleWasteFields),
  ].filter(Boolean);

  return {
    collectionName,
    modelName: model?.modelName || "",
    estimatedDocumentCount: toInt(stats?.count ?? stats?.n ?? 0),
    averageDocumentSizeBytes: toInt(stats?.avgObjSize ?? 0),
    storageSizeBytes: toInt(stats?.storageSize ?? 0),
    totalIndexSizeBytes: toInt(stats?.totalIndexSize ?? 0),
    indexCount: toInt(stats?.nindexes ?? indexes.length),
    likelyWasteFields: Array.from(new Set(likelyWasteFields)).slice(0, 12),
    sampleLargestDocumentSizes: sampleDocs.map((entry) => toInt(entry?.docSizeBytes ?? 0)),
  };
};

const getStorageOverview = async () => {
  const collections = await mongoose.connection.db.listCollections().toArray();
  const models = modelByCollectionName();
  const mediaSummary = await getMediaAuditSummary();

  const rows = [];
  for (const entry of collections) {
    const model = models.get(entry.name) || null;
    rows.push(await buildCollectionOverview(entry.name, model));
  }

  return {
    collections: rows.sort((left, right) => (right.storageSizeBytes || 0) - (left.storageSizeBytes || 0)),
    totals: {
      collections: rows.length,
      estimatedDocuments: rows.reduce((total, row) => total + (row.estimatedDocumentCount || 0), 0),
      storageSizeBytes: rows.reduce((total, row) => total + (row.storageSizeBytes || 0), 0),
      totalIndexSizeBytes: rows.reduce((total, row) => total + (row.totalIndexSizeBytes || 0), 0),
    },
    mediaSummary,
  };
};

const normalizeActions = (actions = []) => {
  const list = Array.isArray(actions) ? actions : [actions];
  return [...new Set(list.map((value) => String(value || "").trim()).filter((value) => ACTION_MAP.has(value)))];
};

const countWithModel = async (model, query) => {
  const count = await model.countDocuments(query);
  return { matchedCount: count, deletedCount: 0, modifiedCount: 0 };
};

const deleteWithModel = async (model, query) => {
  const matchedCount = await model.countDocuments(query);
  if (!matchedCount) {
    return { matchedCount: 0, deletedCount: 0, modifiedCount: 0 };
  }
  const result = await model.deleteMany(query);
  return {
    matchedCount,
    deletedCount: toInt(result?.deletedCount ?? result?.nDeleted ?? 0),
    modifiedCount: 0,
  };
};

const updateWithModel = async (model, query, update) => {
  const matchedCount = await model.countDocuments(query);
  if (!matchedCount) {
    return { matchedCount: 0, deletedCount: 0, modifiedCount: 0 };
  }
  const result = await model.updateMany(query, update);
  return {
    matchedCount,
    deletedCount: 0,
    modifiedCount: toInt(result?.modifiedCount ?? result?.nModified ?? 0),
  };
};

const countStaleNotifications = async () => {
  const now = new Date();
  const readCutoff = buildCutoffDate(notificationReadRetentionDays);
  const unreadCutoff = buildCutoffDate(notificationUnreadRetentionDays);
  const query = {
    $or: [
      {
        read: true,
        $or: [
          { readAt: { $lte: readCutoff } },
          { readAt: null, createdAt: { $lte: readCutoff } },
          { readAt: { $exists: false }, createdAt: { $lte: readCutoff } },
        ],
      },
      {
        read: false,
        $or: [
          { expiresAt: { $lte: now } },
          { expiresAt: { $exists: false }, createdAt: { $lte: unreadCutoff } },
        ],
      },
    ],
  };
  return countWithModel(Notification, query);
};

const deleteStaleNotifications = async () => {
  const now = new Date();
  const readCutoff = buildCutoffDate(notificationReadRetentionDays);
  const unreadCutoff = buildCutoffDate(notificationUnreadRetentionDays);
  const query = {
    $or: [
      {
        read: true,
        $or: [
          { readAt: { $lte: readCutoff } },
          { readAt: null, createdAt: { $lte: readCutoff } },
          { readAt: { $exists: false }, createdAt: { $lte: readCutoff } },
        ],
      },
      {
        read: false,
        $or: [
          { expiresAt: { $lte: now } },
          { expiresAt: { $exists: false }, createdAt: { $lte: unreadCutoff } },
        ],
      },
    ],
  };
  return deleteWithModel(Notification, query);
};

const countExpiredAuthArtifacts = async () => {
  const now = new Date();
  const expiredUserTokens = await User.countDocuments({
    $or: [
      { emailVerifyExpiresAt: { $lte: now } },
      { resetPasswordExpiresAt: { $lte: now } },
    ],
  });
  const expiredOtp = await Otp.countDocuments({ expiresAt: { $lte: now } });
  const expiredChallenges = await AuthChallenge.countDocuments({ expiresAt: { $lte: now } });
  const revokedSessions = await User.countDocuments({ "sessions.revokedAt": { $ne: null } });
  return {
    matchedCount: expiredUserTokens + expiredOtp + expiredChallenges + revokedSessions,
    deletedCount: 0,
    modifiedCount: 0,
  };
};

const deleteExpiredAuthArtifacts = async () => {
  const now = new Date();
  const updates = await Promise.all([
    updateWithModel(
      User,
      { emailVerifyExpiresAt: { $lte: now } },
      { $unset: { emailVerifyTokenHash: "", emailVerifyExpiresAt: "" } }
    ),
    updateWithModel(
      User,
      { resetPasswordExpiresAt: { $lte: now } },
      { $unset: { resetPasswordTokenHash: "", resetPasswordExpiresAt: "" } }
    ),
    updateWithModel(
      User,
      { "sessions.revokedAt": { $ne: null } },
      { $pull: { sessions: { revokedAt: { $ne: null } } } }
    ),
    deleteWithModel(Otp, { expiresAt: { $lte: now } }),
    deleteWithModel(AuthChallenge, { expiresAt: { $lte: now } }),
  ]);

  return {
    matchedCount: updates.reduce((total, entry) => total + (entry.matchedCount || 0), 0),
    deletedCount: updates.reduce((total, entry) => total + (entry.deletedCount || 0), 0),
    modifiedCount: updates.reduce((total, entry) => total + (entry.modifiedCount || 0), 0),
  };
};

const logModelCleanup = async (model, days, query = {}, extraQuery = {}) => {
  const cutoff = buildCutoffDate(days);
  const cleanupQuery = {
    ...query,
    $or: [
      { expiresAt: { $lte: new Date() } },
      { expiresAt: { $exists: false }, createdAt: { $lte: cutoff } },
    ],
  };
  return deleteWithModel(model, { ...cleanupQuery, ...extraQuery });
};

const countStaleLogs = async () => {
  const results = await Promise.all([
    AuditLog.countDocuments({
      $or: [
        { expiresAt: { $lte: new Date() } },
        { expiresAt: { $exists: false }, createdAt: { $lte: buildCutoffDate(auditLogRetentionDays) } },
      ],
    }),
    AnalyticsEvent.countDocuments({
      $or: [
        { expiresAt: { $lte: new Date() } },
        { expiresAt: { $exists: false }, createdAt: { $lte: buildCutoffDate(analyticsEventRetentionDays) } },
      ],
    }),
    ModerationDecisionLog.countDocuments({
      $or: [
        { expiresAt: { $lte: new Date() } },
        { expiresAt: { $exists: false }, createdAt: { $lte: buildCutoffDate(moderationDecisionRetentionDays) } },
      ],
    }),
    RecommendationLog.countDocuments({
      $or: [
        { expiresAt: { $lte: new Date() } },
        { expiresAt: { $exists: false }, createdAt: { $lte: buildCutoffDate(recommendationLogRetentionDays) } },
      ],
    }),
    NewsFeedImpression.countDocuments({
      $or: [
        { expiresAt: { $lte: new Date() } },
        { expiresAt: { $exists: false }, createdAt: { $lte: buildCutoffDate(newsFeedImpressionRetentionDays) } },
      ],
    }),
    NewsIngestionJob.countDocuments({
      $or: [
        { expiresAt: { $lte: new Date() } },
        { expiresAt: { $exists: false }, createdAt: { $lte: buildCutoffDate(newsIngestionJobRetentionDays) } },
      ],
    }),
  ]);

  return {
    matchedCount: results.reduce((total, count) => total + count, 0),
    deletedCount: 0,
    modifiedCount: 0,
  };
};

const deleteStaleLogs = async () => {
  const now = new Date();
  const operations = await Promise.all([
    deleteWithModel(AuditLog, {
      $or: [
        { expiresAt: { $lte: now } },
        { expiresAt: { $exists: false }, createdAt: { $lte: buildCutoffDate(auditLogRetentionDays) } },
      ],
    }),
    deleteWithModel(AnalyticsEvent, {
      $or: [
        { expiresAt: { $lte: now } },
        { expiresAt: { $exists: false }, createdAt: { $lte: buildCutoffDate(analyticsEventRetentionDays) } },
      ],
    }),
    deleteWithModel(ModerationDecisionLog, {
      $or: [
        { expiresAt: { $lte: now } },
        { expiresAt: { $exists: false }, createdAt: { $lte: buildCutoffDate(moderationDecisionRetentionDays) } },
      ],
    }),
    deleteWithModel(RecommendationLog, {
      $or: [
        { expiresAt: { $lte: now } },
        { expiresAt: { $exists: false }, createdAt: { $lte: buildCutoffDate(recommendationLogRetentionDays) } },
      ],
    }),
    deleteWithModel(NewsFeedImpression, {
      $or: [
        { expiresAt: { $lte: now } },
        { expiresAt: { $exists: false }, createdAt: { $lte: buildCutoffDate(newsFeedImpressionRetentionDays) } },
      ],
    }),
    deleteWithModel(NewsIngestionJob, {
      $or: [
        { expiresAt: { $lte: now } },
        { expiresAt: { $exists: false }, createdAt: { $lte: buildCutoffDate(newsIngestionJobRetentionDays) } },
      ],
    }),
  ]);

  return {
    matchedCount: operations.reduce((total, entry) => total + (entry.matchedCount || 0), 0),
    deletedCount: operations.reduce((total, entry) => total + (entry.deletedCount || 0), 0),
    modifiedCount: 0,
  };
};

const countTemporaryUploads = async () =>
  countWithModel(ModerationCase, {
    storageStage: "temporary",
    status: "pending",
    createdAt: { $lte: buildCutoffDate(tempUploadRetentionDays) },
  });

const deleteTemporaryUploads = async () => {
  const cutoff = buildCutoffDate(tempUploadRetentionDays);
  const staleCases = await ModerationCase.find({
    storageStage: "temporary",
    status: "pending",
    createdAt: { $lte: cutoff },
  })
    .select("_id fileUrl media")
    .lean();

  let deletedCount = 0;
  for (const caseDoc of staleCases) {
    const fileUrl =
      String(caseDoc.fileUrl || caseDoc.media?.[0]?.sourceUrl || caseDoc.media?.[0]?.previewUrl || "").trim();
    if (fileUrl) {
      // Best-effort cleanup of the temporary file before removing the record.
      // eslint-disable-next-line no-await-in-loop
      await deleteStoredMedia({ fileUrl }).catch(() => null);
    }

    // eslint-disable-next-line no-await-in-loop
    await MediaHash.deleteMany({ moderationCaseId: caseDoc._id }).catch(() => null);
    // eslint-disable-next-line no-await-in-loop
    await ModerationCase.deleteOne({ _id: caseDoc._id }).catch(() => null);
    deletedCount += 1;
  }

  return {
    matchedCount: staleCases.length,
    deletedCount,
    modifiedCount: 0,
  };
};

const countOrphanedMedia = async () => {
  const validCaseIds = await ModerationCase.distinct("_id");
  const validCaseIdSet = new Set(validCaseIds.map((value) => toId(value)));
  const mediaDocs = await MediaHash.find({}).select("_id moderationCaseId").lean();
  const orphaned = mediaDocs.filter((doc) => {
    const caseId = toId(doc.moderationCaseId);
    return !caseId || !validCaseIdSet.has(caseId);
  });
  return {
    matchedCount: orphaned.length,
    deletedCount: 0,
    modifiedCount: 0,
  };
};

const deleteOrphanedMedia = async () => {
  const validCaseIds = await ModerationCase.distinct("_id");
  const validCaseIdSet = new Set(validCaseIds.map((value) => toId(value)));
  const orphaned = await MediaHash.find({}).select("_id moderationCaseId").lean();
  const orphanedIds = orphaned
    .filter((doc) => {
      const caseId = toId(doc.moderationCaseId);
      return !caseId || !validCaseIdSet.has(caseId);
    })
    .map((doc) => doc._id);

  if (!orphanedIds.length) {
    return { matchedCount: 0, deletedCount: 0, modifiedCount: 0 };
  }

  const result = await MediaHash.deleteMany({ _id: { $in: orphanedIds } });
  return {
    matchedCount: orphanedIds.length,
    deletedCount: toInt(result?.deletedCount ?? 0),
    modifiedCount: 0,
  };
};

const countDuplicateMedia = async () => {
  const duplicates = await MediaHash.aggregate([
    { $match: { moderationCaseId: { $ne: null } } },
    {
      $group: {
        _id: {
          moderationCaseId: "$moderationCaseId",
          targetType: "$targetType",
          targetId: "$targetId",
          mediaRole: "$mediaRole",
          hashKind: "$hashKind",
          hashValue: "$hashValue",
          algorithm: "$algorithm",
        },
        ids: { $push: "$_id" },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]).catch(() => []);

  const duplicateCount = duplicates.reduce((total, group) => total + Math.max(0, (group.count || 0) - 1), 0);
  return {
    matchedCount: duplicateCount,
    deletedCount: 0,
    modifiedCount: 0,
  };
};

const deleteDuplicateMedia = async () => {
  const duplicates = await MediaHash.aggregate([
    { $match: { moderationCaseId: { $ne: null } } },
    {
      $group: {
        _id: {
          moderationCaseId: "$moderationCaseId",
          targetType: "$targetType",
          targetId: "$targetId",
          mediaRole: "$mediaRole",
          hashKind: "$hashKind",
          hashValue: "$hashValue",
          algorithm: "$algorithm",
        },
        ids: { $push: { _id: "$_id", createdAt: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]).catch(() => []);

  const idsToDelete = [];
  for (const group of duplicates) {
    const ordered = (Array.isArray(group.ids) ? group.ids : [])
      .slice()
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
    const keep = ordered[0];
    const remove = ordered.slice(1).map((entry) => entry._id).filter(Boolean);
    if (keep?._id) {
      // Keep the newest document for each exact media hash group.
    }
    idsToDelete.push(...remove);
  }

  if (!idsToDelete.length) {
    return { matchedCount: 0, deletedCount: 0, modifiedCount: 0 };
  }

  const result = await MediaHash.deleteMany({ _id: { $in: idsToDelete } });
  return {
    matchedCount: idsToDelete.length,
    deletedCount: toInt(result?.deletedCount ?? 0),
    modifiedCount: 0,
  };
};

const countDemoData = async () => {
  const demoUsers = await User.find({
    role: { $nin: ["admin", "super_admin", "moderator", "trust_safety_admin"] },
    createdAt: { $lte: buildCutoffDate(7) },
    $or: [
      { username: /^(test|demo|sample|seed)[._-]/i },
      { email: /@(test|example)\.(com|org|net)$/i },
      { name: /^(test|demo|sample|seed)(\b|_|\s)/i },
    ],
  })
    .select("_id email")
    .lean();

  if (!demoUsers.length) {
    return { matchedCount: 0, deletedCount: 0, modifiedCount: 0 };
  }

  const userIds = demoUsers.map((entry) => entry._id);
  const emails = demoUsers.map((entry) => String(entry.email || "").trim().toLowerCase()).filter(Boolean);
  const [posts, stories, messages, notifications, reports, strikes, otp, challenges] = await Promise.all([
    Post.countDocuments({ author: { $in: userIds } }),
    Story.countDocuments({ $or: [{ userId: { $in: userIds.map((id) => id.toString()) } }, { authorId: { $in: userIds } }] }),
    Message.countDocuments({ $or: [{ senderId: { $in: userIds } }, { receiverId: { $in: userIds } }] }),
    Notification.countDocuments({ $or: [{ recipient: { $in: userIds } }, { sender: { $in: userIds } }] }),
    Report.countDocuments({ reporterId: { $in: userIds } }),
    UserStrike.countDocuments({ userId: { $in: userIds } }),
    Otp.countDocuments({ email: { $in: emails } }),
    AuthChallenge.countDocuments({ userId: { $in: userIds } }),
  ]);

  return {
    matchedCount: userIds.length + posts + stories + messages + notifications + reports + strikes + otp + challenges,
    deletedCount: 0,
    modifiedCount: 0,
  };
};

const deleteDemoData = async () => {
  const demoUsers = await User.find({
    role: { $nin: ["admin", "super_admin", "moderator", "trust_safety_admin"] },
    createdAt: { $lte: buildCutoffDate(7) },
    $or: [
      { username: /^(test|demo|sample|seed)[._-]/i },
      { email: /@(test|example)\.(com|org|net)$/i },
      { name: /^(test|demo|sample|seed)(\b|_|\s)/i },
    ],
  })
    .select("_id email")
    .lean();

  if (!demoUsers.length) {
    return { matchedCount: 0, deletedCount: 0, modifiedCount: 0 };
  }

  const userIds = demoUsers.map((entry) => entry._id);
  const userIdStrings = userIds.map((entry) => entry.toString());
  const emails = demoUsers.map((entry) => String(entry.email || "").trim().toLowerCase()).filter(Boolean);

  const operations = await Promise.all([
    deleteWithModel(Post, { author: { $in: userIds } }),
    deleteWithModel(Story, { $or: [{ userId: { $in: userIdStrings } }, { authorId: { $in: userIds } }] }),
    deleteWithModel(Message, { $or: [{ senderId: { $in: userIds } }, { receiverId: { $in: userIds } }] }),
    deleteWithModel(Notification, { $or: [{ recipient: { $in: userIds } }, { sender: { $in: userIds } }] }),
    deleteWithModel(Report, { reporterId: { $in: userIds } }),
    deleteWithModel(UserStrike, { userId: { $in: userIds } }),
    deleteWithModel(Otp, { email: { $in: emails } }),
    deleteWithModel(AuthChallenge, { userId: { $in: userIds } }),
    deleteWithModel(User, { _id: { $in: userIds } }),
  ]);

  return {
    matchedCount: userIds.length,
    deletedCount: operations.reduce((total, entry) => total + (entry.deletedCount || 0), 0),
    modifiedCount: 0,
  };
};

const previewCleanup = async (actions = []) => {
  const normalized = normalizeActions(actions);
  const chosen = normalized.length > 0 ? normalized : DEFAULT_SAFE_ACTIONS;
  const results = [];

  for (const action of chosen) {
    switch (action) {
      case "staleNotifications":
        results.push({ action, ...(await countStaleNotifications()) });
        break;
      case "expiredAuthArtifacts":
        results.push({ action, ...(await countExpiredAuthArtifacts()) });
        break;
      case "staleLogs":
        results.push({ action, ...(await countStaleLogs()) });
        break;
      case "temporaryUploads":
        results.push({ action, ...(await countTemporaryUploads()) });
        break;
      case "orphanedMedia":
        results.push({ action, ...(await countOrphanedMedia()) });
        break;
      case "duplicateMedia":
        results.push({ action, ...(await countDuplicateMedia()) });
        break;
      case "demoData":
        results.push({ action, ...(await countDemoData()) });
        break;
      default:
        break;
    }
  }

  return {
    dryRun: true,
    actions: chosen,
    results,
    totals: {
      matchedCount: results.reduce((total, entry) => total + (entry.matchedCount || 0), 0),
      deletedCount: 0,
      modifiedCount: 0,
    },
  };
};

const runCleanup = async (actions = [], { dryRun = false } = {}) => {
  const normalized = normalizeActions(actions);
  const chosen = normalized.length > 0 ? normalized : DEFAULT_SAFE_ACTIONS;
  if (dryRun) {
    return previewCleanup(chosen);
  }

  const results = [];
  for (const action of chosen) {
    switch (action) {
      case "staleNotifications":
        results.push({ action, ...(await deleteStaleNotifications()) });
        break;
      case "expiredAuthArtifacts":
        results.push({ action, ...(await deleteExpiredAuthArtifacts()) });
        break;
      case "staleLogs":
        results.push({ action, ...(await deleteStaleLogs()) });
        break;
      case "temporaryUploads":
        results.push({ action, ...(await deleteTemporaryUploads()) });
        break;
      case "orphanedMedia":
        results.push({ action, ...(await deleteOrphanedMedia()) });
        break;
      case "duplicateMedia":
        results.push({ action, ...(await deleteDuplicateMedia()) });
        break;
      case "demoData":
        results.push({ action, ...(await deleteDemoData()) });
        break;
      default:
        break;
    }
  }

  return {
    dryRun: false,
    actions: chosen,
    results,
    totals: {
      matchedCount: results.reduce((total, entry) => total + (entry.matchedCount || 0), 0),
      deletedCount: results.reduce((total, entry) => total + (entry.deletedCount || 0), 0),
      modifiedCount: results.reduce((total, entry) => total + (entry.modifiedCount || 0), 0),
    },
  };
};

const getStorageActionCatalog = () =>
  ACTIONS.map((entry) => ({
    ...entry,
    dangerous: ["temporaryUploads", "orphanedMedia", "duplicateMedia", "demoData"].includes(entry.key),
  }));

const previewIndexSync = async () => {
  const results = [];

  for (const model of INDEX_SYNC_MODELS) {
    const diff = await model.diffIndexes().catch(() => ({ toDrop: [], toCreate: [] }));
    results.push({
      modelName: model.modelName,
      collectionName: model.collection.name,
      toDrop: Array.isArray(diff?.toDrop) ? diff.toDrop : [],
      toCreate: Array.isArray(diff?.toCreate) ? diff.toCreate : [],
    });
  }

  return {
    dryRun: true,
    results,
    totals: {
      models: results.length,
      toDrop: results.reduce((total, entry) => total + (entry.toDrop?.length || 0), 0),
      toCreate: results.reduce((total, entry) => total + (entry.toCreate?.length || 0), 0),
    },
  };
};

const runIndexSync = async ({ dryRun = false } = {}) => {
  if (dryRun) {
    return previewIndexSync();
  }

  const results = [];
  for (const model of INDEX_SYNC_MODELS) {
    const syncResult = await model.syncIndexes().catch((error) => ({
      error: error?.message || String(error || "Failed to sync indexes"),
    }));

    if (syncResult && typeof syncResult === "object" && syncResult.error) {
      results.push({
        modelName: model.modelName,
        collectionName: model.collection.name,
        error: syncResult.error,
        droppedIndexes: [],
      });
      continue;
    }

    results.push({
      modelName: model.modelName,
      collectionName: model.collection.name,
      droppedIndexes: Array.isArray(syncResult) ? syncResult : [],
    });
  }

  return {
    dryRun: false,
    results,
    totals: {
      models: results.length,
      droppedIndexes: results.reduce(
        (total, entry) => total + (entry.droppedIndexes?.length || 0),
        0
      ),
      failedModels: results.filter((entry) => Boolean(entry.error)).length,
    },
  };
};

module.exports = {
  ACTIONS,
  getStorageActionCatalog,
  getStorageOverview,
  previewCleanup,
  previewIndexSync,
  runIndexSync,
  runCleanup,
};
