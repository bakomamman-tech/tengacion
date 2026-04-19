const mongoose = require("mongoose");

const sellerDocumentSchema = new mongoose.Schema(
  {
    publicId: { type: String, default: "", trim: true },
    url: { type: String, default: "", trim: true },
    originalName: { type: String, default: "", trim: true },
    mimeType: { type: String, default: "", trim: true },
    provider: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const MarketplaceSellerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    fullName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 140,
    },
    storeName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    slug: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      index: true,
    },
    phoneNumber: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },
    bankName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    accountNumber: {
      type: String,
      default: "",
      trim: true,
      maxlength: 30,
    },
    accountName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 140,
    },
    residentialAddress: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
    businessAddress: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
    state: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },
    cacCertificate: {
      type: sellerDocumentSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ["draft", "pending_review", "approved", "rejected", "suspended"],
      default: "draft",
      index: true,
    },
    rejectionReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 400,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    suspendedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

MarketplaceSellerSchema.index({ storeName: "text", fullName: "text", state: "text", city: "text" });

module.exports = mongoose.model("MarketplaceSeller", MarketplaceSellerSchema);
