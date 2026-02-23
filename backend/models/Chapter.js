const mongoose = require("mongoose");

const ChapterSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
    },
    content: {
      type: String,
      required: true,
    },
    isFree: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

ChapterSchema.index({ bookId: 1, order: 1 }, { unique: true });

module.exports = mongoose.model("Chapter", ChapterSchema);
