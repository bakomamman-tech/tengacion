const mongoose = require("mongoose");

const SchoolInquirySchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SchoolPage",
      required: true,
      index: true,
    },
    schoolSlug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      index: true,
    },
    schoolName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },
    parentName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    childClassInterest: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1200,
    },
    status: {
      type: String,
      enum: ["new", "reviewed", "contacted", "closed"],
      default: "new",
      index: true,
    },
    emailStatus: {
      type: String,
      enum: ["not_configured", "missing_school_email", "sent", "failed"],
      default: "not_configured",
      index: true,
    },
    metadata: {
      ip: { type: String, default: "", trim: true, maxlength: 120 },
      userAgent: { type: String, default: "", trim: true, maxlength: 260 },
      sourcePath: { type: String, default: "", trim: true, maxlength: 260 },
    },
  },
  {
    timestamps: true,
  }
);

SchoolInquirySchema.index({ school: 1, createdAt: -1 });
SchoolInquirySchema.index({ email: 1, createdAt: -1 });

module.exports = mongoose.model("SchoolInquiry", SchoolInquirySchema);
