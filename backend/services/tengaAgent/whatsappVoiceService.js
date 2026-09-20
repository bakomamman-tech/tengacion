const crypto = require("crypto");

const Conversation = require("../../models/tengaAgent/Conversation");
const Message = require("../../models/tengaAgent/Message");
const {
  buildMetaConfig,
  isAutoReplyEnabled,
  queueWhatsAppAutoReply,
} = require("./whatsappOutboundService");

const MAX_VOICE_BYTES = 16 * 1024 * 1024;
const META_REQUEST_TIMEOUT_MS = 15000;
const TRANSCRIPTION_TIMEOUT_MS = 90000;
const VOICE_SWEEP_INTERVAL_MS = 60 * 1000;
const VOICE_SWEEP_LIMIT = 5;
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const MAX_TRANSCRIPT_LENGTH = 6000;

let voiceSweepTimer = null;

const ALLOWED_AUDIO_MIME_TYPES = new Map([
  ["audio/ogg", "ogg"],
  ["audio/mpeg", "mp3"],
  ["audio/mp4", "mp4"],
  ["audio/m4a", "m4a"],
  ["audio/x-m4a", "m4a"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/webm", "webm"],
  ["audio/flac", "flac"],
  ["audio/x-flac", "flac"],
]);

const clean = (value, max = 1000) =>
  String(value || "")
    .trim()
    .slice(0, max);

const normalizeMimeType = (value) =>
  clean(value, 160)
    .toLowerCase()
    .split(";", 1)[0]
    .trim();

const isWhatsAppVoiceEnabled = () =>
  String(process.env.TENGAAGENT_WHATSAPP_VOICE_ENABLED || "")
    .trim()
    .toLowerCase() === "true";

const isAllowedMetaMediaHost = (hostname = "") => {
  const host = String(hostname || "").toLowerCase();
  return [
    "facebook.com",
    "fbcdn.net",
    "fbsbx.com",
    "whatsapp.net",
  ].some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
};

const validateMetaMediaUrl = (value) => {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || !isAllowedMetaMediaHost(url.hostname)) {
    return null;
  }

  if (url.username || url.password) {
    return null;
  }

  return url.toString();
};

const fetchWithTimeout = async (url, init, timeoutMs, fetchImpl = global.fetch) => {
  if (typeof fetchImpl !== "function") {
    const error = new Error("HTTP client is unavailable.");
    error.code = "WHATSAPP_VOICE_HTTP_UNAVAILABLE";
    throw error;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Voice-note provider request timed out.");
      timeoutError.code = "WHATSAPP_VOICE_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const readJsonResponse = async (response, maxChars = 64 * 1024) => {
  const raw = await response.text();
  if (!raw || raw.length > maxChars) {
    const error = new Error("Provider returned malformed voice-note metadata.");
    error.code = "WHATSAPP_VOICE_BAD_RESPONSE";
    throw error;
  }

  try {
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("invalid payload");
    }
    return payload;
  } catch {
    const error = new Error("Provider returned malformed voice-note metadata.");
    error.code = "WHATSAPP_VOICE_BAD_RESPONSE";
    throw error;
  }
};

const retrieveMetaMediaMetadata = async ({
  mediaId,
  phoneNumberId,
  fetchImpl = global.fetch,
  accessToken,
  graphVersion,
}) => {
  const media = clean(mediaId, 300);
  const phone = clean(phoneNumberId, 160);
  if (!media || !phone) {
    const error = new Error("Voice-note media routing information is incomplete.");
    error.code = "WHATSAPP_VOICE_INVALID_MEDIA";
    throw error;
  }

  const { token, version } = buildMetaConfig({ accessToken, graphVersion });
  const url =
    `https://graph.facebook.com/${version}/${encodeURIComponent(media)}` +
    `?phone_number_id=${encodeURIComponent(phone)}`;
  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      redirect: "error",
    },
    META_REQUEST_TIMEOUT_MS,
    fetchImpl
  );

  if (!response.ok) {
    const error = new Error("Meta could not resolve the WhatsApp voice-note media.");
    error.code = "WHATSAPP_VOICE_MEDIA_LOOKUP_FAILED";
    error.status = response.status;
    throw error;
  }

  const payload = await readJsonResponse(response);
  const resolvedUrl = validateMetaMediaUrl(payload.url);
  const mimeType = normalizeMimeType(payload.mime_type);
  const fileSize = Number(payload.file_size);
  const responseMediaId = clean(payload.id, 300);

  if (
    !resolvedUrl ||
    !ALLOWED_AUDIO_MIME_TYPES.has(mimeType) ||
    !Number.isSafeInteger(fileSize) ||
    fileSize <= 0 ||
    fileSize > MAX_VOICE_BYTES ||
    (responseMediaId && responseMediaId !== media)
  ) {
    const error = new Error("WhatsApp voice-note media failed validation.");
    error.code = "WHATSAPP_VOICE_MEDIA_REJECTED";
    throw error;
  }

  return {
    url: resolvedUrl,
    mimeType,
    fileSize,
    sha256: clean(payload.sha256, 200),
    mediaId: responseMediaId || media,
    token,
  };
};

const readBodyWithLimit = async (response, maximumBytes) => {
  const headerLength = Number(response.headers?.get?.("content-length"));
  if (
    Number.isFinite(headerLength) &&
    (headerLength <= 0 || headerLength > maximumBytes)
  ) {
    const error = new Error("WhatsApp voice note is too large.");
    error.code = "WHATSAPP_VOICE_TOO_LARGE";
    throw error;
  }

  if (!response.body || typeof response.body.getReader !== "function") {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length <= 0 || buffer.length > maximumBytes) {
      const error = new Error("WhatsApp voice note is too large.");
      error.code = "WHATSAPP_VOICE_TOO_LARGE";
      throw error;
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    total += chunk.length;
    if (total > maximumBytes) {
      await reader.cancel().catch(() => null);
      const error = new Error("WhatsApp voice note is too large.");
      error.code = "WHATSAPP_VOICE_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }

  if (total <= 0) {
    const error = new Error("WhatsApp voice note was empty.");
    error.code = "WHATSAPP_VOICE_EMPTY";
    throw error;
  }

  return Buffer.concat(chunks, total);
};

const hashMatches = (buffer, expectedHash) => {
  const expected = clean(expectedHash, 200);
  if (!expected) return true;

  const base64 = crypto.createHash("sha256").update(buffer).digest("base64");
  const hex = crypto.createHash("sha256").update(buffer).digest("hex");
  const normalizedExpected = expected.toLowerCase();
  return expected === base64 || normalizedExpected === hex.toLowerCase();
};

const downloadMetaMedia = async ({
  metadata,
  fetchImpl = global.fetch,
}) => {
  const response = await fetchWithTimeout(
    metadata.url,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${metadata.token}` },
      redirect: "error",
    },
    META_REQUEST_TIMEOUT_MS,
    fetchImpl
  );

  if (!response.ok) {
    const error = new Error("Meta could not download the WhatsApp voice note.");
    error.code = "WHATSAPP_VOICE_DOWNLOAD_FAILED";
    error.status = response.status;
    throw error;
  }

  const responseMime = normalizeMimeType(response.headers?.get?.("content-type"));
  if (!ALLOWED_AUDIO_MIME_TYPES.has(responseMime) || responseMime !== metadata.mimeType) {
    const error = new Error("WhatsApp voice-note content type did not match metadata.");
    error.code = "WHATSAPP_VOICE_MIME_MISMATCH";
    throw error;
  }

  const buffer = await readBodyWithLimit(response, MAX_VOICE_BYTES);
  if (buffer.length !== metadata.fileSize) {
    const error = new Error("WhatsApp voice-note size did not match metadata.");
    error.code = "WHATSAPP_VOICE_SIZE_MISMATCH";
    throw error;
  }

  if (!hashMatches(buffer, metadata.sha256)) {
    const error = new Error("WhatsApp voice-note checksum validation failed.");
    error.code = "WHATSAPP_VOICE_HASH_MISMATCH";
    throw error;
  }

  return buffer;
};

const transcribeAudioWithOpenAI = async ({
  buffer,
  mimeType,
  fetchImpl = global.fetch,
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.TENGAAGENT_WHATSAPP_TRANSCRIPTION_MODEL || "gpt-transcribe",
}) => {
  const key = clean(apiKey, 10000);
  const transcriptionModel = clean(model, 120);
  const normalizedMime = normalizeMimeType(mimeType);
  const extension = ALLOWED_AUDIO_MIME_TYPES.get(normalizedMime);

  if (!key) {
    const error = new Error("OpenAI transcription is not configured.");
    error.code = "WHATSAPP_VOICE_TRANSCRIPTION_NOT_CONFIGURED";
    throw error;
  }
  if (!transcriptionModel || !extension || !Buffer.isBuffer(buffer) || !buffer.length) {
    const error = new Error("Voice-note transcription input is invalid.");
    error.code = "WHATSAPP_VOICE_TRANSCRIPTION_INVALID";
    throw error;
  }

  const form = new FormData();
  form.append("model", transcriptionModel);
  form.append(
    "file",
    new Blob([buffer], { type: normalizedMime }),
    `voice-note.${extension}`
  );

  const response = await fetchWithTimeout(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      redirect: "error",
    },
    TRANSCRIPTION_TIMEOUT_MS,
    fetchImpl
  );

  const payload = await readJsonResponse(response, 256 * 1024).catch((error) => {
    if (!response.ok) {
      const upstream = new Error("OpenAI could not transcribe the WhatsApp voice note.");
      upstream.code = "WHATSAPP_VOICE_TRANSCRIPTION_FAILED";
      upstream.status = response.status;
      throw upstream;
    }
    throw error;
  });

  if (!response.ok) {
    const error = new Error("OpenAI could not transcribe the WhatsApp voice note.");
    error.code = "WHATSAPP_VOICE_TRANSCRIPTION_FAILED";
    error.status = response.status;
    throw error;
  }

  const text = clean(payload.text, MAX_TRANSCRIPT_LENGTH);
  if (!text) {
    const error = new Error("Voice-note transcription was empty.");
    error.code = "WHATSAPP_VOICE_TRANSCRIPTION_EMPTY";
    throw error;
  }

  return {
    text,
    provider: "openai",
    model: transcriptionModel,
  };
};

const claimVoiceNote = async (messageId) => {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);

  return Message.findOneAndUpdate(
    {
      _id: messageId,
      provider: "meta_whatsapp",
      sourceType: "voice_note",
      $or: [
        { transcriptionStatus: "pending" },
        {
          transcriptionStatus: "processing",
          transcriptionClaimedAt: { $lte: staleBefore },
        },
      ],
    },
    {
      $set: {
        transcriptionStatus: "processing",
        transcriptionClaimedAt: now,
        transcriptionError: null,
      },
    },
    { returnDocument: "after" }
  );
};

const markVoiceFailure = async (message, error) => {
  const safeError = clean(error?.message || error, 1000) || "Voice-note transcription failed.";
  message.transcriptionStatus = "failed";
  message.transcriptionError = safeError;
  message.transcriptionClaimedAt = null;
  await message.save().catch(() => null);

  await Conversation.updateOne(
    {
      _id: message.conversationId,
      organizationId: message.organizationId,
      agentId: message.agentId,
      channel: "whatsapp",
      status: "ai_active",
    },
    { $set: { status: "handoff_requested" } }
  ).catch(() => null);
};

const processWhatsAppVoiceNote = async ({
  messageId,
  fetchImpl = global.fetch,
  accessToken,
  graphVersion,
  apiKey,
  transcriptionModel,
  metadataResolver = retrieveMetaMediaMetadata,
  mediaDownloader = downloadMetaMedia,
  transcriber = transcribeAudioWithOpenAI,
}) => {
  const message = await claimVoiceNote(messageId);
  if (!message) {
    const existing = await Message.findById(messageId).select("transcriptionStatus").lean();
    return {
      status: "already_claimed",
      existingStatus: existing?.transcriptionStatus || null,
    };
  }

  if (
    !message.providerMediaId ||
    !message.providerPhoneNumberId ||
    !message.externalSenderId
  ) {
    await markVoiceFailure(message, new Error("Voice-note provider metadata is incomplete."));
    return { status: "failed", code: "WHATSAPP_VOICE_INVALID_MEDIA" };
  }

  try {
    const metadata = await metadataResolver({
      mediaId: message.providerMediaId,
      phoneNumberId: message.providerPhoneNumberId,
      fetchImpl,
      accessToken,
      graphVersion,
    });
    const buffer = await mediaDownloader({ metadata, fetchImpl });
    const transcription = await transcriber({
      buffer,
      mimeType: metadata.mimeType,
      fetchImpl,
      apiKey,
      model: transcriptionModel,
    });

    message.content = transcription.text;
    message.providerMediaMimeType = metadata.mimeType;
    message.providerMediaSha256 = metadata.sha256 || message.providerMediaSha256;
    message.providerMediaSizeBytes = metadata.fileSize;
    message.transcriptionStatus = "completed";
    message.transcriptionProvider = transcription.provider;
    message.transcriptionModel = transcription.model;
    message.transcriptionClaimedAt = null;
    message.transcriptionError = null;
    await message.save();

    let replyQueueStatus = "disabled";
    if (isAutoReplyEnabled()) {
      const queued = await queueWhatsAppAutoReply({
        inboundMessageId: message._id,
        phoneNumberId: message.providerPhoneNumberId,
        recipientId: message.externalSenderId,
      });
      replyQueueStatus = queued.status;
    }

    return {
      status: "transcribed",
      messageId: message._id,
      replyQueueStatus,
    };
  } catch (error) {
    await markVoiceFailure(message, error);
    return {
      status: "failed",
      messageId: message._id,
      code: error?.code || "WHATSAPP_VOICE_FAILED",
    };
  }
};

const drainPendingWhatsAppVoiceNotes = async ({
  limit = VOICE_SWEEP_LIMIT,
  ...dependencies
} = {}) => {
  if (!isWhatsAppVoiceEnabled()) {
    return { processed: 0, transcribed: 0, failed: 0 };
  }

  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
  const pending = await Message.find({
    provider: "meta_whatsapp",
    sourceType: "voice_note",
    $or: [
      { transcriptionStatus: "pending" },
      {
        transcriptionStatus: "processing",
        transcriptionClaimedAt: { $lte: staleBefore },
      },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(Math.max(1, Math.min(Number(limit) || VOICE_SWEEP_LIMIT, 20)))
    .select("_id")
    .lean();

  const summary = { processed: 0, transcribed: 0, failed: 0 };
  for (const entry of pending) {
    const result = await processWhatsAppVoiceNote({
      messageId: entry._id,
      ...dependencies,
    });
    summary.processed += 1;
    if (result.status === "transcribed") summary.transcribed += 1;
    if (result.status === "failed") summary.failed += 1;
  }

  return summary;
};

const startWhatsAppVoiceScheduler = ({ logger = console } = {}) => {
  if (
    process.env.NODE_ENV === "test" ||
    !isWhatsAppVoiceEnabled() ||
    voiceSweepTimer
  ) {
    return voiceSweepTimer;
  }

  const runSweep = () =>
    drainPendingWhatsAppVoiceNotes().catch((error) => {
      logger.error?.("[TengaAgent WhatsApp] voice-note sweep failed", {
        message: error?.message || String(error),
      });
    });

  const initialTimer = setTimeout(runSweep, 1500);
  initialTimer.unref?.();
  voiceSweepTimer = setInterval(runSweep, VOICE_SWEEP_INTERVAL_MS);
  voiceSweepTimer.unref?.();
  return voiceSweepTimer;
};

module.exports = {
  ALLOWED_AUDIO_MIME_TYPES,
  MAX_VOICE_BYTES,
  downloadMetaMedia,
  drainPendingWhatsAppVoiceNotes,
  isAllowedMetaMediaHost,
  isWhatsAppVoiceEnabled,
  processWhatsAppVoiceNote,
  retrieveMetaMediaMetadata,
  startWhatsAppVoiceScheduler,
  transcribeAudioWithOpenAI,
  validateMetaMediaUrl,
};
