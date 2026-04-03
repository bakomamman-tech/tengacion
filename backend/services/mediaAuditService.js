const Album = require("../models/Album");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
const Message = require("../models/Message");
const Post = require("../models/Post");
const Room = require("../models/Room");
const RoomMessage = require("../models/RoomMessage");
const Story = require("../models/Story");
const Track = require("../models/Track");
const User = require("../models/User");
const Video = require("../models/Video");
const {
  inferCloudinaryPublicIdFromUrl,
  isCloudinaryUrl,
  normalizeMediaValue,
} = require("../utils/userMedia");

const DEFAULT_SAMPLE_LIMIT = 10;
const MAX_DEPTH = 8;
const MEDIAISH_KEY_PATTERN =
  /(avatar|profile|cover|banner|hero|image|video|audio|media|file|thumbnail|preview|playback|artwork|poster|attachment|track|content|transcript|source|url|path|public_?id|provider|legacy)/i;
const CLOUDINARY_PROVIDER_PATTERN = /^cloudinary$/i;
const HTTP_URL_PATTERN = /^https?:\/\//i;
const BLOB_OR_DATA_URL_PATTERN = /^(?:blob:|data:)/i;
const INTERNAL_MEDIA_ROUTE_PATTERN = /^\/?api\/media(?:\/|$)/i;
const LEGACY_UPLOAD_PATTERN = /(^|\/)(?:public\/)?uploads(\/|$)/i;
const ABS_LOCAL_PATH_PATTERN = /^(?:[a-z]:\\|\/(?:var|srv|home|tmp|opt|app|usr|uploads|public)\/)/i;
const LOCAL_RELATIVE_MEDIA_PATTERN =
  /^(?![a-z][a-z0-9+.-]*:)(?!\/\/)(?:\.{1,2}[\\/])?[^?#]+\.(?:aac|aiff|avi|avif|bmp|doc|docx|epub|flac|gif|heic|jpeg|jpg|m4a|m4v|mobi|mov|mp3|mp4|ogg|pdf|png|svg|txt|wav|webm|webp)(?:[?#].*)?$/i;
const MEDIA_OBJECT_HINT_KEYS = new Set([
  "attachment",
  "attachments",
  "audio",
  "audioMedia",
  "audioUrl",
  "avatar",
  "banner",
  "contentMedia",
  "contentUrl",
  "cover",
  "coverImage",
  "coverImageUrl",
  "coverMedia",
  "coverPhoto",
  "coverUrl",
  "file",
  "fileUrl",
  "heroBannerUrl",
  "image",
  "images",
  "legacyPath",
  "media",
  "mediaUrl",
  "mediaUrls",
  "path",
  "playbackUrl",
  "poster",
  "preview",
  "previewClipMedia",
  "previewClipUrl",
  "previewMedia",
  "previewUrl",
  "profilePicture",
  "provider",
  "publicId",
  "public_id",
  "secureUrl",
  "secure_url",
  "sourceUrl",
  "thumbnail",
  "thumbnailUrl",
  "trackMedia",
  "trackUrl",
  "transcriptMedia",
  "transcriptUrl",
  "url",
  "video",
  "videoMedia",
  "videoUrl",
]);

const DEFAULT_REPORT_TOTALS = Object.freeze({
  totalScanned: 0,
  withMedia: 0,
  noMedia: 0,
  cloudinary: 0,
  legacyLocal: 0,
  mixed: 0,
  unknown: 0,
  otherRemote: 0,
});

const toText = (value) => {
  if (value == null) {
    return "";
  }
  return String(value).trim();
};

const isPlainObject = (value) =>
  Boolean(value) && Object.prototype.toString.call(value) === "[object Object]";

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
  if (Array.isArray(value)) {
    return value.some((entry) => hasMeaningfulRawValue(entry));
  }
  if (typeof value !== "object") {
    return Boolean(value);
  }

  return Object.values(value).some((entry) => hasMeaningfulRawValue(entry));
};

const getPathKeyHint = (path = "") => {
  const normalized = String(path || "").replace(/\[\d+\]/g, "");
  const parts = normalized.split(".").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
};

const isLikelyLocalMediaString = (value = "") => {
  const text = toText(value);
  if (!text) {
    return false;
  }
  if (isCloudinaryUrl(text) || HTTP_URL_PATTERN.test(text) || BLOB_OR_DATA_URL_PATTERN.test(text)) {
    return false;
  }
  if (INTERNAL_MEDIA_ROUTE_PATTERN.test(text) || LEGACY_UPLOAD_PATTERN.test(text)) {
    return true;
  }
  if (ABS_LOCAL_PATH_PATTERN.test(text)) {
    return true;
  }
  return LOCAL_RELATIVE_MEDIA_PATTERN.test(text);
};

const isCloudinaryMedia = (value) => {
  const normalized = normalizeMediaValue(value);
  return Boolean(
    normalized.provider === "cloudinary"
      || normalized.publicId
      || isCloudinaryUrl(normalized.secureUrl || normalized.url)
      || CLOUDINARY_PROVIDER_PATTERN.test(toText(value?.provider))
      || inferCloudinaryPublicIdFromUrl(toText(value?.secureUrl || value?.secure_url || value?.url))
  );
};

const isLegacyLocalMedia = (value) => {
  const normalized = normalizeMediaValue(value);
  const directPath =
    normalized.legacyPath
    || toText(value?.legacyPath || value?.path || value?.filePath)
    || toText(value);
  const publicId = toText(value?.publicId || value?.public_id || normalized.publicId);
  return Boolean(!publicId && isLikelyLocalMediaString(directPath));
};

const createInspectionAccumulator = () => ({
  statuses: {
    cloudinary: false,
    legacyLocal: false,
    otherRemote: false,
    unknown: false,
  },
  fields: {
    cloudinary: new Set(),
    legacyLocal: new Set(),
    otherRemote: new Set(),
    unknown: new Set(),
  },
});

const mergeInspectionAccumulators = (...accumulators) => {
  const merged = createInspectionAccumulator();
  accumulators.filter(Boolean).forEach((accumulator) => {
    Object.keys(merged.statuses).forEach((key) => {
      merged.statuses[key] = merged.statuses[key] || Boolean(accumulator?.statuses?.[key]);
      (accumulator?.fields?.[key] || []).forEach((field) => merged.fields[key].add(field));
    });
  });
  return merged;
};

const addInspectionStatus = (accumulator, status, fieldPath = "") => {
  if (!accumulator || !status || status === "empty") {
    return accumulator;
  }
  accumulator.statuses[status] = true;
  if (fieldPath) {
    accumulator.fields[status].add(fieldPath);
  }
  return accumulator;
};

const finalizeInspection = (accumulator = createInspectionAccumulator(), fieldPath = "") => {
  const status = (() => {
    if (accumulator.statuses.cloudinary && accumulator.statuses.legacyLocal) {
      return "mixed";
    }
    if (accumulator.statuses.legacyLocal) {
      return "legacyLocal";
    }
    if (accumulator.statuses.cloudinary) {
      return "cloudinary";
    }
    if (accumulator.statuses.otherRemote && accumulator.statuses.unknown) {
      return "unknown";
    }
    if (accumulator.statuses.otherRemote) {
      return "otherRemote";
    }
    if (accumulator.statuses.unknown) {
      return "unknown";
    }
    return "empty";
  })();

  return {
    field: fieldPath,
    status,
    statuses: { ...accumulator.statuses },
    fields: Object.fromEntries(
      Object.entries(accumulator.fields).map(([key, set]) => [key, Array.from(set)])
    ),
  };
};

const inspectStringValue = (value, fieldPath = "", keyHint = "") => {
  const text = toText(value);
  const accumulator = createInspectionAccumulator();
  if (!text) {
    return finalizeInspection(accumulator, fieldPath);
  }

  const normalizedKey = toText(keyHint).toLowerCase();
  if (normalizedKey === "provider") {
    if (CLOUDINARY_PROVIDER_PATTERN.test(text)) {
      addInspectionStatus(accumulator, "cloudinary", fieldPath);
    } else {
      addInspectionStatus(accumulator, "unknown", fieldPath);
    }
    return finalizeInspection(accumulator, fieldPath);
  }

  if (normalizedKey === "publicid" || normalizedKey === "public_id") {
    addInspectionStatus(accumulator, "cloudinary", fieldPath);
    return finalizeInspection(accumulator, fieldPath);
  }

  if (isCloudinaryUrl(text)) {
    addInspectionStatus(accumulator, "cloudinary", fieldPath);
    return finalizeInspection(accumulator, fieldPath);
  }

  if (isLikelyLocalMediaString(text)) {
    addInspectionStatus(accumulator, "legacyLocal", fieldPath);
    return finalizeInspection(accumulator, fieldPath);
  }

  if (HTTP_URL_PATTERN.test(text)) {
    addInspectionStatus(accumulator, "otherRemote", fieldPath);
    return finalizeInspection(accumulator, fieldPath);
  }

  if (BLOB_OR_DATA_URL_PATTERN.test(text)) {
    addInspectionStatus(accumulator, "unknown", fieldPath);
    return finalizeInspection(accumulator, fieldPath);
  }

  if (MEDIAISH_KEY_PATTERN.test(normalizedKey)) {
    addInspectionStatus(accumulator, "unknown", fieldPath);
  }
  return finalizeInspection(accumulator, fieldPath);
};

const looksLikeMediaObject = (value) => {
  if (!isPlainObject(value)) {
    return false;
  }
  return Object.keys(value).some((key) => {
    if (MEDIA_OBJECT_HINT_KEYS.has(key)) {
      return true;
    }
    return MEDIAISH_KEY_PATTERN.test(key);
  });
};

const inspectMediaFieldInternal = (value, fieldPath = "", depth = 0) => {
  if (depth > MAX_DEPTH) {
    const accumulator = createInspectionAccumulator();
    addInspectionStatus(accumulator, "unknown", fieldPath);
    return finalizeInspection(accumulator, fieldPath);
  }

  if (value == null) {
    return finalizeInspection(createInspectionAccumulator(), fieldPath);
  }

  if (typeof value === "string") {
    return inspectStringValue(value, fieldPath, getPathKeyHint(fieldPath));
  }

  if (Array.isArray(value)) {
    const merged = mergeInspectionAccumulators(
      ...value.map((entry, index) =>
        inspectMediaFieldInternal(entry, `${fieldPath}[${index}]`, depth + 1)
      )
    );
    if (!value.length) {
      return finalizeInspection(createInspectionAccumulator(), fieldPath);
    }
    return finalizeInspection(merged, fieldPath);
  }

  if (typeof value !== "object") {
    const accumulator = createInspectionAccumulator();
    addInspectionStatus(accumulator, "unknown", fieldPath);
    return finalizeInspection(accumulator, fieldPath);
  }

  const normalized = normalizeMediaValue(value);
  const direct = createInspectionAccumulator();
  const directUrl = toText(
    value?.secureUrl
      || value?.secure_url
      || value?.url
      || value?.path
      || value?.legacyPath
      || normalized.secureUrl
      || normalized.url
      || normalized.legacyPath
  );
  const directPublicId = toText(
    value?.publicId
      || value?.public_id
      || normalized.publicId
      || inferCloudinaryPublicIdFromUrl(directUrl)
  );
  const directProvider = toText(value?.provider || normalized.provider).toLowerCase();

  if (directProvider === "cloudinary" || directPublicId || isCloudinaryUrl(directUrl)) {
    addInspectionStatus(direct, "cloudinary", fieldPath);
  }
  if (!directPublicId && isLikelyLocalMediaString(directUrl)) {
    addInspectionStatus(direct, "legacyLocal", fieldPath);
  }
  if (!directPublicId && !isLikelyLocalMediaString(directUrl) && HTTP_URL_PATTERN.test(directUrl)) {
    addInspectionStatus(direct, "otherRemote", fieldPath);
  }
  if (!directPublicId && directUrl && BLOB_OR_DATA_URL_PATTERN.test(directUrl)) {
    addInspectionStatus(direct, "unknown", fieldPath);
  }

  const nestedResults = [];
  for (const [key, child] of Object.entries(value)) {
    const childPath = fieldPath ? `${fieldPath}.${key}` : key;
    if (child == null) {
      continue;
    }
    if (Array.isArray(child) || isPlainObject(child)) {
      nestedResults.push(inspectMediaFieldInternal(child, childPath, depth + 1));
      continue;
    }
    if (typeof child === "string" && MEDIAISH_KEY_PATTERN.test(key)) {
      nestedResults.push(inspectStringValue(child, childPath, key));
    }
  }

  const merged = mergeInspectionAccumulators(direct, ...nestedResults);
  const finalized = finalizeInspection(merged, fieldPath);
  if (finalized.status !== "empty") {
    return finalized;
  }

  if (looksLikeMediaObject(value) && hasMeaningfulRawValue(value)) {
    const fallback = createInspectionAccumulator();
    addInspectionStatus(fallback, "unknown", fieldPath);
    return finalizeInspection(fallback, fieldPath);
  }

  return finalized;
};

const inspectMediaField = (value, fieldPath = "") =>
  inspectMediaFieldInternal(value, fieldPath, 0);

const toFieldEntries = (doc, source) => {
  if (!source) {
    return [];
  }

  if (typeof source.extract === "function") {
    return toArray(source.extract(doc))
      .filter(Boolean)
      .map((entry, index) => {
        if (entry && typeof entry === "object" && "field" in entry && "value" in entry) {
          return {
            field: toText(entry.field) || `${source.model.modelName}.field[${index}]`,
            value: entry.value,
          };
        }
        return {
          field: `${source.model.modelName}.field[${index}]`,
          value: entry,
        };
      });
  }

  return [];
};

const createSample = (doc, fieldNames = []) => ({
  id: toText(doc?._id),
  fields: Array.from(new Set((fieldNames || []).filter(Boolean))).slice(0, 20),
});

const classifyRecordMedia = (doc, source, options = {}) => {
  const fieldEntries = toFieldEntries(doc, source);
  const inspections = fieldEntries.map((entry) => inspectMediaField(entry.value, entry.field));

  const cloudinaryFields = new Set();
  const legacyFields = new Set();
  const otherRemoteFields = new Set();
  const unknownFields = new Set();

  inspections.forEach((inspection) => {
    (inspection.fields.cloudinary || []).forEach((field) => cloudinaryFields.add(field));
    (inspection.fields.legacyLocal || []).forEach((field) => legacyFields.add(field));
    (inspection.fields.otherRemote || []).forEach((field) => otherRemoteFields.add(field));
    (inspection.fields.unknown || []).forEach((field) => unknownFields.add(field));
  });

  const hasCloudinary = cloudinaryFields.size > 0;
  const hasLegacy = legacyFields.size > 0;
  const hasOtherRemote = otherRemoteFields.size > 0;
  const hasUnknown = unknownFields.size > 0;
  const hasMedia = hasCloudinary || hasLegacy || hasOtherRemote || hasUnknown;

  const status = (() => {
    if (hasCloudinary && hasLegacy) {
      return "mixed";
    }
    if (hasLegacy) {
      return "legacyLocal";
    }
    if (hasCloudinary) {
      return "cloudinary";
    }
    if (hasUnknown) {
      return "unknown";
    }
    if (hasOtherRemote) {
      return "otherRemote";
    }
    return "noMedia";
  })();

  return {
    id: toText(doc?._id),
    status,
    hasMedia,
    inspections,
    fieldNames: Array.from(
      new Set([
        ...cloudinaryFields,
        ...legacyFields,
        ...otherRemoteFields,
        ...unknownFields,
      ])
    ),
    cloudinaryFields: Array.from(cloudinaryFields),
    legacyFields: Array.from(legacyFields),
    otherRemoteFields: Array.from(otherRemoteFields),
    unknownFields: Array.from(unknownFields),
    sampleLimit: Math.max(1, Number(options.sampleLimit) || DEFAULT_SAMPLE_LIMIT),
  };
};

const createModelReport = (source, sampleLimit = DEFAULT_SAMPLE_LIMIT) => ({
  key: source.key,
  label: source.label,
  modelName: source.model.modelName,
  totalScanned: 0,
  withMedia: 0,
  noMedia: 0,
  cloudinary: 0,
  legacyLocal: 0,
  mixed: 0,
  unknown: 0,
  otherRemote: 0,
  sampleLimit,
  sampleLegacyRecords: [],
  sampleMixedRecords: [],
  sampleUnknownRecords: [],
  legacyFieldCounts: {},
});

const maybePushSample = (list, sampleLimit, sample) => {
  if (!Array.isArray(list) || list.length >= sampleLimit || !sample?.id) {
    return;
  }
  list.push(sample);
};

const recordLegacyFields = (report, fields = []) => {
  fields.forEach((field) => {
    const key = toText(field);
    if (!key) {
      return;
    }
    report.legacyFieldCounts[key] = (report.legacyFieldCounts[key] || 0) + 1;
  });
};

const LEGACY_MEDIA_SOURCES = [
  {
    key: "User",
    label: "User",
    model: User,
    select: "avatar cover",
    extract(doc) {
      return [
        { field: "avatar", value: doc?.avatar },
        { field: "cover", value: doc?.cover },
      ];
    },
  },
  {
    key: "Post",
    label: "Post",
    model: Post,
    select:
      "media video audio.url audio.previewUrl audio.coverImageUrl sharedPost.previewImage sharedPost.originalAuthorAvatar",
    extract(doc) {
      return [
        { field: "media", value: doc?.media },
        { field: "video", value: doc?.video },
        { field: "audio.url", value: doc?.audio?.url },
        { field: "audio.previewUrl", value: doc?.audio?.previewUrl },
        { field: "audio.coverImageUrl", value: doc?.audio?.coverImageUrl },
        { field: "sharedPost.previewImage", value: doc?.sharedPost?.previewImage },
        { field: "sharedPost.originalAuthorAvatar", value: doc?.sharedPost?.originalAuthorAvatar },
      ];
    },
  },
  {
    key: "Story",
    label: "Story",
    model: Story,
    select: "avatar image media mediaUrl thumbnailUrl musicAttachment.coverImage musicAttachment.sourceUrl",
    extract(doc) {
      return [
        { field: "avatar", value: doc?.avatar },
        { field: "image", value: doc?.image },
        { field: "media", value: doc?.media },
        { field: "mediaUrl", value: doc?.mediaUrl },
        { field: "thumbnailUrl", value: doc?.thumbnailUrl },
        { field: "musicAttachment.coverImage", value: doc?.musicAttachment?.coverImage },
        { field: "musicAttachment.sourceUrl", value: doc?.musicAttachment?.sourceUrl },
      ];
    },
  },
  {
    key: "CreatorProfile",
    label: "CreatorProfile",
    model: CreatorProfile,
    select: "coverImageUrl heroBannerUrl",
    extract(doc) {
      return [
        { field: "coverImageUrl", value: doc?.coverImageUrl },
        { field: "heroBannerUrl", value: doc?.heroBannerUrl },
      ];
    },
  },
  {
    key: "Track",
    label: "Track",
    model: Track,
    select:
      "audioMedia audioUrl fullAudioUrl previewMedia previewUrl previewSampleUrl coverMedia coverImageUrl coverUrl videoMedia videoUrl previewClipMedia previewClipUrl transcriptMedia transcriptUrl",
    extract(doc) {
      return [
        { field: "audioMedia", value: doc?.audioMedia },
        { field: "audioUrl", value: doc?.audioUrl },
        { field: "fullAudioUrl", value: doc?.fullAudioUrl },
        { field: "previewMedia", value: doc?.previewMedia },
        { field: "previewUrl", value: doc?.previewUrl },
        { field: "previewSampleUrl", value: doc?.previewSampleUrl },
        { field: "coverMedia", value: doc?.coverMedia },
        { field: "coverImageUrl", value: doc?.coverImageUrl },
        { field: "coverUrl", value: doc?.coverUrl },
        { field: "videoMedia", value: doc?.videoMedia },
        { field: "videoUrl", value: doc?.videoUrl },
        { field: "previewClipMedia", value: doc?.previewClipMedia },
        { field: "previewClipUrl", value: doc?.previewClipUrl },
        { field: "transcriptMedia", value: doc?.transcriptMedia },
        { field: "transcriptUrl", value: doc?.transcriptUrl },
      ];
    },
  },
  {
    key: "Book",
    label: "Book",
    model: Book,
    select: "coverMedia coverImageUrl coverUrl contentMedia contentUrl fileUrl previewMedia previewUrl",
    extract(doc) {
      return [
        { field: "coverMedia", value: doc?.coverMedia },
        { field: "coverImageUrl", value: doc?.coverImageUrl },
        { field: "coverUrl", value: doc?.coverUrl },
        { field: "contentMedia", value: doc?.contentMedia },
        { field: "contentUrl", value: doc?.contentUrl },
        { field: "fileUrl", value: doc?.fileUrl },
        { field: "previewMedia", value: doc?.previewMedia },
        { field: "previewUrl", value: doc?.previewUrl },
      ];
    },
  },
  {
    key: "Album",
    label: "Album",
    model: Album,
    select: "coverMedia coverUrl tracks.trackMedia tracks.trackUrl tracks.previewMedia tracks.previewUrl",
    extract(doc) {
      const tracks = Array.isArray(doc?.tracks) ? doc.tracks : [];
      const entries = [
        { field: "coverMedia", value: doc?.coverMedia },
        { field: "coverUrl", value: doc?.coverUrl },
      ];
      tracks.forEach((track, index) => {
        entries.push({ field: `tracks[${index}].trackMedia`, value: track?.trackMedia });
        entries.push({ field: `tracks[${index}].trackUrl`, value: track?.trackUrl });
        entries.push({ field: `tracks[${index}].previewMedia`, value: track?.previewMedia });
        entries.push({ field: `tracks[${index}].previewUrl`, value: track?.previewUrl });
      });
      return entries;
    },
  },
  {
    key: "Video",
    label: "Video",
    model: Video,
    select: "videoMedia videoUrl coverMedia coverImageUrl previewClipMedia previewClipUrl",
    extract(doc) {
      return [
        { field: "videoMedia", value: doc?.videoMedia },
        { field: "videoUrl", value: doc?.videoUrl },
        { field: "coverMedia", value: doc?.coverMedia },
        { field: "coverImageUrl", value: doc?.coverImageUrl },
        { field: "previewClipMedia", value: doc?.previewClipMedia },
        { field: "previewClipUrl", value: doc?.previewClipUrl },
      ];
    },
  },
  {
    key: "Message",
    label: "Message",
    model: Message,
    select: "attachments",
    extract(doc) {
      return [{ field: "attachments", value: doc?.attachments }];
    },
  },
  {
    key: "Room",
    label: "Room",
    model: Room,
    select: "cover",
    extract(doc) {
      return [{ field: "cover", value: doc?.cover }];
    },
  },
  {
    key: "RoomMessage",
    label: "RoomMessage",
    model: RoomMessage,
    select: "attachments",
    extract(doc) {
      return [{ field: "attachments", value: doc?.attachments }];
    },
  },
];

const normalizeModelFilter = (value = "") =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

const filterMediaSources = ({ model } = {}) => {
  const filters = normalizeModelFilter(model);
  if (!filters.length) {
    return LEGACY_MEDIA_SOURCES;
  }
  return LEGACY_MEDIA_SOURCES.filter((source) =>
    filters.includes(source.model.modelName.toLowerCase()) || filters.includes(source.key.toLowerCase())
  );
};

const scanLegacyMediaSource = async (source, options = {}) => {
  const sampleLimit = Math.max(1, Number(options.sampleLimit) || DEFAULT_SAMPLE_LIMIT);
  const report = createModelReport(source, sampleLimit);
  const cursor = source.model.find({}, source.select).lean().cursor();

  for await (const doc of cursor) {
    report.totalScanned += 1;
    const record = classifyRecordMedia(doc, source, { sampleLimit });
    report[record.status] += 1;
    if (record.hasMedia) {
      report.withMedia += 1;
    }

    if (record.status === "legacyLocal") {
      recordLegacyFields(report, record.legacyFields);
      maybePushSample(report.sampleLegacyRecords, sampleLimit, createSample(doc, record.legacyFields));
    }
    if (record.status === "mixed") {
      recordLegacyFields(report, record.legacyFields);
      maybePushSample(
        report.sampleMixedRecords,
        sampleLimit,
        createSample(doc, [...record.legacyFields, ...record.cloudinaryFields])
      );
    }
    if (record.status === "unknown") {
      maybePushSample(report.sampleUnknownRecords, sampleLimit, createSample(doc, record.unknownFields));
    }
  }

  report.legacyFieldCounts = Object.entries(report.legacyFieldCounts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([field, count]) => ({ field, count }));

  return report;
};

const mergeReportTotals = (...reports) =>
  reports.reduce(
    (accumulator, report) => ({
      totalScanned: accumulator.totalScanned + (report.totalScanned || 0),
      withMedia: accumulator.withMedia + (report.withMedia || 0),
      noMedia: accumulator.noMedia + (report.noMedia || 0),
      cloudinary: accumulator.cloudinary + (report.cloudinary || 0),
      legacyLocal: accumulator.legacyLocal + (report.legacyLocal || 0),
      mixed: accumulator.mixed + (report.mixed || 0),
      unknown: accumulator.unknown + (report.unknown || 0),
      otherRemote: accumulator.otherRemote + (report.otherRemote || 0),
    }),
    { ...DEFAULT_REPORT_TOTALS }
  );

const getLegacyMediaReport = async (options = {}) => {
  const sources = filterMediaSources(options);
  const sampleLimit = Math.max(1, Number(options.sampleLimit) || DEFAULT_SAMPLE_LIMIT);
  const models = [];

  for (const source of sources) {
    models.push(await scanLegacyMediaSource(source, { sampleLimit }));
  }

  return {
    generatedAt: new Date().toISOString(),
    sampleLimit,
    modelFilter: normalizeModelFilter(options.model),
    models: models.sort((left, right) => right.legacyLocal - left.legacyLocal || right.mixed - left.mixed),
    grandTotals: mergeReportTotals(...models),
  };
};

const getMediaAuditSummary = async (options = {}) => {
  const report = await getLegacyMediaReport(options);
  return {
    totals: {
      assets: report.grandTotals.withMedia,
      cloudinary: report.grandTotals.cloudinary,
      legacyLocal: report.grandTotals.legacyLocal,
      mixed: report.grandTotals.mixed,
      otherRemote: report.grandTotals.otherRemote,
      malformed: report.grandTotals.unknown,
      empty: report.grandTotals.noMedia,
      totalScanned: report.grandTotals.totalScanned,
    },
    bySource: report.models.map((model) => ({
      key: model.key,
      label: model.label,
      modelName: model.modelName,
      documents: model.totalScanned,
      assets: model.withMedia,
      cloudinary: model.cloudinary,
      legacyLocal: model.legacyLocal,
      mixed: model.mixed,
      otherRemote: model.otherRemote,
      malformed: model.unknown,
      sampleLegacyRecords: model.sampleLegacyRecords,
    })),
  };
};

module.exports = {
  DEFAULT_SAMPLE_LIMIT,
  LEGACY_MEDIA_SOURCES,
  classifyRecordMedia,
  filterMediaSources,
  getLegacyMediaReport,
  getMediaAuditSummary,
  inspectMediaField,
  isCloudinaryMedia,
  isLegacyLocalMedia,
};
