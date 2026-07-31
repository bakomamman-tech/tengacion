const mongoose = require("mongoose");

const KadahiveEventRegistrationSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KadahiveEvent",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["registered", "attended", "cancelled"],
      default: "registered",
    },
  },
  { timestamps: true }
);

KadahiveEventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model(
  "KadahiveEventRegistration",
  KadahiveEventRegistrationSchema
);
