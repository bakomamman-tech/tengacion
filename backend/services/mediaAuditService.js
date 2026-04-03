const Album = require("../models/Album");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
const Message = require("../models/Message");
const Post = require("../models/Post");
const Story = require("../models/Story");
const Track = require("../models/Track");
const User = require("../models/User");
const Video = require("../models/Video");
const {
  isCloudinaryMediaValue,
  isLegacyLocalMediaValue,
  normalizeMediaValue,
} = require("../utils/userMedia");

const DEFAULT_TOTALS = Object.freeze({
  assets: 0,
  cloudinary: 0,
  legacyLocal: 0,
  otherRemote: 0,
  malformed: 0,
  empty: 0,
});

const toText = (value) => String(value || "").trim();

const toArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null) {
    return [];
  }
  return [value];
};

const hasMeaningfulRawValue = (value) => {
  if (value == null) {
    return false;
  }
  if (typeof value === "string") {
    return Boolean(toText(value));
  }
  if (typeof value !== "object") {
    return Boolean(value);
  }
  return Object.values(value).some((entry) => {
    if (Array.isArray(entry)) {
      return entry.some((item) => hasMeaningfulRawValue(item));
    }
    if (entry && typeof entry === "object") {
      return hasMeaningfulRawValue(entry);
    }
    return Boolean(toText(entry));
  });
};

const classifyMediaValue = (value) => {
  const normalized = normalizeMediaValue(value);
  const hasValue = Boolean(normalized.publicId || normalized.url || normalized.legacyPath);

  if (!hasValue) {
    return hasMeaningfulRawValue(value) ? "malformed" : "empty";
  }
  if (isCloudinaryMediaValue(normalized)) {
    return "cloudinary";
  }
  if (isLegacyLocalMediaValue(normalized)) {
    return "legacyLocal";
  }
  if (normalized.url) {
    return "otherRemote";
  }
  return "malformed";
};

const buildMediaIdentity = (value, fallbackKey = "") => {
  const normalized = normalizeMediaValue(value);
  if (normalized.publicId) {
    return `publicId:${normalized.publicId}`;
  }
  if (normalized.legacyPath) {
    return `legacy:${normalized.legacyPath}`;
  }
  if (normalized.url) {
    return `url:${normalized.url}`;
  }
  return fallbackKey;
};

const dedupeMediaValues = (values = []) => {
  const seen = new Set();
  return values.filter((value, index) => {
    const key = buildMediaIdentity(value, `empty:${index}`);
    if (!key) {
      return false;
    }
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const buildSourceSummary = (key, label, model) => ({
  key,
  label,
  modelName: model.modelName,
  documents: 0,
  ...DEFAULT_TOTALS,
});

const MEDIA_SOURCES = [
  {
    key: "users.profileMedia",
    label: "Users: avatar + cover",
    model: User,
    select: "avatar cover",
    extract(doc) {
      return [doc?.avatar, doc?.cover];
    },
  },
  {
    key: "posts.feedMedia",
    label: "Posts: media + video",
    model: Post,
    select: "media video",
    extract(doc) {
      return [...toArray(doc?.media), doc?.video];
    },
  },
  {
    key: "stories.media",
    label: "Stories",
    model: Story,
    select: "media mediaUrl image",
    extract(doc) {
      return [doc?.media || doc?.mediaUrl || doc?.image];
    },
  },
  {
    key: "tracks.creatorAudio",
    label: "Tracks and podcasts",
    model: Track,
    select:
      "audioMedia audioUrl previewMedia previewUrl coverMedia coverImageUrl coverUrl videoMedia videoUrl previewClipMedia previewClipUrl",
    extract(doc) {
      return [
        doc?.audioMedia || doc?.audioUrl,
        doc?.previewMedia || doc?.previewUrl,
        doc?.coverMedia || doc?.coverImageUrl || doc?.coverUrl,
        doc?.videoMedia || doc?.videoUrl,
        doc?.previewClipMedia || doc?.previewClipUrl,
      ];
    },
  },
  {
    key: "albums.musicCatalog",
    label: "Albums",
    model: Album,
    select: "coverMedia coverUrl tracks.trackMedia tracks.trackUrl tracks.previewMedia tracks.previewUrl",
    extract(doc) {
      const tracks = Array.isArray(doc?.tracks) ? doc.tracks : [];
      return [
        doc?.coverMedia || doc?.coverUrl,
        ...tracks.map((track) => track?.trackMedia || track?.trackUrl),
        ...tracks.map((track) => track?.previewMedia || track?.previewUrl),
      ];
    },
  },
  {
    key: "books.publisherMedia",
    label: "Books",
    model: Book,
    select: "coverMedia coverImageUrl coverUrl contentMedia contentUrl previewMedia previewUrl",
    extract(doc) {
      return [
        doc?.coverMedia || doc?.coverImageUrl || doc?.coverUrl,
        doc?.contentMedia || doc?.contentUrl,
        doc?.previewMedia || doc?.previewUrl,
      ];
    },
  },
  {
    key: "videos.creatorVideos",
    label: "Creator videos",
    model: Video,
    select: "videoMedia videoUrl coverMedia coverImageUrl previewClipMedia previewClipUrl",
    extract(doc) {
      return [
        doc?.videoMedia || doc?.videoUrl,
        doc?.coverMedia || doc?.coverImageUrl,
        doc?.previewClipMedia || doc?.previewClipUrl,
      ];
    },
  },
  {
    key: "messages.attachments",
    label: "Messages: attachments",
    model: Message,
    select: "attachments",
    extract(doc) {
      return Array.isArray(doc?.attachments) ? doc.attachments : [];
    },
  },
  {
    key: "creatorProfiles.branding",
    label: "Creator profiles: cover + banner",
    model: CreatorProfile,
    select: "coverImageUrl heroBannerUrl",
    extract(doc) {
      return [doc?.coverImageUrl, doc?.heroBannerUrl];
    },
  },
];

const auditMediaSource = async ({ key, label, model, select, extract }) => {
  const summary = buildSourceSummary(key, label, model);
  const cursor = model.find({}, select).lean().cursor();

  for await (const doc of cursor) {
    summary.documents += 1;
    const values = dedupeMediaValues(extract(doc).filter((entry) => entry != null));
    values.forEach((value) => {
      const kind = classifyMediaValue(value);
      summary[kind] += 1;
      if (kind !== "empty") {
        summary.assets += 1;
      }
    });
  }

  return summary;
};

const getMediaAuditSummary = async () => {
  const bySource = [];
  for (const source of MEDIA_SOURCES) {
    bySource.push(await auditMediaSource(source));
  }

  const totals = bySource.reduce(
    (accumulator, row) => ({
      assets: accumulator.assets + (row.assets || 0),
      cloudinary: accumulator.cloudinary + (row.cloudinary || 0),
      legacyLocal: accumulator.legacyLocal + (row.legacyLocal || 0),
      otherRemote: accumulator.otherRemote + (row.otherRemote || 0),
      malformed: accumulator.malformed + (row.malformed || 0),
      empty: accumulator.empty + (row.empty || 0),
    }),
    { ...DEFAULT_TOTALS }
  );

  return {
    totals,
    bySource: bySource.sort((left, right) => (right.assets || 0) - (left.assets || 0)),
  };
};

module.exports = {
  MEDIA_SOURCES,
  classifyMediaValue,
  getMediaAuditSummary,
};
