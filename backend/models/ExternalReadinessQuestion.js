const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  share: { type: mongoose.Schema.Types.ObjectId, ref: "ExternalReadinessShare", required: true, index: true },
  askedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  question: { type: String, trim: true, required: true, maxlength: 4000 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  dueAt: { type: Date, required: true },
  response: { type: String, trim: true, maxlength: 6000, default: "" },
  draftedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  reviewedAt: Date,
  status: { type: String, enum: ["intake", "draft", "approved", "closed"], default: "intake" },
}, { timestamps: true, optimisticConcurrency: true, strict: "throw" });
module.exports = mongoose.model("ExternalReadinessQuestion", schema);
