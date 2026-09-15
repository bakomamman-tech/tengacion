const mongoose = require("mongoose");

const VoicebridgeDiagnosticTranscriptSchema = new mongoose.Schema(
  {
    correlationId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    channel: {
      type: String,
      default: "africastalking-voice",
      immutable: true,
    },
    languagePair: {
      type: String,
      enum: ["ha-en", "pcm-en"],
      required: true,
    },
    transcript: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    provider: {
      type: String,
      default: "sahara",
      trim: true,
      maxlength: 80,
    },
    model: {
      type: String,
      default: "sahara-v2.5",
      trim: true,
      maxlength: 120,
    },
    processedAudioDurationSeconds: {
      type: Number,
      default: null,
    },
    actionCompleted: {
      type: Boolean,
      default: false,
    },
    intent: {
      type: String,
      default: null,
      maxlength: 120,
    },
    requestedAction: {
      type: String,
      default: null,
      maxlength: 120,
    },
    executedAction: {
      type: String,
      default: null,
      maxlength: 120,
    },
    caseId: {
      type: String,
      default: null,
      maxlength: 120,
    },
    moneyMovementPerformed: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

VoicebridgeDiagnosticTranscriptSchema.index(
  { correlationId: 1 },
  { unique: true }
);
VoicebridgeDiagnosticTranscriptSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);
VoicebridgeDiagnosticTranscriptSchema.index({ createdAt: -1 });

module.exports = mongoose.model(
  "VoicebridgeDiagnosticTranscript",
  VoicebridgeDiagnosticTranscriptSchema
);
