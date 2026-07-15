const crypto = require("crypto");
const PaymentWebhookEvent = require("../models/PaymentWebhookEvent");

const DEFAULT_PAYMENT_WEBHOOK_PROCESSING_LEASE_MS = 2 * 60 * 1000;

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
  const gatewayId = toText(
    event?.data?.id ||
      (eventType.startsWith("charge.dispute.") ? event?.data?.dispute_code : "") ||
      event?.id
  );
  if (gatewayId) {
    // Paystack reuses the same dispute id across create, reminder, and
    // resolution notifications. The event type is therefore part of the
    // identity for disputes, while legacy payment event identities remain
    // unchanged.
    if (eventType.startsWith("charge.dispute.")) {
      return `${eventType}:${gatewayId}`;
    }
    return gatewayId;
  }
  return `${eventType}:${reference || "missing-reference"}:${buildPayloadHash({ rawBody, payload: event })}`;
};

const buildStripeEventId = (event = {}) =>
  toText(event?.id) || `stripe:${toText(event?.type) || "unknown"}:${buildPayloadHash({ payload: event })}`;

const getPaymentWebhookProcessingLeaseMs = () => {
  const configured = Number(process.env.PAYMENT_WEBHOOK_PROCESSING_LEASE_MS);
  return Number.isFinite(configured) && configured >= 30 * 1000
    ? Math.floor(configured)
    : DEFAULT_PAYMENT_WEBHOOK_PROCESSING_LEASE_MS;
};

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
  const now = new Date();
  const leaseMs = getPaymentWebhookProcessingLeaseMs();
  const leaseUntil = new Date(now.getTime() + leaseMs);
  const staleBefore = new Date(now.getTime() - leaseMs);
  const existing = await PaymentWebhookEvent.findOne({
    provider: normalizedProvider,
    eventId: normalizedEventId,
  });
  if (existing) {
    const claimFilter =
      existing.status === "failed"
        ? { _id: existing._id, status: "failed" }
        : existing.status === "received"
          ? {
              _id: existing._id,
              status: "received",
              $or: [
                { processingLeaseUntil: { $lte: now } },
                {
                  processingLeaseUntil: null,
                  processingStartedAt: { $lte: staleBefore },
                },
                {
                  processingLeaseUntil: null,
                  processingStartedAt: null,
                  firstSeenAt: { $lte: staleBefore },
                },
              ],
            }
          : null;

    if (claimFilter) {
      const claimed = await PaymentWebhookEvent.findOneAndUpdate(
        claimFilter,
        {
          $inc: { duplicateCount: 1, attemptCount: 1 },
          $set: {
            status: "received",
            lastSeenAt: now,
            processingStartedAt: now,
            processingLeaseUntil: leaseUntil,
            processedAt: null,
            errorMessage: "",
            payloadHash,
            payloadSummary,
            ...(providerRef ? { providerRef: toText(providerRef) } : {}),
          },
        },
        { returnDocument: "after" }
      );
      if (claimed) {
        return {
          duplicate: false,
          reclaimed: true,
          event: claimed,
        };
      }
    }

    const event = await PaymentWebhookEvent.findOneAndUpdate(
      {
        provider: normalizedProvider,
        eventId: normalizedEventId,
      },
      {
        $inc: { duplicateCount: 1 },
        $set: { lastSeenAt: now },
      },
      { returnDocument: "after" }
    );

    const currentEvent = event || existing;
    return {
      duplicate: true,
      inProgress: currentEvent?.status === "received",
      retryable: currentEvent?.status === "received",
      event: currentEvent,
    };
  }

  try {
    const event = await PaymentWebhookEvent.create({
      provider: normalizedProvider,
      eventId: normalizedEventId,
      eventType: toText(eventType),
      providerRef: toText(providerRef),
      purchaseId: purchaseId || null,
      payloadHash,
      status: "received",
      processingStartedAt: now,
      processingLeaseUntil: leaseUntil,
      attemptCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
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
        $set: { lastSeenAt: now },
      },
      { returnDocument: "after" }
    );

    return {
      duplicate: true,
      inProgress: event?.status === "received",
      retryable: event?.status === "received",
      event,
    };
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
        errorMessage: errorMessage ? toText(errorMessage).slice(0, 500) : "",
        ...(status === "processed" || status === "skipped" || status === "failed"
          ? { processedAt: new Date(), processingLeaseUntil: null }
          : {}),
      },
    },
    { returnDocument: "after" }
  );
};

module.exports = {
  DEFAULT_PAYMENT_WEBHOOK_PROCESSING_LEASE_MS,
  buildPayloadHash,
  buildPaystackEventId,
  buildStripeEventId,
  markPaymentWebhookEvent,
  reservePaymentWebhookEvent,
};
