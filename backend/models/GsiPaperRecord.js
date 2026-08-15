const mongoose = require("mongoose");

const GsiPaperRecordSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    paper: {
      title: { type: String, required: true, trim: true, maxlength: 320 },
      abstract: { type: String, required: true, trim: true, maxlength: 5000 },
      field: { type: String, required: true, trim: true, maxlength: 160 },
      authors: [{ type: String, required: true, trim: true, maxlength: 160 }],
      institution: { type: String, default: null, trim: true, maxlength: 260 },
      countryCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 2 },
      publicationYear: { type: Number, required: true, min: 1900 },
      doi: { type: String, default: null, trim: true, maxlength: 300 },
      openAccessUrl: { type: String, default: null, trim: true, maxlength: 900 },
      journalName: { type: String, default: null, trim: true, maxlength: 260 },
    },
    gsiScore: { type: mongoose.Schema.Types.Mixed, required: true },
    impactEvidence: {
      policyMentions: { type: Number, default: 0, min: 0 },
      ngoAdoptions: { type: Number, default: 0, min: 0 },
      localCitations: { type: Number, default: 0, min: 0 },
      summary: { type: String, default: null, trim: true, maxlength: 700 },
      sourceUrl: { type: String, default: null, trim: true, maxlength: 900 },
      verificationStatus: {
        type: String,
        enum: ["not-provided", "self-reported"],
        default: "not-provided",
      },
    },
    confirmedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

GsiPaperRecordSchema.index({ "paper.doi": 1 }, { sparse: true });
GsiPaperRecordSchema.index({ createdAt: -1 });

module.exports = mongoose.models.GsiPaperRecord ||
  mongoose.model("GsiPaperRecord", GsiPaperRecordSchema);
