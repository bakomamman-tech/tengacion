const mongoose = require("mongoose");
const VoicebridgeDiagnosticTranscript = require(
  "../models/VoicebridgeDiagnosticTranscript"
);

const DEFAULT_CAPTURE_WINDOW_MINUTES = 30;
const MAX_CAPTURE_WINDOW_MINUTES = 60;
const TRANSCRIPT_RETENTION_MINUTES = 30;

let captureEnabledUntilMs = 0;

const toText = (value) =>
  typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();

const clampCaptureMinutes = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_CAPTURE_WINDOW_MINUTES;
  return Math.max(1, Math.min(MAX_CAPTURE_WINDOW_MINUTES, Math.floor(parsed)));
};

const clampLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
};

const getCaptureStatus = ({ nowMs = Date.now() } = {}) => {
  const active = captureEnabledUntilMs > nowMs;
  return {
    active,
    enabledUntil: active ? new Date(captureEnabledUntilMs).toISOString() : null,
    captureWindowMinutesDefault: DEFAULT_CAPTURE_WINDOW_MINUTES,
    captureWindowMinutesMax: MAX_CAPTURE_WINDOW_MINUTES,
    transcriptRetentionMinutes: TRANSCRIPT_RETENTION_MINUTES,
    privacy: {
      rawPhoneStored: false,
      rawSessionIdStored: false,
      recordingUrlStored: false,
      audioStored: false,
      transcriptLogged: false,
    },
  };
};

const enableCapture = (minutes = DEFAULT_CAPTURE_WINDOW_MINUTES) => {
  const safeMinutes = clampCaptureMinutes(minutes);
  captureEnabledUntilMs = Date.now() + safeMinutes * 60 * 1000;
  return getCaptureStatus();
};

const disableCapture = () => {
  captureEnabledUntilMs = 0;
  return getCaptureStatus();
};

const captureTemporaryTranscript = async (
  { transcript, languagePair, correlationId, transcription } = {},
  { DiagnosticModel = VoicebridgeDiagnosticTranscript, now = () => new Date() } = {}
) => {
  const nowDate = now();
  if (!getCaptureStatus({ nowMs: nowDate.getTime() }).active) return null;

  const safeTranscript = toText(transcript);
  const safeCorrelationId = toText(correlationId);
  if (!safeTranscript || !safeCorrelationId) return null;

  const expiresAt = new Date(
    nowDate.getTime() + TRANSCRIPT_RETENTION_MINUTES * 60 * 1000
  );

  const document = await DiagnosticModel.findOneAndUpdate(
    { correlationId: safeCorrelationId },
    {
      $setOnInsert: {
        correlationId: safeCorrelationId,
        channel: "africastalking-voice",
        languagePair,
        transcript: safeTranscript,
        provider: toText(transcription?.provider) || "sahara",
        model: toText(transcription?.model) || "sahara-v2.5",
        processedAudioDurationSeconds: Number.isFinite(
          transcription?.processedAudioDurationSeconds
        )
          ? transcription.processedAudioDurationSeconds
          : null,
        moneyMovementPerformed: false,
        expiresAt,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  ).lean();

  return document
    ? { id: String(document._id || ""), correlationId: document.correlationId, expiresAt: document.expiresAt }
    : null;
};

const completeTemporaryTranscript = async (
  { correlationId, orchestration } = {},
  { DiagnosticModel = VoicebridgeDiagnosticTranscript } = {}
) => {
  const safeCorrelationId = toText(correlationId);
  if (!safeCorrelationId) return null;
  const action = orchestration?.action || {};
  return DiagnosticModel.findOneAndUpdate(
    { correlationId: safeCorrelationId },
    {
      $set: {
        actionCompleted: orchestration?.actionCompleted === true,
        intent: toText(action.intent) || null,
        requestedAction: toText(action.requestedAction) || null,
        executedAction: toText(action.executedAction) || null,
        caseId: toText(action?.case?.caseId) || null,
        moneyMovementPerformed: false,
      },
    },
    { returnDocument: "after" }
  ).lean();
};

const toMetadata = (document) => ({
  id: String(document._id || ""),
  channel: document.channel,
  languagePair: document.languagePair,
  provider: document.provider,
  model: document.model,
  processedAudioDurationSeconds: document.processedAudioDurationSeconds ?? null,
  actionCompleted: document.actionCompleted === true,
  intent: document.intent || null,
  requestedAction: document.requestedAction || null,
  executedAction: document.executedAction || null,
  caseId: document.caseId || null,
  moneyMovementPerformed: false,
  createdAt: document.createdAt,
  expiresAt: document.expiresAt,
});

const toDetail = (document) => ({
  ...toMetadata(document),
  transcript: document.transcript,
});

const listTemporaryTranscripts = async (
  { limit = 50 } = {},
  { DiagnosticModel = VoicebridgeDiagnosticTranscript, now = () => new Date() } = {}
) => {
  const documents = await DiagnosticModel.find({ expiresAt: { $gt: now() } })
    .sort({ createdAt: -1 })
    .limit(clampLimit(limit))
    .select("-transcript -correlationId")
    .lean();
  return documents.map(toMetadata);
};

const getTemporaryTranscriptById = async (
  id,
  { DiagnosticModel = VoicebridgeDiagnosticTranscript, now = () => new Date() } = {}
) => {
  if (!mongoose.Types.ObjectId.isValid(String(id || ""))) return null;
  const document = await DiagnosticModel.findOne({
    _id: id,
    expiresAt: { $gt: now() },
  }).lean();
  return document ? toDetail(document) : null;
};

const getLatestTemporaryTranscript = async (
  { DiagnosticModel = VoicebridgeDiagnosticTranscript, now = () => new Date() } = {}
) => {
  const document = await DiagnosticModel.findOne({ expiresAt: { $gt: now() } })
    .sort({ createdAt: -1 })
    .lean();
  return document ? toDetail(document) : null;
};

const deleteTemporaryTranscript = async (
  id,
  { DiagnosticModel = VoicebridgeDiagnosticTranscript } = {}
) => {
  if (!mongoose.Types.ObjectId.isValid(String(id || ""))) return { deletedCount: 0 };
  const result = await DiagnosticModel.deleteOne({ _id: id });
  return { deletedCount: Number(result?.deletedCount || 0) };
};

const clearTemporaryTranscripts = async (
  { DiagnosticModel = VoicebridgeDiagnosticTranscript } = {}
) => {
  const result = await DiagnosticModel.deleteMany({});
  return { deletedCount: Number(result?.deletedCount || 0) };
};

module.exports = {
  DEFAULT_CAPTURE_WINDOW_MINUTES,
  MAX_CAPTURE_WINDOW_MINUTES,
  TRANSCRIPT_RETENTION_MINUTES,
  getCaptureStatus,
  enableCapture,
  disableCapture,
  captureTemporaryTranscript,
  completeTemporaryTranscript,
  listTemporaryTranscripts,
  getTemporaryTranscriptById,
  getLatestTemporaryTranscript,
  deleteTemporaryTranscript,
  clearTemporaryTranscripts,
};
