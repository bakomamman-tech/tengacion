const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  record: {type: mongoose.Schema.Types.ObjectId, ref: "ExternalReadinessRecord", required: true, immutable: true},
  version: {type: Number, required: true, min: 0, immutable: true},
  capturedAt: {type: Date, required: true, immutable: true},
  changedBy: {type: mongoose.Schema.Types.ObjectId, ref: "User", immutable: true},
  snapshot: {type: mongoose.Schema.Types.Mixed, required: true, immutable: true},
}, {strict: "throw"});
schema.index({record: 1, version: 1}, {unique: true});
module.exports = mongoose.model("CommercialWorkflowRevision", schema);