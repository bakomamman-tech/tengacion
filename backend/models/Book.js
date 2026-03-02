const mongoose = require("mongoose");

const BookSchema = new mongoose.Schema(
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
    contentUrl: {
      type: String,
      default: "",
      trim: true,
    },
    fileUrl: {
      type: String,
      default: "",
      trim: true,
    },
    previewUrl: {
      type: String,
      default: "",
      trim: true,
    },
    priceGlobal: {
      type: Number,
      default: 0,
      min: 0,
    },
    isFreePreview: {
      type: Boolean,
      default: true,
    },
    downloadCount: {
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
  },
  {
    timestamps: true,
  }
);

BookSchema.pre("validate", function syncBookFields(next) {
  if (!Number.isFinite(this.price) && Number.isFinite(this.priceNGN)) this.price = this.priceNGN;
  if (!Number.isFinite(this.priceNGN) && Number.isFinite(this.price)) this.priceNGN = this.price;
  if (!this.coverImageUrl && this.coverUrl) this.coverImageUrl = this.coverUrl;
  if (!this.coverUrl && this.coverImageUrl) this.coverUrl = this.coverImageUrl;
  if (!this.contentUrl && this.fileUrl) this.contentUrl = this.fileUrl;
  if (!this.fileUrl && this.contentUrl) this.fileUrl = this.contentUrl;
  next();
});

BookSchema.virtual("isFree").get(function isFree() {
  return Number(this.priceNGN ?? this.price ?? 0) <= 0;
});

module.exports = mongoose.model("Book", BookSchema);
