const mongoose = require("mongoose");
const { createMediaAssetSchema } = require("./subschemas/mediaAsset");
const { normalizeMediaValue } = require("../utils/userMedia");

const BOOTCAMP_TRACK_VALUES = [
  "abacus_math",
  "tech_skills",
  "reading_phonics",
  "critical_thinking",
];

const BOOTCAMP_STATUS_VALUES = [
  "submitted",
  "reviewing",
  "contacted",
  "confirmed",
  "waitlisted",
  "declined",
];

const privatePhotoSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true, trim: true },
    filename: { type: String, default: "", trim: true, maxlength: 220 },
    originalName: { type: String, default: "", trim: true, maxlength: 220 },
    contentType: { type: String, default: "image/jpeg", trim: true, maxlength: 120 },
    sizeBytes: { type: Number, default: 0, min: 0 },
    role: { type: String, enum: ["parent", "student"], required: true },
  },
  { _id: false }
);

const studentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
    },
    fullName: { type: String, required: true, trim: true, maxlength: 140 },
    preferredName: { type: String, default: "", trim: true, maxlength: 80 },
    dateOfBirth: { type: Date, required: true },
    gender: {
      type: String,
      enum: ["female", "male", "custom", "prefer_not_to_say"],
      default: "prefer_not_to_say",
    },
    currentSchool: { type: String, required: true, trim: true, maxlength: 180 },
    classLevel: { type: String, required: true, trim: true, maxlength: 100 },
    learningTracks: [
      {
        type: String,
        enum: BOOTCAMP_TRACK_VALUES,
      },
    ],
    learningGoals: { type: String, required: true, trim: true, maxlength: 1200 },
    additionalNeeds: { type: String, default: "", trim: true, maxlength: 1200 },
    photo: { type: privatePhotoSchema, required: true },
  },
  { _id: false }
);

const SummerBootcampRegistrationSchema = new mongoose.Schema(
  {
    campaignSlug: {
      type: String,
      default: "summer-bootcamp-2026",
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    campaignTitle: {
      type: String,
      default: "Tengacion Virtual Summer Bootcamp",
      required: true,
      trim: true,
      maxlength: 160,
    },
    programme: {
      startsOn: { type: Date, required: true },
      endsOn: { type: Date, required: true },
      feePerParticipantNgn: { type: Number, required: true, min: 0 },
      standardTotalNgn: { type: Number, required: true, min: 0 },
      participantCount: { type: Number, required: true, min: 1, max: 3 },
      familyRateNegotiable: { type: Boolean, default: false },
      familyRateNote: { type: String, default: "", trim: true, maxlength: 240 },
    },
    referenceCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    parentUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    parent: {
      fullName: { type: String, required: true, trim: true, maxlength: 140 },
      email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
      normalizedEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
      phone: { type: String, required: true, trim: true, maxlength: 40 },
      dateOfBirth: { type: Date, required: true },
      gender: {
        type: String,
        enum: ["female", "male", "custom", "prefer_not_to_say"],
        default: "prefer_not_to_say",
      },
      relationshipToStudents: { type: String, required: true, trim: true, maxlength: 80 },
      country: { type: String, required: true, trim: true, maxlength: 120 },
      stateOfOrigin: { type: String, required: true, trim: true, maxlength: 120 },
      city: { type: String, required: true, trim: true, maxlength: 120 },
      homeAddress: { type: String, required: true, trim: true, maxlength: 320 },
      occupation: { type: String, required: true, trim: true, maxlength: 140 },
      preferredContactMethod: {
        type: String,
        enum: ["phone", "whatsapp", "email"],
        default: "whatsapp",
      },
    },
    emergencyContact: {
      fullName: { type: String, required: true, trim: true, maxlength: 140 },
      phone: { type: String, required: true, trim: true, maxlength: 40 },
      relationship: { type: String, required: true, trim: true, maxlength: 80 },
    },
    household: {
      learningDevice: {
        type: String,
        enum: ["smartphone", "tablet", "computer", "shared_device", "other"],
        required: true,
      },
      internetReliability: {
        type: String,
        enum: ["reliable", "mostly_reliable", "limited", "needs_support"],
        required: true,
      },
      schedulePreference: {
        type: String,
        enum: ["weekday_morning", "weekday_afternoon", "weekday_evening", "weekend", "flexible"],
        required: true,
      },
      goals: { type: String, required: true, trim: true, maxlength: 1600 },
    },
    parentPhoto: { type: privatePhotoSchema, required: true },
    publishedProfilePhoto: {
      type: createMediaAssetSchema(),
      default: () => normalizeMediaValue(),
    },
    students: {
      type: [studentSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length >= 1 && value.length <= 3,
        message: "Register between one and three students.",
      },
    },
    consent: {
      guardianAuthority: { type: Boolean, required: true },
      virtualLearning: { type: Boolean, required: true },
      childDataProcessing: { type: Boolean, required: true },
      profilePhotoUse: { type: Boolean, required: true },
      feeAcknowledged: { type: Boolean, required: true },
      termsAccepted: { type: Boolean, required: true },
      communicationsAccepted: { type: Boolean, default: false },
      acceptedAt: { type: Date, required: true },
    },
    status: {
      type: String,
      enum: BOOTCAMP_STATUS_VALUES,
      default: "submitted",
      index: true,
    },
    photoModeration: {
      decision: { type: String, default: "approve", trim: true, maxlength: 40 },
      labels: [{ type: String, trim: true, maxlength: 120 }],
      reason: { type: String, default: "", trim: true, maxlength: 600 },
      confidence: { type: Number, default: 0, min: 0, max: 1 },
    },
    adminNote: { type: String, default: "", trim: true, maxlength: 1600 },
    reviewedAt: { type: Date, default: null },
    metadata: {
      ip: { type: String, default: "", trim: true, maxlength: 180 },
      userAgent: { type: String, default: "", trim: true, maxlength: 400 },
      sourcePath: { type: String, default: "/summer-bootcamp/register", trim: true, maxlength: 220 },
    },
  },
  { timestamps: true }
);

SummerBootcampRegistrationSchema.index(
  { campaignSlug: 1, parentUserId: 1 },
  { unique: true }
);
SummerBootcampRegistrationSchema.index({ "parent.normalizedEmail": 1, createdAt: -1 });
SummerBootcampRegistrationSchema.index({ campaignSlug: 1, status: 1, createdAt: -1 });

SummerBootcampRegistrationSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  delete obj.parent?.normalizedEmail;
  return obj;
};

module.exports = mongoose.model("SummerBootcampRegistration", SummerBootcampRegistrationSchema);
module.exports.BOOTCAMP_STATUS_VALUES = BOOTCAMP_STATUS_VALUES;
module.exports.BOOTCAMP_TRACK_VALUES = BOOTCAMP_TRACK_VALUES;
