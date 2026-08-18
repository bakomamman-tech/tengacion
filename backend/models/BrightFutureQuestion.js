const mongoose = require("mongoose");

const SUBJECTS = [
  "mathematics",
  "english",
  "basic_science_technology",
  "social_studies",
];

const BrightFutureQuestionSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    subject: { type: String, required: true, enum: SUBJECTS, index: true },
    order: { type: Number, required: true, min: 1, max: 10 },
    prompt: { type: String, required: true, trim: true, maxlength: 1000 },
    options: {
      type: [{ type: String, trim: true, maxlength: 300 }],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 5 && new Set(value.map((item) => String(item).trim().toLowerCase())).size === 5,
        message: "A Bright Future question must have exactly five distinct options.",
      },
    },
    correctIndex: { type: Number, required: true, min: 0, max: 4 },
    active: { type: Boolean, default: true, index: true },
    version: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true }
);

BrightFutureQuestionSchema.index({ subject: 1, order: 1 }, { unique: true });

module.exports = mongoose.model("BrightFutureQuestion", BrightFutureQuestionSchema);
module.exports.BRIGHT_FUTURE_SUBJECTS = SUBJECTS;
