const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    otp: { type: String, default: "" },
    otpHash: { type: String, default: "" },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    attemptCount: { type: Number, default: 0, min: 0 },
    resendCount: { type: Number, default: 0, min: 0 },
    lastSentAt: { type: Date, default: null },
    lastAttemptAt: { type: Date, default: null },
    lockedUntil: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    windowStartedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

otpSchema.index({ email: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Otp", otpSchema);
