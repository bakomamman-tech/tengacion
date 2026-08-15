const mongoose = require("mongoose");

const GsiRegistryRecordSchema = new mongoose.Schema(
  {
    archiveId: { type: String, required: true, unique: true, trim: true, maxlength: 180 },
    recordKind: {
      type: String,
      enum: ["journal", "paper", "journal-work"],
      required: true,
      index: true,
    },
    parentArchiveId: { type: String, default: "", trim: true, maxlength: 120, index: true },
    openAlexWorkId: { type: String, default: "", trim: true, maxlength: 40, index: true },
    doi: { type: String, default: "", trim: true, maxlength: 300, index: true },
    journalName: { type: String, default: "", trim: true, maxlength: 320, index: true },
    authors: [{ type: String, trim: true, maxlength: 220 }],
    topics: [{ type: String, trim: true, maxlength: 220 }],
    institutions: [{ type: String, trim: true, maxlength: 220 }],
    countryCodes: [{ type: String, trim: true, uppercase: true, maxlength: 2 }],
    countryNames: [{ type: String, trim: true, maxlength: 120 }],
    title: { type: String, required: true, trim: true, maxlength: 320 },
    subtitle: { type: String, default: "", trim: true, maxlength: 320 },
    abstract: { type: String, default: "", trim: true, maxlength: 5000 },
    field: { type: String, default: "", trim: true, maxlength: 160, index: true },
    countryCode: { type: String, default: "", trim: true, uppercase: true, maxlength: 2, index: true },
    publicationYear: { type: Number, default: null, index: true },
    issnL: { type: String, default: "", trim: true, maxlength: 24 },
    indexedWorks: { type: Number, default: null, min: 0 },
    queryMatchedWorks: { type: Number, default: null, min: 0 },
    reviewedWorks: { type: Number, default: null, min: 0 },
    scoredWorks: { type: Number, default: null, min: 0 },
    retainedWorks: { type: Number, default: null, min: 0 },
    gsiScore: { type: Number, required: true, min: 0, max: 100, index: true },
    scoreContext: {
      type: String,
      enum: ["record", "parent-journal"],
      default: "record",
    },
    scoringVersion: { type: String, required: true, trim: true, maxlength: 80 },
    publicRecordPath: { type: String, required: true, trim: true, maxlength: 260 },
    permanentUrl: { type: String, default: "", trim: true, maxlength: 900 },
    sourceProvider: { type: String, default: "", trim: true, maxlength: 120 },
    impactEvidenceStatus: {
      type: String,
      enum: ["not-provided", "self-reported"],
      default: "not-provided",
    },
    savedAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

GsiRegistryRecordSchema.index({
  title: "text",
  subtitle: "text",
  abstract: "text",
  field: "text",
});

module.exports = mongoose.models.GsiRegistryRecord ||
  mongoose.model("GsiRegistryRecord", GsiRegistryRecordSchema);
