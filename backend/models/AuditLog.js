const mongoose = require("mongoose");
const { buildExpiryDate, auditLogRetentionDays, sanitizePlainObject } = require("../config/storage");

const AuditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    targetType: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
      index: true,
    },
    targetId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    expiresAt: {
      type: Date,
      default: () =>
        buildExpiryDate({
          createdAt: new Date(),
          retentionDays: auditLogRetentionDays,
        }),
    },
    ip: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    userAgent: {
      type: String,
      default: "",
      trim: true,
      maxlength: 400,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

AuditLogSchema.pre("validate", function () {
  if (this.metadata && typeof this.metadata === "object") {
    this.metadata = sanitizePlainObject(this.metadata, {
      maxDepth: 2,
      maxKeys: 12,
      maxStringLength: 400,
      maxArrayLength: 6,
    });
  }
});

module.exports = mongoose.model("AuditLog", AuditLogSchema);
