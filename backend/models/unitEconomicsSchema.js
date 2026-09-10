const mongoose = require("mongoose");
const config = require("../config/unitEconomics");
const text = (max = 2000) => ({ type: String, trim: true, maxlength: max });
const number = (min = -1e24, max = 1e24) => ({ type: Number, min, max, validate: Number.isFinite });
const owner = { type: mongoose.Schema.Types.ObjectId, ref: "User" };
const key = { ...text(100), required: true, match: /^[a-z][a-z0-9_]*$/ };
const sub = (fields) => new mongoose.Schema(fields, { _id: false, strict: "throw" });
const bounded = (schema, max = config.maxEntries) => ({ type: [schema], validate: (v) => v.length <= max });
const assumption = sub({
  key: { type: String, required: true, enum: config.inputs.map((i) => i.key) }, owner,
  confidence: { type: String, enum: ["incomplete", "assumption", "estimated", "actual", "disputed"], default: "incomplete" },
  low: number(), base: number(), high: number(), rationale: text(),
  evidenceIndexes: { type: [{ type: Number, min: 0, max: 99, validate: Number.isInteger }], validate: (v) => v.length <= 100 },
});
const condition = {
  scenario: { type: String, enum: config.scenarios }, metric: { type: String, enum: config.metrics },
  operator: { type: String, enum: ["gte", "lte"] }, threshold: number(),
};
const schema = sub({
  period: { type: String, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  currency: { type: String, match: /^[A-Z]{3}$/ },
  assumptions: bounded(assumption, config.inputs.length),
  milestones: bounded(sub({ key, title: text(200), owner, targetDate: Date, targetSubscribers: number(0), rationale: text() })),
  riskTriggers: bounded(sub({ key, title: text(200), owner, ...condition, response: text() })),
  allocationGates: bounded(sub({ key, title: text(200), owner, ...condition, milestoneKey: text(100),
    riskTriggerKeys: { type: [text(100)], validate: (v) => v.length <= config.maxEntries },
    priorMaximum: number(0, 1e12), revisedMaximum: number(0, 1e12), rationale: text(), stopLoss: text() })),
});
module.exports = schema;
