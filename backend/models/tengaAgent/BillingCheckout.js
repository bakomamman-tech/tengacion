const mongoose = require("mongoose");

const {
  TENGAAGENT_SELF_SERVICE_PLAN_CODES,
} = require("../../config/tengaAgentPlans");

const TengaAgentBillingCheckoutSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TengaAgentOrganization",
      required: true,
      index: true,
    },
    requestedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planCode: {
      type: String,
      enum: TENGAAGENT_SELF_SERVICE_PLAN_CODES,
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["paystack", "stripe"],
      required: true,
      index: true,
    },
    currency: {
      type: String,
      enum: ["NGN", "USD"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    reference: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
      maxlength: 180,
    },
    providerSessionId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 255,
      select: false,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled"],
      required: true,
      default: "pending",
      index: true,
    },
    failureCode: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    activatedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

TengaAgentBillingCheckoutSchema.index({
  organizationId: 1,
  createdAt: -1,
});

TengaAgentBillingCheckoutSchema.index({
  provider: 1,
  status: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "TengaAgentBillingCheckout",
  TengaAgentBillingCheckoutSchema
);
