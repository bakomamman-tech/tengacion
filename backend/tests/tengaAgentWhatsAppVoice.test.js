const crypto = require("crypto");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengaagent-whatsapp-voice-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "tengaagent-whatsapp-voice-jwt-secret-not-for-production";
process.env.OPENAI_API_KEY = "";
process.env.TENGAAGENT_WHATSAPP_AUTO_REPLY_ENABLED = "false";
process.env.TENGAAGENT_WHATSAPP_VOICE_ENABLED = "false";

const Organization = require("../models/tengaAgent/Organization");
const Agent = require("../models/tengaAgent/Agent");
const Conversation = require("../models/tengaAgent/Conversation");
const Message = require("../models/tengaAgent/Message");
const WhatsAppConnection = require("../models/tengaAgent/WhatsAppConnection");
const WhatsAppReply = require("../models/tengaAgent/WhatsAppReply");
const {
  extractInboundEvents,
  processWhatsAppWebhook,
} = require("../services/tengaAgent/whatsappInboundService");
const {
  MAX_VOICE_BYTES,
  downloadMetaMedia,
  processWhatsAppVoiceNote,
  retrieveMetaMediaMetadata,
  transcribeAudioWithOpenAI,
  validateMetaMediaUrl,
} = require("../services/tengaAgent/whatsappVoiceService");

let mongod;

const createTenant = async ({
  slug = "voice-tenant",
  phoneNumberId = "phone-voice-1",
  conversationStatus = "ai_active",
} = {}) => {
  const organization = await Organization.create({
    name: `${slug} Limited`,
    slug,
    status: "active",
    plan: "growth",
  });

  const agent = await Agent.create({
    organizationId: organization._id,
    key: `${slug}-agent`,
    name: `${slug} Agent`,
    status: "active",
  });

  await WhatsAppConnection.create({
    organizationId: organization._id,
    agentId: agent._id,
    phoneNumberId,
    wabaId: `waba-${slug}`,
    status: "active",
  });

  const conversation = await Conversation.create({
    organizationId: organization._id,
    agentId: agent._id,
    sessionKey: `wa:${phoneNumberId}:2348012345678`,
    channel: "whatsapp",
    status: conversationStatus,
  });

  return { organization, agent, conversation };
};

const buildVoicePayload = ({
  phoneNumberId = "phone-voice-1",
  messageId = "wamid.voice-1",
  mediaId = "media-voice-1",
  from = "2348012345678",
} = {}) => ({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba-test",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "+2348000000000",
              phone_number_id: phoneNumberId,
            },
            messages: [
              {
                from,
                id: messageId,
                timestamp: "1789617600",
                type: "audio",
                audio: {
                  id: mediaId,
                  mime_type: "audio/ogg; codecs=opus",
                  sha256: "webhook-hash",
                  voice: true,
                },
              },
            ],
          },
        },
      ],
    },
  ],
});

const createPendingVoiceMessage = async ({
  slug = "voice-worker",
  conversationStatus = "ai_active",
} = {}) => {
  const { organization, agent, conversation } = await createTenant({
    slug,
    phoneNumberId: `phone-${slug}`,
    conversationStatus,
  });

  const message = await Message.create({
    organizationId: organization._id,
    conversationId: conversation._id,
    agentId: agent._id,
    sender: "customer",
    type: "text",
    sourceType: "voice_note",
    content: "Voice note received. Transcription pending.",
    provider: "meta_whatsapp",
    providerMessageId: `wamid-${slug}`,
    externalSenderId: "2348012345678",
    providerPhoneNumberId: `phone-${slug}`,
    providerMediaId: `media-${slug}`,
    providerMediaMimeType: "audio/ogg",
    transcriptionStatus: "pending",
  });

  return { organization, agent, conversation, message };
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });

  await mongoose.connect(mongod.getUri(), {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });
});

beforeEach(async () => {
  process.env.TENGAAGENT_WHATSAPP_AUTO_REPLY_ENABLED = "false";
  process.env.TENGAAGENT_WHATSAPP_VOICE_ENABLED = "false";
  await mongoose.connection.db.dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe("TengaAgent WhatsApp voice-note transport", () => {
  it("ignores audio when voice notes are disabled and queues it only when explicitly enabled", async () => {
    const payload = buildVoicePayload();

    const disabled = extractInboundEvents(payload, { voiceEnabled: false });
    expect(disabled.events).toHaveLength(0);
    expect(disabled.ignored).toBe(1);

    const enabled = extractInboundEvents(payload, { voiceEnabled: true });
    expect(enabled.events).toHaveLength(1);
    expect(enabled.events[0]).toEqual(
      expect.objectContaining({
        sourceType: "voice_note",
        phoneNumberId: "phone-voice-1",
        providerMessageId: "wamid.voice-1",
        providerMediaId: "media-voice-1",
        providerMediaMimeType: "audio/ogg; codecs=opus",
      })
    );
  });

  it("persists one tenant-scoped pending voice note and treats a duplicate webhook idempotently", async () => {
    const { organization } = await createTenant();
    const payload = buildVoicePayload();

    const first = await processWhatsAppWebhook(payload, {
      voiceEnabled: true,
      autoReply: false,
    });
    expect(first).toEqual(
      expect.objectContaining({
        received: 1,
        stored: 1,
        voiceNotesQueued: 1,
      })
    );

    const stored = await Message.findOne({
      organizationId: organization._id,
      providerMessageId: "wamid.voice-1",
    }).lean();
    expect(stored).toEqual(
      expect.objectContaining({
        sourceType: "voice_note",
        transcriptionStatus: "pending",
        providerPhoneNumberId: "phone-voice-1",
        providerMediaId: "media-voice-1",
      })
    );

    const duplicate = await processWhatsAppWebhook(payload, {
      voiceEnabled: true,
      autoReply: false,
    });
    expect(duplicate.stored).toBe(0);
    expect(duplicate.duplicates).toBe(1);
    expect(duplicate.voiceNotesAlreadyQueued).toBe(1);
    expect(await Message.countDocuments()).toBe(1);
  });

  it("rejects arbitrary media hosts and resolves Meta media with the known phone number and bearer token", async () => {
    expect(validateMetaMediaUrl("https://lookaside.fbsbx.com/whatsapp_business/attachments/abc"))
      .toContain("lookaside.fbsbx.com");
    expect(validateMetaMediaUrl("http://lookaside.fbsbx.com/file")).toBeNull();
    expect(validateMetaMediaUrl("https://evil.example/media.ogg")).toBeNull();
    expect(validateMetaMediaUrl("https://facebook.com.evil.example/media.ogg")).toBeNull();

    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          url: "https://lookaside.fbsbx.com/whatsapp_business/attachments/media-1",
          mime_type: "audio/ogg",
          sha256: "abc123",
          file_size: 100,
          id: "media-1",
        }),
    }));

    const metadata = await retrieveMetaMediaMetadata({
      mediaId: "media-1",
      phoneNumberId: "phone-1",
      accessToken: "meta-test-token",
      graphVersion: "v23.0",
      fetchImpl,
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        mediaId: "media-1",
        mimeType: "audio/ogg",
        fileSize: 100,
      })
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      "https://graph.facebook.com/v23.0/media-1?phone_number_id=phone-1"
    );
    expect(options.headers.Authorization).toBe("Bearer meta-test-token");
    expect(options.redirect).toBe("error");
  });

  it("rejects oversized, MIME-mismatched, and checksum-mismatched downloads", async () => {
    const token = "meta-test-token";
    const baseMetadata = {
      url: "https://lookaside.fbsbx.com/whatsapp_business/attachments/media-1",
      mimeType: "audio/ogg",
      fileSize: 4,
      sha256: "",
      mediaId: "media-1",
      token,
    };

    const oversizedFetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: (name) =>
          name.toLowerCase() === "content-type"
            ? "audio/ogg"
            : name.toLowerCase() === "content-length"
              ? String(MAX_VOICE_BYTES + 1)
              : null,
      },
      body: null,
      arrayBuffer: async () => Buffer.alloc(1).buffer,
    }));

    await expect(
      downloadMetaMedia({ metadata: baseMetadata, fetchImpl: oversizedFetch })
    ).rejects.toMatchObject({ code: "WHATSAPP_VOICE_TOO_LARGE" });

    const mimeFetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: (name) =>
          name.toLowerCase() === "content-type"
            ? "text/html"
            : name.toLowerCase() === "content-length"
              ? "4"
              : null,
      },
      body: null,
      arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
    }));

    await expect(
      downloadMetaMedia({ metadata: baseMetadata, fetchImpl: mimeFetch })
    ).rejects.toMatchObject({ code: "WHATSAPP_VOICE_MIME_MISMATCH" });

    const buffer = Buffer.from([1, 2, 3, 4]);
    const hashFetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: (name) =>
          name.toLowerCase() === "content-type"
            ? "audio/ogg"
            : name.toLowerCase() === "content-length"
              ? "4"
              : null,
      },
      body: null,
      arrayBuffer: async () => buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ),
    }));

    await expect(
      downloadMetaMedia({
        metadata: {
          ...baseMetadata,
          sha256: crypto.createHash("sha256").update("different").digest("base64"),
        },
        fetchImpl: hashFetch,
      })
    ).rejects.toMatchObject({ code: "WHATSAPP_VOICE_HASH_MISMATCH" });
  });

  it("submits voice audio to OpenAI transcription with backend bearer auth and multipart form data", async () => {
    const fetchImpl = jest.fn(async (_url, options) => {
      expect(options.body).toBeInstanceOf(FormData);
      expect(options.body.get("model")).toBe("gpt-transcribe");
      const file = options.body.get("file");
      expect(file).toBeInstanceOf(Blob);
      expect(file.type).toBe("audio/ogg");
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ text: "Hello, I need help." }),
      };
    });

    const result = await transcribeAudioWithOpenAI({
      buffer: Buffer.from("fake-ogg-audio"),
      mimeType: "audio/ogg",
      apiKey: "openai-test-key",
      model: "gpt-transcribe",
      fetchImpl,
    });

    expect(result).toEqual({
      text: "Hello, I need help.",
      provider: "openai",
      model: "gpt-transcribe",
    });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(options.headers.Authorization).toBe("Bearer openai-test-key");
    expect(options.redirect).toBe("error");
  });

  it("stores the transcript and queues exactly one AI reply after successful transcription", async () => {
    process.env.TENGAAGENT_WHATSAPP_AUTO_REPLY_ENABLED = "true";
    const { message } = await createPendingVoiceMessage({ slug: "voice-success" });

    const result = await processWhatsAppVoiceNote({
      messageId: message._id,
      metadataResolver: jest.fn(async () => ({
        url: "https://lookaside.fbsbx.com/media",
        mimeType: "audio/ogg",
        fileSize: 4,
        sha256: "hash",
        mediaId: "media-voice-success",
        token: "token",
      })),
      mediaDownloader: jest.fn(async () => Buffer.from([1, 2, 3, 4])),
      transcriber: jest.fn(async () => ({
        text: "Please tell me about your services.",
        provider: "openai",
        model: "gpt-transcribe",
      })),
    });

    expect(result.status).toBe("transcribed");
    expect(result.replyQueueStatus).toBe("queued");

    const updated = await Message.findById(message._id).lean();
    expect(updated).toEqual(
      expect.objectContaining({
        content: "Please tell me about your services.",
        sourceType: "voice_note",
        transcriptionStatus: "completed",
        transcriptionProvider: "openai",
        transcriptionModel: "gpt-transcribe",
      })
    );

    expect(
      await WhatsAppReply.countDocuments({ inboundMessageId: message._id })
    ).toBe(1);

    const second = await processWhatsAppVoiceNote({ messageId: message._id });
    expect(second.status).toBe("already_claimed");
    expect(await WhatsAppReply.countDocuments()).toBe(1);
  });

  it("fails safely and requests human handoff when transcription cannot complete", async () => {
    const { conversation, message } = await createPendingVoiceMessage({
      slug: "voice-failure",
    });

    const result = await processWhatsAppVoiceNote({
      messageId: message._id,
      metadataResolver: jest.fn(async () => {
        const error = new Error("Meta media expired");
        error.code = "WHATSAPP_VOICE_MEDIA_LOOKUP_FAILED";
        throw error;
      }),
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "failed",
        code: "WHATSAPP_VOICE_MEDIA_LOOKUP_FAILED",
      })
    );

    const updatedMessage = await Message.findById(message._id).lean();
    expect(updatedMessage.transcriptionStatus).toBe("failed");
    expect(updatedMessage.transcriptionError).toContain("Meta media expired");

    const updatedConversation = await Conversation.findById(conversation._id).lean();
    expect(updatedConversation.status).toBe("handoff_requested");
    expect(await WhatsAppReply.countDocuments()).toBe(0);
  });
});
