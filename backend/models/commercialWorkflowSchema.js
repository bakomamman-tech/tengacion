const mongoose = require('mongoose');
const config = require('../config/commercialRoadmap');
const text = (max = 2000) => ({type: String, trim: true, maxlength: max, default: ''});
const number = {type: Number, min: 0, validate: Number.isFinite};
const indexes = [{type: Number, min: 0, validate: Number.isInteger}];
const bounded = (type, max = 100) => ({type: [type], validate: v => v.length <= max});
const options = {_id: false, strict: 'throw'};
const linkedText = new mongoose.Schema({key: {...text(100), required: true}, value: text(4000), evidenceIndexes: indexes}, options);
const score = new mongoose.Schema({key: {type: String, enum: config.dimensions, required: true}, value: {...number, max: 5}, evidenceIndexes: indexes}, options);
const gate = new mongoose.Schema({key: {type: String, enum: config.controls, required: true}, status: {type: String, enum: ['missing', 'pass', 'hold'], default: 'missing'}, evidenceIndexes: indexes}, options);
const metric = new mongoose.Schema({key: {...text(100), required: true}, value: number, unit: text(60), confidence: {type: String, enum: ['actual', 'estimated', 'disputed', 'incomplete'], default: 'incomplete'}, observedAt: Date, evidenceIndexes: indexes}, options);
const threshold = new mongoose.Schema({key: {...text(100), required: true}, direction: {type: String, enum: ['minimum', 'maximum'], required: true}, value: {...number, required: true}}, options);
const step = new mongoose.Schema({key: {...text(100), required: true}, owner: text(200), status: {type: String, enum: ['pending', 'done', 'blocked'], default: 'pending'}, dueAt: Date, evidenceIndexes: indexes}, options);
const outreachTarget = new mongoose.Schema({
  key: {...text(100), required: true},
  recipient: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  grant: {type: mongoose.Schema.Types.ObjectId, ref: 'ExternalReadinessShare'},
  status: {type: String, enum: ['planned', 'in_conversation', 'followup', 'closed'], default: 'planned'},
  followupOwner: text(200), nextStep: text(2000), reviewAt: Date, evidenceIndexes: indexes,
  meetingStatus: {type: String, enum: ['not_scheduled', 'scheduled', 'held', 'cancelled'], default: 'not_scheduled'},
  interestLevel: {type: String, enum: ['unknown', 'low', 'medium', 'high', 'declined'], default: 'unknown'},
  objections: text(4000), diligenceRequests: text(4000), requestedTerms: text(4000), riskyAsks: text(4000),
  advisorReviewState: {type: String, enum: ['not_required', 'pending', 'reviewed'], default: 'not_required'},
  advisorReviewEvidenceIndexes: indexes,
}, options);
module.exports = new mongoose.Schema({
  outreachTargets: bounded(outreachTarget, 50),
  state: {type: String, enum: config.states, default: 'research'},
  decision: {type: String, enum: config.decisions},
  subject: text(200), channel: {type: String, enum: config.channels}, revenueLine: {type: String, enum: config.revenueLines},
  hypothesis: text(4000), learning: text(4000), nextCohort: text(200), rollbackTrigger: text(2000),
  currency: {type: String, match: /^[A-Z]{3}$/}, budgetLimit: number, spendToDate: number,
  periodStart: Date, periodEnd: Date, reviewAt: Date,
  scores: bounded(score, 12), gates: bounded(gate, 9), metrics: bounded(metric), thresholds: bounded(threshold),
  details: bounded(linkedText), steps: bounded(step), acceptance: bounded(linkedText, 20),
}, options);