const ModerationCase = require("../models/ModerationCase");
const Album = require("../models/Album");
const Book = require("../models/Book");
const Message = require("../models/Message");
const Post = require("../models/Post");
const Story = require("../models/Story");
const Track = require("../models/Track");
const Video = require("../models/Video");

const HELD_PUBLICATION_STATUSES = [
  "pending",
  "rejected",
  "quarantined",
  "HOLD_FOR_REVIEW",
  "RESTRICTED_BLURRED",
  "BLOCK_REPEAT_VIOLATOR",
];
const PROHIBITED_PUBLICATION_STATUSES = new Set([
  "BLOCK_EXPLICIT_ADULT",
  "BLOCK_SUSPECTED_CHILD_EXPLOITATION",
  "BLOCK_EXTREME_GORE",
  "BLOCK_ANIMAL_CRUELTY",
]);
const PROHIBITED_PUBLICATION_QUEUES = new Set([
  "explicit_pornography",
  "suspected_child_exploitation",
  "graphic_gore",
  "animal_cruelty",
]);
const PROHIBITED_LABEL_PATTERNS = [
  "explicit_pornography",
  "explicit_adult",
  "child_abuse",
  "child_pornography",
  "suspected_child_exploitation",
  "csam",
  "graphic_gore",
  "animal_cruelty",
];

const toId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return typeof value.toString === "function" ? value.toString() : "";
};

const normalizeLabels = (record = {}) => [
  ...(Array.isArray(record.labels) ? record.labels : []),
  ...(Array.isArray(record.riskLabels) ? record.riskLabels : []),
  ...(Array.isArray(record.moderationLabels) ? record.moderationLabels : []),
]
  .map((label) => String(label || "").trim().toLowerCase())
  .filter(Boolean);

const hasProhibitedPublicationSignal = (record = {}) => {
  const status = String(record.status || record.moderationStatus || "").trim();
  if (PROHIBITED_PUBLICATION_STATUSES.has(status)) return true;

  const queue = String(record.queue || record.sensitiveType || "").trim().toLowerCase();
  if (PROHIBITED_PUBLICATION_QUEUES.has(queue)) return true;

  return normalizeLabels(record).some((label) =>
    PROHIBITED_LABEL_PATTERNS.some((pattern) => label.includes(pattern))
  );
};

const caseTargetKey = (caseDoc = {}) => {
  const targetType = String(caseDoc.subject?.targetType || caseDoc.targetType || "").trim();
  const targetId = String(caseDoc.subject?.targetId || caseDoc.targetId || "").trim();
  return targetType && targetId ? `${targetType}:${targetId}` : "";
};

const findCasesForTargets = async (targets = []) => {
  const byType = targets.reduce((map, target) => {
    const type = String(target.type || "");
    const id = String(target.id || "");
    if (!type || !id) return map;
    if (!map.has(type)) map.set(type, []);
    map.get(type).push(id);
    return map;
  }, new Map());
  const clauses = [];
  for (const [type, ids] of byType.entries()) {
    clauses.push({ targetType: type, targetId: { $in: ids } });
    clauses.push({ "subject.targetType": type, "subject.targetId": { $in: ids } });
  }
  if (clauses.length === 0) return [];
  return ModerationCase.find({ $or: clauses }).lean();
};

const buildPostReleaseUpdate = (post = {}) => {
  const originalVisibility = String(post.originalVisibility || "").trim();
  const currentVisibility = String(post.visibility || "").trim();
  const privacy = String(post.privacy || "").trim();
  const restoredVisibility = originalVisibility
    || (currentVisibility === "private" && privacy && privacy !== "private" ? privacy : currentVisibility);
  const set = {
    moderationStatus: "approved",
    moderationLabels: [],
    moderationReason: "",
    moderationConfidence: 0,
    moderationCaseId: null,
    reviewedBy: null,
    reviewedAt: null,
    storageStage: "permanent",
    sensitiveContent: false,
    sensitiveType: "",
    blurPreviewUrl: "",
    reviewRequired: false,
  };
  if (restoredVisibility) set.visibility = restoredVisibility;
  return { $set: set };
};

const buildStoryReleaseUpdate = (story = {}) => {
  const originalVisibility = String(story.originalVisibility || "").trim();
  const set = {
    moderationStatus: "approved",
    moderationCaseId: null,
    sensitiveContent: false,
    sensitiveType: "",
    blurPreviewUrl: "",
    reviewRequired: false,
  };
  if (originalVisibility) set.visibility = originalVisibility;
  return { $set: set };
};

const buildCreatorAssetReleaseUpdate = (asset = {}, { album = false, video = false } = {}) => {
  const set = {
    moderationStatus: "approved",
    moderationCaseId: null,
    publishedStatus: "published",
    isPublished: true,
    sensitiveContent: false,
    sensitiveType: "",
    blurPreviewUrl: "",
    reviewRequired: false,
  };
  if (album) set.status = "published";
  if (video) set.visibility = String(asset.originalVisibility || "public");
  return { $set: set };
};

const buildMessageReleaseUpdate = () => ({
  $set: {
    moderationStatus: "approved",
    moderationCaseId: null,
    sensitiveContent: false,
    sensitiveType: "",
    blurPreviewUrl: "",
    reviewRequired: false,
  },
});

const safeTargetsFor = ({ type, docs, casesByTarget }) => docs.filter((doc) => {
  if (hasProhibitedPublicationSignal(doc)) return false;
  return !(casesByTarget.get(`${type}:${toId(doc._id)}`) || []).some(hasProhibitedPublicationSignal);
});

const releaseSafePublicationHolds = async ({ logger = console } = {}) => {
  const heldQuery = {
    $or: [
      { moderationStatus: { $in: HELD_PUBLICATION_STATUSES } },
      { reviewRequired: true },
    ],
  };
  const heldCreatorAssetQuery = {
    publishedStatus: { $ne: "draft" },
    $or: [
      { moderationStatus: { $in: HELD_PUBLICATION_STATUSES } },
      { reviewRequired: true },
      { publishedStatus: { $in: ["under_review", "blocked"] } },
    ],
  };
  const [posts, stories, albums, books, tracks, videos, messages] = await Promise.all([
    Post.find(heldQuery)
      .select("_id moderationStatus moderationLabels sensitiveType reviewRequired visibility privacy originalVisibility")
      .lean(),
    Story.find(heldQuery)
      .select("_id moderationStatus sensitiveType reviewRequired visibility originalVisibility")
      .lean(),
    Album.find(heldCreatorAssetQuery)
      .select("_id moderationStatus moderationLabels sensitiveType reviewRequired publishedStatus originalVisibility")
      .lean(),
    Book.find(heldCreatorAssetQuery)
      .select("_id moderationStatus moderationLabels sensitiveType reviewRequired publishedStatus originalVisibility")
      .lean(),
    Track.find(heldCreatorAssetQuery)
      .select("_id moderationStatus moderationLabels sensitiveType reviewRequired publishedStatus originalVisibility")
      .lean(),
    Video.find(heldCreatorAssetQuery)
      .select("_id moderationStatus moderationLabels sensitiveType reviewRequired publishedStatus visibility originalVisibility")
      .lean(),
    Message.find(heldQuery)
      .select("_id moderationStatus sensitiveType reviewRequired")
      .lean(),
  ]);
  const targets = [
    ...posts.map((post) => ({ type: "post", id: toId(post._id) })),
    ...stories.map((story) => ({ type: "story", id: toId(story._id) })),
    ...albums.map((album) => ({ type: "album", id: toId(album._id) })),
    ...books.map((book) => ({ type: "book", id: toId(book._id) })),
    ...tracks.map((track) => ({ type: "track", id: toId(track._id) })),
    ...videos.map((video) => ({ type: "video", id: toId(video._id) })),
    ...messages.map((message) => ({ type: "message", id: toId(message._id) })),
  ];
  const cases = await findCasesForTargets(targets);
  const casesByTarget = cases.reduce((map, caseDoc) => {
    const key = caseTargetKey(caseDoc);
    if (!key) return map;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(caseDoc);
    return map;
  }, new Map());

  const safePosts = safeTargetsFor({ type: "post", docs: posts, casesByTarget });
  const safeStories = safeTargetsFor({ type: "story", docs: stories, casesByTarget });
  const safeAlbums = safeTargetsFor({ type: "album", docs: albums, casesByTarget });
  const safeBooks = safeTargetsFor({ type: "book", docs: books, casesByTarget });
  const safeTracks = safeTargetsFor({ type: "track", docs: tracks, casesByTarget });
  const safeVideos = safeTargetsFor({ type: "video", docs: videos, casesByTarget });
  const safeMessages = safeTargetsFor({ type: "message", docs: messages, casesByTarget });

  const releaseOperations = [
    ...safePosts.map((post) => Post.updateOne({ _id: post._id }, buildPostReleaseUpdate(post))),
    ...safeStories.map((story) => Story.updateOne({ _id: story._id }, buildStoryReleaseUpdate(story))),
    ...safeAlbums.map((album) => Album.updateOne(
      { _id: album._id },
      buildCreatorAssetReleaseUpdate(album, { album: true })
    )),
    ...safeBooks.map((book) => Book.updateOne(
      { _id: book._id },
      buildCreatorAssetReleaseUpdate(book)
    )),
    ...safeTracks.map((track) => Track.updateOne(
      { _id: track._id },
      buildCreatorAssetReleaseUpdate(track)
    )),
    ...safeVideos.map((video) => Video.updateOne(
      { _id: video._id },
      buildCreatorAssetReleaseUpdate(video, { video: true })
    )),
    ...safeMessages.map((message) => Message.updateOne(
      { _id: message._id },
      buildMessageReleaseUpdate()
    )),
  ];
  await Promise.all(releaseOperations);

  const safeTargetKeys = new Set([
    ...safePosts.map((post) => `post:${toId(post._id)}`),
    ...safeStories.map((story) => `story:${toId(story._id)}`),
    ...safeAlbums.map((album) => `album:${toId(album._id)}`),
    ...safeBooks.map((book) => `book:${toId(book._id)}`),
    ...safeTracks.map((track) => `track:${toId(track._id)}`),
    ...safeVideos.map((video) => `video:${toId(video._id)}`),
    ...safeMessages.map((message) => `message:${toId(message._id)}`),
  ]);
  const safeHeldCaseIds = cases
    .filter((caseDoc) =>
      safeTargetKeys.has(caseTargetKey(caseDoc))
      && HELD_PUBLICATION_STATUSES.includes(String(caseDoc.status || ""))
      && !hasProhibitedPublicationSignal(caseDoc)
    )
    .map((caseDoc) => caseDoc._id);
  if (safeHeldCaseIds.length > 0) {
    await ModerationCase.updateMany(
      { _id: { $in: safeHeldCaseIds } },
      {
        $set: {
          status: "approved",
          workflowState: "RESOLVED",
          visibility: "public",
          visibilityDecision: "allowed",
          storageStage: "permanent",
          "quarantine.isQuarantined": false,
          "quarantine.quarantinedAt": null,
          "quarantine.neverGeneratePreview": false,
          "escalation.required": false,
          "escalation.status": "not_required",
          publicWarningLabel: "",
        },
      }
    );
  }

  const result = {
    scannedPosts: posts.length,
    scannedStories: stories.length,
    scannedAlbums: albums.length,
    scannedBooks: books.length,
    scannedTracks: tracks.length,
    scannedVideos: videos.length,
    scannedMessages: messages.length,
    releasedPosts: safePosts.length,
    releasedStories: safeStories.length,
    releasedAlbums: safeAlbums.length,
    releasedBooks: safeBooks.length,
    releasedTracks: safeTracks.length,
    releasedVideos: safeVideos.length,
    releasedMessages: safeMessages.length,
    retainedProhibited:
      posts.length + stories.length + albums.length + books.length + tracks.length + videos.length + messages.length
      - safePosts.length - safeStories.length - safeAlbums.length - safeBooks.length
      - safeTracks.length - safeVideos.length - safeMessages.length,
  };
  logger?.log?.("[moderation-publication] Released safe held content.", result);
  return result;
};

module.exports = {
  HELD_PUBLICATION_STATUSES,
  hasProhibitedPublicationSignal,
  releaseSafePublicationHolds,
};
