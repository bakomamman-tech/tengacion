const mongoose = require("mongoose");

const TALENT_CATEGORY_VALUES = [
  "singer",
  "dancer",
  "comedian",
  "magician",
  "instrumentalist",
  "spoken_word",
  "actor",
  "other",
];

const TALENT_APPLICATION_STATUS_VALUES = [
  "submitted",
  "reviewing",
  "shortlisted",
  "selected",
  "rejected",
];

const TalentShowApplicationSchema = new mongoose.Schema(
  {
    showSlug: {
      type: String,
      default: "kaduna-got-talent",
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    showTitle: {
      type: String,
      default: "Kaduna Got Talent",
      required: true,
      trim: true,
      maxlength: 120,
    },
    applicantUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    stageName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    normalizedEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    gender: {
      type: String,
      enum: ["male", "female", "custom", "prefer_not_to_say"],
      default: "prefer_not_to_say",
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    stateOfOrigin: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    talentCategory: {
      type: String,
      enum: TALENT_CATEGORY_VALUES,
      required: true,
      index: true,
    },
    talentCategoryOther: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    bio: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1600,
    },
    experienceLevel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    socialHandle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: TALENT_APPLICATION_STATUS_VALUES,
      default: "submitted",
      index: true,
    },
    adminNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    reviewedAt: {
      type: Date,
      default: null,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

TalentShowApplicationSchema.index({ showSlug: 1, normalizedEmail: 1 }, { unique: true });
TalentShowApplicationSchema.index(
  { showSlug: 1, applicantUserId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      applicantUserId: { $type: "objectId" },
    },
  }
);
TalentShowApplicationSchema.index({ showSlug: 1, status: 1, createdAt: -1 });

TalentShowApplicationSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  delete obj.normalizedEmail;
  return obj;
};

module.exports = mongoose.model("TalentShowApplication", TalentShowApplicationSchema);
module.exports.TALENT_CATEGORY_VALUES = TALENT_CATEGORY_VALUES;
module.exports.TALENT_APPLICATION_STATUS_VALUES = TALENT_APPLICATION_STATUS_VALUES;
