const mongoose = require("mongoose");

const BookingConfirmationLockSchema =
  new mongoose.Schema(
    {
      _id: {
        type: String,
        required: true,
      },
      organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TengaAgentOrganization",
        required: true,
        index: true,
      },
      agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TengaAgentAgent",
        required: true,
        index: true,
      },
      ownerToken: {
        type: String,
        default: "",
        maxlength: 120,
      },
      lockedUntil: {
        type: Date,
        default: () => new Date(0),
        index: true,
      },
    },
    {
      timestamps: true,
      collection: "tengaagent_booking_confirmation_locks",
    }
  );

module.exports = mongoose.model(
  "TengaAgentBookingConfirmationLock",
  BookingConfirmationLockSchema
);
