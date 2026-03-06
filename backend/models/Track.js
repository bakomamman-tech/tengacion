const mongoose = require("mongoose");

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
    previewUrl: {
      type: String,
      default: "",
      trim: true,
    },
    coverImageUrl: {
      type: String,
      default: "",
      trim: true,
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
    durationSec: {
      type: Number,
      default: 0,
      min: 0,
    },
    kind: {
      type: String,
      enum: ["music", "podcast", "comedy"],
      default: "music",
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
    archivedAt: {
      type: Date,
      default: null,
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
  if (!Number.isFinite(this.price) && Number.isFinite(this.priceNGN)) {
    this.price = this.priceNGN;
  }
  if (!Number.isFinite(this.priceNGN) && Number.isFinite(this.price)) {
    this.priceNGN = this.price;
  }
  if (!this.coverImageUrl && this.coverUrl) this.coverImageUrl = this.coverUrl;
  if (!this.coverUrl && this.coverImageUrl) this.coverUrl = this.coverImageUrl;
  if (!this.audioUrl && this.fullAudioUrl) this.audioUrl = this.fullAudioUrl;
  if (!this.fullAudioUrl && this.audioUrl) this.fullAudioUrl = this.audioUrl;
  if (!this.previewUrl && this.previewSampleUrl) this.previewUrl = this.previewSampleUrl;
  if (!this.previewSampleUrl && this.previewUrl) this.previewSampleUrl = this.previewUrl;
  if (!Number.isFinite(this.playsCount) && Number.isFinite(this.playCount)) this.playsCount = this.playCount;
  if (!Number.isFinite(this.playCount) && Number.isFinite(this.playsCount)) this.playCount = this.playsCount;
  next();
});

module.exports = mongoose.model("Track", TrackSchema);
