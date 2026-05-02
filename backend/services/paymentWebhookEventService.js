const crypto = require("crypto");
const PaymentWebhookEvent = require("../models/PaymentWebhookEvent");

const toText = (value = "") => String(value || "").trim();

const hashPayload = (value = "") =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex");

const buildPayloadHash = ({ rawBody = "", payload = null } = {}) => {
  if (rawBody) {
    return hashPayload(rawBody);
  }
  return hashPayload(JSON.stringify(payload || {}));
};

const buildPaystackEventId = ({ event = {}, rawBody = "" } = {}) => {
  const reference = toText(event?.data?.reference);
  const eventType = toText(event?.event) || "unknown";
  const gatewayId = toText(event?.data?.id || event?.id);
  if (gatewayId) {
    return gatewayId;
  }
  return `${eventType}:${reference || "missing-reference"}:${buildPayloadHash({ rawBody, payload: event })}`;
};

const buildStripeEventId = (event = {}) =>
  toText(event?.id) || `stripe:${toText(event?.type) || "unknown"}:${buildPayloadHash({ payload: event })}`;

const reservePaymentWebhookEvent = async ({
  provider,
  eventId,
  eventType = "",
  providerRef = "",
  purchaseId = null,
  rawBody = "",
  payload = null,
  payloadSummary = {},
} = {}) => {
  const normalizedProvider = toText(provider).toLowerCase();
  const normalizedEventId = toText(eventId);
  if (!normalizedProvider || !normalizedEventId) {
    return {
      duplicate: false,
      event: null,
      skipped: true,
      reason: "missing_event_identity",
    };
  }

  const payloadHash = buildPayloadHash({ rawBody, payload });
  try {
    const event = await PaymentWebhookEvent.create({
      provider: normalizedProvider,
      eventId: normalizedEventId,
      eventType: toText(eventType),
      providerRef: toText(providerRef),
      purchaseId: purchaseId || null,
      payloadHash,
      status: "received",
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      payloadSummary,
    });
    return { duplicate: false, event };
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    const event = await PaymentWebhookEvent.findOneAndUpdate(
      {
        provider: normalizedProvider,
        eventId: normalizedEventId,
      },
      {
        $inc: { duplicateCount: 1 },
        $set: { lastSeenAt: new Date() },
      },
      { new: true }
    );

    return { duplicate: true, event };
  }
};

const markPaymentWebhookEvent = async ({
  event,
  status,
  purchaseId = null,
  providerRef = "",
  errorMessage = "",
} = {}) => {
  if (!event?._id || !status) {
    return null;
  }

  return PaymentWebhookEvent.findByIdAndUpdate(
    event._id,
    {
      $set: {
        status,
        ...(purchaseId ? { purchaseId } : {}),
        ...(providerRef ? { providerRef: toText(providerRef) } : {}),
        ...(errorMessage ? { errorMessage: toText(errorMessage).slice(0, 500) } : {}),
        ...(status === "processed" || status === "skipped" || status === "failed"
          ? { processedAt: new Date() }
          : {}),
      },
    },
    { new: true }
  ).catch(() => null);
};

module.exports = {
  buildPayloadHash,
  buildPaystackEventId,
  buildStripeEventId,
  markPaymentWebhookEvent,
  reservePaymentWebhookEvent,
};
