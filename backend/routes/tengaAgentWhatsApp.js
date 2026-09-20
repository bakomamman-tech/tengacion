const express = require("express");

const {
  processWhatsAppWebhook,
  verifyMetaWebhookSignature,
} = require("../services/tengaAgent/whatsappInboundService");
const {
  drainQueuedWhatsAppReplies,
  isAutoReplyEnabled,
} = require("../services/tengaAgent/whatsappOutboundService");
const {
  drainPendingWhatsAppVoiceNotes,
  isWhatsAppVoiceEnabled,
} = require("../services/tengaAgent/whatsappVoiceService");

const router = express.Router();

const noStore = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};

router.use(noStore);

router.get("/webhook", (req, res) => {
  const expectedToken = String(
    process.env.TENGAAGENT_WHATSAPP_VERIFY_TOKEN || ""
  ).trim();
  const mode = String(req.query?.["hub.mode"] || "").trim();
  const token = String(req.query?.["hub.verify_token"] || "").trim();
  const challenge = String(req.query?.["hub.challenge"] || "");

  if (!expectedToken) {
    return res.status(503).json({
      message: "WhatsApp webhook verification is not configured.",
    });
  }

  if (mode !== "subscribe" || token !== expectedToken || !challenge) {
    return res.status(403).json({
      message: "WhatsApp webhook verification failed.",
    });
  }

  return res.status(200).type("text/plain").send(challenge);
});

router.post("/webhook", async (req, res, next) => {
  try {
    const appSecret = String(
      process.env.TENGAAGENT_WHATSAPP_APP_SECRET || ""
    ).trim();

    if (!appSecret) {
      return res.status(503).json({
        message: "WhatsApp webhook signature verification is not configured.",
      });
    }

    const signatureHeader = req.get("X-Hub-Signature-256");
    const verified = verifyMetaWebhookSignature({
      rawBody: req.rawBody,
      signatureHeader,
      appSecret,
    });

    if (!verified) {
      return res.status(401).json({
        message: "Invalid WhatsApp webhook signature.",
      });
    }

    const summary = await processWhatsAppWebhook(req.body || {});

    if (isWhatsAppVoiceEnabled() && summary.voiceNotesQueued > 0) {
      setImmediate(() => {
        drainPendingWhatsAppVoiceNotes().catch((error) => {
          console.error("[TengaAgent WhatsApp] queued voice-note processing failed", {
            message: error?.message || String(error),
          });
        });
      });
    }

    if (isAutoReplyEnabled() && summary.repliesQueued > 0) {
      setImmediate(() => {
        drainQueuedWhatsAppReplies().catch((error) => {
          console.error("[TengaAgent WhatsApp] queued reply delivery failed", {
            message: error?.message || String(error),
          });
        });
      });
    }

    return res.status(200).json({
      ok: true,
      ...summary,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
