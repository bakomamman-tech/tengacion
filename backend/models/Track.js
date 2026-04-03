const mongoose = require("mongoose");
const { createMediaAssetSchema } = require("./subschemas/mediaAsset");

const MediaAssetSchema = createMediaAssetSchema();

const TrackSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreatorProfile",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    description: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    priceNGN: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "NGN",
      trim: true,
      uppercase: true,
    },
    audioUrl: {
      type: String,
      required: true,
      trim: true,
    },
    audioMedia: {
      type: MediaAssetSchema,
      default: null,
    },
    previewUrl: {
      type: String,
      default: "",
      trim: true,
    },
    previewMedia: {
      type: MediaAssetSchema,
      default: null,
    },
    coverImageUrl: {
      type: String,
      default: "",
      trim: true,
    },
    coverMedia: {
      type: MediaAssetSchema,
      default: null,
    },
    coverUrl: {
      type: String,
      default: "",
      trim: true,
    },
    fullAudioUrl: {
      type: String,
      default: "",
      trim: true,
    },
    previewSampleUrl: {
      type: String,
      default: "",
      trim: true,
    },
    previewStartSec: {
      type: Number,
      default: 0,
      min: 0,
    },
    previewLimitSec: {
      type: Number,
      default: 30,
      min: 1,
    },
    durationSec: {
      type: Number,
      default: 0,
      min: 0,
    },
    genre: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    artistName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    releaseType: {
      type: String,
      enum: ["single", "ep", "album"],
      default: "single",
    },
    explicitContent: {
      type: Boolean,
      default: false,
    },
    featuringArtists: [
      {
        type: String,
        trim: true,
        maxlength: 80,
      },
    ],
    producerCredits: [
      {
        type: String,
        trim: true,
        maxlength: 80,
      },
    ],
    songwriterCredits: [
      {
        type: String,
        trim: true,
        maxlength: 80,
      },
    ],
    releaseDate: {
      type: Date,
      default: null,
    },
    lyrics: {
      type: String,
      default: "",
      maxlength: 12000,
    },
    audioFormat: {
      type: String,
      default: "",
      trim: true,
      maxlength: 32,
    },
    mediaType: {
      type: String,
      enum: ["audio", "video"],
      default: "audio",
    },
    videoUrl: {
      type: String,
      default: "",
      trim: true,
    },
    videoMedia: {
      type: MediaAssetSchema,
      default: null,
    },
    previewClipUrl: {
      type: String,
      default: "",
      trim: true,
    },
    previewClipMedia: {
      type: MediaAssetSchema,
      default: null,
    },
    videoFormat: {
      type: String,
      default: "",
      trim: true,
      maxlength: 32,
    },
    kind: {
      type: String,
      enum: ["music", "podcast", "comedy"],
      default: "music",
      index: true,
    },
    creatorCategory: {
      type: String,
      enum: ["music", "books", "podcasts"],
      default: "music",
      index: true,
    },
    contentType: {
      type: String,
      enum: ["track", "podcast_episode"],
      default: "track",
      index: true,
    },
    podcastSeries: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },
    seasonNumber: {
      type: Number,
      default: 0,
      min: 0,
    },
    episodeNumber: {
      type: Number,
      default: 0,
      min: 0,
    },
    podcastCategory: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    episodeType: {
      type: String,
      enum: ["free", "premium"],
      default: "free",
    },
    guestNames: [
      {
        type: String,
        trim: true,
        maxlength: 80,
      },
    ],
    showNotes: {
      type: String,
      default: "",
      maxlength: 12000,
    },
    transcriptUrl: {
      type: String,
      default: "",
      trim: true,
    },
    transcriptMedia: {
      type: MediaAssetSchema,
      default: null,
    },
    episodeTags: [
      {
        type: String,
        trim: true,
        maxlength: 40,
      },
    ],
    priceGlobal: {
      type: Number,
      default: 0,
      min: 0,
    },
    isFree: {
      type: Boolean,
      default: false,
      index: true,
    },
    playsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    playCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    purchaseCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    publishedStatus: {
      type: String,
      enum: ["draft", "published", "under_review", "blocked"],
      default: "published",
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },
    copyrightScanStatus: {
      type: String,
      enum: ["pending_scan", "passed", "flagged", "blocked"],
      default: "pending_scan",
      index: true,
    },
    verificationNotes: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    reviewRequired: {
      type: Boolean,
      default: false,
      index: true,
    },
    moderationStatus: {
      type: String,
      default: "ALLOW",
      trim: true,
      maxlength: 80,
      index: true,
    },
    moderationCaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ModerationCase",
      default: null,
      index: true,
    },
    sensitiveContent: {
      type: Boolean,
      default: false,
      index: true,
    },
    sensitiveType: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    blurPreviewUrl: {
      type: String,
      default: "",
      trim: true,
    },
    originalVisibility: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },
    contentFingerprintHash: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    contentFileHash: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

TrackSchema.pre("validate", function syncStandardFields(next) {
  const audioMediaUrl = this.audioMedia?.secureUrl || this.audioMedia?.url || "";
  const previewMediaUrl = this.previewMedia?.secureUrl || this.previewMedia?.url || "";
  const coverMediaUrl = this.coverMedia?.secureUrl || this.coverMedia?.url || "";
  const videoMediaUrl = this.videoMedia?.secureUrl || this.videoMedia?.url || "";
  const previewClipMediaUrl = this.previewClipMedia?.secureUrl || this.previewClipMedia?.url || "";
  const transcriptMediaUrl = this.transcriptMedia?.secureUrl || this.transcriptMedia?.url || "";
  if (!Number.isFinite(this.price) && Number.isFinite(this.priceNGN)) {
    this.price = this.priceNGN;
  }
  if (!Number.isFinite(this.priceNGN) && Number.isFinite(this.price)) {
    this.priceNGN = this.price;
  }
  if (!this.audioUrl && audioMediaUrl) this.audioUrl = audioMediaUrl;
  if (!this.fullAudioUrl && audioMediaUrl) this.fullAudioUrl = audioMediaUrl;
  if (!this.previewUrl && previewMediaUrl) this.previewUrl = previewMediaUrl;
  if (!this.previewSampleUrl && previewMediaUrl) this.previewSampleUrl = previewMediaUrl;
  if (!this.coverImageUrl && coverMediaUrl) this.coverImageUrl = coverMediaUrl;
  if (!this.coverUrl && coverMediaUrl) this.coverUrl = coverMediaUrl;
  if (!this.videoUrl && videoMediaUrl) this.videoUrl = videoMediaUrl;
  if (!this.previewClipUrl && previewClipMediaUrl) this.previewClipUrl = previewClipMediaUrl;
  if (!this.transcriptUrl && transcriptMediaUrl) this.transcriptUrl = transcriptMediaUrl;
  if (!this.coverImageUrl && this.coverUrl) this.coverImageUrl = this.coverUrl;
  if (!this.coverUrl && this.coverImageUrl) this.coverUrl = this.coverImageUrl;
  if (!this.audioUrl && this.fullAudioUrl) this.audioUrl = this.fullAudioUrl;
  if (!this.fullAudioUrl && this.audioUrl) this.fullAudioUrl = this.audioUrl;
  if (!this.previewUrl && this.previewSampleUrl) this.previewUrl = this.previewSampleUrl;
  if (!this.previewSampleUrl && this.previewUrl) this.previewSampleUrl = this.previewUrl;
  if (!Number.isFinite(this.previewStartSec) || this.previewStartSec < 0) this.previewStartSec = 0;
  if (!Number.isFinite(this.previewLimitSec) || this.previewLimitSec <= 0) this.previewLimitSec = 30;
  if (!Number.isFinite(this.playsCount) && Number.isFinite(this.playCount)) this.playsCount = this.playCount;
  if (!Number.isFinite(this.playCount) && Number.isFinite(this.playsCount)) this.playCount = this.playsCount;
  if (this.kind === "podcast") {
    this.creatorCategory = "podcasts";
    this.contentType = "podcast_episode";
    this.releaseType = "single";
    this.mediaType = this.mediaType === "video" ? "video" : "audio";
    if (this.mediaType === "video") {
      if (!this.videoUrl && this.audioUrl) this.videoUrl = this.audioUrl;
      if (!this.audioUrl && this.videoUrl) this.audioUrl = this.videoUrl;
      if (!this.fullAudioUrl && this.audioUrl) this.fullAudioUrl = this.audioUrl;
      if (!this.previewClipUrl && this.previewUrl) this.previewClipUrl = this.previewUrl;
      if (!this.previewUrl && this.previewClipUrl) this.previewUrl = this.previewClipUrl;
      if (!this.previewSampleUrl && this.previewUrl) this.previewSampleUrl = this.previewUrl;
    } else {
      this.videoUrl = "";
      this.previewClipUrl = "";
      this.videoFormat = "";
    }
  } else {
    this.creatorCategory = "music";
    this.contentType = "track";
    this.mediaType = "audio";
    this.videoUrl = "";
    this.previewClipUrl = "";
    this.videoFormat = "";
    this.podcastCategory = "";
    this.episodeType = this.price > 0 ? "premium" : "free";
  }
  if (this.publishedStatus === "published") this.isPublished = true;
  if (["draft", "under_review", "blocked"].includes(this.publishedStatus)) this.isPublished = false;
  if (typeof next === "function") next();
});

module.exports = mongoose.model("Track", TrackSchema);
