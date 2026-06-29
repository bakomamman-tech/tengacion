const mongoose = require("mongoose");

const boundedText = (maxlength = 240, extra = {}) => ({
  type: String,
  default: "",
  trim: true,
  maxlength,
  ...extra,
});

const SchoolTuitionPaymentSchema = new mongoose.Schema(
  {
    schoolSlug: boundedText(120, { required: true, lowercase: true, index: true }),
    schoolName: boundedText(180, { required: true }),
    parentName: boundedText(160, { required: true, index: true }),
    childName: boundedText(160, { required: true, index: true }),
    childClass: boundedText(120, { required: true, index: true }),
    bankName: boundedText(160, { required: true }),
    email: boundedText(160, { required: true, lowercase: true, index: true }),
    homeAddress: boundedText(500, { required: true }),
    phoneNumber: boundedText(60, { required: true, index: true }),
    amount: {
      type: Number,
      required: true,
      min: 100,
      max: 10000000,
    },
    currency: boundedText(10, { required: true, uppercase: true }),
    provider: boundedText(40, { required: true, lowercase: true }),
    reference: boundedText(180, { required: true, unique: true, index: true }),
    providerAccessCode: boundedText(240),
    providerTransactionId: boundedText(160, { index: true }),
    status: {
      type: String,
      enum: ["initiated", "pending", "paid", "failed", "abandoned"],
      default: "initiated",
      index: true,
    },
    gatewayStatus: boundedText(80),
    paymentChannel: boundedText(80),
    verifiedBankName: boundedText(160),
    failureReason: boundedText(500),
    paidAt: { type: Date, default: null, index: true },
    lastVerifiedAt: { type: Date, default: null },
    metadata: {
      ip: boundedText(120),
      userAgent: boundedText(260),
      sourcePath: boundedText(260),
    },
  },
  {
    timestamps: true,
  }
);

SchoolTuitionPaymentSchema.index({ schoolSlug: 1, createdAt: -1 });
SchoolTuitionPaymentSchema.index({ schoolSlug: 1, status: 1, createdAt: -1 });
SchoolTuitionPaymentSchema.index({ childName: "text", parentName: "text", email: "text", reference: "text" });

module.exports = mongoose.model("SchoolTuitionPayment", SchoolTuitionPaymentSchema);
