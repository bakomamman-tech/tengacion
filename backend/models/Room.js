const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120, index: true },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
    cover: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
    privacy: {
      type: String,
      enum: ["public", "private"],
      default: "public",
      index: true,
    },
  },
  { timestamps: true }
);

RoomSchema.index({ name: "text", description: "text" });

module.exports = mongoose.model("Room", RoomSchema);
