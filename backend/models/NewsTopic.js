const mongoose = require("mongoose");

const NewsTopicSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    category: {
      type: String,
      default: "general",
      trim: true,
      lowercase: true,
      maxlength: 80,
      index: true,
    },
    summary: {
      type: String,
      default: "",
      trim: true,
      maxlength: 260,
    },
    regionScopes: [{ type: String, trim: true, lowercase: true, maxlength: 40 }],
    keywords: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    icon: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    trustPriority: {
      type: Number,
      default: 0.5,
      min: 0,
      max: 1,
    },
  },
  { timestamps: true }
);

NewsTopicSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("NewsTopic", NewsTopicSchema);
