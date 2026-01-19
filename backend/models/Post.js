const mongoose = require("mongoose");

// ----- Comment Schema -----
const CommentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },

    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    // Reply system like Facebook
    replies: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        text: {
          type: String,
          maxlength: 1000
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  { timestamps: true }
);

// ----- Post Schema -----
const PostSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    text: {
      type: String,
      trim: true,
      maxlength: 5000
    },

    // Media like Facebook
    media: [
      {
        url: String,
        type: {
          type: String,
          enum: ["image", "video", "gif"]
        }
      }
    ],

    // Engagement
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true
      }
    ],

    comments: [CommentSchema],

    // Privacy like Facebook audience selector
    privacy: {
      type: String,
      enum: ["public", "friends", "private"],
      default: "public",
      index: true
    },

    edited: {
      type: Boolean,
      default: false
    },

    shareCount: {
      type: Number,
      default: 0
    }
  },

  {
    timestamps: true
  }
);

// ---- INDEXES FOR FEED PERFORMANCE ----
PostSchema.index({ createdAt: -1 });
PostSchema.index({ userId: 1, createdAt: -1 });
PostSchema.index({ privacy: 1, createdAt: -1 });

// Clean JSON for frontend
PostSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Post", PostSchema);
