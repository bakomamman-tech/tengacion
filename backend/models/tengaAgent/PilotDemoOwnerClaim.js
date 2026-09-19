"use strict";
const mongoose = require("mongoose");

// A separate pilot-only ownership record. Never repurpose a customer's tenant workspace.
const schema = new mongoose.Schema({
  // MongoDB enforces the singleton on its built-in primary key even before indexes are built.
  _id: { type: String, default: "tengacion-demo", immutable: true },
  key: { type: String, required: true, enum: ["tengacion-demo"], immutable: true },
  ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "TengaAgentOrganization", required: true },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: "TengaAgentAgent", required: true },
}, { timestamps: true });

module.exports = mongoose.model("TengaAgentPilotDemoOwnerClaim", schema);
