const mongoose = require("mongoose");

const { createMediaAssetSchema } = require("./subschemas/mediaAsset");

const MarketplaceProductSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceSeller",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 6000,
    },
    images: {
      type: [createMediaAssetSchema({ includeType: true, defaultType: "image" })],
      default: [],
    },
    category: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 300,
    },
    currency: {
      type: String,
      default: "NGN",
      trim: true,
      uppercase: true,
      maxlength: 10,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    condition: {
      type: String,
      enum: ["new", "used"],
      default: "new",
    },
    state: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },
    deliveryOptions: {
      type: [
        {
          type: String,
          enum: ["pickup", "local_delivery", "nationwide_delivery"],
        },
      ],
      default: [],
    },
    deliveryNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 400,
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    isHidden: {
      type: Boolean,
      default: false,
      index: true,
    },
    moderationStatus: {
      type: String,
      enum: ["approved", "hidden", "removed"],
      default: "approved",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

MarketplaceProductSchema.index({
  title: "text",
  description: "text",
  category: "text",
  state: "text",
  city: "text",
});

MarketplaceProductSchema.index({ seller: 1, isPublished: 1, isHidden: 1, updatedAt: -1 });

module.exports = mongoose.model("MarketplaceProduct", MarketplaceProductSchema);
