const mongoose = require("mongoose");

const groupMemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["admin", "moderator", "member"], default: "member" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const groupPostSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: 5000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const groupSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    privacy: { type: String, enum: ["public", "private"], default: "public", index: true },
    coverImage: { type: String, trim: true, maxlength: 2048, default: "" },
    members: { type: [groupMemberSchema], default: [] },
    posts: { type: [groupPostSchema], default: [] },
  },
  { timestamps: true }
);

groupSchema.index({ "members.user": 1, updatedAt: -1 });
groupSchema.index({ privacy: 1, updatedAt: -1 });

module.exports = mongoose.models.Group || mongoose.model("Group", groupSchema);
