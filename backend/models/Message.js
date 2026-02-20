const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    receiverId: {
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

    senderName: {
      type: String,
      trim: true,
      default: ""
    },

    clientId: {
      type: String,
      trim: true,
      default: ""
    },

    // Keep a numeric timestamp for frontend compatibility.
    time: {
      type: Number,
      default: () => Date.now(),
      index: true
    },

    // Facebook-style features
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
      index: true
    },

    attachments: [
      {
        url: String,
        type: {
          type: String,
          enum: ["image", "video", "file", "audio"]
        },
        name: String,
        size: Number
      }
    ],

    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    edited: {
      type: Boolean,
      default: false
    }
  },

  {
    timestamps: true // createdAt, updatedAt
  }
);

// Indexes for fast chat loading
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, receiverId: 1 });

// Hide internal fields when sending to frontend
MessageSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Message", MessageSchema);
