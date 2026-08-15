const mongoose = require("mongoose");

const GsiRegistryRecordSchema = new mongoose.Schema(
  {
    archiveId: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
    recordKind: { type: String, enum: ["journal", "paper"], required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 320 },
    subtitle: { type: String, default: "", trim: true, maxlength: 320 },
    abstract: { type: String, default: "", trim: true, maxlength: 5000 },
    field: { type: String, default: "", trim: true, maxlength: 160, index: true },
    countryCode: { type: String, default: "", trim: true, uppercase: true, maxlength: 2, index: true },
    publicationYear: { type: Number, default: null, index: true },
    gsiScore: { type: Number, required: true, min: 0, max: 100, index: true },
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

GsiRegistryRecordSchema.index({ title: "text", subtitle: "text", abstract: "text", field: "text" });

module.exports = mongoose.models.GsiRegistryRecord ||
  mongoose.model("GsiRegistryRecord", GsiRegistryRecordSchema);
