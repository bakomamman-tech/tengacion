const mongoose = require("mongoose");

const WalletAccountSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    ownerType: {
      type: String,
      enum: ["creator", "platform"],
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    currency: {
      type: String,
      default: "NGN",
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 10,
      index: true,
    },
    label: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

WalletAccountSchema.index({ ownerType: 1, ownerId: 1, currency: 1 });

module.exports = mongoose.model("WalletAccount", WalletAccountSchema);
