const mongoose = require("mongoose");

/* ================= COMMENT SCHEMA ================= */
const ReplySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    text: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

const CommentSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    replies: {
      type: [ReplySchema],
      default: [],
    },
  },
  { timestamps: true }
);

/* ================= POST SCHEMA ================= */
const PostSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    text: {
      type: String,
      trim: true,
      maxlength: 5000,
    },

    media: [
      {
        public_id: String, // Cloudinary
        url: String,
        type: {
          type: String,
          enum: ["image", "video", "gif"],
        },
      },
    ],

    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],

    comments: {
      type: [CommentSchema],
      default: [],
    },

    commentsCount: {
      type: Number,
      default: 0,
    },

    privacy: {
      type: String,
      enum: ["public", "friends", "private"],
      default: "public",
      index: true,
    },

    edited: {
      type: Boolean,
      default: false,
    },

    shareCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

/* ================= INDEXES ================= */
PostSchema.index({ createdAt: -1 });
PostSchema.index({ author: 1, createdAt: -1 });
PostSchema.index({ privacy: 1, createdAt: -1 });

/* ================= CLEAN JSON ================= */
PostSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Post", PostSchema);
