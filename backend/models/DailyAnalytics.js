const mongoose = require("mongoose");

const DailyAnalyticsSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true, index: true }, // YYYY-MM-DD
    dau: { type: Number, default: 0, min: 0 },
    mau: { type: Number, default: 0, min: 0 },
    newUsers: { type: Number, default: 0, min: 0 },
    postsCount: { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
    reportsCount: { type: Number, default: 0, min: 0 },
    uploadFailuresCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DailyAnalytics", DailyAnalyticsSchema);
