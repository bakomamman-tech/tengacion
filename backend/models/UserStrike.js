const mongoose = require("mongoose");

const UserStrikeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
    history: [
      {
        reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report", default: null },
        count: { type: Number, default: 1 },
        reason: { type: String, default: "", trim: true, maxlength: 300 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    lastActionAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserStrike", UserStrikeSchema);
