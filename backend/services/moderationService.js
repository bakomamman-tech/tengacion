const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");

const Album = require("../models/Album");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
const MediaHash = require("../models/MediaHash");
const ModerationCase = require("../models/ModerationCase");
const ModerationDecisionLog = require("../models/ModerationDecisionLog");
const Message = require("../models/Message");
const Post = require("../models/Post");
const Report = require("../models/Report");
const Story = require("../models/Story");
const Track = require("../models/Track");
const User = require("../models/User");
const UserStrike = require("../models/UserStrike");
const Video = require("../models/Video");
const {
  ACTION_PERMISSION_MAP,
  BLOCKED_PUBLIC_STATUSES,
  CRITICAL_QUEUE_SET,
  CRITICAL_STATUS_SET,
  QUEUE_REVIEW_PERMISSION_MAP,
  RESTRICTED_PUBLIC_STATUSES,
  MODERATION_REPEAT_VIOLATOR_STRIKE_THRESHOLD,
} = require("../config/moderation");
const { writeAuditLog } = require("./auditLogService");
const { sendModerationMessengerWarning } = require("./moderationMessengerService");
const { buildSignedMediaUrl } = require("./mediaSigner");
const { findPrimaryModerationAdmin } = require("./moderationAdminService");
const {
  buildRestrictedPreviewPath,
  evaluateModerationPolicy,
} = require("./moderationPolicyService");
const { createNotification } = require("./notificationService");
const { hasAllPermissions } = require("./permissionService");
const { disconnectUserSockets } = require("../utils/realtimeSessions");
const { resolvePublicSensitivity } = require("../utils/publicModeration");
const sendSecurityEmail = require("../utils/sendSecurityEmail");

const ACTIVE_REVIEW_STATES = ["OPEN", "UNDER_REVIEW", "ESCALATED"];
const CASE_ACTIONS = [
  "approve",
  "restore_content",
  "hold_for_review",
  "reject",
  "delete_media",
  "restrict_with_warning",
  "blur_preview",
  "suspend_user",
  "ban_user",
  "preserve_evidence",
  "escalate_case",
];

const TARGET_MODEL_MAP = {
  album: Album,
  book: Book,
  message: Message,
  post: Post,
  story: Story,
  track: Track,
  video: Video,
  user: User,
};

const toId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  if (typeof value.toString === "function") return value.toString();
  return "";
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const uniqueStrings = (values = []) => [...new Set(values.filter(Boolean).map((entry) => String(entry)))];
const normalizeText = (value = "", maxLength = 2000) =>
  String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
const escapeRegex = (value = "") => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const docHasPath = (doc = null, path = "") =>
  Boolean(
    doc
    && (
      (typeof doc.$__schema?.path === "function" && doc.$__schema.path(path))
      || (typeof doc.schema?.path === "function" && doc.schema.path(path))
      || Object.prototype.hasOwnProperty.call(doc, path)
    )
  );

const extractMediaIdFromSource = (value = "") => {
  const match = String(value || "").match(/\/api\/media\/([a-f0-9]{24})(?:$|[/?#])/i);
  return match?.[1] || "";
};

const hashFileFromDisk = (filePath) =>
  new Promise((resolve, reject) => {
    const digest = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => digest.update(chunk));
    stream.on("end", () => resolve(digest.digest("hex")));
  });

const hashBuffer = (buffer) =>
  crypto
    .createHash("sha256")
    .update(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || ""))
    .digest("hex");

const computeUploadHash = async (file = null) => {
  if (Buffer.isBuffer(file?.buffer) && file.buffer.length > 0) {
    return hashBuffer(file.buffer);
  }

  if (!file?.path || !fs.existsSync(file.path)) {
    return crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          name: file?.originalname || "",
          mimeType: file?.mimetype || "",
          size: Number(file?.size || 0),
        })
      )
      .digest("hex");
  }

  try {
    return await hashFileFromDisk(file.path);
  } catch {
    return "";
  }
};

const buildSourceReferenceHash = (asset = {}) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        sourceUrl: asset.sourceUrl || "",
        previewUrl: asset.previewUrl || "",
        mediaType: asset.mediaType || "",
        mimeType: asset.mimeType || "",
        originalFilename: asset.originalFilename || "",
        fileSizeBytes: Number(asset.fileSizeBytes || 0),
      })
    )
    .digest("hex");

const buildFingerprintHash = ({ title = "", description = "", asset = {}, sourceHash = "" }) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        title: normalizeText(title, 400),
        description: normalizeText(description, 1200),
        mediaType: asset.mediaType || "",
        sourceHash,
      })
    )
    .digest("hex");

const buildCaseMediaEntries = ({ media = [], req, queue = "", severity = "" }) =>
  (Array.isArray(media) ? media : []).map((asset) => {
    const supportsRestrictedPreview =
      !["suspected_child_exploitation", "explicit_pornography"].includes(String(queue || ""));

    return {
      role: normalizeText(asset.role || "primary", 40),
      mediaId: normalizeText(asset.mediaId || extractMediaIdFromSource(asset.sourceUrl), 120),
      mediaType: normalizeText(asset.mediaType || "unknown", 40),
      mimeType: normalizeText(asset.mimeType || "", 120),
      sourceUrl: normalizeText(asset.sourceUrl || "", 1200),
      previewUrl: normalizeText(asset.previewUrl || "", 1200),
      restrictedPreviewUrl: supportsRestrictedPreview
        ? (
          normalizeText(asset.restrictedPreviewUrl || "", 1200)
          || buildRestrictedPreviewPath({ req, category: queue, severity })
        )
        : "",
      originalFilename: normalizeText(asset.originalFilename || "", 260),
      fileSizeBytes: Number(asset.fileSizeBytes || 0),
      hashIds: [],
      fileHash: asset.fileHash || "",
      fingerprintHash: asset.fingerprintHash || "",
    };
  });

const stripTransientMediaFields = (media = []) =>
  media.map((asset) => ({
    role: asset.role,
    mediaId: asset.mediaId,
    mediaType: asset.mediaType,
    mimeType: asset.mimeType,
    sourceUrl: asset.sourceUrl,
    previewUrl: asset.previewUrl,
    restrictedPreviewUrl: asset.restrictedPreviewUrl,
    originalFilename: asset.originalFilename,
    fileSizeBytes: asset.fileSizeBytes,
    hashIds: asset.hashIds || [],
  }));

const deriveBaselineAccess = (targetType, target = {}) => {
  if (targetType === "album") {
    return {
      isPublished: target.isPublished !== false,
      publishedStatus: String(
        target.publishedStatus || (target.isPublished === false ? "blocked" : "published")
      ),
      albumStatus: String(target.status || (target.isPublished === false ? "draft" : "published")),
    };
  }

  if (["track", "book", "video"].includes(targetType)) {
    return {
      isPublished: target.isPublished !== false,
      publishedStatus: String(
        target.publishedStatus || (target.isPublished === false ? "blocked" : "published")
      ),
      albumStatus: "",
    };
  }

  return {
    isPublished: true,
    publishedStatus: "published",
    albumStatus: "",
  };
};

const toAbsoluteSourceUrl = (value = "", req = null) => {
  const raw = normalizeText(value, 1200);
  if (!raw) {
    return "";
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("/") && req && typeof req.get === "function") {
    return `${req.protocol}://${req.get("host")}${raw}`;
  }

  return raw;
};

const buildPostScanMedia = (post = {}, req = null) => {
  const assets = [];
  const mediaList = Array.isArray(post?.media) ? post.media : [];

  mediaList.forEach((asset, index) => {
    const sourceUrl = toAbsoluteSourceUrl(asset?.url || "", req);
    if (!sourceUrl) {
      return;
    }

    assets.push({
      role: index === 0 ? "primary" : `attachment_${index + 1}`,
      mediaId: extractMediaIdFromSource(sourceUrl),
      mediaType: normalizeText(asset?.type || "image", 40),
      mimeType: normalizeText(
        asset?.type === "video" ? "video/mp4" : asset?.type === "image" ? "image/jpeg" : "",
        120
      ),
      sourceUrl,
      previewUrl: sourceUrl,
      originalFilename: normalizeText(`${post?._id || "post"}-${index + 1}`, 260),
    });
  });

  const videoSourceUrl = toAbsoluteSourceUrl(
    post?.video?.playbackUrl || post?.video?.url || "",
    req
  );
  if (videoSourceUrl) {
    assets.push({
      role: "video",
      mediaId: extractMediaIdFromSource(videoSourceUrl),
      mediaType: "video",
      mimeType: normalizeText(post?.video?.mimeType || "video/mp4", 120),
      sourceUrl: videoSourceUrl,
      previewUrl: toAbsoluteSourceUrl(
        post?.video?.thumbnailUrl || post?.video?.playbackUrl || post?.video?.url || "",
        req
      ),
      originalFilename: normalizeText(`${post?._id || "post"}-video`, 260),
      fileSizeBytes: Number(post?.video?.sizeBytes || 0),
    });
  }

  return assets;
};

const buildVideoScanMedia = (video = {}, req = null) => {
  const sourceUrl = toAbsoluteSourceUrl(video?.videoUrl || "", req);
  if (!sourceUrl) {
    return [];
  }

  return [
    {
      role: "primary",
      mediaId: extractMediaIdFromSource(sourceUrl),
      mediaType: "video",
      mimeType: normalizeText(video?.videoFormat || "video/mp4", 120),
      sourceUrl,
      previewUrl: toAbsoluteSourceUrl(video?.coverImageUrl || video?.previewClipUrl || video?.videoUrl || "", req),
      originalFilename: normalizeText(`${video?._id || "video"}-upload`, 260),
    },
  ];
};

const flattenScanValues = (values = [], seen = new Set()) =>
  (Array.isArray(values) ? values : [values]).flatMap((entry) => {
    if (entry === null || entry === undefined) {
      return [];
    }
    if (entry instanceof Date) {
      return [entry];
    }
    if (Array.isArray(entry)) {
      return flattenScanValues(entry, seen);
    }
    if (entry && typeof entry === "object") {
      if (seen.has(entry)) {
        return [];
      }
      seen.add(entry);
      return flattenScanValues(Object.values(entry), seen);
    }
    return [entry];
  });

const buildScanText = (...values) =>
  uniqueStrings(
    flattenScanValues(values)
      .map((entry) => normalizeText(entry, 4000))
      .filter(Boolean)
  ).join(" | ");

const buildScanAsset = (url = "", {
  req = null,
  role = "primary",
  mediaType = "image",
  mimeType = "",
  originalFilename = "",
  fileSizeBytes = 0,
} = {}) => {
  const sourceUrl = toAbsoluteSourceUrl(url, req);
  if (!sourceUrl) {
    return null;
  }

  const inferredMediaType = normalizeText(
    mediaType || (String(mimeType || "").toLowerCase().startsWith("video/") ? "video" : "image"),
    40
  ) || "image";
  const inferredMimeType = normalizeText(
    mimeType || (inferredMediaType === "video" ? "video/mp4" : "image/jpeg"),
    120
  );
  const filename = normalizeText(
    originalFilename || path.basename(sourceUrl.split("?")[0] || ""),
    260
  );

  return {
    role: normalizeText(role || "primary", 40),
    mediaId: extractMediaIdFromSource(sourceUrl),
    mediaType: inferredMediaType,
    mimeType: inferredMimeType,
    sourceUrl,
    previewUrl: sourceUrl,
    originalFilename: filename,
    fileSizeBytes: Number(fileSizeBytes || 0),
  };
};

const buildStoryScanMedia = (story = {}, req = null) => {
  const assets = [];
  const storyMedia = story?.media || {};
  const mainUrl =
    storyMedia?.url
    || story?.mediaUrl
    || story?.image
    || story?.thumbnailUrl
    || "";

  const mainAsset = buildScanAsset(mainUrl, {
    req,
    role: "primary",
    mediaType: storyMedia?.type || story?.mediaType || "image",
    mimeType: storyMedia?.type === "video" ? "video/mp4" : "image/jpeg",
    originalFilename: `${story?._id || "story"}-${storyMedia?.type || story?.mediaType || "image"}`,
  });
  if (mainAsset) {
    assets.push(mainAsset);
  }

  const thumbAsset = buildScanAsset(story?.thumbnailUrl || "", {
    req,
    role: "thumbnail",
    mediaType: "image",
    originalFilename: `${story?._id || "story"}-thumbnail`,
  });
  if (thumbAsset) {
    assets.push(thumbAsset);
  }

  const avatarAsset = buildScanAsset(story?.avatar || "", {
    req,
    role: "author_avatar",
    mediaType: "image",
    originalFilename: `${story?._id || "story"}-avatar`,
  });
  if (avatarAsset) {
    assets.push(avatarAsset);
  }

  return assets;
};

const buildMessageScanMedia = (message = {}, req = null) => {
  const assets = [];
  const attachments = Array.isArray(message?.attachments) ? message.attachments : [];

  attachments.slice(0, 4).forEach((attachment, index) => {
    const asset = buildScanAsset(attachment?.url || "", {
      req,
      role: index === 0 ? "primary" : `attachment_${index + 1}`,
      mediaType: attachment?.type || "file",
      mimeType:
        attachment?.type === "video"
          ? "video/mp4"
          : attachment?.type === "image"
            ? "image/jpeg"
            : "",
      originalFilename: attachment?.name || `${message?._id || "message"}-${index + 1}`,
      fileSizeBytes: attachment?.size || 0,
    });
    if (asset) {
      assets.push(asset);
    }
  });

  const cardAsset = buildScanAsset(message?.metadata?.coverImageUrl || "", {
    req,
    role: "content_card",
    mediaType: "image",
    originalFilename: `${message?._id || "message"}-card`,
  });
  if (cardAsset) {
    assets.push(cardAsset);
  }

  return assets;
};

const buildBookScanMedia = (book = {}, req = null) => {
  const urls = [
    book?.coverImageUrl,
    book?.coverUrl,
    book?.previewUrl,
    book?.contentUrl,
    book?.fileUrl,
  ].filter(Boolean);

  return urls
    .map((url, index) => buildScanAsset(url, {
      req,
      role: index === 0 ? "primary" : `attachment_${index + 1}`,
      mediaType: "image",
      originalFilename: `${book?._id || "book"}-${index + 1}`,
    }))
    .filter(Boolean);
};

const buildTrackScanMedia = (track = {}, req = null) => {
  const urls = [
    track?.coverImageUrl,
    track?.coverUrl,
    track?.previewUrl,
    track?.previewSampleUrl,
    track?.videoUrl,
    track?.previewClipUrl,
    track?.audioUrl,
    track?.fullAudioUrl,
  ].filter(Boolean);

  return urls
    .map((url, index) => buildScanAsset(url, {
      req,
      role: index === 0 ? "primary" : `attachment_${index + 1}`,
      mediaType: String(url || "").match(/\.(mp4|mov|webm|m4v)(\?|$)/i) ? "video" : "image",
      mimeType: String(url || "").match(/\.(mp4|mov|webm|m4v)(\?|$)/i) ? "video/mp4" : "",
      originalFilename: `${track?._id || "track"}-${index + 1}`,
    }))
    .filter(Boolean);
};

const buildAlbumScanMedia = (album = {}, req = null) => {
  const assets = [];
  const coverAsset = buildScanAsset(album?.coverUrl || "", {
    req,
    role: "primary",
    mediaType: "image",
    originalFilename: `${album?._id || "album"}-cover`,
  });
  if (coverAsset) {
    assets.push(coverAsset);
  }

  const trackAssets = (Array.isArray(album?.tracks) ? album.tracks : []).slice(0, 4).flatMap((track, index) => {
    const urls = [
      track?.previewUrl,
      track?.trackUrl,
    ].filter(Boolean);
    return urls.map((url, urlIndex) => buildScanAsset(url, {
      req,
      role: index === 0 && urlIndex === 0 ? "attachment_1" : `attachment_${index * 2 + urlIndex + 1}`,
      mediaType: String(url || "").match(/\.(mp4|mov|webm|m4v)(\?|$)/i) ? "video" : "audio",
      mimeType: String(url || "").match(/\.(mp4|mov|webm|m4v)(\?|$)/i) ? "video/mp4" : "audio/mpeg",
      originalFilename: `${album?._id || "album"}-${index + 1}-${urlIndex + 1}`,
    }));
  }).filter(Boolean);

  return [...assets, ...trackAssets];
};

const buildUserScanMedia = (user = {}, creatorProfile = null, req = null) => {
  const assets = [];
  const profile = creatorProfile || {};
  const urls = [
    user?.avatar?.url,
    user?.cover?.url,
    profile?.coverImageUrl,
    profile?.heroBannerUrl,
  ].filter(Boolean);

  urls.forEach((url, index) => {
    const asset = buildScanAsset(url, {
      req,
      role: index === 0 ? "primary" : `attachment_${index + 1}`,
      mediaType: "image",
      originalFilename: `${user?._id || "user"}-${index + 1}`,
    });
    if (asset) {
      assets.push(asset);
    }
  });

  return assets;
};

const buildPostScanCandidate = (post = {}, req = null) => {
  const media = buildPostScanMedia(post, req);
  const author = post?.author || {};
  return {
    targetType: "post",
    targetId: toId(post?._id),
    title: normalizeText(post?.text || post?.sharedPost?.originalText || post?.subject?.title || "Post", 240),
    description: buildScanText(
      post?.text,
      post?.location,
      post?.feeling,
      post?.tags,
      post?.moreOptions,
      post?.callToAction?.value,
      post?.sharedPost?.originalText,
      post?.sharedPost?.previewImage,
      post?.subject?.description
    ),
    media,
    metadata: {
      type: post?.type || "",
      visibility: post?.visibility || "",
      privacy: post?.privacy || "",
      scanSource: "admin_dashboard_scan",
    },
    uploader: {
      userId: author?._id || post?.author || null,
      email: String(author?.email || ""),
      username: String(author?.username || ""),
      displayName: String(author?.name || ""),
    },
    detectionSource: "admin_dashboard_scan",
    sortAt: post?.createdAt || post?.updatedAt || new Date(0),
    targetDoc: post,
    subjectMediaType: media[0]?.mediaType || post?.type || "unknown",
  };
};

const buildStoryScanCandidate = (story = {}, req = null) => {
  const media = buildStoryScanMedia(story, req);
  return {
    targetType: "story",
    targetId: toId(story?._id),
    title: normalizeText(story?.text || story?.name || story?.username || "Story", 240),
    description: buildScanText(
      story?.text,
      story?.name,
      story?.username,
      story?.mediaUrl,
      story?.thumbnailUrl
    ),
    media,
    metadata: {
      visibility: story?.visibility || "",
      scanSource: "admin_dashboard_scan",
    },
    uploader: {
      userId: story?.authorId || story?.userId || null,
      email: "",
      username: String(story?.username || ""),
      displayName: String(story?.name || ""),
    },
    detectionSource: "admin_dashboard_scan",
    sortAt: story?.time || story?.createdAt || story?.updatedAt || new Date(0),
    targetDoc: story,
    subjectMediaType: media[0]?.mediaType || story?.mediaType || "image",
  };
};

const buildMessageScanCandidate = (message = {}, req = null) => {
  const media = buildMessageScanMedia(message, req);
  return {
    targetType: "message",
    targetId: toId(message?._id),
    title: normalizeText(
      message?.text
      || message?.metadata?.title
      || message?.replyTo?.text
      || `Message in ${message?.conversationId || "conversation"}`,
      240
    ),
    description: buildScanText(
      message?.text,
      message?.metadata?.title,
      message?.metadata?.description,
      message?.metadata?.payload,
      message?.replyTo?.text,
      message?.replyTo?.contentTitle,
      message?.senderName,
      message?.attachments?.map((attachment) => attachment?.name),
      message?.attachments?.map((attachment) => attachment?.url)
    ),
    media,
    metadata: {
      conversationId: message?.conversationId || "",
      messageType: message?.type || "text",
      scanSource: "admin_dashboard_scan",
    },
    uploader: {
      userId: message?.senderId || null,
      email: "",
      username: "",
      displayName: String(message?.senderName || ""),
    },
    detectionSource: "admin_dashboard_scan",
    sortAt: message?.createdAt || message?.updatedAt || Number(message?.time || 0) || new Date(0),
    targetDoc: message,
    subjectMediaType: media[0]?.mediaType || "message",
  };
};

const buildVideoScanCandidate = (video = {}, req = null) => {
  const media = buildVideoScanMedia(video, req);
  return {
    targetType: "video",
    targetId: toId(video?._id),
    title: normalizeText(video?.caption || video?.name || "Video", 240),
    description: buildScanText(
      video?.caption,
      video?.description,
      video?.name,
      video?.username,
      video?.creatorCategory,
      video?.contentType
    ),
    media,
    metadata: {
      creatorCategory: video?.creatorCategory || "",
      contentType: video?.contentType || "",
      scanSource: "admin_dashboard_scan",
    },
    uploader: {
      userId: video?.userId || null,
      email: "",
      username: String(video?.username || ""),
      displayName: String(video?.name || ""),
    },
    detectionSource: "admin_dashboard_scan",
    sortAt: video?.time || video?.createdAt || video?.updatedAt || new Date(0),
    targetDoc: video,
    subjectMediaType: "video",
  };
};

const buildBookScanCandidate = (book = {}, creatorProfile = null, req = null) => {
  const media = buildBookScanMedia(book, req);
  return {
    targetType: "book",
    targetId: toId(book?._id),
    title: normalizeText(book?.title || "Book", 240),
    description: buildScanText(
      book?.description,
      book?.subtitle,
      book?.authorName,
      book?.genre,
      book?.language,
      book?.tableOfContents,
      book?.previewExcerptText,
      book?.readingAge,
      book?.audience,
      book?.edition,
      book?.isbn,
      book?.tags,
      book?.previewUrl,
      book?.fileUrl,
      book?.contentUrl
    ),
    media,
    metadata: {
      creatorCategory: book?.creatorCategory || "",
      contentType: book?.contentType || "",
      scanSource: "admin_dashboard_scan",
    },
    uploader: {
      userId: creatorProfile?.userId || null,
      email: "",
      username: "",
      displayName: String(creatorProfile?.displayName || creatorProfile?.fullName || book?.authorName || ""),
    },
    detectionSource: "admin_dashboard_scan",
    sortAt: book?.updatedAt || book?.createdAt || new Date(0),
    targetDoc: book,
    subjectMediaType: media[0]?.mediaType || "image",
  };
};

const buildTrackScanCandidate = (track = {}, creatorProfile = null, req = null) => {
  const media = buildTrackScanMedia(track, req);
  return {
    targetType: "track",
    targetId: toId(track?._id),
    title: normalizeText(track?.title || "Track", 240),
    description: buildScanText(
      track?.description,
      track?.genre,
      track?.artistName,
      track?.releaseType,
      track?.explicitContent ? "explicit content" : "",
      track?.featuringArtists,
      track?.producerCredits,
      track?.songwriterCredits,
      track?.lyrics,
      track?.showNotes,
      track?.podcastSeries,
      track?.podcastCategory,
      track?.contentType
    ),
    media,
    metadata: {
      creatorCategory: track?.creatorCategory || "",
      contentType: track?.contentType || "",
      scanSource: "admin_dashboard_scan",
    },
    uploader: {
      userId: creatorProfile?.userId || null,
      email: "",
      username: "",
      displayName: String(creatorProfile?.displayName || creatorProfile?.fullName || track?.artistName || ""),
    },
    detectionSource: "admin_dashboard_scan",
    sortAt: track?.updatedAt || track?.createdAt || new Date(0),
    targetDoc: track,
    subjectMediaType: media[0]?.mediaType || "audio",
  };
};

const buildAlbumScanCandidate = (album = {}, creatorProfile = null, req = null) => {
  const media = buildAlbumScanMedia(album, req);
  return {
    targetType: "album",
    targetId: toId(album?._id),
    title: normalizeText(album?.title || "Album", 240),
    description: buildScanText(
      album?.description,
      album?.releaseType,
      album?.status,
      album?.tracks?.map((track) => track?.title),
      album?.tracks?.map((track) => track?.trackUrl),
      album?.tracks?.map((track) => track?.previewUrl)
    ),
    media,
    metadata: {
      creatorCategory: album?.creatorCategory || "",
      contentType: album?.contentType || "",
      scanSource: "admin_dashboard_scan",
    },
    uploader: {
      userId: creatorProfile?.userId || null,
      email: "",
      username: "",
      displayName: String(creatorProfile?.displayName || creatorProfile?.fullName || ""),
    },
    detectionSource: "admin_dashboard_scan",
    sortAt: album?.updatedAt || album?.createdAt || new Date(0),
    targetDoc: album,
    subjectMediaType: media[0]?.mediaType || "image",
  };
};

const buildUserAccountScanCandidate = (user = {}, creatorProfile = null, req = null) => {
  const profile = creatorProfile || {};
  const media = buildUserScanMedia(user, profile, req);
  const targetId = toId(user?._id || profile?.userId);
  if (!targetId) {
    return null;
  }

  const displayName = String(
    user?.name
    || profile?.displayName
    || profile?.fullName
    || user?.username
    || "User"
  );

  return {
    targetType: "user",
    targetId,
    title: normalizeText(displayName, 240),
    description: buildScanText(
      user?.name,
      user?.username,
      user?.email,
      user?.bio,
      user?.status?.text,
      user?.currentCity,
      user?.hometown,
      user?.workplace,
      user?.education,
      user?.website,
      user?.gender,
      user?.pronouns,
      profile?.displayName,
      profile?.fullName,
      profile?.bio,
      profile?.tagline,
      profile?.country,
      profile?.countryOfResidence,
      profile?.socialHandles,
      profile?.musicProfile,
      profile?.booksProfile,
      profile?.podcastsProfile,
      profile?.links
    ),
    media,
    metadata: {
      scanSource: "admin_dashboard_scan",
      accountType: profile?._id ? "creator_profile" : "user",
      userStatus: user?.isBanned ? "banned" : user?.isSuspended ? "suspended" : "active",
      creatorProfileId: toId(profile?._id || ""),
    },
    uploader: {
      userId: targetId,
      email: String(user?.email || ""),
      username: String(user?.username || ""),
      displayName,
    },
    detectionSource: "admin_dashboard_scan",
    sortAt: user?.updatedAt || profile?.updatedAt || user?.createdAt || profile?.createdAt || new Date(0),
    targetDoc: user,
    subjectMediaType: media[0]?.mediaType || "image",
  };
};

const readInspectionSnippet = async (localPath = "") => {
  const normalizedPath = String(localPath || "").trim();
  if (!normalizedPath || !fs.existsSync(normalizedPath)) {
    return "";
  }

  const handle = await fsp.open(normalizedPath, "r");
  try {
    const buffer = Buffer.alloc(8192);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (!bytesRead) {
      return "";
    }
    return normalizeText(buffer.subarray(0, bytesRead).toString("utf8"), 4000);
  } finally {
    await handle.close().catch(() => null);
  }
};

const normalizeImageModerationResult = (policyDecision = {}, { localPath = "", mimeType = "", uploaderId = "" } = {}) => {
  const status = String(policyDecision.status || "ALLOW");
  const labels = uniqueStrings([
    ...(Array.isArray(policyDecision.riskLabels) ? policyDecision.riskLabels : []),
    mimeType ? `mime:${String(mimeType).toLowerCase()}` : "",
    uploaderId ? `uploader:${uploaderId}` : "",
  ]).filter(Boolean);
  const severity = String(policyDecision.severity || "").toUpperCase();
  const confidence = Math.max(
    0.05,
    Math.min(0.99, Number(policyDecision.priorityScore || 0) / 100 || 0.08)
  );

  if (status === "ALLOW") {
    return {
      decision: "approve",
      labels,
      reason: policyDecision.summary || "Content passed moderation checks.",
      confidence,
    };
  }

  const isExplicitSexual =
    status === "BLOCK_SUSPECTED_CHILD_EXPLOITATION" ||
    status === "BLOCK_EXPLICIT_ADULT";
  if (isExplicitSexual) {
    return {
      decision: "reject",
      labels,
      reason: policyDecision.summary || "This upload violates Tengacion safety rules and could not be published.",
      confidence: Math.max(confidence, 0.96),
    };
  }

  if (
    status === "BLOCK_EXTREME_GORE" ||
    status === "BLOCK_ANIMAL_CRUELTY" ||
    (status === "RESTRICTED_BLURRED" && ["HIGH", "CRITICAL"].includes(severity))
  ) {
    return {
      decision: "reject",
      labels,
      reason: policyDecision.summary || "This upload violates Tengacion safety rules and could not be published.",
      confidence: Math.max(confidence, 0.9),
    };
  }

  if (status === "RESTRICTED_BLURRED" || status === "HOLD_FOR_REVIEW") {
    const lowerLabels = labels.map((entry) => String(entry).toLowerCase());
    const sensitive = lowerLabels.some((entry) => entry.includes("graphic_gore") || entry.includes("animal_cruelty"));
    return {
      decision: sensitive ? "quarantine" : "quarantine",
      labels,
      reason: policyDecision.summary || "Your upload is under review by the Tengacion moderation team.",
      confidence: Math.max(confidence, sensitive ? 0.72 : 0.62),
    };
  }

  return {
    decision: "quarantine",
    labels,
    reason: policyDecision.summary || "Your upload is under review by the Tengacion moderation team.",
    confidence: Math.max(confidence, 0.55),
  };
};

const analyzeImage = async ({ localPath = "", mimeType = "", uploaderId = "" } = {}) => {
  try {
    const normalizedPath = String(localPath || "").trim();
    const snippet = await readInspectionSnippet(normalizedPath);
    const fileName = path.basename(normalizedPath || "uploaded-image");
    const policyDecision = evaluateModerationPolicy({
      title: fileName,
      description: snippet,
      metadata: {
        mimeType,
        localPath: normalizedPath,
        uploaderId,
      },
      media: [
        {
          originalFilename: fileName,
          sourceUrl: normalizedPath || fileName,
          previewUrl: snippet || fileName,
          mimeType,
          mediaType: mimeType.startsWith("video/") ? "video" : "image",
        },
      ],
      detectionSource: "automated_upload_scan",
    });

    return normalizeImageModerationResult(policyDecision, {
      localPath: normalizedPath,
      mimeType,
      uploaderId,
    });
  } catch {
    return {
      decision: "quarantine",
      labels: ["inspection_failed"],
      reason: "Unable to inspect uploaded file.",
      confidence: 0.2,
    };
  }
};

const mergeVisibilityWithModeration = (baselineAccess = {}, moderationDecision = {}) => {
  const status = String(moderationDecision?.status || "ALLOW");
  if (status === "ALLOW") {
    return {
      isPublished: Boolean(baselineAccess?.isPublished),
      publishedStatus: String(baselineAccess?.publishedStatus || "published"),
      albumStatus: String(
        baselineAccess?.albumStatus || (baselineAccess?.isPublished ? "published" : "draft")
      ),
    };
  }

  if (status === "RESTRICTED_BLURRED") {
    return {
      isPublished: true,
      publishedStatus: "published",
      albumStatus: "published",
    };
  }

  return {
    isPublished: false,
    publishedStatus: status === "HOLD_FOR_REVIEW" ? "under_review" : "blocked",
    albumStatus: "draft",
  };
};

const resolveTargetOwnerId = async ({ targetType, targetId, targetDoc = null }) => {
  if (targetType === "user") {
    return toId(targetDoc?._id || targetId);
  }

  if (targetType === "post") {
    const post = targetDoc || (await Post.findById(targetId).select("author").lean());
    return toId(post?.author);
  }

  if (targetType === "video") {
    const video =
      targetDoc
      || (await Video.findById(targetId).select("userId creatorProfileId").lean());
    if (video?.creatorProfileId) {
      const creator = await CreatorProfile.findById(video.creatorProfileId).select("userId").lean();
      return toId(creator?.userId) || toId(video?.userId);
    }
    return toId(video?.userId);
  }

  if (["track", "book", "album"].includes(targetType)) {
    const model = TARGET_MODEL_MAP[targetType];
    const target =
      targetDoc || (await model.findById(targetId).select("creatorId").lean());
    const creator = await CreatorProfile.findById(target?.creatorId).select("userId").lean();
    return toId(creator?.userId);
  }

  return "";
};

const getLatestCaseMapForTargets = async (targetType, targetIds = []) => {
  const normalizedIds = uniqueStrings(targetIds);
  if (!targetType || normalizedIds.length === 0) {
    return new Map();
  }

  const rows = await ModerationCase.find({
    "subject.targetType": String(targetType),
    "subject.targetId": { $in: normalizedIds },
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  const map = new Map();
  rows.forEach((row) => {
    const key = String(row?.subject?.targetId || "");
    if (key && !map.has(key)) {
      map.set(key, row);
    }
  });
  return map;
};

const getLatestCaseForTarget = async (targetType, targetId) => {
  if (!targetType || !targetId) {
    return null;
  }
  return ModerationCase.findOne({
    "subject.targetType": String(targetType),
    "subject.targetId": String(targetId),
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();
};

const getLatestCaseForMediaId = async (mediaId) => {
  const normalizedMediaId = normalizeText(mediaId, 120);
  if (!normalizedMediaId) {
    return null;
  }

  return ModerationCase.findOne({
    "media.mediaId": normalizedMediaId,
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();
};

const isHiddenFromPublic = (caseDoc = null) =>
  Boolean(caseDoc && BLOCKED_PUBLIC_STATUSES.has(String(caseDoc.status || "")));

const isRestrictedForPublic = (caseDoc = null) =>
  Boolean(caseDoc && RESTRICTED_PUBLIC_STATUSES.has(String(caseDoc.status || "")));

const filterPublicItems = async (targetType, items = []) => {
  const caseMap = await getLatestCaseMapForTargets(
    targetType,
    (Array.isArray(items) ? items : []).map((entry) => toId(entry?._id || entry?.id))
  );

  const visibleItems = (Array.isArray(items) ? items : []).filter((entry) => {
    const key = toId(entry?._id || entry?.id);
    return !isHiddenFromPublic(caseMap.get(key));
  });

  return { items: visibleItems, caseMap };
};

const getPublicModerationOverlay = (caseDoc = null, req = null) => {
  if (!isRestrictedForPublic(caseDoc)) {
    return null;
  }

  const firstAsset = Array.isArray(caseDoc?.media) ? caseDoc.media[0] : null;
  return {
    status: String(caseDoc?.status || ""),
    severity: String(caseDoc?.severity || "HIGH"),
    warningLabel: normalizeText(caseDoc?.publicWarningLabel || "Sensitive content", 160),
    placeholderUrl:
      normalizeText(firstAsset?.restrictedPreviewUrl || "", 1200)
      || buildRestrictedPreviewPath({
        req,
        category: caseDoc?.queue || "graphic_gore",
        severity: caseDoc?.severity || "HIGH",
      }),
    riskLabels: Array.isArray(caseDoc?.riskLabels) ? caseDoc.riskLabels : [],
  };
};

const buildCaseViewPermissions = (caseDoc = null) => {
  if (!caseDoc) {
    return [];
  }

  const required = ["view_moderation_queue"];
  const queuePermissions = QUEUE_REVIEW_PERMISSION_MAP[String(caseDoc.queue || "")] || [];
  const needsQuarantineReview =
    Boolean(caseDoc?.quarantine?.isQuarantined)
    && !queuePermissions.includes("review_quarantined_media");

  if (needsQuarantineReview) {
    required.push("review_quarantined_media");
  }

  return uniqueStrings([...required, ...queuePermissions]);
};

const buildCaseActionPermissions = (caseDoc = null, action = "") =>
  uniqueStrings([
    ...buildCaseViewPermissions(caseDoc),
    ...(ACTION_PERMISSION_MAP[String(action || "")] || []),
  ]);

const assertCasePermissions = ({ user, caseDoc, action = "" }) => {
  const required = action
    ? buildCaseActionPermissions(caseDoc, action)
    : buildCaseViewPermissions(caseDoc);
  if (!hasAllPermissions(user, required)) {
    const error = new Error("Forbidden");
    error.status = 403;
    error.missingPermissions = required;
    throw error;
  }
};

const buildAvailableActions = (caseDoc = null, user = null) =>
  CASE_ACTIONS.filter((action) => {
    if (
      ["restrict_with_warning", "blur_preview"].includes(action)
      && ["suspected_child_exploitation", "explicit_pornography"].includes(
        String(caseDoc?.queue || "")
      )
    ) {
      return false;
    }
    if (
      action === "hold_for_review"
      && ["suspected_child_exploitation", "explicit_pornography"].includes(
        String(caseDoc?.queue || "")
      )
    ) {
      return false;
    }
    if (
      ["approve", "restore_content"].includes(action)
      && String(caseDoc?.status || "") === "ALLOW"
    ) {
      return false;
    }
    if (
      action === "hold_for_review"
      && String(caseDoc?.status || "") === "HOLD_FOR_REVIEW"
      && String(caseDoc?.workflowState || "") === "UNDER_REVIEW"
    ) {
      return false;
    }
    if (
      action === "delete_media"
      && String(caseDoc?.status || "") === "BLOCK_REPEAT_VIOLATOR"
    ) {
      return false;
    }
    if (
      action === "escalate_case"
      && String(caseDoc?.workflowState || "") === "ESCALATED"
    ) {
      return false;
    }
    return hasAllPermissions(user, buildCaseActionPermissions(caseDoc, action));
  });

const persistMediaHashes = async ({ moderationCase, title = "", description = "", media = [] }) => {
  const assetRecords = [];
  for (const asset of media) {
    const referenceHash = buildSourceReferenceHash(asset);
    const fingerprintHash = asset.fingerprintHash || buildFingerprintHash({
      title,
      description,
      asset,
      sourceHash: referenceHash,
    });
    if (asset.fileHash) {
      assetRecords.push({
        moderationCaseId: moderationCase._id,
        targetType: moderationCase.subject.targetType,
        targetId: moderationCase.subject.targetId,
        mediaRole: asset.role,
        algorithm: "sha256",
        hashKind: "content_file",
        hashValue: asset.fileHash,
        sourceUrl: asset.sourceUrl,
        mimeType: asset.mimeType,
        originalFilename: asset.originalFilename,
      });
    }
    assetRecords.push(
      {
        moderationCaseId: moderationCase._id,
        targetType: moderationCase.subject.targetType,
        targetId: moderationCase.subject.targetId,
        mediaRole: asset.role,
        algorithm: "sha256",
        hashKind: "source_reference",
        hashValue: referenceHash,
        sourceUrl: asset.sourceUrl,
        mimeType: asset.mimeType,
        originalFilename: asset.originalFilename,
      },
      {
        moderationCaseId: moderationCase._id,
        targetType: moderationCase.subject.targetType,
        targetId: moderationCase.subject.targetId,
        mediaRole: asset.role,
        algorithm: "sha256",
        hashKind: "fingerprint",
        hashValue: fingerprintHash,
        sourceUrl: asset.sourceUrl,
        mimeType: asset.mimeType,
        originalFilename: asset.originalFilename,
      }
    );
  }

  if (assetRecords.length === 0) {
    return moderationCase.media || [];
  }

  const created = await MediaHash.create(assetRecords);
  const createdByAsset = new Map();
  created.forEach((doc) => {
    const key = `${String(doc.mediaRole || "")}:${String(doc.hashKind || "")}:${String(doc.hashValue || "")}`;
    createdByAsset.set(key, doc);
  });

  return (moderationCase.media || []).map((asset) => {
    const baseAsset = asset?.toObject ? asset.toObject() : asset;
    const referenceHash = buildSourceReferenceHash(baseAsset);
    const fingerprintHash = buildFingerprintHash({
      title,
      description,
      asset: baseAsset,
      sourceHash: referenceHash,
    });
    const hashIds = [];
    if (baseAsset.fileHash) {
      hashIds.push(
        createdByAsset.get(`${baseAsset.role}:content_file:${baseAsset.fileHash}`)?._id
      );
    }
    hashIds.push(
      createdByAsset.get(`${baseAsset.role}:source_reference:${referenceHash}`)?._id,
      createdByAsset.get(`${baseAsset.role}:fingerprint:${fingerprintHash}`)?._id
    );
    return {
      ...baseAsset,
      hashIds: hashIds.filter(Boolean),
    };
  });
};

const buildAdminCasePayload = (caseDoc = {}, user = null) => ({
  _id: toId(caseDoc._id),
  queue: String(caseDoc.queue || ""),
  status: String(caseDoc.status || ""),
  workflowState: String(caseDoc.workflowState || ""),
  severity: String(caseDoc.severity || ""),
  priorityScore: Number(caseDoc.priorityScore || 0),
  riskLabels: Array.isArray(caseDoc.riskLabels) ? caseDoc.riskLabels : [],
  createdAt: caseDoc.createdAt || null,
  updatedAt: caseDoc.updatedAt || null,
  detectionSource: String(caseDoc.detectionSource || ""),
  publicWarningLabel: String(caseDoc.publicWarningLabel || ""),
  uploader: {
    userId: toId(caseDoc?.uploader?.userId),
    email: String(caseDoc?.uploader?.email || ""),
    username: String(caseDoc?.uploader?.username || ""),
    displayName: String(caseDoc?.uploader?.displayName || ""),
  },
  subject: {
    targetType: String(caseDoc?.subject?.targetType || ""),
    targetId: String(caseDoc?.subject?.targetId || ""),
    title: String(caseDoc?.subject?.title || ""),
    description: String(caseDoc?.subject?.description || ""),
    mediaType: String(caseDoc?.subject?.mediaType || ""),
    createdAt: caseDoc?.subject?.createdAt || null,
  },
  media: (Array.isArray(caseDoc?.media) ? caseDoc.media : []).map((asset) => ({
    role: String(asset.role || ""),
    mediaId: String(asset.mediaId || ""),
    mediaType: String(asset.mediaType || ""),
    mimeType: String(asset.mimeType || ""),
    originalFilename: String(asset.originalFilename || ""),
    restrictedPreviewUrl: String(asset.restrictedPreviewUrl || ""),
    hasReviewSource: Boolean(asset.sourceUrl),
  })),
  quarantine: {
    isQuarantined: Boolean(caseDoc?.quarantine?.isQuarantined),
    quarantinedAt: caseDoc?.quarantine?.quarantinedAt || null,
    neverGeneratePreview: Boolean(caseDoc?.quarantine?.neverGeneratePreview),
  },
  escalation: {
    required: Boolean(caseDoc?.escalation?.required),
    status: String(caseDoc?.escalation?.status || ""),
    escalatedAt: caseDoc?.escalation?.escalatedAt || null,
  },
  reviewedBy: caseDoc?.reviewedBy
    ? {
        _id: toId(caseDoc.reviewedBy),
        name: String(caseDoc?.reviewedBy?.name || caseDoc?.reviewedBy?.displayName || ""),
        username: String(caseDoc?.reviewedBy?.username || ""),
        email: String(caseDoc?.reviewedBy?.email || caseDoc?.latestDecisionSummary?.adminEmail || ""),
      }
    : caseDoc?.reviewer
      ? {
          _id: toId(caseDoc.reviewer),
          name: String(caseDoc?.latestDecisionSummary?.adminEmail || ""),
          username: "",
          email: String(caseDoc?.latestDecisionSummary?.adminEmail || ""),
        }
      : null,
  reviewedAt: caseDoc?.reviewedAt || caseDoc?.latestDecisionSummary?.decidedAt || null,
  reviewerNote: String(caseDoc?.reviewerNote || caseDoc?.latestDecisionSummary?.reason || ""),
  internalNotes: String(caseDoc?.internalNotes || ""),
  evidence: {
    preservedAt: caseDoc?.evidence?.preservedAt || null,
    notes: String(caseDoc?.evidence?.notes || ""),
  },
  linkedReportsCount: Array.isArray(caseDoc?.linkedReportIds) ? caseDoc.linkedReportIds.length : 0,
  latestDecisionSummary: caseDoc?.latestDecisionSummary || null,
  history: (Array.isArray(caseDoc?.history) ? caseDoc.history : [])
    .slice(-6)
    .reverse()
    .map((entry) => ({
      actionType: String(entry.actionType || ""),
      adminUserId: toId(entry.adminUserId),
      adminEmail: String(entry.adminEmail || ""),
      previousStatus: String(entry.previousStatus || ""),
      newStatus: String(entry.newStatus || ""),
      reason: String(entry.reason || ""),
      createdAt: entry.createdAt || null,
    })),
  availableActions: buildAvailableActions(caseDoc, user),
});

const maybeNotifyPrimaryAdmin = async ({ moderationCase, req }) => {
  if (
    !CRITICAL_QUEUE_SET.has(String(moderationCase.queue || ""))
    && !CRITICAL_STATUS_SET.has(String(moderationCase.status || ""))
  ) {
    return;
  }

  const primaryAdmin = await findPrimaryModerationAdmin();
  if (!primaryAdmin?._id) {
    return;
  }

  await createNotification({
    recipient: primaryAdmin._id,
    sender: moderationCase?.uploader?.userId || primaryAdmin._id,
    type: "system",
    text: `Critical moderation case: ${String(moderationCase.subject?.title || moderationCase.queue || "Sensitive content")}`,
    entity: {
      id: moderationCase._id,
      model: "ModerationCase",
    },
    metadata: {
      previewText: moderationCase.publicWarningLabel || moderationCase.status,
      link: "/admin/reports",
      dedupeKey: `moderation_case:${moderationCase._id.toString()}`,
    },
  }).catch(() => null);

  if (String(process.env.MODERATION_ALERT_EMAIL_ENABLED || "").toLowerCase() === "true") {
    const toEmail = primaryAdmin.moderationProfile?.escalationEmail || primaryAdmin.email;
    if (toEmail) {
      await sendSecurityEmail({
        to: toEmail,
        subject: "Critical Tengacion moderation alert",
        html: `
          <div style="font-family: Arial; padding: 12px;">
            <h2>Critical moderation case opened</h2>
            <p>Queue: <strong>${moderationCase.queue}</strong></p>
            <p>Status: <strong>${moderationCase.status}</strong></p>
            <p>Target: ${moderationCase.subject?.targetType || "media"} ${moderationCase.subject?.title || ""}</p>
            <p>Open the moderation dashboard to review the case.</p>
          </div>
        `,
      }).catch(() => null);
    }
  }
};

const applyModerationStatusToTarget = async ({
  targetType,
  targetId,
  status,
  baselineAccess = {},
  moderationCaseId = null,
  sensitiveType = "",
  blurPreviewUrl = "",
  action = "",
}) => {
  const normalizedTargetType = String(targetType || "");
  if (!normalizedTargetType || !targetId) {
    return null;
  }

  const model = TARGET_MODEL_MAP[normalizedTargetType];
  if (!model || !isValidObjectId(targetId)) {
    return null;
  }

  const doc = await model.findById(targetId);
  if (!doc) {
    return null;
  }

  const nextAccess = mergeVisibilityWithModeration(baselineAccess, { status });
  const publicSensitivity = resolvePublicSensitivity({
    moderationStatus: status,
    sensitiveType,
    queue: sensitiveType,
  });
  if (docHasPath(doc, "isPublished")) {
    doc.isPublished = nextAccess.isPublished;
  }

  if (docHasPath(doc, "publishedStatus")) {
    doc.publishedStatus = nextAccess.publishedStatus;
  }
  if (normalizedTargetType === "album") {
    doc.status = nextAccess.albumStatus;
  }
  if (docHasPath(doc, "moderationStatus")) {
    doc.moderationStatus = publicSensitivity.moderationStatus;
  }
  if (docHasPath(doc, "moderationCaseId")) {
    doc.moderationCaseId = moderationCaseId || null;
  }
  if (docHasPath(doc, "sensitiveContent")) {
    doc.sensitiveContent = publicSensitivity.sensitiveContent;
  }
  if (docHasPath(doc, "sensitiveType")) {
    doc.sensitiveType = publicSensitivity.sensitiveType;
  }
  if (docHasPath(doc, "blurPreviewUrl") && blurPreviewUrl) {
    doc.blurPreviewUrl = blurPreviewUrl;
  }
  if (
    docHasPath(doc, "blurPreviewUrl")
    && publicSensitivity.moderationStatus !== "RESTRICTED_BLURRED"
  ) {
    doc.blurPreviewUrl = "";
  }
  if (docHasPath(doc, "reviewRequired")) {
    doc.reviewRequired = publicSensitivity.moderationStatus === "HOLD_FOR_REVIEW";
  }
  if (
    docHasPath(doc, "originalVisibility")
    && docHasPath(doc, "visibility")
  ) {
    const currentVisibility = String(doc.visibility || "");
    if (!String(doc.originalVisibility || "").trim()) {
      doc.originalVisibility = currentVisibility;
    }

    if (publicSensitivity.moderationStatus === "ALLOW" || publicSensitivity.moderationStatus === "approved") {
      doc.visibility = String(doc.originalVisibility || baselineAccess?.visibility || currentVisibility || "public");
    } else if (publicSensitivity.moderationStatus !== "RESTRICTED_BLURRED") {
      doc.visibility = "private";
    }
  }

  if (docHasPath(doc, "archivedAt")) {
    if (action === "delete_media") {
      doc.archivedAt = doc.archivedAt || new Date();
    } else if (["approve", "restore_content"].includes(String(action || ""))) {
      doc.archivedAt = null;
    }
  }

  await doc.save();
  return doc;
};

const getModerationCaseUploaderDetail = async ({ caseId, user }) => {
  if (!isValidObjectId(caseId)) {
    const error = new Error("Invalid moderation case id");
    error.status = 400;
    throw error;
  }

  const moderationCase = await ModerationCase.findById(caseId).lean();
  if (!moderationCase) {
    const error = new Error("Moderation case not found");
    error.status = 404;
    throw error;
  }

  assertCasePermissions({ user, caseDoc: moderationCase });

  const uploaderId = moderationCase?.uploader?.userId;
  if (!uploaderId || !isValidObjectId(uploaderId)) {
    return {
      user: null,
      strike: null,
      moderationCaseCount: 0,
    };
  }

  const [uploader, strike, moderationCaseCount] = await Promise.all([
    User.findById(uploaderId)
      .select(
        "_id name username email role isActive isBanned isSuspended suspendedAt suspendedUntil suspensionReason bannedAt banReason createdAt lastLogin moderationProfile"
      )
      .lean(),
    UserStrike.findOne({ userId: uploaderId }).lean(),
    ModerationCase.countDocuments({ "uploader.userId": uploaderId }),
  ]);

  return {
    user: uploader
      ? {
        _id: toId(uploader._id),
        displayName: String(uploader.name || ""),
        username: String(uploader.username || ""),
        email: String(uploader.email || ""),
        role: String(uploader.role || "user"),
        isActive: Boolean(uploader.isActive),
        isBanned: Boolean(uploader.isBanned),
        isSuspended: Boolean(uploader.isSuspended),
        suspendedAt: uploader.suspendedAt || null,
        suspendedUntil: uploader.suspendedUntil || null,
        suspensionReason: String(uploader.suspensionReason || ""),
        bannedAt: uploader.bannedAt || null,
        banReason: String(uploader.banReason || ""),
        createdAt: uploader.createdAt || null,
        lastLoginAt: uploader.lastLogin || null,
        moderationProfile: uploader.moderationProfile || {},
      }
      : null,
    strike: strike
      ? {
        count: Number(strike.count || 0),
        lastActionAt: strike.lastActionAt || null,
        lastActionType: String(strike.lastActionType || ""),
        lastSeverity: String(strike.lastSeverity || ""),
        lastEnforcementAction: String(strike.lastEnforcementAction || ""),
      }
      : null,
    moderationCaseCount: Number(moderationCaseCount || 0),
  };
};

const recordUserStrike = async ({
  targetUserId,
  moderationCaseId,
  actionType,
  targetType,
  targetId,
  reason,
  actorId,
  count = 1,
  reasonCategory = "",
  severity = "medium",
  actionTaken = "warning",
  expiresAt = null,
}) => {
  if (!targetUserId) {
    return null;
  }

  return UserStrike.findOneAndUpdate(
    { userId: targetUserId },
    {
      $inc: { count: Number(count) || 1 },
      $push: {
        history: {
          moderationCaseId,
          actionType,
          reasonCategory,
          severity,
          actionTaken,
          actorId,
          targetType,
          targetId,
          count: Number(count) || 1,
          reason: normalizeText(reason, 300),
          expiresAt: expiresAt || null,
          createdAt: new Date(),
        },
      },
      $set: {
        lastActionAt: new Date(),
        lastActionType: actionType,
        lastSeverity: severity,
        lastEnforcementAction: actionTaken,
        lastModeratorId: actorId || null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const suspendUserAccount = async ({ targetUserId, actorId, reason, req }) => {
  const user = await User.findById(targetUserId);
  if (!user) {
    return null;
  }

  user.isSuspended = true;
  user.isActive = false;
  user.suspensionReason = normalizeText(reason, 300);
  user.suspendedAt = new Date();
  user.suspendedUntil = null;
  user.suspendedBy = actorId || null;
  user.tokenVersion = (Number(user.tokenVersion) || 0) + 1;
  await user.save();
  disconnectUserSockets(req?.app, user._id, {
    code: "ACCOUNT_SUSPENDED",
    message: "Your account was suspended.",
  });
  return user;
};

const banUserAccount = async ({ targetUserId, actorId, reason, req }) => {
  const user = await User.findById(targetUserId);
  if (!user) {
    return null;
  }

  user.isBanned = true;
  user.isActive = false;
  user.isSuspended = false;
  user.suspensionReason = "";
  user.suspendedAt = null;
  user.suspendedUntil = null;
  user.suspendedBy = null;
  user.banReason = normalizeText(reason, 300);
  user.bannedAt = new Date();
  user.bannedBy = actorId || null;
  user.tokenVersion = (Number(user.tokenVersion) || 0) + 1;
  await user.save();
  disconnectUserSockets(req?.app, user._id, {
    code: "ACCOUNT_BANNED",
    message: "Your account was banned.",
  });
  return user;
};

const resolveRejectStatus = (caseDoc = {}) => {
  switch (String(caseDoc.queue || "")) {
    case "suspected_child_exploitation":
      return "BLOCK_SUSPECTED_CHILD_EXPLOITATION";
    case "explicit_pornography":
      return "BLOCK_EXPLICIT_ADULT";
    case "graphic_gore":
      return "BLOCK_EXTREME_GORE";
    case "animal_cruelty":
      return "BLOCK_ANIMAL_CRUELTY";
    default:
      return "HOLD_FOR_REVIEW";
  }
};

const syncLinkedReports = async ({ moderationCase, action, actorId }) => {
  const reportIds = Array.isArray(moderationCase?.linkedReportIds)
    ? moderationCase.linkedReportIds.filter(Boolean)
    : [];
  if (reportIds.length === 0) {
    return;
  }

  const nextStatus =
    action === "approve"
      ? "dismissed"
      : action === "preserve_evidence" || action === "escalate_case"
        ? "reviewing"
        : "actioned";

  await Report.updateMany(
    { _id: { $in: reportIds } },
    {
      $set: {
        status: nextStatus,
        actionTaken: normalizeText(action, 500),
        assignedTo: actorId || null,
      },
    }
  );
};

const buildDecisionFromMatchedCase = (matchedCase = null) => {
  if (!matchedCase?._id) {
    return null;
  }

  return {
    queue: String(matchedCase.queue || ""),
    status: String(matchedCase.status || "HOLD_FOR_REVIEW"),
    severity: String(matchedCase.severity || "HIGH"),
    priorityScore: Math.max(Number(matchedCase.priorityScore || 0), 95),
    riskLabels: uniqueStrings([
      "duplicate_ban_match",
      ...(Array.isArray(matchedCase.riskLabels) ? matchedCase.riskLabels : []),
    ]),
    quarantineMedia:
      String(matchedCase.status || "") !== "RESTRICTED_BLURRED",
    neverGeneratePreview:
      String(matchedCase.status || "") === "BLOCK_SUSPECTED_CHILD_EXPLOITATION"
      || String(matchedCase.status || "") === "BLOCK_EXPLICIT_ADULT",
    requiresEscalation:
      String(matchedCase.status || "") === "BLOCK_SUSPECTED_CHILD_EXPLOITATION",
    workflowState:
      String(matchedCase.status || "") === "BLOCK_SUSPECTED_CHILD_EXPLOITATION"
        ? "ESCALATED"
        : "OPEN",
    publicWarningLabel:
      String(matchedCase.publicWarningLabel || "") || "Matched previously prohibited media",
    summary: `Upload matched previously moderated media in ${matchedCase.queue || "the trust and safety queue"}.`,
    matchedCaseId: toId(matchedCase._id),
  };
};

const findMatchedHashDecision = async ({ title = "", description = "", media = [] }) => {
  const candidates = [];

  for (const asset of Array.isArray(media) ? media : []) {
    if (asset.fileHash) {
      candidates.push({
        hashKind: "content_file",
        hashValue: asset.fileHash,
      });
    }
    const sourceReferenceHash = buildSourceReferenceHash(asset);
    const fingerprintHash = buildFingerprintHash({
      title,
      description,
      asset,
      sourceHash: sourceReferenceHash,
    });
    candidates.push(
      {
        hashKind: "source_reference",
        hashValue: sourceReferenceHash,
      },
      {
        hashKind: "fingerprint",
        hashValue: fingerprintHash,
      }
    );
  }

  const normalizedCandidates = candidates.filter(
    (entry) => entry.hashKind && entry.hashValue
  );
  if (normalizedCandidates.length === 0) {
    return null;
  }

  const hashDocs = await MediaHash.find({
    $or: normalizedCandidates.map((entry) => ({
      hashKind: entry.hashKind,
      hashValue: entry.hashValue,
    })),
    moderationCaseId: { $ne: null },
  })
    .sort({ createdAt: -1 })
    .lean();

  if (hashDocs.length === 0) {
    return null;
  }

  const caseIds = uniqueStrings(hashDocs.map((doc) => toId(doc.moderationCaseId))).filter(
    isValidObjectId
  );
  if (caseIds.length === 0) {
    return null;
  }

  const matchedCases = await ModerationCase.find({
    _id: { $in: caseIds },
  })
    .sort({ updatedAt: -1, priorityScore: -1 })
    .lean();

  const matchedCase = matchedCases.find(
    (entry) =>
      BLOCKED_PUBLIC_STATUSES.has(String(entry.status || ""))
      || RESTRICTED_PUBLIC_STATUSES.has(String(entry.status || ""))
  );

  if (!matchedCase) {
    return null;
  }

  return buildDecisionFromMatchedCase(matchedCase);
};

const coerceMediaForModeration = async ({ media = [] }) => {
  const normalized = [];

  for (const asset of Array.isArray(media) ? media : []) {
    const fileHash =
      asset.fileHash
      || (asset.file ? await computeUploadHash(asset.file) : "");
    normalized.push({
      role: asset.role || "primary",
      mediaId: asset.mediaId || "",
      mediaType: asset.mediaType || "",
      mimeType: asset.mimeType || asset.file?.mimetype || "",
      sourceUrl: asset.sourceUrl || "",
      previewUrl: asset.previewUrl || "",
      restrictedPreviewUrl: asset.restrictedPreviewUrl || "",
      originalFilename:
        asset.originalFilename || asset.file?.originalname || asset.file?.filename || "",
      fileSizeBytes: Number(asset.fileSizeBytes || asset.file?.size || 0),
      fileHash,
      fingerprintHash: asset.fingerprintHash || "",
    });
  }

  return normalized;
};

const buildModelSignalsFromDecision = (decision = {}) => {
  const labels = Array.isArray(decision.riskLabels) ? decision.riskLabels.map(String) : [];
  const hasLabel = (value) => labels.includes(value);

  return {
    nudityScore: hasLabel("explicit_pornography") ? 0.99 : 0,
    sexualActivityScore: hasLabel("explicit_pornography") ? 0.97 : 0,
    minorRiskScore: hasLabel("suspected_child_exploitation") ? 0.99 : 0,
    goreScore: hasLabel("graphic_gore") ? 0.9 : 0,
    bloodScore: hasLabel("graphic_gore") ? 0.85 : 0,
    animalCrueltyScore: hasLabel("animal_cruelty") ? 0.92 : 0,
    coercionScore: hasLabel("sadistic") ? 0.8 : 0,
    ocrFlags: labels.filter((entry) => entry.includes("ocr:")),
    duplicateBanMatch: hasLabel("duplicate_ban_match"),
    repeatOffenderScore:
      decision.status === "BLOCK_REPEAT_VIOLATOR"
        ? 1
        : hasLabel("duplicate_ban_match")
          ? 0.8
          : 0,
  };
};

const createOrUpdateModerationCase = async ({
  targetType,
  targetId,
  title = "",
  description = "",
  metadata = {},
  media = [],
  uploader = {},
  detectionSource = "automated_upload_scan",
  reportReason = "",
  linkedReportIds = [],
  req = null,
  targetDoc = null,
  subjectMediaType = "",
  forceReview = false,
  manualReviewReason = "",
}) => {
  const normalizedTargetType = normalizeText(targetType, 40);
  const normalizedTargetId = normalizeText(targetId, 120);
  if (!normalizedTargetType || !normalizedTargetId) {
    return {
      moderationDecision: { status: "ALLOW", queue: "", severity: "LOW" },
      moderationCase: null,
    };
  }

  const sourceTarget = targetDoc
    || (TARGET_MODEL_MAP[normalizedTargetType]
      ? await TARGET_MODEL_MAP[normalizedTargetType].findById(normalizedTargetId).lean()
      : null);
  const baselineAccess = deriveBaselineAccess(normalizedTargetType, sourceTarget || {});
  const normalizedMedia = await coerceMediaForModeration({ media });
  const caseMediaEntries = buildCaseMediaEntries({
    media: normalizedMedia,
    req,
  });

  let moderationDecision = evaluateModerationPolicy({
    title,
    description,
    metadata,
    media: caseMediaEntries,
    reportReason,
    detectionSource,
  });

  const matchedHashDecision = await findMatchedHashDecision({
    title,
    description,
    media: normalizedMedia,
  });
  if (
    matchedHashDecision
    && (
      moderationDecision.status === "ALLOW"
      || BLOCKED_PUBLIC_STATUSES.has(String(matchedHashDecision.status || ""))
      || RESTRICTED_PUBLIC_STATUSES.has(String(matchedHashDecision.status || ""))
    )
  ) {
    moderationDecision = {
      ...moderationDecision,
      ...matchedHashDecision,
      riskLabels: uniqueStrings([
        ...(moderationDecision.riskLabels || []),
        ...(matchedHashDecision.riskLabels || []),
      ]),
    };
  }

  if (forceReview && moderationDecision.status === "ALLOW") {
    moderationDecision = {
      queue: "user_reported_sensitive_content",
      status: "HOLD_FOR_REVIEW",
      severity: "HIGH",
      priorityScore: 66,
      riskLabels: uniqueStrings([
        "admin_manual_review_requested",
        normalizeText(manualReviewReason, 120).toLowerCase().replace(/\s+/g, "_"),
      ].filter(Boolean)),
      quarantineMedia: false,
      neverGeneratePreview: false,
      requiresEscalation: false,
      workflowState: "OPEN",
      publicWarningLabel: "Sensitive content under review",
      summary:
        normalizeText(manualReviewReason, 500)
        || "An administrator requested a manual moderation review for this content.",
    };
  }

  const shouldCreateCase =
    moderationDecision.status !== "ALLOW"
    || detectionSource === "user_report"
    || linkedReportIds.length > 0;

  if (!shouldCreateCase) {
    return {
      moderationDecision,
      moderationCase: null,
      publicOverlay: getPublicModerationOverlay(null, req),
      baselineAccess,
    };
  }

  const latestCase = await getLatestCaseForTarget(normalizedTargetType, normalizedTargetId);
  const uploaderInfo = {
    userId: uploader.userId || (await resolveTargetOwnerId({
      targetType: normalizedTargetType,
      targetId: normalizedTargetId,
      targetDoc: sourceTarget,
    })) || null,
    email: normalizeText(uploader.email || "", 160).toLowerCase(),
    username: normalizeText(uploader.username || "", 80),
    displayName: normalizeText(uploader.displayName || uploader.name || "", 160),
  };

  const nextMedia = buildCaseMediaEntries({
    media: normalizedMedia,
    req,
    queue: moderationDecision.queue,
    severity: moderationDecision.severity,
  });

  const nextPayload = {
    queue: moderationDecision.queue || "user_reported_sensitive_content",
    status: moderationDecision.status || "HOLD_FOR_REVIEW",
    workflowState: moderationDecision.workflowState || "OPEN",
    severity: moderationDecision.severity || "MEDIUM",
    priorityScore: Number(moderationDecision.priorityScore || 0),
    riskLabels: uniqueStrings(moderationDecision.riskLabels || []),
    detectionSource,
    visibilityDecision:
      moderationDecision.status === "ALLOW"
        ? "allowed"
        : moderationDecision.status === "RESTRICTED_BLURRED"
          ? "restricted"
          : moderationDecision.status === "HOLD_FOR_REVIEW"
            ? "review"
            : "blocked",
    modelSignals: buildModelSignalsFromDecision(moderationDecision),
    subject: {
      targetType: normalizedTargetType,
      targetId: normalizedTargetId,
      title: normalizeText(title, 240),
      description: normalizeText(description, 3000),
      mediaType: normalizeText(
        subjectMediaType || nextMedia[0]?.mediaType || sourceTarget?.mediaType || "unknown",
        40
      ),
      createdAt: sourceTarget?.createdAt || sourceTarget?.time || null,
      baselineAccess,
    },
    uploader: {
      userId: uploaderInfo.userId && isValidObjectId(uploaderInfo.userId)
        ? uploaderInfo.userId
        : null,
      email: uploaderInfo.email,
      username: uploaderInfo.username,
      displayName: uploaderInfo.displayName,
    },
    media: stripTransientMediaFields(nextMedia),
    quarantine: {
      isQuarantined: Boolean(moderationDecision.quarantineMedia),
      quarantinedAt: moderationDecision.quarantineMedia ? new Date() : null,
      neverGeneratePreview: Boolean(moderationDecision.neverGeneratePreview),
    },
    escalation: {
      required: Boolean(moderationDecision.requiresEscalation),
      status: moderationDecision.requiresEscalation ? "pending_review" : "not_required",
      escalatedAt: moderationDecision.requiresEscalation ? new Date() : null,
      escalatedBy: null,
      notes: matchedHashDecision?.matchedCaseId
        ? `Matched previously moderated media case ${matchedHashDecision.matchedCaseId}.`
        : "",
    },
    publicWarningLabel: normalizeText(moderationDecision.publicWarningLabel || "", 160),
    internalNotes: normalizeText(moderationDecision.summary || "", 4000),
    linkedReportIds: uniqueStrings([
      ...(Array.isArray(latestCase?.linkedReportIds) ? latestCase.linkedReportIds.map(toId) : []),
      ...linkedReportIds.map(toId),
    ])
      .filter(isValidObjectId)
      .map((entry) => new mongoose.Types.ObjectId(entry)),
  };

  let moderationCase;
  const shouldReuseCase =
    latestCase
    && String(latestCase.subject?.targetType || "") === normalizedTargetType
    && String(latestCase.subject?.targetId || "") === normalizedTargetId
    && ACTIVE_REVIEW_STATES.includes(String(latestCase.workflowState || ""))
    && latestCase.status !== "ALLOW";

  if (shouldReuseCase) {
    Object.assign(latestCase, nextPayload);
    moderationCase = await latestCase.save();
  } else {
    moderationCase = await ModerationCase.create(nextPayload);
  }

  const persistedMedia = await persistMediaHashes({
    moderationCase,
    title,
    description,
    media: nextMedia,
  });

  moderationCase.media = stripTransientMediaFields(persistedMedia);
  await moderationCase.save();

  await applyModerationStatusToTarget({
    targetType: normalizedTargetType,
    targetId: normalizedTargetId,
    status: moderationCase.status,
    baselineAccess,
    moderationCaseId: moderationCase._id,
    sensitiveType: moderationCase.queue,
    blurPreviewUrl: moderationCase.media?.[0]?.restrictedPreviewUrl || "",
  });

  await syncLinkedReports({
    moderationCase,
    action: moderationDecision.status === "ALLOW" ? "approve" : "reject",
    actorId: null,
  });

  await maybeNotifyPrimaryAdmin({ moderationCase, req });

  return {
    moderationDecision,
    moderationCase,
    publicOverlay: getPublicModerationOverlay(moderationCase, req),
    baselineAccess,
  };
};

const listModerationCases = async ({
  user,
  page = 1,
  limit = 20,
  queue = "",
  status = "",
  workflowState = "",
  severity = "",
  search = "",
  criticalOnly = false,
}) => {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const skip = (normalizedPage - 1) * normalizedLimit;

  const query = {};
  if (queue) query.queue = String(queue);
  if (status) query.status = String(status);
  if (workflowState) query.workflowState = String(workflowState);
  if (severity) query.severity = String(severity);
  if (criticalOnly) {
    query.$or = [{ severity: "CRITICAL" }, { priorityScore: { $gte: 90 } }];
  }
  if (search) {
    const escapedSearch = escapeRegex(search);
    query.$and = [
      ...(Array.isArray(query.$and) ? query.$and : []),
      {
        $or: [
          { "subject.title": { $regex: escapedSearch, $options: "i" } },
          { "subject.description": { $regex: escapedSearch, $options: "i" } },
          { "uploader.email": { $regex: escapedSearch, $options: "i" } },
          { "uploader.username": { $regex: escapedSearch, $options: "i" } },
          { riskLabels: { $elemMatch: { $regex: escapedSearch, $options: "i" } } },
        ],
      },
    ];
  }

  const [rows, total] = await Promise.all([
    ModerationCase.find(query)
      .sort({ priorityScore: -1, severity: -1, updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(normalizedLimit)
      .lean(),
    ModerationCase.countDocuments(query),
  ]);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    total,
    cases: rows.map((entry) => buildAdminCasePayload(entry, user)),
  };
};

const getModerationSummary = async ({ user }) => {
  const repeatViolatorThreshold = MODERATION_REPEAT_VIOLATOR_STRIKE_THRESHOLD;
  const [
    queueSummary,
    statusSummary,
    workflowSummary,
    criticalCount,
    pendingReview,
    blockedExplicit,
    suspectedCsam,
    restrictedGore,
    animalCruelty,
    repeatViolators,
  ] = await Promise.all([
    ModerationCase.aggregate([
      { $group: { _id: "$queue", count: { $sum: 1 } } },
    ]),
    ModerationCase.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    ModerationCase.aggregate([
      { $group: { _id: "$workflowState", count: { $sum: 1 } } },
    ]),
    ModerationCase.countDocuments({
      $or: [{ severity: "CRITICAL" }, { priorityScore: { $gte: 90 } }],
    }),
    ModerationCase.countDocuments({
      workflowState: { $in: ["OPEN", "UNDER_REVIEW", "ESCALATED"] },
    }),
    ModerationCase.countDocuments({ status: "BLOCK_EXPLICIT_ADULT" }),
    ModerationCase.countDocuments({ status: "BLOCK_SUSPECTED_CHILD_EXPLOITATION" }),
    ModerationCase.countDocuments({
      queue: "graphic_gore",
      status: "RESTRICTED_BLURRED",
    }),
    ModerationCase.countDocuments({ status: "BLOCK_ANIMAL_CRUELTY" }),
    UserStrike.countDocuments({ count: { $gte: repeatViolatorThreshold } }),
  ]);

  const toMap = (rows = []) =>
    rows.reduce((acc, row) => {
      acc[String(row._id || "unknown")] = Number(row.count || 0);
      return acc;
    }, {});

  return {
    permissions: [...buildCaseViewPermissions(null), ...buildAvailableActions(null, user)],
    queues: toMap(queueSummary),
    statuses: toMap(statusSummary),
    workflowStates: toMap(workflowSummary),
    criticalCount,
    pendingReview,
    blockedExplicit,
    suspectedCsam,
    restrictedGore,
    animalCruelty,
    repeatViolators,
    repeatViolatorThreshold,
  };
};

const scanContentForModeration = async ({
  user,
  req = null,
  search = "",
  limit = 20,
  includeManualReview = false,
}) => {
  const normalizedSearch = normalizeText(search, 160);
  const normalizedLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  const regex = normalizedSearch ? new RegExp(escapeRegex(normalizedSearch), "i") : null;
  const [matchedUsers, matchedCreatorProfiles] = regex
    ? await Promise.all([
      User.find(
        {
          $or: [
            { name: regex },
            { username: regex },
            { email: regex },
            { bio: regex },
            { "status.text": regex },
            { currentCity: regex },
            { hometown: regex },
            { workplace: regex },
            { education: regex },
            { website: regex },
          ],
        },
        "_id name username email"
      ).lean(),
      CreatorProfile.find(
        {
          $or: [
            { displayName: regex },
            { fullName: regex },
            { bio: regex },
            { tagline: regex },
            { country: regex },
            { countryOfResidence: regex },
            { "musicProfile.artistBio": regex },
            { "booksProfile.authorBio": regex },
            { "podcastsProfile.description": regex },
            { "podcastsProfile.themeOrTopic": regex },
          ],
        },
        "_id userId displayName fullName"
      ).lean(),
    ])
    : [[], []];

  const matchedUserIds = uniqueStrings([
    ...matchedUsers.map((entry) => toId(entry._id)),
    ...matchedCreatorProfiles.map((entry) => toId(entry.userId)),
  ]).filter(Boolean);
  const matchedCreatorProfileIds = uniqueStrings(matchedCreatorProfiles.map((entry) => toId(entry._id))).filter(Boolean);

  const userQuery = regex
    ? {
        $or: [
          { name: regex },
          { username: regex },
          { email: regex },
          { bio: regex },
          { "status.text": regex },
          { currentCity: regex },
          { hometown: regex },
          { workplace: regex },
          { education: regex },
          { website: regex },
          { "avatar.url": regex },
          { "cover.url": regex },
        ],
      }
    : { isDeleted: { $ne: true } };

  const creatorProfileQuery = regex
    ? {
        $or: [
          { displayName: regex },
          { fullName: regex },
          { bio: regex },
          { tagline: regex },
          { country: regex },
          { countryOfResidence: regex },
          { "musicProfile.artistBio": regex },
          { "booksProfile.authorBio": regex },
          { "podcastsProfile.description": regex },
          { "podcastsProfile.themeOrTopic": regex },
        ],
      }
    : {};

  const postQuery = regex
    ? {
        $or: [
          { text: regex },
          { location: regex },
          { feeling: regex },
          { tags: regex },
          { moreOptions: regex },
          { "sharedPost.originalText": regex },
          { "sharedPost.previewImage": regex },
          ...(matchedUserIds.length > 0 ? [{ author: { $in: matchedUserIds } }] : []),
        ],
      }
    : {
        $or: [
          { text: { $exists: true, $ne: "" } },
          { "media.0": { $exists: true } },
          { "video.playbackUrl": { $exists: true, $ne: "" } },
          { "video.url": { $exists: true, $ne: "" } },
          { "sharedPost.originalText": { $exists: true, $ne: "" } },
        ],
      };

  const storyQuery = regex
    ? {
        $or: [
          { text: regex },
          { name: regex },
          { username: regex },
          { mediaUrl: regex },
          { thumbnailUrl: regex },
          ...(matchedUserIds.length > 0 ? [{ authorId: { $in: matchedUserIds } }] : []),
          ...(matchedUserIds.length > 0 ? [{ userId: { $in: matchedUserIds } }] : []),
        ],
      }
    : {
        $or: [
          { text: { $exists: true, $ne: "" } },
          { "media.url": { $exists: true, $ne: "" } },
          { mediaUrl: { $exists: true, $ne: "" } },
          { thumbnailUrl: { $exists: true, $ne: "" } },
        ],
      };

  const messageQuery = regex
    ? {
        $or: [
          { text: regex },
          { senderName: regex },
          { "metadata.title": regex },
          { "metadata.description": regex },
          { "replyTo.text": regex },
          { "replyTo.contentTitle": regex },
          { "attachments.name": regex },
          { "attachments.url": regex },
          ...(matchedUserIds.length > 0 ? [{ senderId: { $in: matchedUserIds } }] : []),
          ...(matchedUserIds.length > 0 ? [{ receiverId: { $in: matchedUserIds } }] : []),
        ],
      }
    : {
        isSystem: { $ne: true },
        $or: [
          { text: { $exists: true, $ne: "" } },
          { "attachments.0": { $exists: true } },
          { "metadata.title": { $exists: true, $ne: "" } },
          { "metadata.description": { $exists: true, $ne: "" } },
        ],
      };

  const videoQuery = regex
    ? {
        $or: [
          { caption: regex },
          { description: regex },
          { name: regex },
          { username: regex },
          { videoUrl: regex },
          { coverImageUrl: regex },
          { previewClipUrl: regex },
          ...(matchedUserIds.length > 0 ? [{ userId: { $in: matchedUserIds } }] : []),
        ],
      }
    : {
        videoUrl: { $exists: true, $ne: "" },
      };

  const bookQuery = regex
    ? {
        $or: [
          { title: regex },
          { description: regex },
          { authorName: regex },
          { subtitle: regex },
          { genre: regex },
          { language: regex },
          { tableOfContents: regex },
          { previewExcerptText: regex },
          { tags: regex },
          { coverImageUrl: regex },
          { coverUrl: regex },
          { contentUrl: regex },
          { fileUrl: regex },
          { previewUrl: regex },
          ...(matchedCreatorProfileIds.length > 0 ? [{ creatorId: { $in: matchedCreatorProfileIds } }] : []),
        ],
      }
    : {
        $or: [
          { title: { $exists: true, $ne: "" } },
          { description: { $exists: true, $ne: "" } },
          { coverImageUrl: { $exists: true, $ne: "" } },
          { coverUrl: { $exists: true, $ne: "" } },
          { contentUrl: { $exists: true, $ne: "" } },
          { fileUrl: { $exists: true, $ne: "" } },
          { previewUrl: { $exists: true, $ne: "" } },
        ],
      };

  const trackQuery = regex
    ? {
        $or: [
          { title: regex },
          { description: regex },
          { artistName: regex },
          { genre: regex },
          { lyrics: regex },
          { showNotes: regex },
          { podcastSeries: regex },
          { podcastCategory: regex },
          { featuringArtists: regex },
          { producerCredits: regex },
          { songwriterCredits: regex },
          { coverImageUrl: regex },
          { coverUrl: regex },
          { audioUrl: regex },
          { fullAudioUrl: regex },
          { videoUrl: regex },
          { previewClipUrl: regex },
          { previewSampleUrl: regex },
          ...(matchedCreatorProfileIds.length > 0 ? [{ creatorId: { $in: matchedCreatorProfileIds } }] : []),
        ],
      }
    : {
        $or: [
          { title: { $exists: true, $ne: "" } },
          { description: { $exists: true, $ne: "" } },
          { audioUrl: { $exists: true, $ne: "" } },
          { fullAudioUrl: { $exists: true, $ne: "" } },
          { videoUrl: { $exists: true, $ne: "" } },
          { previewClipUrl: { $exists: true, $ne: "" } },
          { previewSampleUrl: { $exists: true, $ne: "" } },
          { coverImageUrl: { $exists: true, $ne: "" } },
          { coverUrl: { $exists: true, $ne: "" } },
        ],
      };

  const albumQuery = regex
    ? {
        $or: [
          { title: regex },
          { description: regex },
          { releaseType: regex },
          { status: regex },
          { "tracks.title": regex },
          { "tracks.trackUrl": regex },
          { "tracks.previewUrl": regex },
          { coverUrl: regex },
          ...(matchedCreatorProfileIds.length > 0 ? [{ creatorId: { $in: matchedCreatorProfileIds } }] : []),
        ],
      }
    : {
        $or: [
          { title: { $exists: true, $ne: "" } },
          { description: { $exists: true, $ne: "" } },
          { coverUrl: { $exists: true, $ne: "" } },
          { "tracks.0": { $exists: true } },
        ],
      };

  const [posts, stories, messages, videos, books, tracks, albums, users, creatorProfiles] = await Promise.all([
    Post.find(postQuery)
      .sort({ createdAt: -1, updatedAt: -1 })
      .limit(normalizedLimit)
      .populate("author", "_id name username email bio currentCity hometown workplace education website gender pronouns avatar cover status")
      .lean(),
    Story.find(storyQuery)
      .sort({ time: -1, updatedAt: -1, createdAt: -1 })
      .limit(normalizedLimit)
      .populate("authorId", "_id name username email bio currentCity hometown workplace education website gender pronouns avatar cover status")
      .lean(),
    Message.find(messageQuery)
      .sort({ createdAt: -1, time: -1, updatedAt: -1 })
      .limit(normalizedLimit)
      .populate("senderId", "_id name username email bio currentCity hometown workplace education website gender pronouns avatar cover status")
      .populate("receiverId", "_id name username email bio currentCity hometown workplace education website gender pronouns avatar cover status")
      .lean(),
    Video.find(videoQuery)
      .sort({ time: -1, createdAt: -1, updatedAt: -1 })
      .limit(normalizedLimit)
      .lean(),
    Book.find(bookQuery)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(normalizedLimit)
      .populate("creatorId", "_id userId displayName fullName bio tagline country countryOfResidence coverImageUrl heroBannerUrl")
      .lean(),
    Track.find(trackQuery)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(normalizedLimit)
      .populate("creatorId", "_id userId displayName fullName bio tagline country countryOfResidence coverImageUrl heroBannerUrl")
      .lean(),
    Album.find(albumQuery)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(normalizedLimit)
      .populate("creatorId", "_id userId displayName fullName bio tagline country countryOfResidence coverImageUrl heroBannerUrl")
      .lean(),
    User.find(userQuery)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(normalizedLimit)
      .select("_id name username email bio currentCity hometown workplace education website gender pronouns status avatar cover isBanned isSuspended updatedAt createdAt")
      .lean(),
    CreatorProfile.find(creatorProfileQuery)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(normalizedLimit)
      .select("_id userId displayName fullName bio tagline country countryOfResidence musicProfile booksProfile podcastsProfile links coverImageUrl heroBannerUrl updatedAt createdAt")
      .lean(),
  ]);

  const candidateMap = new Map();
  const dedupeMediaAssets = (assets = []) => {
    const seen = new Set();
    return (Array.isArray(assets) ? assets : []).filter((asset = {}) => {
      const key = [
        String(asset.sourceUrl || ""),
        String(asset.role || ""),
        String(asset.mediaId || ""),
      ].join("|");
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  const addCandidate = (candidate = {}) => {
    const targetType = String(candidate.targetType || "");
    const targetId = toId(candidate.targetId || "");
    if (!targetType || !targetId) {
      return;
    }

    const normalizedCandidate = {
      ...candidate,
      targetType,
      targetId,
      title: normalizeText(candidate.title || "", 240),
      description: normalizeText(candidate.description || "", 3000),
      media: dedupeMediaAssets(candidate.media || []),
      metadata: candidate.metadata || {},
      uploader: candidate.uploader || {},
      detectionSource: String(candidate.detectionSource || "admin_dashboard_scan"),
      subjectMediaType: String(candidate.subjectMediaType || "unknown"),
      sortAt: candidate.sortAt || new Date(0),
    };

    const key = `${targetType}:${targetId}`;
    const existing = candidateMap.get(key);
    if (!existing) {
      candidateMap.set(key, normalizedCandidate);
      return;
    }

    existing.title = existing.title || normalizedCandidate.title;
    existing.description = buildScanText(existing.description, normalizedCandidate.description);
    existing.media = dedupeMediaAssets([...(existing.media || []), ...normalizedCandidate.media]);
    existing.metadata = { ...(existing.metadata || {}), ...(normalizedCandidate.metadata || {}) };
    if (!existing.uploader?.userId && normalizedCandidate.uploader?.userId) {
      existing.uploader = normalizedCandidate.uploader;
    }
    if (!existing.targetDoc && normalizedCandidate.targetDoc) {
      existing.targetDoc = normalizedCandidate.targetDoc;
    }
    if (!existing.subjectMediaType && normalizedCandidate.subjectMediaType) {
      existing.subjectMediaType = normalizedCandidate.subjectMediaType;
    }
    const existingSort = new Date(existing.sortAt || 0).getTime();
    const candidateSort = new Date(normalizedCandidate.sortAt || 0).getTime();
    if (candidateSort > existingSort) {
      existing.sortAt = normalizedCandidate.sortAt;
    }
  };

  const creatorProfileByUserId = new Map(
    creatorProfiles.map((entry) => [toId(entry?.userId), entry]).filter(([key]) => Boolean(key))
  );
  const creatorProfileById = new Map(
    creatorProfiles.map((entry) => [toId(entry?._id), entry]).filter(([key]) => Boolean(key))
  );
  const userById = new Map(users.map((entry) => [toId(entry?._id), entry]).filter(([key]) => Boolean(key)));
  const storyAuthorById = new Map();
  stories.forEach((story) => {
    const author = story?.authorId || {};
    const authorId = toId(author?._id || story?.authorId || story?.userId || "");
    if (authorId && !storyAuthorById.has(authorId)) {
      storyAuthorById.set(authorId, author);
    }
  });
  const messageSenderById = new Map();
  [...messages].forEach((message) => {
    const sender = message?.senderId || {};
    const senderId = toId(sender?._id || message?.senderId || "");
    if (senderId && !messageSenderById.has(senderId)) {
      messageSenderById.set(senderId, sender);
    }
  });

  posts.forEach((entry) => addCandidate(buildPostScanCandidate(entry, req)));
  stories.forEach((entry) => addCandidate(buildStoryScanCandidate(entry, req)));
  messages.forEach((entry) => addCandidate(buildMessageScanCandidate(entry, req)));
  videos.forEach((entry) => addCandidate(buildVideoScanCandidate(entry, req)));
  books.forEach((entry) => addCandidate(buildBookScanCandidate(entry, creatorProfileById.get(toId(entry?.creatorId)) || null, req)));
  tracks.forEach((entry) => addCandidate(buildTrackScanCandidate(entry, creatorProfileById.get(toId(entry?.creatorId)) || null, req)));
  albums.forEach((entry) => addCandidate(buildAlbumScanCandidate(entry, creatorProfileById.get(toId(entry?.creatorId)) || null, req)));
  users.forEach((entry) => addCandidate(buildUserAccountScanCandidate(entry, creatorProfileByUserId.get(toId(entry?._id)) || null, req)));
  creatorProfiles.forEach((entry) => addCandidate(buildUserAccountScanCandidate(userById.get(toId(entry?.userId)) || {}, entry, req)));

  const candidates = [...candidateMap.values()].sort(
    (left, right) => new Date(right.sortAt || 0).getTime() - new Date(left.sortAt || 0).getTime()
  );

  const cases = [];
  let approvedCount = 0;
  let blockedCount = 0;
  let reviewCount = 0;
  let restrictedCount = 0;
  let flaggedCount = 0;
  const flaggedAccountIds = new Set();

  const tallyScanResult = (candidate = {}, result = {}) => {
    const status = String(result?.moderationCase?.status || result?.moderationDecision?.status || "").toUpperCase();
    if (!status || status === "ALLOW") {
      approvedCount += 1;
      return;
    }

    if (status === "RESTRICTED_BLURRED") {
      restrictedCount += 1;
      flaggedCount += 1;
    } else if (status === "HOLD_FOR_REVIEW" || status === "PENDING" || status === "QUARANTINED") {
      reviewCount += 1;
      flaggedCount += 1;
    } else {
      blockedCount += 1;
      flaggedCount += 1;
    }

    if (String(candidate?.targetType || "") === "user" && result?.moderationCase?._id) {
      flaggedAccountIds.add(String(candidate.targetId || ""));
    }
  };

  for (const candidate of candidates) {
    const result = await createOrUpdateModerationCase({
      targetType: candidate.targetType,
      targetId: candidate.targetId,
      title: candidate.title,
      description: candidate.description,
      metadata: {
        ...(candidate.metadata || {}),
        scanSource: "admin_dashboard_scan",
      },
      media: candidate.media || [],
      uploader: candidate.uploader || {},
      detectionSource: candidate.detectionSource || "admin_dashboard_scan",
      req,
      targetDoc: candidate.targetDoc || null,
      subjectMediaType: candidate.subjectMediaType || "",
      forceReview: includeManualReview && Boolean(normalizedSearch),
      manualReviewReason: normalizedSearch
        ? `Admin scan requested for "${normalizedSearch}"`
        : "Admin scan requested",
    });

    if (result?.moderationCase) {
      cases.push(buildAdminCasePayload(result.moderationCase, user));
    }
    tallyScanResult(candidate, result);
  }

  return {
    scannedCount: candidates.length,
    approvedCount,
    blockedCount,
    reviewCount,
    restrictedCount,
    flaggedCount,
    accountsFlagged: flaggedAccountIds.size,
    cases,
  };
};

const getModerationCaseDetail = async ({ caseId, user }) => {
  if (!isValidObjectId(caseId)) {
    const error = new Error("Invalid moderation case id");
    error.status = 400;
    throw error;
  }

  const moderationCase = await ModerationCase.findById(caseId).lean();
  if (!moderationCase) {
    const error = new Error("Moderation case not found");
    error.status = 404;
    throw error;
  }

  assertCasePermissions({ user, caseDoc: moderationCase });
  return buildAdminCasePayload(moderationCase, user);
};

const generateModerationReviewUrl = async ({
  caseId,
  user,
  req,
  mediaRole = "",
  mediaIndex = 0,
}) => {
  if (!isValidObjectId(caseId)) {
    const error = new Error("Invalid moderation case id");
    error.status = 400;
    throw error;
  }

  const moderationCase = await ModerationCase.findById(caseId).lean();
  if (!moderationCase) {
    const error = new Error("Moderation case not found");
    error.status = 404;
    throw error;
  }

  assertCasePermissions({ user, caseDoc: moderationCase });

  const mediaList = Array.isArray(moderationCase.media) ? moderationCase.media : [];
  const selectedAsset =
    mediaList.find((entry) => mediaRole && String(entry.role || "") === String(mediaRole))
    || mediaList[Number(mediaIndex) || 0]
    || mediaList[0];

  if (!selectedAsset) {
    const error = new Error("No reviewable media found");
    error.status = 404;
    throw error;
  }

  const sourceUrl =
    selectedAsset.sourceUrl
    || selectedAsset.previewUrl
    || selectedAsset.restrictedPreviewUrl;
  if (!sourceUrl) {
    const error = new Error("Review URL unavailable for this case");
    error.status = 404;
    throw error;
  }

  return {
    url: buildSignedMediaUrl({
      sourceUrl,
      userId: req?.user?.id || user?._id || "",
      itemType: "moderation_case",
      itemId: toId(moderationCase._id),
      expiresInSec: 300,
      allowDownload: false,
      req,
    }),
    mediaRole: selectedAsset.role || "primary",
  };
};

const performModerationAction = async ({
  caseId,
  action,
  reason = "",
  user,
  req = null,
  metadata = {},
}) => {
  if (!isValidObjectId(caseId)) {
    const error = new Error("Invalid moderation case id");
    error.status = 400;
    throw error;
  }

  const moderationCase = await ModerationCase.findById(caseId);
  if (!moderationCase) {
    const error = new Error("Moderation case not found");
    error.status = 404;
    throw error;
  }

  const normalizedAction = normalizeText(action, 80).toLowerCase();
  assertCasePermissions({ user, caseDoc: moderationCase, action: normalizedAction });

  const actorId = user?._id || user?.id || null;
  const actorEmail = String(user?.email || "").toLowerCase();
  const previousStatus = String(moderationCase.status || "ALLOW");
  let nextStatus = previousStatus;
  let nextWorkflowState = String(moderationCase.workflowState || "OPEN");
  const normalizedReason = normalizeText(reason, 1000);
  const baselineAccess = moderationCase.subject?.baselineAccess || {};

  if (normalizedAction === "approve" || normalizedAction === "restore_content") {
    nextStatus = "ALLOW";
    nextWorkflowState = "RESOLVED";
    moderationCase.quarantine.isQuarantined = false;
    moderationCase.quarantine.quarantinedAt = null;
    moderationCase.publicWarningLabel = "";
  } else if (normalizedAction === "hold_for_review") {
    if (["suspected_child_exploitation", "explicit_pornography"].includes(String(moderationCase.queue || ""))) {
      const error = new Error("Hold for review is not allowed for suspected child exploitation or explicit adult content");
      error.status = 400;
      throw error;
    }
    nextStatus = "HOLD_FOR_REVIEW";
    nextWorkflowState = "UNDER_REVIEW";
    moderationCase.quarantine.isQuarantined = true;
    moderationCase.quarantine.quarantinedAt = moderationCase.quarantine.quarantinedAt || new Date();
  } else if (normalizedAction === "reject") {
    nextStatus = resolveRejectStatus(moderationCase);
    nextWorkflowState = "RESOLVED";
  } else if (normalizedAction === "delete_media") {
    nextStatus = resolveRejectStatus(moderationCase);
    nextWorkflowState = "RESOLVED";
  } else if (
    normalizedAction === "restrict_with_warning"
    || normalizedAction === "blur_preview"
  ) {
    if (["suspected_child_exploitation", "explicit_pornography"].includes(String(moderationCase.queue || ""))) {
      const error = new Error("Restricted blurred display is not allowed for sexual exploitation or explicit adult content");
      error.status = 400;
      throw error;
    }
    nextStatus = "RESTRICTED_BLURRED";
    nextWorkflowState = "RESOLVED";
    moderationCase.quarantine.isQuarantined = false;
    moderationCase.media = (Array.isArray(moderationCase.media) ? moderationCase.media : []).map(
      (asset) => ({
        ...asset,
        restrictedPreviewUrl:
          asset.restrictedPreviewUrl
          || buildRestrictedPreviewPath({
            req,
            category: moderationCase.queue,
            severity: moderationCase.severity,
          }),
      })
    );
  } else if (normalizedAction === "preserve_evidence") {
    moderationCase.evidence.preservedAt = new Date();
    moderationCase.evidence.preservedBy = actorId || null;
    moderationCase.evidence.notes = normalizedReason;
    nextWorkflowState = nextWorkflowState === "RESOLVED" ? "UNDER_REVIEW" : nextWorkflowState;
  } else if (normalizedAction === "escalate_case") {
    moderationCase.escalation.required = true;
    moderationCase.escalation.status = "escalated";
    moderationCase.escalation.escalatedAt = new Date();
    moderationCase.escalation.escalatedBy = actorId || null;
    moderationCase.escalation.notes = normalizedReason;
    nextWorkflowState = "ESCALATED";
  } else if (normalizedAction === "suspend_user") {
    await suspendUserAccount({
      targetUserId: moderationCase.uploader?.userId,
      actorId,
      reason: normalizedReason || "Suspended after moderation review",
      req,
    });
    await recordUserStrike({
      targetUserId: moderationCase.uploader?.userId,
      moderationCaseId: moderationCase._id,
      actionType: normalizedAction,
      reasonCategory: moderationCase.queue,
      severity: moderationCase.severity?.toLowerCase?.() || "high",
      actionTaken: "temporary_suspend",
      targetType: moderationCase.subject?.targetType,
      targetId: moderationCase.subject?.targetId,
      reason: normalizedReason,
      actorId,
      count: 1,
    });
    nextStatus = resolveRejectStatus(moderationCase);
    nextWorkflowState = "RESOLVED";
  } else if (normalizedAction === "ban_user") {
    await banUserAccount({
      targetUserId: moderationCase.uploader?.userId,
      actorId,
      reason: normalizedReason || "Banned after moderation review",
      req,
    });
    await recordUserStrike({
      targetUserId: moderationCase.uploader?.userId,
      moderationCaseId: moderationCase._id,
      actionType: normalizedAction,
      reasonCategory: moderationCase.queue,
      severity: "critical",
      actionTaken: "permanent_ban",
      targetType: moderationCase.subject?.targetType,
      targetId: moderationCase.subject?.targetId,
      reason: normalizedReason,
      actorId,
      count: 3,
    });
    nextStatus = "BLOCK_REPEAT_VIOLATOR";
    nextWorkflowState = "RESOLVED";
  } else {
    const error = new Error("Unsupported moderation action");
    error.status = 400;
    throw error;
  }

  moderationCase.status = nextStatus;
  moderationCase.workflowState = nextWorkflowState;
  moderationCase.reviewedBy = actorId || null;
  moderationCase.reviewedAt = new Date();
  moderationCase.reviewer = actorId || null;
  moderationCase.reviewerNote = normalizedReason;
  moderationCase.visibilityDecision =
    nextStatus === "ALLOW"
      ? "allowed"
      : nextStatus === "RESTRICTED_BLURRED"
        ? "restricted"
        : nextStatus === "HOLD_FOR_REVIEW"
          ? "review"
          : "blocked";
  moderationCase.latestDecisionSummary = {
    actionType: normalizedAction,
    adminUserId: actorId || null,
    adminEmail: actorEmail,
    previousStatus,
    newStatus: nextStatus,
    reason: normalizedReason,
    decidedAt: new Date(),
  };
  moderationCase.history.push({
    actionType: normalizedAction,
    adminUserId: actorId || null,
    adminEmail: actorEmail,
    previousStatus,
    newStatus: nextStatus,
    reason: normalizedReason,
    createdAt: new Date(),
  });

  await moderationCase.save();

  await applyModerationStatusToTarget({
    targetType: moderationCase.subject?.targetType,
    targetId: moderationCase.subject?.targetId,
    status: moderationCase.status,
    baselineAccess,
    moderationCaseId: moderationCase._id,
    sensitiveType: moderationCase.queue,
    blurPreviewUrl: moderationCase.media?.[0]?.restrictedPreviewUrl || "",
    action: normalizedAction,
  });

  await ModerationDecisionLog.create({
    moderationCaseId: moderationCase._id,
    adminUserId: actorId,
    adminEmail: actorEmail,
    actionType: normalizedAction,
    targetMediaId: moderationCase.media?.[0]?.mediaId || "",
    targetUserId: moderationCase.uploader?.userId || null,
    previousStatus,
    newStatus: nextStatus,
    reason: normalizedReason,
    metadata: metadata || {},
  });

  await syncLinkedReports({
    moderationCase,
    action: normalizedAction,
    actorId,
  });

  await writeAuditLog({
    req,
    actorId,
    action: `moderation.${normalizedAction}`,
    targetType: "ModerationCase",
    targetId: toId(moderationCase._id),
    reason: normalizedReason,
    metadata: {
      previousStatus,
      newStatus: nextStatus,
      targetUserId: toId(moderationCase.uploader?.userId),
      targetContentId: moderationCase.subject?.targetId || "",
    },
  }).catch(() => null);

  await sendModerationMessengerWarning({
    req,
    actor: user,
    recipientId: moderationCase.uploader?.userId || "",
    action: normalizedAction,
    reason: normalizedReason,
    scope: ["suspend_user", "ban_user"].includes(normalizedAction) ? "user" : "content",
    subjectTitle: moderationCase.subject?.title || moderationCase.queue || "",
    subjectDescription: moderationCase.subject?.description || "",
    labels: Array.isArray(moderationCase.labels) ? moderationCase.labels : [],
    clientSeed: toId(moderationCase._id),
  }).catch(() => null);

  if (normalizedAction === "escalate_case") {
    await maybeNotifyPrimaryAdmin({ moderationCase, req });
  }

  return buildAdminCasePayload(moderationCase.toObject(), user);
};

module.exports = {
  ACTIVE_REVIEW_STATES,
  assertCasePermissions,
  buildAdminCasePayload,
  buildCaseActionPermissions,
  buildCaseViewPermissions,
  buildPublicModerationOverlay: getPublicModerationOverlay,
  buildSourceReferenceHash,
  buildFingerprintHash,
  buildAvailableActions,
  createOrUpdateModerationCase,
  deriveBaselineAccess,
  filterPublicItems,
  generateModerationReviewUrl,
  getLatestCaseForTarget,
  getLatestCaseForMediaId,
  getLatestCaseMapForTargets,
  getModerationCaseDetail,
  getModerationCaseUploaderDetail,
  getModerationSummary,
  getPublicModerationOverlay,
  isHiddenFromPublic,
  isRestrictedForPublic,
  listModerationCases,
  mergeVisibilityWithModeration,
  performModerationAction,
  recordUserStrike,
  resolveRejectStatus,
  scanContentForModeration,
  suspendUserAccount,
  banUserAccount,
  analyzeImage,
};
