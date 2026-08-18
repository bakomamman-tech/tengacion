const mongoose = require("mongoose");

const BrightFutureCompetitionConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    competitionStatus: {
      type: String,
      enum: [
        "registration_upcoming",
        "registration_open",
        "examination_open",
        "examination_closed",
        "results_published",
      ],
      default: "examination_open",
    },
    registrationOpen: { type: Boolean, default: true },
    examinationOpen: { type: Boolean, default: true },
    leaderboardVisible: { type: Boolean, default: true },
    winnerVisible: { type: Boolean, default: true },
    detailedResultsVisible: { type: Boolean, default: false },
    questionTimerSeconds: { type: Number, default: 50, min: 20, max: 180 },
    allowedViolations: { type: Number, default: 3, min: 1, max: 10 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BrightFutureCompetitionConfig", BrightFutureCompetitionConfigSchema);
