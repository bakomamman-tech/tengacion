const mongoose = require("mongoose");

const sessionMetaSchema = new mongoose.Schema(
  {
    deviceName: { type: String, default: "", trim: true, maxlength: 180 },
    ip: { type: String, default: "", trim: true, maxlength: 180 },
    userAgent: { type: String, default: "", trim: true, maxlength: 400 },
    country: { type: String, default: "", trim: true, maxlength: 32 },
    city: { type: String, default: "", trim: true, maxlength: 120 },
    fingerprint: { type: String, default: "", trim: true, maxlength: 128 },
  },
  { _id: false }
);

const authChallengeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: ["login_mfa", "mfa_setup"],
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: ["totp", "email"],
      required: true,
    },
    codeHash: { type: String, default: "" },
    secretCipher: { type: String, default: "" },
    sessionMeta: {
      type: sessionMetaSchema,
      default: () => ({}),
    },
    riskScore: { type: Number, default: 0, min: 0 },
    riskReasons: [{ type: String, default: "", trim: true, maxlength: 80 }],
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 5, min: 1, max: 10 },
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

authChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AuthChallenge", authChallengeSchema);
