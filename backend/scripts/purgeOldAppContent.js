const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "backend", ".env") });

require("../config/env");

const { config } = require("../config/env");

const DEFAULT_CUTOFF = "2026-04-01T00:00:00.000Z";
const RUN_CONFIRMATION_FLAG = "--yes-delete-old-app-content";

const PURGE_TARGETS = [
  {
    key: "feed_posts",
    collection: "posts",
    dateFields: ["createdAt", "updatedAt"],
    reason: "public/user feed posts and embedded comments",
  },
  {
    key: "stories",
    collection: "stories",
    dateFields: ["time", "createdAt", "expiresAt"],
    reason: "story posts and story replies/reactions",
  },
  {
    key: "chat_messages",
    collection: "messages",
    dateFields: ["createdAt", "updatedAt", "time"],
    reason: "direct chat messages and attachments metadata",
  },
  {
    key: "rooms",
    collection: "rooms",
    dateFields: ["createdAt", "updatedAt"],
    reason: "social rooms",
  },
  {
    key: "room_messages",
    collection: "roommessages",
    dateFields: ["createdAt", "updatedAt"],
    reason: "room chat messages",
  },
  {
    key: "notifications",
    collection: "notifications",
    dateFields: ["createdAt", "updatedAt", "expiresAt"],
    reason: "old user notifications",
  },
  {
    key: "tracks",
    collection: "tracks",
    dateFields: ["createdAt", "updatedAt"],
    reason: "music and podcast releases",
  },
  {
    key: "albums",
    collection: "albums",
    dateFields: ["createdAt", "updatedAt"],
    reason: "music albums",
  },
  {
    key: "videos",
    collection: "videos",
    dateFields: ["time", "createdAt", "updatedAt"],
    reason: "music videos and video content records",
  },
  {
    key: "books",
    collection: "books",
    dateFields: ["createdAt", "updatedAt"],
    reason: "book releases",
  },
  {
    key: "chapters",
    collection: "chapters",
    dateFields: ["createdAt", "updatedAt"],
    reason: "book chapters/sample chapters",
  },
  {
    key: "marketplace_products",
    collection: "marketplaceproducts",
    dateFields: ["createdAt", "updatedAt"],
    reason: "marketplace product listings, not orders or transactions",
  },
  {
    key: "live_sessions",
    collection: "livesessions",
    dateFields: ["createdAt", "updatedAt", "startedAt", "endedAt"],
    reason: "old live session metadata",
  },
  {
    key: "live_reminders",
    collection: "livereminders",
    dateFields: ["createdAt", "updatedAt"],
    reason: "old live reminders",
  },
  {
    key: "saved_creator_content",
    collection: "savedcreatorcontents",
    dateFields: ["createdAt", "updatedAt", "savedAt"],
    reason: "saved references to old creator content",
  },
  {
    key: "news_stories",
    collection: "newsstories",
    dateFields: ["createdAt", "updatedAt", "publishedAt", "updatedAtSource"],
    reason: "old news story records",
  },
  {
    key: "news_assets",
    collection: "newsassets",
    dateFields: ["createdAt", "updatedAt"],
    reason: "old news asset metadata",
  },
  {
    key: "news_clusters",
    collection: "newsclusters",
    dateFields: ["createdAt", "updatedAt"],
    reason: "old news clustering records",
  },
  {
    key: "news_ingestion_jobs",
    collection: "newsingestionjobs",
    dateFields: ["createdAt", "updatedAt", "expiresAt"],
    reason: "old news ingestion job logs",
  },
  {
    key: "news_feed_impressions",
    collection: "newsfeedimpressions",
    dateFields: ["createdAt", "expiresAt"],
    reason: "old news impression analytics",
  },
  {
    key: "analytics_events",
    collection: "analyticsevents",
    dateFields: ["createdAt", "expiresAt"],
    reason: "old product analytics events",
  },
  {
    key: "recommendation_logs",
    collection: "recommendationlogs",
    dateFields: ["createdAt", "expiresAt"],
    reason: "old recommendation/discovery logs",
  },
  {
    key: "assistant_memories",
    collection: "assistantmemories",
    dateFields: ["createdAt", "updatedAt", "expiresAt"],
    reason: "old Akuso memory records",
  },
  {
    key: "assistant_feedback",
    collection: "assistantfeedbacks",
    dateFields: ["createdAt", "expiresAt"],
    reason: "old Akuso feedback records",
  },
  {
    key: "assistant_review_items",
    collection: "assistantreviewitems",
    dateFields: ["createdAt", "updatedAt"],
    reason: "old Akuso review queue records",
  },
  {
    key: "auth_challenges",
    collection: "authchallenges",
    dateFields: ["createdAt", "updatedAt", "expiresAt"],
    reason: "expired auth challenge records",
  },
  {
    key: "otps",
    collection: "otps",
    dateFields: ["createdAt", "updatedAt", "expiresAt"],
    reason: "expired OTP records",
  },
  {
    key: "gridfs_uploads",
    collection: "uploads.files",
    chunksCollection: "uploads.chunks",
    dateFields: ["uploadDate"],
    gridFsBucket: "uploads",
    reason: "legacy MongoDB file uploads and their GridFS chunks",
  },
];

const PROTECTED_COLLECTIONS = new Set([
  "users",
  "artistprofiles",
  "creatorprofiles",
  "creatorqualityprofiles",
  "walletaccounts",
  "walletentries",
  "revenueledgerentries",
  "purchases",
  "entitlements",
  "marketplaceorders",
  "marketplacetransactions",
  "marketplacepayouts",
  "creatorpayoutrequests",
  "paymentwebhookevents",
  "reports",
  "admincomplaints",
  "moderationcases",
  "moderationauditlogs",
  "moderationdecisionlogs",
  "userstrikes",
  "auditlogs",
  "talentshowapplications",
  "rechargerafflecards",
  "rechargeraffleplays",
]);

const parseOption = (args, name) => {
  const prefix = `--${name}=`;
  const match = args.find((value) => String(value || "").startsWith(prefix));
  return match ? String(match).slice(prefix.length).trim() : "";
};

const parseListOption = (args, name) =>
  parseOption(args, name)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const parseCutoff = (value) => {
  const raw = String(value || DEFAULT_CUTOFF).trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw;
  const cutoff = new Date(normalized);

  if (Number.isNaN(cutoff.getTime())) {
    throw new Error(`Invalid cutoff date: ${value}`);
  }

  return cutoff;
};

const getCutoffObjectId = (cutoff) => {
  const secondsHex = Math.floor(cutoff.getTime() / 1000)
    .toString(16)
    .padStart(8, "0");
  return new mongoose.Types.ObjectId(`${secondsHex}0000000000000000`);
};

const buildAgeQuery = (target, cutoff) => {
  const cutoffObjectId = getCutoffObjectId(cutoff);
  const cutoffMs = cutoff.getTime();
  const clauses = [
    { _id: { $lt: cutoffObjectId } },
    ...target.dateFields.flatMap((field) => [
      { [field]: { $type: "date", $lt: cutoff } },
      { [field]: { $type: "number", $lt: cutoffMs } },
    ]),
  ];

  return { $or: clauses };
};

const collectionExists = async (db, name) => {
  const matches = await db.listCollections({ name }).toArray();
  return matches.length > 0;
};

const getCollectionStats = async (db, name) => {
  try {
    return await db.command({ collStats: name });
  } catch {
    return {};
  }
};

const filterTargets = (args) => {
  const include = new Set(parseListOption(args, "include"));
  const exclude = new Set(parseListOption(args, "exclude"));

  return PURGE_TARGETS.filter((target) => {
    if (include.size > 0 && !include.has(target.key) && !include.has(target.collection)) {
      return false;
    }
    if (exclude.has(target.key) || exclude.has(target.collection)) {
      return false;
    }
    return true;
  });
};

const assertSafeTargets = (targets) => {
  const protectedTargets = targets.filter((target) => PROTECTED_COLLECTIONS.has(target.collection));
  if (protectedTargets.length > 0) {
    throw new Error(
      `Refusing to purge protected collections: ${protectedTargets
        .map((target) => target.collection)
        .join(", ")}`
    );
  }
};

const readGridFsMatches = async (db, target, cutoff) => {
  const files = db.collection(target.collection);
  const chunks = db.collection(target.chunksCollection);
  const query = buildAgeQuery(target, cutoff);
  const ids = await files.find(query).project({ _id: 1 }).toArray();
  const fileIds = ids.map((entry) => entry._id).filter(Boolean);
  const lengthResult = await files
    .aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalBytes: { $sum: "$length" },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();
  const matched = Number(lengthResult?.[0]?.count || fileIds.length || 0);
  const estimatedBytesMatched = Number(lengthResult?.[0]?.totalBytes || 0);
  const matchedChunks = fileIds.length
    ? await chunks.countDocuments({ files_id: { $in: fileIds } })
    : 0;

  return {
    query,
    fileIds,
    matched,
    matchedChunks,
    estimatedBytesMatched,
  };
};

const deleteGridFsMatches = async (db, target, fileIds) => {
  if (!fileIds.length) {
    return { deletedFiles: 0, deletedChunks: 0 };
  }

  const files = db.collection(target.collection);
  const chunks = db.collection(target.chunksCollection);
  const chunkResult = await chunks.deleteMany({ files_id: { $in: fileIds } });
  const fileResult = await files.deleteMany({ _id: { $in: fileIds } });

  return {
    deletedFiles: Number(fileResult.deletedCount || 0),
    deletedChunks: Number(chunkResult.deletedCount || 0),
  };
};

const run = async () => {
  const args = process.argv.slice(2);
  const execute = args.includes("--run");
  const confirmed = args.includes(RUN_CONFIRMATION_FLAG);
  const cutoff = parseCutoff(parseOption(args, "before"));
  const targets = filterTargets(args);

  assertSafeTargets(targets);

  if (execute && !confirmed) {
    throw new Error(
      `Refusing to delete without ${RUN_CONFIRMATION_FLAG}. Run without --run first for a dry-run.`
    );
  }

  console.log("Old app content purge");
  console.log(`Mode: ${execute ? "execute" : "dry-run"}`);
  console.log(`Cutoff: ${cutoff.toISOString()} (deletes records before this instant)`);
  console.log(`Targets: ${targets.map((target) => target.key).join(", ")}`);
  console.log("Protected: users, profiles, purchases, entitlements, wallets, payouts, reports, moderation, audit logs");
  console.log("");

  await mongoose.connect(config.MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 120000,
  });

  const db = mongoose.connection.db;
  const rows = [];

  try {
    for (const target of targets) {
      const exists = await collectionExists(db, target.collection);
      if (!exists) {
        rows.push({
          key: target.key,
          collection: target.collection,
          exists: false,
          matched: 0,
          deleted: 0,
          estimatedBytesMatched: 0,
          reason: target.reason,
        });
        continue;
      }

      const collection = db.collection(target.collection);
      const query = buildAgeQuery(target, cutoff);
      if (target.gridFsBucket) {
        const grid = await readGridFsMatches(db, target, cutoff);
        let deletedFiles = 0;
        let deletedChunks = 0;

        if (execute && grid.fileIds.length > 0) {
          const deleteResult = await deleteGridFsMatches(db, target, grid.fileIds);
          deletedFiles = deleteResult.deletedFiles;
          deletedChunks = deleteResult.deletedChunks;
        }

        rows.push({
          key: target.key,
          collection: target.collection,
          chunksCollection: target.chunksCollection,
          exists: true,
          matched: grid.matched,
          matchedChunks: grid.matchedChunks,
          deleted: deletedFiles,
          deletedChunks,
          estimatedBytesMatched: grid.estimatedBytesMatched,
          reason: target.reason,
        });
        continue;
      }

      const stats = await getCollectionStats(db, target.collection);
      const matched = await collection.countDocuments(query);
      const avgObjSize = Number(stats.avgObjSize || 0);
      const estimatedBytesMatched = Math.max(0, Math.round(avgObjSize * matched));
      let deleted = 0;

      if (execute && matched > 0) {
        const result = await collection.deleteMany(query);
        deleted = Number(result.deletedCount || 0);
      }

      rows.push({
        key: target.key,
        collection: target.collection,
        exists: true,
        matched,
        deleted,
        estimatedBytesMatched,
        reason: target.reason,
      });
    }
  } finally {
    await mongoose.disconnect().catch(() => null);
  }

  const totals = rows.reduce(
    (summary, row) => ({
      matched: summary.matched + Number(row.matched || 0),
      deleted: summary.deleted + Number(row.deleted || 0),
      matchedChunks: summary.matchedChunks + Number(row.matchedChunks || 0),
      deletedChunks: summary.deletedChunks + Number(row.deletedChunks || 0),
      estimatedBytesMatched:
        summary.estimatedBytesMatched + Number(row.estimatedBytesMatched || 0),
    }),
    { matched: 0, deleted: 0, matchedChunks: 0, deletedChunks: 0, estimatedBytesMatched: 0 }
  );

  rows
    .filter((row) => row.exists)
    .sort((left, right) => Number(right.estimatedBytesMatched) - Number(left.estimatedBytesMatched))
    .forEach((row) => {
      const mb = (Number(row.estimatedBytesMatched || 0) / (1024 * 1024)).toFixed(2);
      const chunkInfo =
        row.matchedChunks !== undefined
          ? `, chunks=${row.matchedChunks}, deletedChunks=${row.deletedChunks}`
          : "";
      console.log(
        `- ${row.collection}: matched=${row.matched}, deleted=${row.deleted}${chunkInfo}, estimated=${mb}MB`
      );
    });

  console.log("");
  console.log(
    JSON.stringify(
      {
        mode: execute ? "execute" : "dry-run",
        cutoff: cutoff.toISOString(),
        totals,
        rows,
      },
      null,
      2
    )
  );

  if (!execute) {
    console.log("");
    console.log(
      `Dry-run only. To delete, rerun with --run ${RUN_CONFIRMATION_FLAG} after reviewing the matched counts.`
    );
  }
};

run().catch((error) => {
  console.error("Old app content purge failed:", error?.message || error);
  process.exitCode = 1;
});
