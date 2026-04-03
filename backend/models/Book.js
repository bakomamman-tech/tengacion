const mongoose = require("mongoose");
const { createMediaAssetSchema } = require("./subschemas/mediaAsset");
const { sanitizeLegacyMediaFieldsForNewWrite } = require("../utils/userMedia");

const MediaAssetSchema = createMediaAssetSchema();

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
    authorName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    subtitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
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
    coverMedia: {
      type: MediaAssetSchema,
      default: null,
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
    contentMedia: {
      type: MediaAssetSchema,
      default: null,
    },
    genre: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    language: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
    },
    pageCount: {
      type: Number,
      default: null,
      min: 0,
    },
    isbn: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },
    edition: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },
    audience: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    readingAge: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    tableOfContents: {
      type: String,
      default: "",
      maxlength: 4000,
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 40,
      },
    ],
    fileFormat: {
      type: String,
      default: "",
      trim: true,
      maxlength: 30,
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
    previewMedia: {
      type: MediaAssetSchema,
      default: null,
    },
    previewExcerptText: {
      type: String,
      default: "",
      maxlength: 3000,
    },
    creatorCategory: {
      type: String,
      enum: ["music", "books", "podcasts"],
      default: "books",
      index: true,
    },
    contentType: {
      type: String,
      enum: ["ebook", "pdf_book"],
      default: "ebook",
      index: true,
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
    copyrightDeclared: {
      type: Boolean,
      default: false,
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
  },
  {
    timestamps: true,
  }
);

BookSchema.pre("validate", function syncBookFields(next) {
  const coverMediaUrl = this.coverMedia?.secureUrl || this.coverMedia?.url || "";
  const contentMediaUrl = this.contentMedia?.secureUrl || this.contentMedia?.url || "";
  const previewMediaUrl = this.previewMedia?.secureUrl || this.previewMedia?.url || "";
  if (!Number.isFinite(this.price) && Number.isFinite(this.priceNGN)) this.price = this.priceNGN;
  if (!Number.isFinite(this.priceNGN) && Number.isFinite(this.price)) this.priceNGN = this.price;
  if (!this.coverImageUrl && coverMediaUrl) this.coverImageUrl = coverMediaUrl;
  if (!this.coverUrl && coverMediaUrl) this.coverUrl = coverMediaUrl;
  if (!this.contentUrl && contentMediaUrl) this.contentUrl = contentMediaUrl;
  if (!this.fileUrl && contentMediaUrl) this.fileUrl = contentMediaUrl;
  if (!this.previewUrl && previewMediaUrl) this.previewUrl = previewMediaUrl;
  if (!this.coverImageUrl && this.coverUrl) this.coverImageUrl = this.coverUrl;
  if (!this.coverUrl && this.coverImageUrl) this.coverUrl = this.coverImageUrl;
  if (!this.contentUrl && this.fileUrl) this.contentUrl = this.fileUrl;
  if (!this.fileUrl && this.contentUrl) this.fileUrl = this.contentUrl;
  sanitizeLegacyMediaFieldsForNewWrite(this, {
    cloudinaryMedia: [
      { mediaPath: "coverMedia", urlPaths: ["coverImageUrl", "coverUrl"] },
      { mediaPath: "contentMedia", urlPaths: ["contentUrl", "fileUrl"] },
      { mediaPath: "previewMedia", urlPaths: ["previewUrl"] },
    ],
  });
  this.creatorCategory = "books";
  if (this.fileFormat && String(this.fileFormat).toLowerCase() === "pdf") {
    this.contentType = "pdf_book";
  }
  if (this.publishedStatus === "published") this.isPublished = true;
  if (["draft", "under_review", "blocked"].includes(this.publishedStatus)) this.isPublished = false;
  if (typeof next === "function") next();
});

BookSchema.virtual("isFree").get(function isFree() {
  return Number(this.priceNGN ?? this.price ?? 0) <= 0;
});

module.exports = mongoose.model("Book", BookSchema);
