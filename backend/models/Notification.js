const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    /* ================= CORE ================= */

    // Who receives the notification
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Who triggered the action
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* ================= TYPE ================= */

    // Facebook-style standardized types
    type: {
      type: String,
      enum: [
        "like",
        "comment",
        "reply",
        "follow",
        "message",
        "mention",
        "tag",
        "friend_request",
        "system",
      ],
      required: true,
      index: true,
    },

    /* ================= OPTIONAL TEXT ================= */

    // Human-readable message (optional, frontend can generate too)
    text: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    /* ================= TARGET ENTITY ================= */

    entity: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        index: true,
        default: null,
      },
      model: {
        type: String,
        enum: ["Post", "Comment", "Message", "User"],
        default: null,
      },
    },

    /* ================= STATE ================= */

    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    /* ================= EXTRAS ================= */

    // Preview helpers for UI
    metadata: {
      previewImage: { type: String, default: "" },
      previewText: { type: String, default: "" },
      link: { type: String, default: "" },
    },
  },
  {
    timestamps: true,
  }
);

/* ================= INDEXES ================= */

// Fast inbox loading
NotificationSchema.index({ recipient: 1, createdAt: -1 });

// Fast unread count
NotificationSchema.index({ recipient: 1, read: 1 });

/* ================= CLEAN JSON ================= */
NotificationSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Notification", NotificationSchema);
