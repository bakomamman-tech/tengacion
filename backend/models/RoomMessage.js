const mongoose = require("mongoose");

const RoomMessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    attachments: [
      {
        url: { type: String, default: "" },
        type: { type: String, default: "" },
        name: { type: String, default: "" },
      },
    ],
    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
        emoji: { type: String, default: "", trim: true, maxlength: 8 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

RoomMessageSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model("RoomMessage", RoomMessageSchema);
