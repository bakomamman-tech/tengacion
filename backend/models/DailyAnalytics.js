const mongoose = require("mongoose");

const DailyAnalyticsSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true, index: true }, // YYYY-MM-DD
    dau: { type: Number, default: 0, min: 0 },
    mau: { type: Number, default: 0, min: 0 },
    newUsers: { type: Number, default: 0, min: 0 },
    activeUsers: { type: Number, default: 0, min: 0 },
    totalLogins: { type: Number, default: 0, min: 0 },
    creatorAccounts: { type: Number, default: 0, min: 0 },
    songsUploaded: { type: Number, default: 0, min: 0 },
    albumsUploaded: { type: Number, default: 0, min: 0 },
    booksUploaded: { type: Number, default: 0, min: 0 },
    podcastsUploaded: { type: Number, default: 0, min: 0 },
    videosUploaded: { type: Number, default: 0, min: 0 },
    postsCount: { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
    downloads: { type: Number, default: 0, min: 0 },
    streams: { type: Number, default: 0, min: 0 },
    messagesSent: { type: Number, default: 0, min: 0 },
    friendRequestsSent: { type: Number, default: 0, min: 0 },
    friendRequestsAccepted: { type: Number, default: 0, min: 0 },
    successfulPurchases: { type: Number, default: 0, min: 0 },
    failedPurchases: { type: Number, default: 0, min: 0 },
    revenueAmount: { type: Number, default: 0, min: 0 },
    reportsCount: { type: Number, default: 0, min: 0 },
    uploadFailuresCount: { type: Number, default: 0, min: 0 },
    loginWarnings: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DailyAnalytics", DailyAnalyticsSchema);
