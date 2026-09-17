const mongoose = require("mongoose");

const {
  TENGAAGENT_PLAN_CODES,
} = require("../../config/tengaAgentPlans");

const TengaAgentSubscriptionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TengaAgentOrganization",
      required: true,
      unique: true,
      index: true,
    },
    planCode: {
      type: String,
      enum: TENGAAGENT_PLAN_CODES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["trialing", "active", "past_due", "suspended", "cancelled"],
      required: true,
      default: "trialing",
      index: true,
    },
    billingProvider: {
      type: String,
      enum: ["manual", "paystack", "stripe"],
      default: "manual",
      index: true,
    },
    providerCustomerId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 240,
      select: false,
    },
    providerSubscriptionId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 240,
      select: false,
    },
    currentPeriodStart: {
      type: Date,
      default: null,
    },
    currentPeriodEnd: {
      type: Date,
      default: null,
      index: true,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    renewalMode: {
      type: String,
      enum: ["manual", "prepaid", "recurring"],
      default: "manual",
      index: true,
    },
    lastPaymentReference: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
      index: true,
    },
    lastPaymentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

TengaAgentSubscriptionSchema.index({
  status: 1,
  currentPeriodEnd: 1,
});

module.exports = mongoose.model(
  "TengaAgentSubscription",
  TengaAgentSubscriptionSchema
);
