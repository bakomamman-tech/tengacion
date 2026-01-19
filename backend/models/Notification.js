const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    // Who receives the notification
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    // Who triggered the action
    fromId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    // Standardized types like Facebook
    type: {
      type: String,
      enum: [
        "like",
        "comment",
        "follow",
        "message",
        "mention",
        "tag",
        "friend_request",
        "system"
      ],
      required: true,
      index: true
    },

    text: {
      type: String,
      trim: true,
      maxlength: 500
    },

    // Target entity (post, comment, message etc.)
    entity: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        index: true
      },
      model: {
        type: String,
        enum: ["Post", "Comment", "Message", "User"]
      }
    },

    read: {
      type: Boolean,
      default: false,
      index: true
    },

    // Facebook-style extras
    metadata: {
      previewImage: String,
      previewText: String,
      link: String
    }
  },

  {
    timestamps: true
  }
);

// PERFORMANCE INDEXES
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, read: 1 });

// Clean response for frontend
NotificationSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Notification", NotificationSchema);
