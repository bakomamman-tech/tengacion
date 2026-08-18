const mongoose = require("mongoose");

const BrightFutureCounterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    sequence: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BrightFutureCounter", BrightFutureCounterSchema);
