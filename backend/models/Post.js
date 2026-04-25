const mongoose = require("mongoose");
const { createMediaAssetSchema } = require("./subschemas/mediaAsset");
const { COMMENT_MAX_CHARS } = require("../utils/commentText");

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
      maxlength: COMMENT_MAX_CHARS,
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
      maxlength: COMMENT_MAX_CHARS,
    },

    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    hashtags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        index: true,
      },
    ],

    audience: {
      type: String,
      enum: ["public", "friends", "close_friends"],
      default: "friends",
      index: true,
    },

    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
        emoji: { type: String, default: "", maxlength: 8, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    reactionsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    edited: {
      type: Boolean,
      default: false,
    },

    editedAt: {
      type: Date,
      default: null,
    },

    replies: {
      type: [ReplySchema],
      default: [],
    },
  },
  { timestamps: true }
);

const TaggedUserSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    username: {
      type: String,
      trim: true,
      maxlength: 30,
      default: "",
    },
  },
  { _id: false }
);

const SharedPostSchema = new mongoose.Schema(
  {
    originalPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    originalAuthorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    originalAuthorName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    originalAuthorUsername: {
      type: String,
      trim: true,
      maxlength: 30,
      default: "",
    },
    originalAuthorAvatar: {
      type: String,
      trim: true,
      default: "",
    },
    originalText: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    previewImage: {
      type: String,
      trim: true,
      default: "",
    },
    previewMediaType: {
      type: String,
      enum: ["text", "image", "video", "reel"],
      default: "text",
    },
  },
  { _id: false }
);

const PostMediaSchema = createMediaAssetSchema({
  type: {
    type: String,
    enum: ["image", "video", "gif"],
    default: "image",
  },
  mimeType: {
    type: String,
    trim: true,
    default: "",
  },
});

const PostVideoSchema = createMediaAssetSchema({
  playbackUrl: {
    type: String,
    trim: true,
    default: "",
  },
  thumbnailUrl: {
    type: String,
    trim: true,
    default: "",
  },
  sizeBytes: {
    type: Number,
    default: 0,
  },
  mimeType: {
    type: String,
    trim: true,
    default: "",
  },
});

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

    tags: {
      type: [String],
      default: [],
    },

    taggedUsers: {
      type: [TaggedUserSchema],
      default: [],
    },

    feeling: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "",
    },

    location: {
      type: String,
      trim: true,
      maxlength: 140,
      default: "",
    },

    callToAction: {
      type: {
        type: String,
        enum: ["none", "call"],
        default: "none",
      },
      enabled: {
        type: Boolean,
        default: false,
      },
      value: {
        type: String,
        trim: true,
        maxlength: 36,
        default: "",
      },
    },

    moreOptions: {
      type: [String],
      default: [],
    },

    type: {
      type: String,
      enum: ["text", "image", "video", "reel", "poll", "quiz", "checkin"],
      default: "text",
      index: true,
    },

    poll: {
      question: { type: String, default: "", trim: true, maxlength: 280 },
      options: [
        {
          id: { type: String, default: "" },
          text: { type: String, default: "", trim: true, maxlength: 180 },
          votesCount: { type: Number, default: 0, min: 0 },
        },
      ],
      votes: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
          optionId: { type: String, default: "" },
        },
      ],
      closesAt: { type: Date, default: null },
    },

    quiz: {
      question: { type: String, default: "", trim: true, maxlength: 280 },
      options: [
        {
          id: { type: String, default: "" },
          text: { type: String, default: "", trim: true, maxlength: 180 },
        },
      ],
      correctOptionId: { type: String, default: "" },
      answers: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
          optionId: { type: String, default: "" },
          isCorrect: { type: Boolean, default: false },
        },
      ],
    },

    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    visibility: {
      type: String,
      enum: ["public", "friends", "close_friends", "private", "blocked"],
      default: "public",
      index: true,
    },

    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
        emoji: { type: String, default: "", maxlength: 8, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    reactionsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    media: {
      type: [PostMediaSchema],
      default: [],
    },
    video: {
      type: PostVideoSchema,
      default: null,
    },
    audio: {
      trackId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Track",
        index: true,
      },
      url: {
        type: String,
        trim: true,
        default: "",
      },
      previewUrl: {
        type: String,
        trim: true,
        default: "",
      },
      title: {
        type: String,
        trim: true,
        default: "",
      },
      durationSec: {
        type: Number,
        default: 0,
      },
      coverImageUrl: {
        type: String,
        trim: true,
        default: "",
      },
    },

    sharedPost: {
      type: SharedPostSchema,
      default: null,
    },

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

    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
      index: true,
    },

    moderationStatus: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "quarantined",
        "ALLOW",
        "HOLD_FOR_REVIEW",
        "RESTRICTED_BLURRED",
        "BLOCK_EXPLICIT_ADULT",
        "BLOCK_SUSPECTED_CHILD_EXPLOITATION",
        "BLOCK_EXTREME_GORE",
        "BLOCK_ANIMAL_CRUELTY",
        "BLOCK_REPEAT_VIOLATOR",
      ],
      default: "pending",
      trim: true,
      maxlength: 80,
      index: true,
    },
    moderationLabels: {
      type: [String],
      default: [],
    },
    moderationReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    moderationConfidence: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    storageStage: {
      type: String,
      enum: ["temporary", "quarantine", "permanent"],
      default: "temporary",
      index: true,
    },
    moderationCaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ModerationCase",
      default: null,
      index: true,
    },
    sensitiveContent: {
      type: Boolean,
      default: false,
      index: true,
    },
    sensitiveType: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    blurPreviewUrl: {
      type: String,
      default: "",
      trim: true,
    },
    originalVisibility: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },
    reviewRequired: {
      type: Boolean,
      default: false,
      index: true,
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
PostSchema.index({ hashtags: 1, createdAt: -1 });
PostSchema.index({ audience: 1, createdAt: -1 });

/* ================= CLEAN JSON ================= */
PostSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Post", PostSchema);
