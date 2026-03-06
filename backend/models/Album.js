const mongoose = require("mongoose");

const AlbumTrackSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },
    trackUrl: {
      type: String,
      required: true,
      trim: true,
    },
    previewUrl: {
      type: String,
      default: "",
      trim: true,
    },
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const AlbumSchema = new mongoose.Schema(
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
      maxlength: 4000,
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
    coverUrl: {
      type: String,
      required: true,
      trim: true,
    },
    tracks: {
      type: [AlbumTrackSchema],
      default: [],
      validate: {
        validator: (tracks) => Array.isArray(tracks) && tracks.length >= 1 && tracks.length <= 25,
        message: "Album must have between 1 and 25 tracks",
      },
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
      index: true,
    },
    totalTracks: {
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
  },
  {
    timestamps: true,
  }
);

AlbumSchema.pre("validate", function syncAlbumFields(next) {
  if (!Number.isFinite(this.price) && Number.isFinite(this.priceNGN)) this.price = this.priceNGN;
  if (!Number.isFinite(this.priceNGN) && Number.isFinite(this.price)) this.priceNGN = this.price;
  if (Number.isFinite(this.totalTracks) && this.totalTracks <= 0 && Array.isArray(this.tracks)) {
    this.totalTracks = this.tracks.length;
  }
  if (this.isPublished && this.status !== "published") {
    this.status = "published";
  }
  next();
});

AlbumSchema.virtual("isFree").get(function isFree() {
  return Number(this.priceNGN ?? this.price ?? 0) <= 0;
});

module.exports = mongoose.model("Album", AlbumSchema);
