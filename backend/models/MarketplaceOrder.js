const mongoose = require("mongoose");

const MarketplaceOrderSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceSeller",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceProduct",
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "NGN",
      trim: true,
      uppercase: true,
      maxlength: 10,
    },
    platformFee: {
      type: Number,
      default: 300,
      min: 0,
    },
    sellerReceivable: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentProvider: {
      type: String,
      default: "paystack",
      trim: true,
      lowercase: true,
      maxlength: 40,
    },
    paymentReference: {
      type: String,
      default: "",
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    paystackAccessCode: {
      type: String,
      default: "",
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: ["initiated", "pending", "paid", "failed", "refunded"],
      default: "initiated",
      index: true,
    },
    orderStatus: {
      type: String,
      enum: [
        "pending",
        "paid",
        "processing",
        "shipped_or_ready",
        "delivered",
        "completed",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },
    deliveryMethod: {
      type: String,
      enum: ["pickup", "local_delivery", "nationwide_delivery"],
      required: true,
    },
    deliveryAddress: {
      type: String,
      default: "",
      trim: true,
      maxlength: 320,
    },
    deliveryContactPhone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },
    fulfillmentNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 600,
    },
    productTitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },
    productSlug: {
      type: String,
      default: "",
      trim: true,
      maxlength: 220,
    },
    productImageUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    storeName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },
    storeSlug: {
      type: String,
      default: "",
      trim: true,
      maxlength: 220,
    },
    stockReserved: {
      type: Boolean,
      default: false,
      index: true,
    },
    stockReleasedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

MarketplaceOrderSchema.index({ buyer: 1, createdAt: -1 });
MarketplaceOrderSchema.index({ seller: 1, createdAt: -1 });
MarketplaceOrderSchema.index({ product: 1, paymentStatus: 1 });

module.exports = mongoose.model("MarketplaceOrder", MarketplaceOrderSchema);
