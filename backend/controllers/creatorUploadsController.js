const asyncHandler = require("../middleware/asyncHandler");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
const Post = require("../models/Post");
const Track = require("../models/Track");
const { saveUploadedFile } = require("../services/mediaStore");
const { logAnalyticsEvent } = require("../services/analyticsService");
const { evaluateVerification } = require("../services/contentVerificationService");
const { creatorHasCategory } = require("../services/creatorProfileService");
const {
  AUDIO_EXTENSIONS,
  AUDIO_MIME_TYPES,
  BOOK_EXTENSIONS,
  BOOK_MIME_TYPES,
  IMAGE_EXTENSIONS,
  IMAGE_MIME_TYPES,
  TRANSCRIPT_EXTENSIONS,
  TRANSCRIPT_MIME_TYPES,
  bookUploadSchema,
  getExtension,
  inferBookFormatFromFile,
  musicUploadSchema,
  parsePayload,
  podcastUploadSchema,
  validateFile,
} = require("../services/creatorUploadValidation");

const toTrackPayload = (track, { includeAudio = false } = {}) => ({
  _id: track._id.toString(),
  creatorId: track.creatorId?._id?.toString() || track.creatorId?.toString() || "",
  title: track.title || "",
  description: track.description || "",
  price: Number(track.price) || 0,
  genre: track.genre || "",
  artistName: track.artistName || "",
  releaseType: track.releaseType || "single",
  explicitContent: Boolean(track.explicitContent),
  featuringArtists: Array.isArray(track.featuringArtists) ? track.featuringArtists : [],
  producerCredits: Array.isArray(track.producerCredits) ? track.producerCredits : [],
  songwriterCredits: Array.isArray(track.songwriterCredits) ? track.songwriterCredits : [],
  releaseDate: track.releaseDate || null,
  lyrics: track.lyrics || "",
  audioFormat: track.audioFormat || "",
  previewUrl: track.previewUrl || "",
  coverImageUrl: track.coverImageUrl || "",
  durationSec: Number(track.durationSec) || 0,
  createdAt: track.createdAt,
  updatedAt: track.updatedAt,
  publishedStatus: track.publishedStatus || (track.isPublished ? "published" : "draft"),
  copyrightScanStatus: track.copyrightScanStatus || "pending_scan",
  verificationNotes: track.verificationNotes || "",
  reviewRequired: Boolean(track.reviewRequired),
  creatorCategory: track.creatorCategory || (track.kind === "podcast" ? "podcasts" : "music"),
  contentType: track.contentType || (track.kind === "podcast" ? "podcast_episode" : "track"),
  podcastSeries: track.podcastSeries || "",
  seasonNumber: Number(track.seasonNumber || 0),
  episodeNumber: Number(track.episodeNumber || 0),
  podcastCategory: track.podcastCategory || "",
  episodeType: track.episodeType || "free",
  guestNames: Array.isArray(track.guestNames) ? track.guestNames : [],
  showNotes: track.showNotes || "",
  transcriptUrl: track.transcriptUrl || "",
  episodeTags: Array.isArray(track.episodeTags) ? track.episodeTags : [],
  creator:
    track.creatorId && typeof track.creatorId === "object"
      ? {
          _id: track.creatorId._id?.toString() || "",
          displayName: track.creatorId.displayName || "",
          userId: track.creatorId.userId?._id?.toString() || track.creatorId.userId?.toString() || "",
          username: track.creatorId.userId?.username || "",
        }
      : null,
  ...(includeAudio ? { audioUrl: track.audioUrl || "" } : {}),
});

const toBookPayload = (book) => ({
  _id: book._id.toString(),
  creatorId: book.creatorId?._id?.toString() || book.creatorId?.toString() || "",
  title: book.title || "",
  authorName: book.authorName || "",
  subtitle: book.subtitle || "",
  description: book.description || "",
  price: Number(book.price) || 0,
  genre: book.genre || "",
  language: book.language || "",
  pageCount: Number(book.pageCount || 0),
  isbn: book.isbn || "",
  edition: book.edition || "",
  audience: book.audience || "",
  readingAge: book.readingAge || "",
  tableOfContents: book.tableOfContents || "",
  coverImageUrl: book.coverImageUrl || "",
  contentUrl: book.contentUrl || "",
  previewUrl: book.previewUrl || "",
  fileFormat: book.fileFormat || "",
  createdAt: book.createdAt,
  updatedAt: book.updatedAt,
  publishedStatus: book.publishedStatus || (book.isPublished ? "published" : "draft"),
  copyrightScanStatus: book.copyrightScanStatus || "pending_scan",
  verificationNotes: book.verificationNotes || "",
  reviewRequired: Boolean(book.reviewRequired),
  creatorCategory: "books",
  contentType: book.contentType || "ebook",
  copyrightDeclared: Boolean(book.copyrightDeclared),
  creator:
    book.creatorId && typeof book.creatorId === "object"
      ? {
          _id: book.creatorId._id?.toString() || "",
          displayName: book.creatorId.displayName || "",
          userId: book.creatorId.userId?._id?.toString() || book.creatorId.userId?.toString() || "",
          username: book.creatorId.userId?.username || "",
        }
      : null,
});

const loadCreatorName = async (creatorProfileId) => {
  const profile = await CreatorProfile.findById(creatorProfileId).select("displayName fullName").lean();
  return profile?.displayName || profile?.fullName || "";
};

const hydrateTrack = (trackId) =>
  Track.findById(trackId)
    .populate({
      path: "creatorId",
      select: "displayName userId",
      populate: { path: "userId", select: "username" },
    })
    .lean();

const hydrateBook = (bookId) =>
  Book.findById(bookId)
    .populate({
      path: "creatorId",
      select: "displayName userId",
      populate: { path: "userId", select: "username" },
    })
    .lean();

const inferAudioFormat = (file) => {
  const extension = getExtension(file);
  return extension ? extension.slice(1) : String(file?.mimetype || "").split("/")[1] || "";
};

const sendBadRequest = (res, error) => res.status(400).json({ error });

const maybeCreateAudioPost = async ({
  authorId,
  tags,
  trackId = null,
  title,
  audioUrl,
  previewUrl,
  durationSec,
  coverImageUrl,
}) => {
  await Post.create({
    author: authorId,
    text: `${title} is now available.`,
    tags,
    audio: {
      ...(trackId ? { trackId } : {}),
      url: audioUrl,
      previewUrl,
      title,
      durationSec: Number.isFinite(durationSec) ? durationSec : 0,
      coverImageUrl,
    },
    privacy: "public",
  });
};

exports.createMusicUpload = asyncHandler(async (req, res) => {
  if (!creatorHasCategory(req.creatorProfile, "music")) {
    return res.status(403).json({ error: "Music publishing is not enabled on this creator profile" });
  }

  const parsed = parsePayload(musicUploadSchema, req.body);
  if (!parsed.ok) {
    return sendBadRequest(res, parsed.error);
  }

  const audioFile = req.files?.audio?.[0] || null;
  const previewFile = req.files?.preview?.[0] || null;
  const coverFile = req.files?.cover?.[0] || null;

  if (!audioFile) {
    return sendBadRequest(res, "A full audio upload is required");
  }

  const audioError = validateFile(audioFile, {
    label: "Audio upload",
    allowedExtensions: AUDIO_EXTENSIONS,
    allowedMimeTypes: AUDIO_MIME_TYPES,
  });
  if (audioError) {
    return sendBadRequest(res, audioError);
  }

  const previewError = validateFile(previewFile, {
    label: "Preview sample",
    allowedExtensions: AUDIO_EXTENSIONS,
    allowedMimeTypes: AUDIO_MIME_TYPES,
  });
  if (previewError) {
    return sendBadRequest(res, previewError);
  }

  const coverError = validateFile(coverFile, {
    label: "Cover image",
    allowedExtensions: IMAGE_EXTENSIONS,
    allowedMimeTypes: IMAGE_MIME_TYPES,
  });
  if (coverError) {
    return sendBadRequest(res, coverError);
  }

  if (parsed.data.publishedStatus === "published" && parsed.data.price > 0 && !previewFile) {
    return sendBadRequest(res, "A preview sample is required before publishing a paid music release");
  }

  const creatorName = req.creatorProfile.displayName || req.creatorProfile.fullName || "";
  const audioUrl = await saveUploadedFile(audioFile);
  const previewUrl = previewFile ? await saveUploadedFile(previewFile) : "";
  const coverImageUrl = coverFile ? await saveUploadedFile(coverFile) : "";

  const verification = await evaluateVerification({
    creatorProfileId: req.creatorProfile._id,
    creatorCategory: "music",
    contentType: "track",
    requestedStatus: parsed.data.publishedStatus,
    title: parsed.data.title,
    description: parsed.data.description,
    primaryFile: audioFile,
    metadata: {
      creatorId: req.creatorProfile._id?.toString?.() || "",
      artistName: parsed.data.artistName || creatorName,
      genre: parsed.data.genre,
      releaseType: parsed.data.releaseType,
    },
  });

  const track = await Track.create({
    creatorId: req.creatorProfile._id,
    title: parsed.data.title,
    description: parsed.data.description,
    price: parsed.data.price,
    priceNGN: parsed.data.price,
    audioUrl,
    fullAudioUrl: audioUrl,
    previewUrl,
    previewSampleUrl: previewUrl,
    coverImageUrl,
    coverUrl: coverImageUrl,
    durationSec: parsed.data.durationSec,
    genre: parsed.data.genre,
    artistName: parsed.data.artistName || creatorName,
    releaseType: parsed.data.releaseType,
    explicitContent: parsed.data.explicitContent,
    featuringArtists: parsed.data.featuringArtists,
    producerCredits: parsed.data.producerCredits,
    songwriterCredits: parsed.data.songwriterCredits,
    releaseDate: parsed.data.releaseDate || null,
    lyrics: parsed.data.lyrics,
    audioFormat: inferAudioFormat(audioFile),
    kind: "music",
    creatorCategory: "music",
    contentType: "track",
    episodeType: parsed.data.price > 0 ? "premium" : "free",
    isFree: parsed.data.price <= 0,
    publishedStatus: verification.publishedStatus,
    copyrightScanStatus: verification.scanStatus,
    verificationNotes: verification.verificationNotes,
    reviewRequired: verification.reviewRequired,
    contentFingerprintHash: verification.contentFingerprintHash,
    contentFileHash: verification.contentFileHash,
    isPublished: verification.publishedStatus === "published",
    archivedAt: null,
  });

  if (track.publishedStatus === "published") {
    try {
      await maybeCreateAudioPost({
        authorId: req.user.id,
        tags: ["track", "music"],
        trackId: track._id,
        title: track.title,
        audioUrl: track.audioUrl,
        previewUrl: track.previewUrl,
        durationSec: track.durationSec,
        coverImageUrl: track.coverImageUrl,
      });
    } catch (err) {
      console.error("Failed to create feed post for music upload:", err);
    }
  }

  await logAnalyticsEvent({
    type: "song_uploaded",
    userId: req.user.id,
    actorRole: req.user.role,
    targetId: track._id,
    targetType: "track",
    contentType: "music",
    metadata: {
      creatorId: req.creatorProfile._id.toString(),
      price: Number(track.price || 0),
      title: track.title || "",
      releaseType: track.releaseType || "single",
    },
  }).catch(() => null);

  const hydrated = await hydrateTrack(track._id);
  return res.status(201).json(toTrackPayload(hydrated, { includeAudio: true }));
});

exports.createPodcastUpload = asyncHandler(async (req, res) => {
  if (!creatorHasCategory(req.creatorProfile, "podcast")) {
    return res.status(403).json({ error: "Podcast publishing is not enabled on this creator profile" });
  }

  const parsed = parsePayload(podcastUploadSchema, req.body);
  if (!parsed.ok) {
    return sendBadRequest(res, parsed.error);
  }

  const audioFile = req.files?.audio?.[0] || null;
  const previewFile = req.files?.preview?.[0] || null;
  const coverFile = req.files?.cover?.[0] || null;
  const transcriptFile = req.files?.transcript?.[0] || null;

  if (!audioFile) {
    return sendBadRequest(res, "A full audio upload is required");
  }

  const audioError = validateFile(audioFile, {
    label: "Episode audio",
    allowedExtensions: AUDIO_EXTENSIONS,
    allowedMimeTypes: AUDIO_MIME_TYPES,
  });
  if (audioError) {
    return sendBadRequest(res, audioError);
  }

  const previewError = validateFile(previewFile, {
    label: "Preview sample",
    allowedExtensions: AUDIO_EXTENSIONS,
    allowedMimeTypes: AUDIO_MIME_TYPES,
  });
  if (previewError) {
    return sendBadRequest(res, previewError);
  }

  const coverError = validateFile(coverFile, {
    label: "Cover image",
    allowedExtensions: IMAGE_EXTENSIONS,
    allowedMimeTypes: IMAGE_MIME_TYPES,
  });
  if (coverError) {
    return sendBadRequest(res, coverError);
  }

  const transcriptError = validateFile(transcriptFile, {
    label: "Transcript upload",
    allowedExtensions: TRANSCRIPT_EXTENSIONS,
    allowedMimeTypes: TRANSCRIPT_MIME_TYPES,
  });
  if (transcriptError) {
    return sendBadRequest(res, transcriptError);
  }

  if (parsed.data.episodeType === "premium" && parsed.data.price <= 0) {
    return sendBadRequest(res, "Premium podcast episodes must include a price greater than zero");
  }

  if (
    parsed.data.publishedStatus === "published" &&
    parsed.data.episodeType === "premium" &&
    !previewFile
  ) {
    return sendBadRequest(res, "A preview sample is required before publishing a premium podcast episode");
  }

  const audioUrl = await saveUploadedFile(audioFile);
  const previewUrl = previewFile ? await saveUploadedFile(previewFile) : "";
  const coverImageUrl = coverFile ? await saveUploadedFile(coverFile) : "";
  const transcriptUrl = transcriptFile ? await saveUploadedFile(transcriptFile) : "";
  const finalPrice = parsed.data.episodeType === "premium" ? parsed.data.price : 0;

  const verification = await evaluateVerification({
    creatorProfileId: req.creatorProfile._id,
    creatorCategory: "podcasts",
    contentType: "podcast_episode",
    requestedStatus: parsed.data.publishedStatus,
    title: parsed.data.title,
    description: parsed.data.description,
    primaryFile: audioFile,
    metadata: {
      creatorId: req.creatorProfile._id?.toString?.() || "",
      category: parsed.data.category,
      seriesName: parsed.data.podcastSeries,
      episodeType: parsed.data.episodeType,
    },
  });

  const track = await Track.create({
    creatorId: req.creatorProfile._id,
    title: parsed.data.title,
    description: parsed.data.description,
    price: finalPrice,
    priceNGN: finalPrice,
    audioUrl,
    fullAudioUrl: audioUrl,
    previewUrl,
    previewSampleUrl: previewUrl,
    coverImageUrl,
    coverUrl: coverImageUrl,
    durationSec: parsed.data.durationSec,
    kind: "podcast",
    creatorCategory: "podcasts",
    contentType: "podcast_episode",
    podcastSeries: parsed.data.podcastSeries,
    seasonNumber: parsed.data.seasonNumber,
    episodeNumber: parsed.data.episodeNumber,
    podcastCategory: parsed.data.category,
    episodeType: parsed.data.episodeType,
    explicitContent: parsed.data.explicitContent,
    guestNames: parsed.data.guestNames,
    showNotes: parsed.data.showNotes,
    transcriptUrl,
    episodeTags: parsed.data.episodeTags,
    isFree: finalPrice <= 0,
    publishedStatus: verification.publishedStatus,
    copyrightScanStatus: verification.scanStatus,
    verificationNotes: verification.verificationNotes,
    reviewRequired: verification.reviewRequired,
    contentFingerprintHash: verification.contentFingerprintHash,
    contentFileHash: verification.contentFileHash,
    isPublished: verification.publishedStatus === "published",
    archivedAt: null,
  });

  if (track.publishedStatus === "published") {
    try {
      await maybeCreateAudioPost({
        authorId: req.user.id,
        tags: ["podcast"],
        trackId: track._id,
        title: track.title,
        audioUrl: track.audioUrl,
        previewUrl: track.previewUrl,
        durationSec: track.durationSec,
        coverImageUrl: track.coverImageUrl,
      });
    } catch (err) {
      console.error("Failed to create feed post for podcast upload:", err);
    }
  }

  await logAnalyticsEvent({
    type: "podcast_uploaded",
    userId: req.user.id,
    actorRole: req.user.role,
    targetId: track._id,
    targetType: "track",
    contentType: "podcast",
    metadata: {
      creatorId: req.creatorProfile._id.toString(),
      price: Number(track.price || 0),
      title: track.title || "",
      podcastSeries: track.podcastSeries || "",
    },
  }).catch(() => null);

  const hydrated = await hydrateTrack(track._id);
  return res.status(201).json(toTrackPayload(hydrated, { includeAudio: true }));
});

exports.createBookUpload = asyncHandler(async (req, res) => {
  if (!creatorHasCategory(req.creatorProfile, "bookPublishing")) {
    return res.status(403).json({ error: "Book publishing is not enabled on this creator profile" });
  }

  const parsed = parsePayload(bookUploadSchema, req.body);
  if (!parsed.ok) {
    return sendBadRequest(res, parsed.error);
  }

  const coverFile = req.files?.cover?.[0] || null;
  const contentFile = req.files?.content?.[0] || null;
  const previewFile = req.files?.preview?.[0] || null;

  if (!contentFile) {
    return sendBadRequest(res, "A manuscript upload is required");
  }

  const contentError = validateFile(contentFile, {
    label: "Manuscript upload",
    allowedExtensions: BOOK_EXTENSIONS,
    allowedMimeTypes: BOOK_MIME_TYPES,
  });
  if (contentError) {
    return sendBadRequest(res, contentError);
  }

  const previewError = validateFile(previewFile, {
    label: "Preview upload",
    allowedExtensions: BOOK_EXTENSIONS,
    allowedMimeTypes: BOOK_MIME_TYPES,
  });
  if (previewError) {
    return sendBadRequest(res, previewError);
  }

  const coverError = validateFile(coverFile, {
    label: "Cover image",
    allowedExtensions: IMAGE_EXTENSIONS,
    allowedMimeTypes: IMAGE_MIME_TYPES,
  });
  if (coverError) {
    return sendBadRequest(res, coverError);
  }

  const inferredFormat = inferBookFormatFromFile(contentFile);
  const finalFormat = parsed.data.fileFormat || inferredFormat;
  if (!finalFormat) {
    return sendBadRequest(res, "The uploaded manuscript format is not supported");
  }
  if (parsed.data.fileFormat && inferredFormat && parsed.data.fileFormat !== inferredFormat) {
    return sendBadRequest(res, "The selected file format does not match the uploaded manuscript");
  }

  const contentUrl = await saveUploadedFile(contentFile);
  const coverImageUrl = coverFile ? await saveUploadedFile(coverFile) : "";
  const previewUrl = previewFile ? await saveUploadedFile(previewFile) : "";
  const authorName =
    parsed.data.authorName ||
    req.creatorProfile.booksProfile?.penName ||
    req.creatorProfile.displayName ||
    (await loadCreatorName(req.creatorProfile._id));

  const verification = await evaluateVerification({
    creatorProfileId: req.creatorProfile._id,
    creatorCategory: "books",
    contentType: finalFormat === "pdf" ? "pdf_book" : "ebook",
    requestedStatus: parsed.data.publishedStatus,
    title: parsed.data.title,
    description: parsed.data.description,
    primaryFile: contentFile,
    metadata: {
      creatorId: req.creatorProfile._id?.toString?.() || "",
      authorName,
      genre: parsed.data.genre,
      language: parsed.data.language,
      fileFormat: finalFormat,
    },
  });

  const book = await Book.create({
    creatorId: req.creatorProfile._id,
    title: parsed.data.title,
    authorName,
    subtitle: parsed.data.subtitle,
    description: parsed.data.description,
    price: parsed.data.price,
    priceNGN: parsed.data.price,
    genre: parsed.data.genre,
    language: parsed.data.language,
    pageCount: parsed.data.pageCount ?? null,
    isbn: parsed.data.isbn,
    edition: parsed.data.edition,
    audience: parsed.data.audience,
    readingAge: parsed.data.readingAge,
    tableOfContents: parsed.data.tableOfContents,
    coverImageUrl,
    coverUrl: coverImageUrl,
    contentUrl,
    fileUrl: contentUrl,
    previewUrl,
    fileFormat: finalFormat,
    contentType: finalFormat === "pdf" ? "pdf_book" : "ebook",
    copyrightDeclared: parsed.data.copyrightDeclared,
    publishedStatus: verification.publishedStatus,
    copyrightScanStatus: verification.scanStatus,
    verificationNotes: verification.verificationNotes,
    reviewRequired: verification.reviewRequired,
    contentFingerprintHash: verification.contentFingerprintHash,
    contentFileHash: verification.contentFileHash,
    isPublished: verification.publishedStatus === "published",
    archivedAt: null,
  });

  await logAnalyticsEvent({
    type: "book_uploaded",
    userId: req.user.id,
    actorRole: req.user.role,
    targetId: book._id,
    targetType: "book",
    contentType: "book",
    metadata: {
      creatorId: req.creatorProfile._id.toString(),
      price: Number(book.price || 0),
      title: book.title || "",
      fileFormat: book.fileFormat || "",
    },
  }).catch(() => null);

  const hydrated = await hydrateBook(book._id);
  return res.status(201).json(toBookPayload(hydrated));
});
