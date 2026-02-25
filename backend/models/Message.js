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
      default: "",
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

    type: {
      type: String,
      enum: ["text", "contentCard"],
      default: "text",
      index: true
    },

    metadata: {
      itemType: {
        type: String,
        enum: ["track", "book"],
        default: ""
      },
      itemId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
      },
      previewType: {
        type: String,
        enum: ["play", "read", ""],
        default: ""
      },
      title: {
        type: String,
        default: ""
      },
      description: {
        type: String,
        default: ""
      },
      price: {
        type: Number,
        default: 0
      },
      coverImageUrl: {
        type: String,
        default: ""
      }
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

MessageSchema.pre("validate", function () {
  if (this.type === "text") {
    const clean = String(this.text || "").trim();
    if (!clean) {
      throw new Error("Text message cannot be empty");
    }
    this.text = clean;
  }

  if (this.type === "contentCard") {
    const hasCard =
      this.metadata &&
      ["track", "book"].includes(this.metadata.itemType) &&
      this.metadata.itemId;
    if (!hasCard) {
      throw new Error("Content card metadata is required");
    }
  }
});

// Hide internal fields when sending to frontend
MessageSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Message", MessageSchema);
