const Purchase = require("../models/Purchase");
const Entitlement = require("../models/Entitlement");
const Track = require("../models/Track");
const Book = require("../models/Book");
const Album = require("../models/Album");
const User = require("../models/User");
const CreatorProfile = require("../models/CreatorProfile");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const WalletEntry = require("../models/WalletEntry");
const { resolvePurchasableItem } = require("./catalogService");
const { hasCreatorSubscriptionAccess } = require("./entitlementService");
const {
  generatePaymentReference,
  initializeTransaction,
  validateWebhookSignature,
  verifyTransaction,
} = require("./paystackService");
const { sendCreatorPurchaseMessengerAlert } = require("./creatorSalesMessengerService");
const { recordPurchaseSettlementEntries } = require("./walletService");
const { logAnalyticsEvent } = require("./analyticsService");
const { config } = require("../config/env");

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_STUCK_PENDING_MINUTES = 15;

const LEGACY_SUPPORTED_PAYMENT_OPTIONS = {
  NG: ["Paystack Card", "Bank Transfer", "USSD", "Verve", "Flutterwave"],
  GLOBAL: ["Card", "Apple Pay", "Google Pay", "Stripe", "PayPal"],
};

const TIMELINE_EVENT_META = {
  purchase_record_created: { label: "Purchase record created", tone: "info" },
  purchase_checkout_initialized: { label: "Checkout initialized", tone: "info" },
  purchase_checkout_failed: { label: "Checkout initialization failed", tone: "danger" },
  purchase_verification_pending: { label: "Verification still pending", tone: "warn" },
  purchase_verification_failed: { label: "Verification failed", tone: "danger" },
  purchase_verification_succeeded: { label: "Payment verified", tone: "success" },
  purchase_webhook_received: { label: "Webhook received", tone: "info" },
  purchase_webhook_pending: { label: "Webhook left payment pending", tone: "warn" },
  purchase_webhook_failed: { label: "Webhook verification failed", tone: "danger" },
  purchase_webhook_settled: { label: "Webhook settled purchase", tone: "success" },
  purchase_access_granted: { label: "Access granted", tone: "success" },
  purchase_entitlement_granted: { label: "Entitlement granted", tone: "success" },
  purchase_wallet_settled: { label: "Wallet settlement recorded", tone: "success" },
  purchase_creator_alert_sent: { label: "Creator sales alert processed", tone: "info" },
  purchase_reconciliation_requested: { label: "Admin reconciliation requested", tone: "info" },
  purchase_reconciliation_completed: { label: "Admin reconciliation completed", tone: "success" },
  purchase_reconciliation_failed: { label: "Admin reconciliation failed", tone: "danger" },
  purchase_success: { label: "Purchase success metric recorded", tone: "success" },
  purchase_failed: { label: "Purchase failure metric recorded", tone: "danger" },
};

const toIdString = (value) => {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (value._id) {
    return value._id.toString();
  }
  return value.toString();
};

const normalizeType = (value = "") => {
  const raw = String(value || "").trim().toLowerCase();
  const aliases = {
    music: "track",
    song: "track",
    tracks: "track",
    track: "track",
    book: "book",
    books: "book",
    ebook: "book",
    podcasts: "podcast",
    podcast: "podcast",
    albums: "album",
    album: "album",
    videos: "video",
    video: "video",
    subscription: "subscription",
    membership: "subscription",
    fanpass: "subscription",
  };

  return aliases[raw] || raw;
};

const toPurchasePayload = (purchase) => ({
  _id: toIdString(purchase?._id),
  itemType: purchase?.itemType || "",
  itemId: toIdString(purchase?.itemId),
  creatorId: toIdString(purchase?.creatorId),
  amount: Number(purchase?.amount) || 0,
  currency: purchase?.currency || "NGN",
  status: purchase?.status || "pending",
  provider: purchase?.provider || "paystack",
  providerRef: purchase?.providerRef || "",
  billingInterval: purchase?.billingInterval || "one_time",
  accessExpiresAt: purchase?.accessExpiresAt || null,
  paidAt: purchase?.paidAt || null,
  createdAt: purchase?.createdAt || null,
  updatedAt: purchase?.updatedAt || null,
});

const toLegacyCheckoutPayload = ({
  purchase,
  payment,
  currencyMode = "NG",
} = {}) => ({
  purchaseId: toIdString(purchase?._id),
  checkoutUrl: payment?.authorization_url || "",
  authorization_url: payment?.authorization_url || "",
  access_code: payment?.access_code || "",
  reference: purchase?.providerRef || payment?.reference || "",
  itemType: purchase?.itemType || "",
  itemId: toIdString(purchase?.itemId),
  amount: Number(purchase?.amount) || 0,
  currency: purchase?.currency || "NGN",
  currencyMode: ["NG", "GLOBAL"].includes(String(currencyMode || "").trim().toUpperCase())
    ? String(currencyMode || "").trim().toUpperCase()
    : "NG",
  supportedPaymentOptions: LEGACY_SUPPORTED_PAYMENT_OPTIONS,
});

const createServiceError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const isPublishablePayload = (payload = {}) => {
  const status = String(payload?.publishedStatus || payload?.status || "").trim().toLowerCase();
  if (payload?.isPublished === false) {
    return false;
  }
  if (["draft", "blocked", "private", "archived"].includes(status)) {
    return false;
  }
  return true;
};

const validatePurchasableItem = (item) => {
  if (!item) {
    return "Item not found";
  }
  if (!item.creatorId) {
    return "Creator not found";
  }
  if (!isPublishablePayload(item.payload)) {
    return "Item is not published";
  }
  if (!Number.isFinite(Number(item.price)) || Number(item.price) <= 0) {
    return "Item is free and does not require payment";
  }
  return "";
};

const getReturnUrl = (value = "") => {
  const trimmed = String(value || "").trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return String(config.PAYSTACK_CALLBACK_URL || "").trim();
};

const buildPurchaseEventMetadata = (purchase, metadata = {}) => ({
  purchaseId: toIdString(purchase?._id) || String(metadata.purchaseId || ""),
  providerRef: purchase?.providerRef || String(metadata.providerRef || ""),
  provider: purchase?.provider || String(metadata.provider || ""),
  status: purchase?.status || String(metadata.status || ""),
  itemType: purchase?.itemType || String(metadata.itemType || ""),
  itemId: toIdString(purchase?.itemId) || String(metadata.itemId || ""),
  creatorId: toIdString(purchase?.creatorId) || String(metadata.creatorId || ""),
  amount: Number(purchase?.amount ?? metadata.amount ?? 0) || 0,
  currency: purchase?.currency || String(metadata.currency || "NGN"),
  ...metadata,
});

const logPurchaseLifecycleEvent = async ({
  type,
  purchase = null,
  userId = null,
  actorRole = "",
  metadata = {},
  createdAt = new Date(),
} = {}) => {
  if (!type) {
    return null;
  }

  return logAnalyticsEvent({
    type,
    userId: toIdString(purchase?.userId) || userId || null,
    actorRole,
    targetId: purchase?._id || metadata.purchaseId || null,
    targetType: "purchase",
    contentType: purchase?.itemType || metadata.itemType || "",
    metadata: buildPurchaseEventMetadata(purchase, metadata),
    createdAt,
  });
};

const emitEntitlementGranted = ({ req, purchase }) => {
  const io = req?.app?.get?.("io");
  if (!io || !purchase?.userId) {
    return;
  }

  io.to(`user:${String(purchase.userId)}`).emit("entitlement:granted", {
    purchaseId: toIdString(purchase._id),
    itemType: purchase.itemType || "",
    itemId: toIdString(purchase.itemId),
    creatorId: toIdString(purchase.creatorId),
    status: "paid",
    paidAt: purchase.paidAt || new Date(),
  });
};

const incrementPurchasedItemCounter = async (purchase) => {
  if (!purchase?.itemId) {
    return;
  }

  if (purchase.itemType === "track") {
    await Track.updateOne({ _id: purchase.itemId }, { $inc: { purchaseCount: 1 } }).catch(() => null);
  } else if (purchase.itemType === "book") {
    await Book.updateOne({ _id: purchase.itemId }, { $inc: { purchaseCount: 1 } }).catch(() => null);
  } else if (purchase.itemType === "album") {
    await Album.updateOne({ _id: purchase.itemId }, { $inc: { purchaseCount: 1 } }).catch(() => null);
  }
};

const resolveCheckoutTarget = async ({ productType, productId, userId }) => {
  const normalizedType = normalizeType(productType);
  const item = await resolvePurchasableItem(normalizedType, productId);
  const validationError = validatePurchasableItem(item);
  if (validationError) {
    return { error: validationError, item: null };
  }

  if (normalizedType === "subscription" && String(item.ownerUserId || "") === String(userId || "")) {
    return { error: "You cannot subscribe to your own creator page", item: null };
  }

  if (
    normalizedType === "subscription" &&
    item.creatorId &&
    (await hasCreatorSubscriptionAccess({ userId, creatorId: item.creatorId }))
  ) {
    return { error: "You already have an active subscription for this creator", item: null };
  }

  return { error: "", item };
};

const createPendingPurchase = async ({ userId, item, providerRef, currency = "NGN" }) =>
  Purchase.create({
    userId,
    creatorId: item.creatorId || undefined,
    itemType: item.itemType,
    itemId: item.itemId,
    amount: Number(item.price) || 0,
    priceNGN: Number(item.price) || 0,
    currency: String(currency || "NGN").trim().toUpperCase() || "NGN",
    status: "pending",
    provider: "paystack",
    providerRef,
    billingInterval: item.itemType === "subscription" ? "monthly" : "one_time",
  });

const initializePaystackCheckout = async ({
  req = null,
  userId,
  productType,
  productId,
  returnUrl = "",
  currencyMode = "NG",
  actorRole = "",
} = {}) => {
  const user = await User.findById(userId).select("email").lean();
  if (!user?.email) {
    throw createServiceError("User email is required for payment", 400);
  }

  const checkout = await resolveCheckoutTarget({ productType, productId, userId });
  if (checkout.error) {
    throw createServiceError(checkout.error, checkout.error === "Item not found" ? 404 : 400);
  }

  const item = checkout.item;
  const reference = generatePaymentReference(item.itemType);
  const purchase = await createPendingPurchase({
    userId,
    item,
    providerRef: reference,
    currency: config.PAYSTACK_CURRENCY || "NGN",
  });

  await logPurchaseLifecycleEvent({
    type: "purchase_record_created",
    purchase,
    actorRole,
    metadata: {
      source: "checkout",
      returnUrl: getReturnUrl(returnUrl),
      currencyMode: String(currencyMode || "NG").trim().toUpperCase(),
    },
  }).catch(() => null);

  try {
    const payment = await initializeTransaction({
      email: user.email,
      amountNgn: Number(item.price) || 0,
      reference,
      callbackUrl: getReturnUrl(returnUrl),
      metadata: {
        app: "tengacion",
        buyerId: toIdString(userId),
        creatorId: toIdString(item.creatorId),
        productId: toIdString(item.itemId),
        productType: item.itemType,
        productTitle: item.title || "",
        purchaseId: toIdString(purchase._id),
        currencyMode: String(currencyMode || "NG").trim().toUpperCase(),
      },
    });

    await logPurchaseLifecycleEvent({
      type: "purchase_checkout_initialized",
      purchase,
      actorRole,
      metadata: {
        source: "checkout",
        authorizationUrl: payment.authorization_url || "",
        accessCodePresent: Boolean(payment.access_code),
      },
    }).catch(() => null);

    return { purchase, payment, item };
  } catch (error) {
    await Purchase.updateOne(
      { _id: purchase._id },
      { $set: { status: "failed" } }
    ).catch(() => null);
    const failedPurchase = await Purchase.findById(purchase._id).catch(() => null);
    const eventPurchase = failedPurchase || purchase;

    await logPurchaseLifecycleEvent({
      type: "purchase_checkout_failed",
      purchase: eventPurchase,
      actorRole,
      metadata: {
        source: "checkout",
        reason: error.message || "Payment initialization failed",
      },
    }).catch(() => null);

    await logAnalyticsEvent({
      type: "purchase_failed",
      userId,
      actorRole,
      targetId: purchase._id,
      targetType: "purchase",
      contentType: item.itemType,
      metadata: {
        creatorId: toIdString(item.creatorId),
        itemId: toIdString(item.itemId),
        amount: Number(item.price || 0),
        reason: error.message || "Payment initialization failed",
      },
    }).catch(() => null);

    throw createServiceError(error.message || "Payment initialization failed", 502);
  }
};

const settlePurchasedAccess = async (purchase, { paidAt = new Date() } = {}) => {
  if (!purchase) {
    return {
      purchase: null,
      purchaseUpdated: false,
      entitlementCreated: false,
    };
  }

  const settledPurchase = await Purchase.findOneAndUpdate(
    {
      _id: purchase._id,
      status: { $in: ["pending", "abandoned", "failed"] },
    },
    {
      $set: {
        status: "paid",
        paidAt,
        ...(purchase.itemType === "subscription"
          ? {
              billingInterval: "monthly",
              accessExpiresAt: new Date(paidAt.getTime() + MONTH_MS),
            }
          : {}),
      },
    },
    { new: true }
  );

  const finalPurchase = settledPurchase || (await Purchase.findById(purchase._id));
  if (!finalPurchase) {
    return {
      purchase: null,
      purchaseUpdated: false,
      entitlementCreated: false,
    };
  }

  if (settledPurchase) {
    await incrementPurchasedItemCounter(finalPurchase);
  }

  let entitlementCreated = false;
  if (finalPurchase.itemType !== "subscription") {
    const entitlementResult = await Entitlement.updateOne(
      {
        buyerId: finalPurchase.userId,
        itemType: finalPurchase.itemType,
        itemId: finalPurchase.itemId,
      },
      {
        $setOnInsert: {
          grantedAt: finalPurchase.paidAt || paidAt,
        },
      },
      { upsert: true }
    );
    entitlementCreated = Boolean(
      entitlementResult?.upsertedCount ||
      entitlementResult?.upsertedId
    );
  }

  return {
    purchase: finalPurchase,
    purchaseUpdated: Boolean(settledPurchase),
    entitlementCreated,
  };
};

const runSettlementSideEffects = async ({
  req = null,
  purchase = null,
  actorRole = "",
  source = "settlement",
} = {}) => {
  if (!purchase?._id) {
    return {
      walletResult: {
        createdCount: 0,
        skipped: true,
        reason: "missing_purchase",
      },
      alertResult: {
        sent: false,
        skipped: true,
        reason: "missing_purchase",
      },
    };
  }

  emitEntitlementGranted({ req, purchase });

  let walletResult;
  try {
    walletResult = await recordPurchaseSettlementEntries({ purchase, logger: console });
  } catch (error) {
    walletResult = {
      createdCount: 0,
      skipped: false,
      failed: true,
      reason: error?.message || "Wallet settlement failed",
    };
  }

  await logPurchaseLifecycleEvent({
    type: "purchase_wallet_settled",
    purchase,
    actorRole,
    metadata: {
      source,
      createdCount: Number(walletResult?.createdCount || 0),
      skipped: Boolean(walletResult?.skipped),
      failed: Boolean(walletResult?.failed),
      reason: walletResult?.reason || "",
    },
  }).catch(() => null);

  let alertResult;
  try {
    alertResult = await sendCreatorPurchaseMessengerAlert({
      req,
      purchase,
    });
  } catch (error) {
    alertResult = {
      sent: false,
      skipped: false,
      failed: true,
      reason: error?.message || "Creator sales alert failed",
    };
  }

  await logPurchaseLifecycleEvent({
    type: "purchase_creator_alert_sent",
    purchase,
    actorRole,
    metadata: {
      source,
      sent: Boolean(alertResult?.sent),
      duplicate: Boolean(alertResult?.duplicate),
      failed: Boolean(alertResult?.failed),
      reason: alertResult?.reason || "",
      messageId: alertResult?.messageId || "",
    },
  }).catch(() => null);

  return {
    walletResult,
    alertResult,
  };
};

const resolveFailureStatusFromVerification = (verifiedStatus = "") => {
  const normalized = String(verifiedStatus || "").trim().toLowerCase();
  if (normalized === "abandoned") {
    return "abandoned";
  }
  if (normalized === "pending") {
    return "pending";
  }
  return "failed";
};

const verifyGatewayMatch = ({ purchase, verified }) => {
  const expectedAmountKobo = Math.round(Number(purchase?.amount || 0) * 100);
  const verifiedAmountKobo = Number(verified?.amountKobo || 0);
  const verifiedCurrency = String(verified?.currency || "").trim().toUpperCase();
  const expectedCurrency = String(purchase?.currency || "NGN").trim().toUpperCase();

  if (String(verified?.status || "").trim().toLowerCase() !== "success") {
    return {
      ok: false,
      status: resolveFailureStatusFromVerification(verified?.status),
      reason: `Gateway status is ${verified?.status || "unknown"}`,
      metadata: {
        gatewayStatus: verified?.status || "unknown",
      },
    };
  }

  if (verifiedAmountKobo !== expectedAmountKobo || verifiedCurrency !== expectedCurrency) {
    return {
      ok: false,
      status: "failed",
      reason: "Payment verification mismatch",
      metadata: {
        gatewayStatus: verified?.status || "success",
        expectedAmountKobo,
        verifiedAmountKobo,
        expectedCurrency,
        verifiedCurrency,
      },
    };
  }

  return {
    ok: true,
    metadata: {
      gatewayStatus: verified?.status || "success",
      expectedAmountKobo,
      verifiedAmountKobo,
      expectedCurrency,
      verifiedCurrency,
    },
  };
};

const updatePurchaseStatus = async (purchase, status) =>
  Purchase.findByIdAndUpdate(
    purchase._id,
    { $set: { status } },
    { new: true }
  );

const reconcilePurchase = async ({
  req = null,
  purchase,
  actorUserId = "",
  actorRole = "",
  source = "verify",
  reason = "",
} = {}) => {
  if (!purchase?._id) {
    throw createServiceError("Payment not found", 404);
  }

  if (purchase.provider !== "paystack") {
    throw createServiceError("Unsupported payment provider", 400);
  }

  if (purchase.status === "refunded") {
    throw createServiceError("Refunded purchases cannot be reconciled automatically", 400);
  }

  if (source === "admin_reconcile") {
    await logPurchaseLifecycleEvent({
      type: "purchase_reconciliation_requested",
      purchase,
      userId: actorUserId || toIdString(purchase.userId),
      actorRole,
      metadata: {
        source,
        reason,
      },
    }).catch(() => null);
  } else if (source === "webhook") {
    await logPurchaseLifecycleEvent({
      type: "purchase_webhook_received",
      purchase,
      userId: actorUserId || toIdString(purchase.userId),
      actorRole,
      metadata: {
        source,
      },
    }).catch(() => null);
  }

  const verified = await verifyTransaction(purchase.providerRef);
  const match = verifyGatewayMatch({ purchase, verified });

  if (!match.ok) {
    const nextStatus = match.status || "failed";
    const updatedPurchase = await updatePurchaseStatus(purchase, nextStatus).catch(() => purchase);
    const failureEventType =
      source === "webhook"
        ? nextStatus === "failed"
          ? "purchase_webhook_failed"
          : "purchase_webhook_pending"
        : source === "admin_reconcile"
          ? "purchase_reconciliation_failed"
          : nextStatus === "failed"
            ? "purchase_verification_failed"
            : "purchase_verification_pending";

    await logPurchaseLifecycleEvent({
      type: failureEventType,
      purchase: updatedPurchase || purchase,
      userId: actorUserId || toIdString(purchase.userId),
      actorRole,
      metadata: {
        source,
        reason: match.reason,
        ...match.metadata,
      },
    }).catch(() => null);

    if (nextStatus === "failed") {
      await logAnalyticsEvent({
        type: "purchase_failed",
        userId: toIdString(purchase.userId),
        actorRole,
        targetId: purchase._id,
        targetType: "purchase",
        contentType: purchase.itemType,
        metadata: {
          creatorId: toIdString(purchase.creatorId),
          itemId: toIdString(purchase.itemId),
          amount: Number(purchase.amount || 0),
          provider: purchase.provider || "",
          reason: match.reason,
        },
      }).catch(() => null);
    }

    return {
      purchase: updatedPurchase || purchase,
      verified,
      accessGranted: false,
      success: false,
      reason: match.reason,
    };
  }

  const settled = await settlePurchasedAccess(purchase, { paidAt: new Date() });
  if (!settled.purchase) {
    throw createServiceError("Failed to load purchase after settlement", 500);
  }

  const successEventType =
    source === "webhook"
      ? "purchase_webhook_settled"
      : source === "admin_reconcile"
        ? "purchase_reconciliation_completed"
        : "purchase_verification_succeeded";

  await logPurchaseLifecycleEvent({
    type: successEventType,
    purchase: settled.purchase,
    userId: actorUserId || toIdString(settled.purchase.userId),
    actorRole,
    metadata: {
      source,
      reason,
      purchaseUpdated: Boolean(settled.purchaseUpdated),
      ...match.metadata,
    },
  }).catch(() => null);

  await logPurchaseLifecycleEvent({
    type: "purchase_access_granted",
    purchase: settled.purchase,
    actorRole,
    metadata: {
      source,
      entitlementBackfilled: Boolean(settled.entitlementCreated),
      subscriptionAccess: settled.purchase.itemType === "subscription",
      accessExpiresAt: settled.purchase.accessExpiresAt || null,
    },
  }).catch(() => null);

  if (settled.entitlementCreated) {
    await logPurchaseLifecycleEvent({
      type: "purchase_entitlement_granted",
      purchase: settled.purchase,
      actorRole,
      metadata: {
        source,
      },
    }).catch(() => null);
  }

  if (settled.purchaseUpdated) {
    await logAnalyticsEvent({
      type: "purchase_success",
      userId: toIdString(settled.purchase.userId),
      actorRole,
      targetId: settled.purchase._id,
      targetType: "purchase",
      contentType: settled.purchase.itemType,
      metadata: {
        creatorId: toIdString(settled.purchase.creatorId),
        itemId: toIdString(settled.purchase.itemId),
        amount: Number(settled.purchase.amount || 0),
        provider: settled.purchase.provider || "",
        source,
      },
    }).catch(() => null);
  }

  const sideEffects = await runSettlementSideEffects({
    req,
    purchase: settled.purchase,
    actorRole,
    source,
  });

  return {
    purchase: settled.purchase,
    verified,
    accessGranted: true,
    success: true,
    purchaseUpdated: Boolean(settled.purchaseUpdated),
    entitlementCreated: Boolean(settled.entitlementCreated),
    walletResult: sideEffects.walletResult,
    alertResult: sideEffects.alertResult,
  };
};

const loadPurchaseOperationalArtifacts = async (purchase) => {
  const entitlementQuery =
    purchase?.itemType === "subscription"
      ? Promise.resolve([])
      : Entitlement.find({
          buyerId: purchase.userId,
          itemType: purchase.itemType,
          itemId: purchase.itemId,
        })
        .sort({ grantedAt: 1, createdAt: 1 })
        .lean();

  const [events, entitlements, walletEntries] = await Promise.all([
    AnalyticsEvent.find({
      targetType: "purchase",
      targetId: purchase._id,
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean(),
    entitlementQuery,
    WalletEntry.find({
      sourceType: "purchase",
      sourceId: purchase._id,
    })
      .sort({ effectiveAt: 1, createdAt: 1, _id: 1 })
      .lean(),
  ]);

  return {
    events,
    entitlements,
    walletEntries,
  };
};

const buildPurchaseOperationsSummary = ({
  purchase,
  artifacts,
  olderThanMinutes = DEFAULT_STUCK_PENDING_MINUTES,
} = {}) => {
  const events = Array.isArray(artifacts?.events) ? artifacts.events : [];
  const entitlements = Array.isArray(artifacts?.entitlements) ? artifacts.entitlements : [];
  const walletEntries = Array.isArray(artifacts?.walletEntries) ? artifacts.walletEntries : [];
  const now = Date.now();
  const updatedAt = purchase?.updatedAt ? new Date(purchase.updatedAt).getTime() : now;
  const ageMinutes = Math.max(0, Math.round((now - updatedAt) / 60000));
  const saleCreditCount = walletEntries.filter((entry) => entry.entryType === "sale_credit").length;
  const platformFeeCount = walletEntries.filter((entry) => entry.entryType === "platform_fee").length;
  const isSubscription = purchase?.itemType === "subscription";
  const entitlementPresent = isSubscription
    ? Boolean(purchase?.accessExpiresAt)
    : entitlements.length > 0;
  const walletSettled = !purchase?.creatorId
    ? false
    : saleCreditCount > 0 && platformFeeCount > 0;
  const stuckPending = ["pending", "abandoned"].includes(String(purchase?.status || "").trim().toLowerCase())
    && ageMinutes >= olderThanMinutes;
  const needsEntitlementRepair = purchase?.status === "paid" && !entitlementPresent && !isSubscription;
  const needsWalletRepair = purchase?.status === "paid" && Boolean(purchase?.creatorId) && !walletSettled;
  const lastEvent = events.at(-1) || null;

  return {
    ageMinutes,
    stuckPending,
    entitlementPresent,
    needsEntitlementRepair,
    walletSettled,
    needsWalletRepair,
    needsAttention: Boolean(stuckPending || needsEntitlementRepair || needsWalletRepair),
    walletEntryCount: walletEntries.length,
    entitlementCount: entitlements.length,
    lastEventType: lastEvent?.type || "",
    lastEventAt: lastEvent?.createdAt || null,
    canReconcile: purchase?.status !== "refunded" && purchase?.provider === "paystack",
  };
};

const buildTimelineEntryFromEvent = (event = {}) => {
  const meta = TIMELINE_EVENT_META[event.type] || {
    label: String(event.type || "").replace(/_/g, " ").trim() || "Purchase event",
    tone: "info",
  };

  return {
    id: `event:${toIdString(event._id) || `${event.type}:${event.createdAt}`}`,
    kind: "event",
    type: event.type || "",
    label: meta.label,
    tone: meta.tone,
    createdAt: event.createdAt || null,
    metadata: event.metadata || {},
  };
};

const buildTimelineEntryFromEntitlement = (row = {}) => ({
  id: `entitlement:${toIdString(row._id)}`,
  kind: "entitlement",
  type: "entitlement_record",
  label: "Entitlement record present",
  tone: "success",
  createdAt: row.grantedAt || row.createdAt || null,
  metadata: {
    itemType: row.itemType || "",
    itemId: toIdString(row.itemId),
  },
});

const buildTimelineEntryFromWalletEntry = (row = {}) => ({
  id: `wallet:${toIdString(row._id)}`,
  kind: "wallet_entry",
  type: row.entryType || "wallet_entry",
  label: row.entryType === "sale_credit"
    ? "Creator wallet credited"
    : row.entryType === "platform_fee"
      ? "Platform fee booked"
      : "Wallet entry recorded",
  tone: "success",
  createdAt: row.effectiveAt || row.createdAt || null,
  metadata: {
    entryType: row.entryType || "",
    amount: Number(row.amount || 0),
    grossAmount: Number(row.grossAmount || 0),
    currency: row.currency || "NGN",
  },
});

const buildPurchaseTimeline = ({ purchase, artifacts }) => {
  const baseEntries = [
    {
      id: `purchase:${toIdString(purchase?._id)}`,
      kind: "purchase",
      type: "purchase_record_created",
      label: "Purchase record created",
      tone: "info",
      createdAt: purchase?.createdAt || null,
      metadata: {
        status: purchase?.status || "",
        providerRef: purchase?.providerRef || "",
      },
    },
  ];

  const eventEntries = (artifacts?.events || []).map(buildTimelineEntryFromEvent);
  const entitlementEntries = (artifacts?.entitlements || []).map(buildTimelineEntryFromEntitlement);
  const walletEntries = (artifacts?.walletEntries || []).map(buildTimelineEntryFromWalletEntry);

  return [...baseEntries, ...eventEntries, ...entitlementEntries, ...walletEntries]
    .sort((left, right) => new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime());
};

const buildPurchaseAdminDetail = async ({
  purchase,
  olderThanMinutes = DEFAULT_STUCK_PENDING_MINUTES,
} = {}) => {
  const [buyer, creatorProfile, artifacts] = await Promise.all([
    User.findById(purchase.userId).select("_id name username email").lean(),
    purchase.creatorId
      ? CreatorProfile.findById(purchase.creatorId).select("_id displayName fullName userId").lean()
      : Promise.resolve(null),
    loadPurchaseOperationalArtifacts(purchase),
  ]);

  return {
    transaction: toPurchasePayload(purchase),
    buyer: buyer
      ? {
          _id: toIdString(buyer._id),
          name: buyer.name || "",
          username: buyer.username || "",
          email: buyer.email || "",
        }
      : null,
    creator: creatorProfile
      ? {
          _id: toIdString(creatorProfile._id),
          displayName: creatorProfile.displayName || creatorProfile.fullName || "",
          userId: toIdString(creatorProfile.userId),
        }
      : null,
    ops: buildPurchaseOperationsSummary({
      purchase,
      artifacts,
      olderThanMinutes,
    }),
    timeline: buildPurchaseTimeline({ purchase, artifacts }),
  };
};

const buildTransactionListItem = ({
  purchase,
  olderThanMinutes = DEFAULT_STUCK_PENDING_MINUTES,
} = {}) => {
  const updatedAt = purchase?.updatedAt ? new Date(purchase.updatedAt).getTime() : Date.now();
  const ageMinutes = Math.max(0, Math.round((Date.now() - updatedAt) / 60000));

  return {
    ...toPurchasePayload(purchase),
    ageMinutes,
    stuckPending:
      ["pending", "abandoned"].includes(String(purchase?.status || "").trim().toLowerCase()) &&
      ageMinutes >= olderThanMinutes,
  };
};

module.exports = {
  DEFAULT_STUCK_PENDING_MINUTES,
  LEGACY_SUPPORTED_PAYMENT_OPTIONS,
  buildPurchaseAdminDetail,
  buildTimelineEntryFromEvent,
  buildTransactionListItem,
  createServiceError,
  initializePaystackCheckout,
  loadPurchaseOperationalArtifacts,
  normalizeType,
  reconcilePurchase,
  resolveCheckoutTarget,
  toLegacyCheckoutPayload,
  toPurchasePayload,
  validateWebhookSignature,
};
