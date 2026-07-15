const Purchase = require("../models/Purchase");
const Entitlement = require("../models/Entitlement");
const Track = require("../models/Track");
const Book = require("../models/Book");
const Album = require("../models/Album");
const User = require("../models/User");
const CreatorProfile = require("../models/CreatorProfile");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const WalletEntry = require("../models/WalletEntry");
const PaymentDispute = require("../models/PaymentDispute");
const SchoolTuitionPayment = require("../models/SchoolTuitionPayment");
const { resolvePurchasableItem } = require("./catalogService");
const { hasCreatorSubscriptionAccess } = require("./entitlementService");
const {
  generatePaymentReference,
  fetchDispute,
  initializeTransaction,
  resolvePaystackTransactionPaidAt,
  resolvePaystackTransactionDeductions,
  validateWebhookSignature,
  verifyTransaction,
} = require("./paystackService");
const {
  constructWebhookEvent: constructStripeWebhookEvent,
  createCheckoutSession,
  generateStripeReference,
  retrieveCheckoutSession,
} = require("./stripeService");
const { sendCreatorPurchaseMessengerAlert } = require("./creatorSalesMessengerService");
const {
  recordPurchaseRefundEntries,
  recordPurchaseSettlementEntries,
} = require("./walletService");
const {
  recordPurchaseAuthorized,
  recordRefundInitiated,
} = require("./revenueLedgerService");
const { sendPurchaseConfirmationEmail } = require("./purchaseConfirmationService");
const { reconcileSchoolTuitionPayment } = require("./schoolTuitionPaymentService");
const {
  buildPaystackEventId,
  buildStripeEventId,
  markPaymentWebhookEvent,
  reservePaymentWebhookEvent,
} = require("./paymentWebhookEventService");
const { logAnalyticsEvent } = require("./analyticsService");
const {
  buildPurchaseLifecyclePayload,
  isSubscriptionAccessActive,
  isSubscriptionPurchase,
  resolveSubscriptionLifecycle,
} = require("./purchaseLifecycleService");
const {
  buildRevenueShareSnapshot,
  buildSettlementRevenueShareSnapshot,
  computePurchaseRevenueShare,
} = require("./creatorRevenueSharePolicy");
const {
  buildArtistSaleTaxSnapshot,
  resolveSettlementTaxSnapshot,
} = require("./artistSaleTaxService");
const {
  markPaymentDisputeFinancialState,
  normalizePaystackDispute,
  recordDisputeOpenedEntries,
  recordDisputeResolvedEntries,
  shouldResolvePaystackDispute,
  upsertPaystackDispute,
} = require("./paymentDisputeService");
const { notifyPurchaseUnlocked } = require("./fanReturnPathService");
const { config } = require("../config/env");
const logger = require("../utils/logger");

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_STUCK_PENDING_MINUTES = 15;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  purchase_webhook_duplicate: { label: "Duplicate webhook ignored", tone: "info" },
  purchase_webhook_pending: { label: "Webhook left payment pending", tone: "warn" },
  purchase_webhook_failed: { label: "Webhook verification failed", tone: "danger" },
  purchase_webhook_settled: { label: "Webhook settled purchase", tone: "success" },
  purchase_access_granted: { label: "Access granted", tone: "success" },
  purchase_entitlement_granted: { label: "Entitlement granted", tone: "success" },
  purchase_wallet_settled: { label: "Wallet settlement recorded", tone: "success" },
  purchase_creator_alert_sent: { label: "Creator sales alert processed", tone: "info" },
  purchase_fan_return_notified: { label: "Fan return notification processed", tone: "info" },
  purchase_confirmation_sent: { label: "Purchase confirmation sent", tone: "info" },
  purchase_reconciliation_requested: { label: "Admin reconciliation requested", tone: "info" },
  purchase_reconciliation_completed: { label: "Admin reconciliation completed", tone: "success" },
  purchase_reconciliation_failed: { label: "Admin reconciliation failed", tone: "danger" },
  purchase_subscription_cancel_scheduled: { label: "Subscription cancel scheduled", tone: "warn" },
  purchase_subscription_renewal_resumed: { label: "Subscription renewal resumed", tone: "success" },
  purchase_access_revoked: { label: "Access revoked", tone: "danger" },
  purchase_refund_requested: { label: "Refund requested", tone: "info" },
  purchase_refunded: { label: "Refund completed", tone: "danger" },
  purchase_dispute_opened: { label: "Payment dispute opened", tone: "warn" },
  purchase_dispute_reminded: { label: "Payment dispute reminder", tone: "warn" },
  purchase_dispute_resolved: { label: "Payment dispute resolved", tone: "info" },
  purchase_chargeback_applied: { label: "Chargeback applied", tone: "danger" },
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

const toSettlementDate = (value) => {
  if (value == null || value === "") {
    return null;
  }
  const numericValue = Number(value);
  const date =
    Number.isFinite(numericValue) && String(value).trim() !== ""
      ? new Date(numericValue < 1e12 ? numericValue * 1000 : numericValue)
      : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const resolveVerifiedSettlementAt = ({ verified = {}, provider = "" } = {}) => {
  const fallback = new Date();
  if (String(provider || "").trim().toLowerCase() === "paystack") {
    return resolvePaystackTransactionPaidAt(verified, fallback) || fallback;
  }

  return (
    toSettlementDate(verified?.paidAt) ||
    toSettlementDate(verified?.paid_at) ||
    toSettlementDate(verified?.raw?.paidAt) ||
    toSettlementDate(verified?.raw?.paid_at) ||
    fallback
  );
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
  listedPriceAmount:
    purchase?.listedPriceAmount == null
      ? Number(purchase?.amount) || 0
      : Number(purchase.listedPriceAmount) || 0,
  taxableBaseAmount:
    purchase?.taxableBaseAmount == null
      ? null
      : Number(purchase.taxableBaseAmount) || 0,
  processingFeeAmount: Number(purchase?.processingFeeAmount) || 0,
  taxAmount: Number(purchase?.taxAmount) || 0,
  taxRateBps: purchase?.taxRateBps == null ? null : Number(purchase.taxRateBps),
  taxPriceMode: purchase?.taxPriceMode || null,
  taxSource: purchase?.taxSource || "none",
  taxPolicy: purchase?.taxPolicy || "",
  taxJurisdiction: purchase?.taxJurisdiction || "",
  taxProviderReported: Boolean(purchase?.taxProviderReported),
  taxEffectiveAt: purchase?.taxEffectiveAt || null,
  currency: purchase?.currency || "NGN",
  status: purchase?.status || "pending",
  provider: purchase?.provider || "paystack",
  providerRef: purchase?.providerRef || "",
  reference: purchase?.providerRef || "",
  providerSessionId: purchase?.providerSessionId || "",
  billingInterval: purchase?.billingInterval || "one_time",
  accessExpiresAt: purchase?.accessExpiresAt || null,
  cancelAtPeriodEnd: Boolean(purchase?.cancelAtPeriodEnd),
  canceledAt: purchase?.canceledAt || null,
  refundedAt: purchase?.refundedAt || null,
  refundReason: purchase?.refundReason || "",
  revenueCategory: purchase?.revenueCategory || "",
  revenueSharePolicy: purchase?.revenueSharePolicy || "",
  creatorShareRate: Number(purchase?.creatorShareRate) || 0,
  platformShareRate: Number(purchase?.platformShareRate) || 0,
  lifecycle: buildPurchaseLifecyclePayload(purchase),
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
  sessionId: payment?.id || payment?.session_id || purchase?.providerSessionId || "",
  providerSessionId: payment?.id || payment?.session_id || purchase?.providerSessionId || "",
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
  error.statusCode = status;
  error.isOperational = true;
  return error;
};

const isValidPaymentEmail = (value = "") =>
  EMAIL_PATTERN.test(String(value || "").trim().toLowerCase());

const getPaymentInitRoute = (req = null) =>
  String(req?.originalUrl || req?.path || "/api/payments/init");

const buildPaymentInitDiagnostics = ({
  req = null,
  itemType = "",
  itemId = "",
  amount = null,
  email = "",
  callbackUrl = "",
  error = null,
} = {}) => ({
  route: getPaymentInitRoute(req),
  itemType: String(itemType || "").trim().toLowerCase(),
  itemId: String(itemId || "").trim(),
  amount:
    amount === null || amount === undefined || amount === ""
      ? null
      : Number.isFinite(Number(amount))
        ? Number(amount)
        : null,
  emailPresent: Boolean(String(email || "").trim()),
  callbackUrl: String(callbackUrl || "").trim(),
  paystackResponseStatus:
    error?.paystackStatus ||
    error?.providerStatus ||
    error?.providerHttpStatus ||
    error?.statusCode ||
    error?.status ||
    "",
  paystackResponseMessage:
    error?.paystackMessage ||
    error?.providerMessage ||
    error?.message ||
    "",
});

const logPaymentInitFailure = (details = {}) => {
  logger.warn("Payment initialization failed", buildPaymentInitDiagnostics(details));
};

const resolvePaymentProviderErrorStatus = (error = {}) => {
  const status = Number(error?.status || error?.statusCode || 0);
  if (status >= 400 && status < 500) {
    return status;
  }
  return 503;
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

const validatePurchasableItem = (item, { currency = "NGN" } = {}) => {
  if (!item) {
    return "Item not found";
  }
  if (!item.creatorId) {
    return "Creator not found";
  }
  if (!isPublishablePayload(item.payload)) {
    return "Item is not published";
  }
  const amount = resolveItemAmountForCurrency(item, currency);
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return buildMissingCurrencyPriceMessage(currency);
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

const normalizeCurrency = (value = "NGN") =>
  String(value || "NGN").trim().toUpperCase() || "NGN";

const normalizeCurrencyMode = (value = "") =>
  String(value || "").trim().toUpperCase() === "GLOBAL" ? "GLOBAL" : "NG";

const resolveCheckoutCurrency = ({ currency = "", currencyMode = "" } = {}) => {
  const normalizedCurrency = normalizeCurrency(currency);
  if (normalizedCurrency === "USD") {
    return "USD";
  }
  if (normalizeCurrencyMode(currencyMode) === "GLOBAL") {
    return "USD";
  }
  return "NGN";
};

const selectProviderForCurrency = (currency = "NGN") =>
  normalizeCurrency(currency) === "USD" ? "stripe" : "paystack";

const resolveItemAmountForCurrency = (item = {}, currency = "NGN") => {
  const normalizedCurrency = normalizeCurrency(currency);
  if (normalizedCurrency === "USD") {
    return Number(item.priceGlobal || item.priceUSD || 0) || 0;
  }
  return Number(item.priceNGN ?? item.price ?? 0) || 0;
};

const buildMissingCurrencyPriceMessage = (currency = "NGN") =>
  normalizeCurrency(currency) === "USD"
    ? "USD price is not configured for this item"
    : "A valid amount is required to start payment.";

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

const decrementPurchasedItemCounter = async (purchase) => {
  if (!purchase?.itemId) {
    return;
  }

  if (purchase.itemType === "track") {
    await Track.updateOne({ _id: purchase.itemId }, { $inc: { purchaseCount: -1 } }).catch(() => null);
  } else if (purchase.itemType === "book") {
    await Book.updateOne({ _id: purchase.itemId }, { $inc: { purchaseCount: -1 } }).catch(() => null);
  } else if (purchase.itemType === "album") {
    await Album.updateOne({ _id: purchase.itemId }, { $inc: { purchaseCount: -1 } }).catch(() => null);
  }
};

const resolveCheckoutTarget = async ({ productType, productId, userId, currency = "NGN" }) => {
  const normalizedType = normalizeType(productType);
  const item = await resolvePurchasableItem(normalizedType, productId);
  const validationError = validatePurchasableItem(item, { currency });
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

const createPendingPurchase = async ({
  userId,
  item,
  providerRef,
  currency = "NGN",
  provider = "paystack",
  amount = null,
  providerSessionId = "",
} = {}) => {
  const revenueShareSnapshot = buildRevenueShareSnapshot(item);
  const listedPriceAmount = Number(
    amount ?? resolveItemAmountForCurrency(item, currency)
  ) || 0;
  const taxSnapshot = buildArtistSaleTaxSnapshot({
    item,
    listedPriceAmount,
    currency: normalizeCurrency(currency),
    effectiveAt: new Date(),
  });
  const { chargeAmount, ...persistedTaxSnapshot } = taxSnapshot;
  return Purchase.create({
    userId,
    creatorId: item.creatorId || undefined,
    itemType: item.itemType,
    itemId: item.itemId,
    amount: chargeAmount,
    priceNGN: Number(item.priceNGN ?? item.price) || 0,
    currency: normalizeCurrency(currency),
    status: "initiated",
    provider,
    providerRef,
    providerSessionId,
    billingInterval: item.itemType === "subscription" ? "monthly" : "one_time",
    ...revenueShareSnapshot,
    ...persistedTaxSnapshot,
  });
};

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
  const userEmail = String(user?.email || "").trim().toLowerCase();
  const callbackUrl = getReturnUrl(returnUrl);
  const requestedType = normalizeType(productType);
  if (!isValidPaymentEmail(userEmail)) {
    logPaymentInitFailure({
      req,
      itemType: requestedType,
      itemId: productId,
      email: userEmail,
      callbackUrl,
      error: { message: "A valid email is required to start payment.", status: 400 },
    });
    throw createServiceError("A valid email is required to start payment.", 400);
  }

  const checkout = await resolveCheckoutTarget({
    productType,
    productId,
    userId,
    currency: "NGN",
  });
  if (checkout.error) {
    logPaymentInitFailure({
      req,
      itemType: requestedType,
      itemId: productId,
      email: userEmail,
      callbackUrl,
      error: { message: checkout.error, status: checkout.error === "Item not found" ? 404 : 400 },
    });
    throw createServiceError(checkout.error, checkout.error === "Item not found" ? 404 : 400);
  }

  const item = checkout.item;
  const amount = resolveItemAmountForCurrency(item, "NGN");
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    logPaymentInitFailure({
      req,
      itemType: item.itemType,
      itemId: toIdString(item.itemId),
      amount,
      email: userEmail,
      callbackUrl,
      error: { message: "A valid amount is required to start payment.", status: 400 },
    });
    throw createServiceError("A valid amount is required to start payment.", 400);
  }

  const reference = generatePaymentReference(item.itemType);
  const purchase = await createPendingPurchase({
    userId,
    item,
    providerRef: reference,
    currency: config.PAYSTACK_CURRENCY || "NGN",
    provider: "paystack",
    amount,
  });

  await logPurchaseLifecycleEvent({
    type: "purchase_record_created",
    purchase,
    actorRole,
    metadata: {
      source: "checkout",
      returnUrl: callbackUrl,
      currencyMode: String(currencyMode || "NG").trim().toUpperCase(),
      provider: "paystack",
    },
  }).catch(() => null);
  await recordPurchaseAuthorized({
    purchase,
    actorUserId: userId,
    actorRole,
    actorType: "user",
  }).catch(() => null);

  try {
    const payment = await initializeTransaction({
      email: userEmail,
      amountNgn: Number(purchase.amount || 0),
      reference,
      callbackUrl,
      metadata: {
        app: "tengacion",
        buyerId: toIdString(userId),
        creatorId: toIdString(item.creatorId),
        productId: toIdString(item.itemId),
        productType: item.itemType,
        productTitle: item.title || "",
        purchaseId: toIdString(purchase._id),
        currencyMode: String(currencyMode || "NG").trim().toUpperCase(),
        tengacionTaxPolicy: purchase.taxPolicy || "",
        tengacionTaxSource: purchase.taxSource || "none",
        tengacionTaxJurisdiction: purchase.taxJurisdiction || "",
      },
    });

    const pendingPurchase = await Purchase.findByIdAndUpdate(
      purchase._id,
      {
        $set: {
          status: "pending",
          providerSessionId: payment?.id || payment?.access_code || "",
        },
      },
      { returnDocument: "after" }
    );

    await logPurchaseLifecycleEvent({
      type: "purchase_checkout_initialized",
      purchase: pendingPurchase || purchase,
      actorRole,
      metadata: {
        source: "checkout",
        provider: "paystack",
        authorizationUrl: payment.authorization_url || "",
        accessCodePresent: Boolean(payment.access_code),
      },
    }).catch(() => null);

    return { purchase: pendingPurchase || purchase, payment, item };
  } catch (error) {
    logPaymentInitFailure({
      req,
      itemType: item.itemType,
      itemId: toIdString(item.itemId),
      amount,
      email: userEmail,
      callbackUrl,
      error,
    });

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
        providerStatus: error.providerStatus || error.paystackStatus || "",
        providerHttpStatus: error.providerHttpStatus || "",
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
        amount,
        reason: error.message || "Payment initialization failed",
        providerStatus: error.providerStatus || error.paystackStatus || "",
        providerHttpStatus: error.providerHttpStatus || "",
      },
    }).catch(() => null);

    throw createServiceError(
      error.message || "Payment provider is unavailable. Please try again shortly.",
      resolvePaymentProviderErrorStatus(error)
    );
  }
};

const initializeStripeCheckout = async ({
  userId,
  productType,
  productId,
  returnUrl = "",
  actorRole = "",
} = {}) => {
  const user = await User.findById(userId).select("email").lean();
  if (!isValidPaymentEmail(user?.email)) {
    throw createServiceError("A valid email is required to start payment.", 400);
  }

  const checkout = await resolveCheckoutTarget({
    productType,
    productId,
    userId,
    currency: "USD",
  });
  if (checkout.error) {
    throw createServiceError(checkout.error, checkout.error === "Item not found" ? 404 : 400);
  }

  const item = checkout.item;
  const amount = resolveItemAmountForCurrency(item, "USD");
  const reference = generateStripeReference(item.itemType);
  const purchase = await createPendingPurchase({
    userId,
    item,
    providerRef: reference,
    currency: "USD",
    provider: "stripe",
    amount,
  });

  await logPurchaseLifecycleEvent({
    type: "purchase_record_created",
    purchase,
    actorRole,
    metadata: {
      source: "checkout",
      provider: "stripe",
      returnUrl: getReturnUrl(returnUrl),
      currencyMode: "GLOBAL",
    },
  }).catch(() => null);
  await recordPurchaseAuthorized({
    purchase,
    actorUserId: userId,
    actorRole,
    actorType: "user",
  }).catch(() => null);

  try {
    const payment = await createCheckoutSession({
      email: user.email,
      amountUsd: Number(purchase.amount || 0),
      reference,
      purchaseId: purchase._id,
      item,
      returnUrl: getReturnUrl(returnUrl),
      metadata: {
        buyerId: toIdString(userId),
        creatorId: toIdString(item.creatorId),
        productId: toIdString(item.itemId),
        productType: item.itemType,
        productTitle: item.title || "",
        currencyMode: "GLOBAL",
        tengacionTaxPolicy: purchase.taxPolicy || "",
        tengacionTaxSource: purchase.taxSource || "none",
        tengacionTaxJurisdiction: purchase.taxJurisdiction || "",
      },
    });

    const pendingPurchase = await Purchase.findByIdAndUpdate(
      purchase._id,
      {
        $set: {
          status: "pending",
          providerSessionId: payment.id || "",
        },
      },
      { returnDocument: "after" }
    );

    await logPurchaseLifecycleEvent({
      type: "purchase_checkout_initialized",
      purchase: pendingPurchase || purchase,
      actorRole,
      metadata: {
        source: "checkout",
        provider: "stripe",
        authorizationUrl: payment.authorization_url || "",
        sessionId: payment.id || "",
      },
    }).catch(() => null);

    return { purchase: pendingPurchase || purchase, payment, item };
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
        provider: "stripe",
        reason: error.message || "Stripe checkout initialization failed",
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
        amount,
        provider: "stripe",
        reason: error.message || "Stripe checkout initialization failed",
      },
    }).catch(() => null);

    throw createServiceError(error.message || "Stripe checkout initialization failed", 503);
  }
};

const initializeCheckout = async ({
  currency = "",
  currencyMode = "",
  ...payload
} = {}) => {
  const resolvedCurrency = resolveCheckoutCurrency({ currency, currencyMode });
  const provider = selectProviderForCurrency(resolvedCurrency);
  if (provider === "stripe") {
    return initializeStripeCheckout(payload);
  }
  return initializePaystackCheckout({
    ...payload,
    currencyMode: normalizeCurrencyMode(currencyMode),
  });
};

const settlePurchasedAccess = async (
  purchase,
  { paidAt = new Date(), financialSnapshot = {} } = {}
) => {
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
      status: { $in: ["initiated", "pending", "abandoned", "failed"] },
    },
    {
      $set: {
        status: "paid",
        paidAt,
        ...financialSnapshot,
        ...(purchase.itemType === "subscription"
          ? {
              billingInterval: "monthly",
              accessExpiresAt: new Date(paidAt.getTime() + MONTH_MS),
              cancelAtPeriodEnd: false,
              canceledAt: null,
              refundedAt: null,
              refundReason: "",
            }
          : {}),
      },
    },
    { returnDocument: "after" }
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
    walletResult = await recordPurchaseSettlementEntries({
      purchase,
      logger: console,
      actorUserId: req?.user?.id || "",
      actorRole,
      actorType: req?.user?.id ? "admin" : "provider",
    });
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

  const fanReturnResult = await notifyPurchaseUnlocked({
    req,
    purchase,
  }).catch((error) => ({
    sent: false,
    skipped: false,
    failed: true,
    reason: error?.message || "Fan return notification failed",
  }));

  await logPurchaseLifecycleEvent({
    type: "purchase_fan_return_notified",
    purchase,
    actorRole,
    metadata: {
      source,
      sent: Boolean(fanReturnResult?.sent),
      failed: Boolean(fanReturnResult?.failed),
      reason: fanReturnResult?.reason || "",
      notificationId: fanReturnResult?.notificationId || "",
    },
  }).catch(() => null);

  return {
    walletResult,
    alertResult,
    fanReturnResult,
  };
};

const cancelSubscriptionPurchase = async ({
  purchase,
  actorUserId = "",
  actorRole = "",
  reason = "user_cancelled",
} = {}) => {
  if (!purchase?._id) {
    throw createServiceError("Subscription purchase not found", 404);
  }

  if (!isSubscriptionPurchase(purchase)) {
    throw createServiceError("Only subscription purchases can be cancelled", 400);
  }

  const lifecycle = resolveSubscriptionLifecycle(purchase);
  if (!lifecycle.hasActiveAccess) {
    throw createServiceError("This subscription is not active anymore", 400);
  }

  if (lifecycle.cancelAtPeriodEnd) {
    return {
      purchase,
      alreadyCancelled: true,
    };
  }

  const canceledAt = new Date();
  const updatedPurchase = await Purchase.findByIdAndUpdate(
    purchase._id,
    {
      $set: {
        cancelAtPeriodEnd: true,
        canceledAt,
      },
    },
    { returnDocument: "after" }
  );

  await logPurchaseLifecycleEvent({
    type: "purchase_subscription_cancel_scheduled",
    purchase: updatedPurchase,
    userId: actorUserId || toIdString(updatedPurchase?.userId),
    actorRole,
    metadata: {
      reason,
      accessExpiresAt: updatedPurchase?.accessExpiresAt || null,
      cancelAtPeriodEnd: true,
    },
  }).catch(() => null);

  return {
    purchase: updatedPurchase,
    alreadyCancelled: false,
  };
};

const resumeSubscriptionRenewal = async ({
  purchase,
  actorUserId = "",
  actorRole = "",
  reason = "user_resumed_subscription",
} = {}) => {
  if (!purchase?._id) {
    throw createServiceError("Subscription purchase not found", 404);
  }

  if (!isSubscriptionPurchase(purchase)) {
    throw createServiceError("Only subscription purchases can resume renewal", 400);
  }

  const lifecycle = resolveSubscriptionLifecycle(purchase);
  if (!lifecycle.hasActiveAccess) {
    throw createServiceError("This subscription is not active anymore", 400);
  }

  if (!lifecycle.cancelAtPeriodEnd) {
    return {
      purchase,
      alreadyResumed: true,
    };
  }

  const updatedPurchase = await Purchase.findByIdAndUpdate(
    purchase._id,
    {
      $set: {
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    },
    { returnDocument: "after" }
  );

  await logPurchaseLifecycleEvent({
    type: "purchase_subscription_renewal_resumed",
    purchase: updatedPurchase,
    userId: actorUserId || toIdString(updatedPurchase?.userId),
    actorRole,
    metadata: {
      reason,
      accessExpiresAt: updatedPurchase?.accessExpiresAt || null,
      cancelAtPeriodEnd: false,
    },
  }).catch(() => null);

  return {
    purchase: updatedPurchase,
    alreadyResumed: false,
  };
};

const refundPurchase = async ({
  req = null,
  purchase,
  actorUserId = "",
  actorRole = "",
  reason = "admin_refund",
} = {}) => {
  if (!purchase?._id) {
    throw createServiceError("Purchase not found", 404);
  }

  if (String(purchase?.status || "").trim().toLowerCase() !== "paid") {
    throw createServiceError("Only paid purchases can be refunded", 400);
  }

  await logPurchaseLifecycleEvent({
    type: "purchase_refund_requested",
    purchase,
    userId: actorUserId || toIdString(purchase.userId),
    actorRole,
    metadata: {
      reason,
    },
  }).catch(() => null);
  await recordRefundInitiated({
    purchase,
    actorUserId,
    actorRole,
    reason,
  }).catch(() => null);

  await recordPurchaseSettlementEntries({
    purchase,
    logger: null,
    actorUserId,
    actorRole,
    actorType: actorUserId ? "admin" : "system",
  }).catch(() => null);

  const refundedAt = new Date();
  const updatedPurchase = await Purchase.findByIdAndUpdate(
    purchase._id,
    {
      $set: {
        status: "refunded",
        refundedAt,
        refundReason: reason,
        cancelAtPeriodEnd: false,
        canceledAt: purchase?.canceledAt || refundedAt,
        ...(isSubscriptionPurchase(purchase)
          ? { accessExpiresAt: refundedAt }
          : {}),
      },
    },
    { returnDocument: "after" }
  );

  if (!updatedPurchase) {
    throw createServiceError("Failed to refund purchase", 500);
  }

  if (!isSubscriptionPurchase(updatedPurchase)) {
    await Entitlement.deleteOne({
      buyerId: updatedPurchase.userId,
      itemType: updatedPurchase.itemType,
      itemId: updatedPurchase.itemId,
    }).catch(() => null);
    await decrementPurchasedItemCounter(updatedPurchase);
  }

  let walletResult;
  try {
    walletResult = await recordPurchaseRefundEntries({
      purchase: updatedPurchase,
      logger: console,
      actorUserId,
      actorRole,
      reason,
    });
  } catch (error) {
    walletResult = {
      createdCount: 0,
      skipped: false,
      failed: true,
      reason: error?.message || "Wallet refund reversal failed",
    };
  }

  await logPurchaseLifecycleEvent({
    type: "purchase_refunded",
    purchase: updatedPurchase,
    userId: actorUserId || toIdString(updatedPurchase.userId),
    actorRole,
    metadata: {
      reason,
      createdCount: Number(walletResult?.createdCount || 0),
      walletSkipped: Boolean(walletResult?.skipped),
      walletFailed: Boolean(walletResult?.failed),
    },
  }).catch(() => null);

  await logPurchaseLifecycleEvent({
    type: "purchase_access_revoked",
    purchase: updatedPurchase,
    userId: actorUserId || toIdString(updatedPurchase.userId),
    actorRole,
    metadata: {
      reason,
      subscriptionAccess: isSubscriptionPurchase(updatedPurchase),
      accessExpiresAt: updatedPurchase.accessExpiresAt || null,
    },
  }).catch(() => null);

  return {
    purchase: updatedPurchase,
    walletResult,
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
    { returnDocument: "after" }
  );

const findActiveDuplicateSubscription = async (purchase, { at = new Date() } = {}) => {
  if (!isSubscriptionPurchase(purchase) || !purchase?.userId || !purchase?.creatorId) {
    return null;
  }

  const rows = await Purchase.find({
    _id: { $ne: purchase._id },
    userId: purchase.userId,
    creatorId: purchase.creatorId,
    itemType: "subscription",
    status: "paid",
  })
    .sort({ accessExpiresAt: -1, paidAt: -1, createdAt: -1 })
    .lean();

  return rows.find((row) => isSubscriptionAccessActive(row, { at })) || null;
};

const blockDuplicateActiveSubscription = async ({
  purchase,
  duplicate,
  verified,
  actorUserId = "",
  actorRole = "",
  source = "verify",
} = {}) => {
  const message = "You already have an active subscription for this creator";
  const updatedPurchase = await updatePurchaseStatus(purchase, "failed").catch(() => purchase);
  const failureEventType =
    source === "webhook"
      ? "purchase_webhook_failed"
      : source === "admin_reconcile"
        ? "purchase_reconciliation_failed"
        : "purchase_verification_failed";

  await logPurchaseLifecycleEvent({
    type: failureEventType,
    purchase: updatedPurchase || purchase,
    userId: actorUserId || toIdString(purchase.userId),
    actorRole,
    metadata: {
      source,
      reason: message,
      duplicatePurchaseId: toIdString(duplicate?._id),
      duplicateAccessExpiresAt: duplicate?.accessExpiresAt || null,
    },
  }).catch(() => null);

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
      reason: message,
    },
  }).catch(() => null);

  return {
    purchase: updatedPurchase || purchase,
    verified,
    accessGranted: false,
    success: false,
    reason: message,
  };
};

const reconcileVerifiedPurchase = async ({
  req = null,
  purchase,
  verified,
  actorUserId = "",
  actorRole = "",
  source = "verify",
  reason = "",
} = {}) => {
  if (!purchase?._id) {
    throw createServiceError("Payment not found", 404);
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

  if (isSubscriptionPurchase(purchase) && String(purchase.status || "").trim().toLowerCase() !== "paid") {
    const duplicate = await findActiveDuplicateSubscription(purchase);
    if (duplicate) {
      return blockDuplicateActiveSubscription({
        purchase,
        duplicate,
        verified,
        actorUserId,
        actorRole,
        source,
      });
    }
  }

  const paidAt = resolveVerifiedSettlementAt({
    verified,
    provider: purchase.provider,
  });
  const revenueShareSnapshot = buildSettlementRevenueShareSnapshot(purchase, {
    settledAt: paidAt,
  });
  const deductionSnapshot =
    String(purchase.provider || "").trim().toLowerCase() === "paystack"
      ? resolvePaystackTransactionDeductions({
          transaction: verified,
          grossAmount: Number(purchase.amount || 0),
          taxAmount: Number(purchase.taxAmount || 0),
        })
      : {
          processingFeeAmount: Number(
            verified?.processingFeeAmount ?? purchase.processingFeeAmount ?? 0
          ) || 0,
          taxAmount: Number(verified?.taxAmount ?? purchase.taxAmount ?? 0) || 0,
          taxProviderReported: Boolean(verified?.taxProviderReported),
        };
  const resolvedTaxSnapshot = resolveSettlementTaxSnapshot({
    purchase,
    providerTaxAmount: deductionSnapshot.taxAmount,
    providerTaxReported: Boolean(deductionSnapshot.taxProviderReported),
    settledAt: paidAt,
  });
  const { chargeAmount: _settlementChargeAmount, ...persistedTaxSnapshot } =
    resolvedTaxSnapshot;
  const settled = await settlePurchasedAccess(purchase, {
    paidAt,
    financialSnapshot: {
      ...revenueShareSnapshot,
      processingFeeAmount: deductionSnapshot.processingFeeAmount,
      ...persistedTaxSnapshot,
    },
  });
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

  if (settled.purchaseUpdated) {
    const confirmationResult = await sendPurchaseConfirmationEmail({
      purchase: settled.purchase,
    }).catch((error) => ({
      sent: false,
      skipped: false,
      failed: true,
      reason: error?.message || "Purchase confirmation email failed",
    }));

    await logPurchaseLifecycleEvent({
      type: "purchase_confirmation_sent",
      purchase: settled.purchase,
      actorRole,
      metadata: {
        source,
        sent: Boolean(confirmationResult?.sent),
        skipped: Boolean(confirmationResult?.skipped),
        failed: Boolean(confirmationResult?.failed),
        reason: confirmationResult?.reason || "",
      },
    }).catch(() => null);
  }

  return {
    purchase: settled.purchase,
    verified,
    accessGranted: true,
    success: true,
    purchaseUpdated: Boolean(settled.purchaseUpdated),
    entitlementCreated: Boolean(settled.entitlementCreated),
    walletResult: sideEffects.walletResult,
    alertResult: sideEffects.alertResult,
    fanReturnResult: sideEffects.fanReturnResult,
  };
};

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

  const verified = await verifyTransaction(purchase.providerRef);
  return reconcileVerifiedPurchase({
    req,
    purchase,
    verified,
    actorUserId,
    actorRole,
    source,
    reason,
  });
};

const logDuplicateWebhookEvent = async ({
  purchase = null,
  provider = "",
  eventId = "",
  eventType = "",
} = {}) => {
  if (!purchase?._id) {
    return null;
  }

  return logPurchaseLifecycleEvent({
    type: "purchase_webhook_duplicate",
    purchase,
    actorRole: "system",
    metadata: {
      source: "webhook",
      provider,
      eventId,
      eventType,
    },
  }).catch(() => null);
};

const PAYSTACK_DISPUTE_EVENT_TYPES = new Set([
  "charge.dispute.create",
  "charge.dispute.remind",
  "charge.dispute.resolve",
]);

const getPaystackEventReference = (payload = {}) =>
  String(
    payload?.data?.transaction?.reference ||
      payload?.data?.transaction_reference ||
      payload?.data?.merchant_transaction_reference ||
      payload?.data?.reference ||
      ""
  ).trim();

const assertDisputeAccountingComplete = (result = {}) => {
  const ledgerFailed = Boolean(
    result?.revenueLedgerFailed || result?.releaseResult?.revenueLedgerFailed
  );
  if (ledgerFailed) {
    throw createServiceError(
      "Chargeback wallet entries were written but revenue-ledger recording failed",
      500
    );
  }
};

const synchronizePurchasedItemCounter = async (purchase) => {
  if (!purchase?.itemId || !["track", "book", "album"].includes(purchase.itemType)) {
    return;
  }

  const purchaseCount = await Purchase.countDocuments({
    itemType: purchase.itemType,
    itemId: purchase.itemId,
    status: "paid",
  });
  const model =
    purchase.itemType === "track"
      ? Track
      : purchase.itemType === "book"
        ? Book
        : Album;
  await model.updateOne(
    { _id: purchase.itemId },
    { $set: { purchaseCount } }
  );
};

const loadCumulativePurchaseChargebackAmount = async (purchaseId) => {
  const rows = await PaymentDispute.aggregate([
    {
      $match: {
        purchaseId: purchaseId,
        financialState: "debited",
      },
    },
    { $group: { _id: null, amount: { $sum: "$chargebackAmount" } } },
  ]);
  return Math.max(0, Number(rows?.[0]?.amount || 0));
};

const finalizeFullyChargedBackPurchase = async ({ purchase, dispute } = {}) => {
  if (!purchase?._id || !dispute?._id) {
    return { purchase, accessRevoked: false, fullyChargedBack: false };
  }

  const shareBaseAmount = Number(computePurchaseRevenueShare(purchase).shareBaseAmount || 0);
  const cumulativeChargebackAmount = await loadCumulativePurchaseChargebackAmount(
    purchase._id
  );
  const fullyChargedBack =
    shareBaseAmount > 0 && cumulativeChargebackAmount + 0.009 >= shareBaseAmount;
  if (!fullyChargedBack) {
    return {
      purchase,
      accessRevoked: false,
      fullyChargedBack: false,
      cumulativeChargebackAmount,
      shareBaseAmount,
    };
  }

  const refundedAt = dispute.resolvedAt || dispute.lastEventAt || new Date();
  const updatedPurchase = await Purchase.findOneAndUpdate(
    { _id: purchase._id, status: "paid" },
    {
      $set: {
        status: "refunded",
        refundedAt,
        refundReason: `paystack_chargeback:${dispute.providerDisputeId}`,
        cancelAtPeriodEnd: false,
        ...(isSubscriptionPurchase(purchase)
          ? {
              canceledAt: refundedAt,
              accessExpiresAt: refundedAt,
            }
          : {}),
      },
    },
    { returnDocument: "after" }
  );

  const finalPurchase = updatedPurchase || (await Purchase.findById(purchase._id));
  const chargebackReason = `paystack_chargeback:${dispute.providerDisputeId}`;
  const shouldEnsureRevocation = Boolean(
    finalPurchase &&
      (updatedPurchase ||
        (finalPurchase.status === "refunded" &&
          finalPurchase.refundReason === chargebackReason))
  );
  if (!shouldEnsureRevocation) {
    return {
      purchase: finalPurchase,
      accessRevoked: false,
      fullyChargedBack: true,
      cumulativeChargebackAmount,
      shareBaseAmount,
    };
  }

  if (!isSubscriptionPurchase(finalPurchase)) {
    await Entitlement.deleteOne({
      buyerId: finalPurchase.userId,
      itemType: finalPurchase.itemType,
      itemId: finalPurchase.itemId,
    });
    await synchronizePurchasedItemCounter(finalPurchase);
  }

  await logPurchaseLifecycleEvent({
    type: "purchase_access_revoked",
    purchase: finalPurchase,
    userId: toIdString(finalPurchase.userId),
    actorRole: "system",
    metadata: {
      reason: "paystack_chargeback",
      providerDisputeId: dispute.providerDisputeId,
      cumulativeChargebackAmount,
      shareBaseAmount,
    },
  }).catch(() => null);

  return {
    purchase: finalPurchase,
    accessRevoked: true,
    fullyChargedBack: true,
    cumulativeChargebackAmount,
    shareBaseAmount,
  };
};

const handlePaystackDisputeWebhook = async ({
  payload,
  eventType,
  reservation,
} = {}) => {
  const eventDisputeId = String(
    payload?.data?.id || payload?.data?.dispute_code || ""
  ).trim();
  if (!eventDisputeId) {
    throw createServiceError("Paystack dispute event is missing its dispute ID", 400);
  }

  const canonical = await fetchDispute(eventDisputeId);
  const eventData = payload?.data && typeof payload.data === "object" ? payload.data : {};
  const canonicalData = canonical && typeof canonical === "object" ? canonical : {};
  const normalized = normalizePaystackDispute(
    {
      ...eventData,
      ...canonicalData,
      id: canonicalData.id || eventData.id || eventData.dispute_code,
      transaction: canonicalData.transaction || eventData.transaction || {},
    },
    { eventType }
  );
  const purchase = normalized.providerRef
    ? await Purchase.findOne({
        provider: "paystack",
        providerRef: normalized.providerRef,
      })
    : null;
  const stored = await upsertPaystackDispute({
    dispute: normalized,
    purchaseId: purchase?._id || null,
    eventType,
  });
  let dispute = stored.dispute;

  if (!purchase) {
    dispute = await markPaymentDisputeFinancialState({
      dispute,
      financialState: "manual_review",
      manualReviewReason: normalized.providerRef
        ? "purchase_not_found"
        : "missing_purchase_reference",
    });
    await markPaymentWebhookEvent({
      event: reservation.event,
      status: "processed",
      providerRef: normalized.providerRef,
    });
    return {
      received: true,
      dispute: true,
      manualReview: true,
      reason: dispute?.manualReviewReason || "purchase_not_found",
    };
  }

  const purchaseStatus = String(purchase.status || "").trim().toLowerCase();
  if (
    purchaseStatus !== "paid" &&
    !(purchaseStatus === "refunded" && dispute?.financialState === "debited")
  ) {
    dispute = await markPaymentDisputeFinancialState({
      dispute,
      financialState: "manual_review",
      manualReviewReason: `purchase_status_${purchaseStatus || "unknown"}`,
    });
    await markPaymentWebhookEvent({
      event: reservation.event,
      status: "processed",
      purchaseId: purchase._id,
      providerRef: normalized.providerRef,
    });
    return {
      received: true,
      dispute: true,
      manualReview: true,
      reason: dispute?.manualReviewReason || "purchase_not_paid",
    };
  }

  const isResolve = shouldResolvePaystackDispute({
    eventType,
    dispute: normalized,
  });
  const accountingResult = isResolve
    ? await recordDisputeResolvedEntries({ purchase, dispute, logger })
    : await recordDisputeOpenedEntries({ purchase, dispute, logger });
  assertDisputeAccountingComplete(accountingResult);
  dispute = accountingResult.dispute || dispute;

  let finalization = {
    purchase,
    accessRevoked: false,
    fullyChargedBack: false,
  };
  if (
    isResolve &&
    accountingResult.action === "chargeback" &&
    accountingResult.financialState === "debited"
  ) {
    finalization = await finalizeFullyChargedBackPurchase({ purchase, dispute });
    await logPurchaseLifecycleEvent({
      type: "purchase_chargeback_applied",
      purchase: finalization.purchase || purchase,
      userId: toIdString(purchase.userId),
      actorRole: "system",
      metadata: {
        providerDisputeId: dispute.providerDisputeId,
        chargebackAmount: Number(accountingResult.chargebackAmount || 0),
        creatorChargebackAmount: Number(
          accountingResult.creatorChargebackAmount || 0
        ),
        platformChargebackAmount: Number(
          accountingResult.platformChargebackAmount || 0
        ),
        fullyChargedBack: Boolean(finalization.fullyChargedBack),
      },
    }).catch(() => null);
  }

  await logPurchaseLifecycleEvent({
    type: isResolve
      ? "purchase_dispute_resolved"
      : eventType === "charge.dispute.remind"
        ? "purchase_dispute_reminded"
        : "purchase_dispute_opened",
    purchase: finalization.purchase || purchase,
    userId: toIdString(purchase.userId),
    actorRole: "system",
    metadata: {
      providerDisputeId: dispute.providerDisputeId,
      status: dispute.status || "",
      resolution: dispute.resolution || "",
      financialState: dispute.financialState || accountingResult.financialState || "",
      action: accountingResult.action || "",
    },
  }).catch(() => null);

  await markPaymentWebhookEvent({
    event: reservation.event,
    status: "processed",
    purchaseId: purchase._id,
    providerRef: normalized.providerRef,
  });

  return {
    received: true,
    dispute: true,
    action: accountingResult.action || "",
    financialState: dispute.financialState || accountingResult.financialState || "",
    accessRevoked: Boolean(finalization.accessRevoked),
    fullyChargedBack: Boolean(finalization.fullyChargedBack),
  };
};

const handlePaystackWebhookEvent = async ({
  req = null,
  rawBody = "",
  signature = "",
  event = null,
} = {}) => {
  if (!validateWebhookSignature({ rawBody, signature })) {
    throw createServiceError("Invalid Paystack signature", 401);
  }

  const payload = event || {};
  const eventType = String(payload?.event || "").trim();
  const reference = getPaystackEventReference(payload);
  const eventId = buildPaystackEventId({ event: payload, rawBody });
  const reservation = await reservePaymentWebhookEvent({
    provider: "paystack",
    eventId,
    eventType,
    providerRef: reference,
    rawBody,
    payload,
    payloadSummary: {
      reference,
      gatewayId: String(
        payload?.data?.id || payload?.data?.dispute_code || payload?.id || ""
      ),
      amount: Number(payload?.data?.amount || 0),
      currency: String(payload?.data?.currency || "").trim().toUpperCase(),
    },
  });

  if (reservation.duplicate && reservation.retryable) {
    throw createServiceError("Paystack webhook processing is still in progress", 503);
  }

  if (reservation.duplicate && reservation.event?.status !== "failed") {
    if (reference) {
      const purchase = await Purchase.findOne({ providerRef: reference }).catch(() => null);
      await logDuplicateWebhookEvent({
        purchase,
        provider: "paystack",
        eventId,
        eventType,
      });
    }
    return { received: true, duplicate: true };
  }

  if (PAYSTACK_DISPUTE_EVENT_TYPES.has(eventType)) {
    try {
      return await handlePaystackDisputeWebhook({
        payload,
        eventType,
        reservation,
      });
    } catch (error) {
      await markPaymentWebhookEvent({
        event: reservation.event,
        status: "failed",
        providerRef: reference,
        errorMessage: error.message || "Paystack dispute processing failed",
      });
      throw error;
    }
  }

  if (eventType !== "charge.success" || !reference) {
    await markPaymentWebhookEvent({
      event: reservation.event,
      status: "skipped",
      providerRef: reference,
    });
    return { received: true, skipped: true };
  }

  const purchase = await Purchase.findOne({ providerRef: reference });
  const tuitionPayment = purchase
    ? null
    : await SchoolTuitionPayment.findOne({ reference });
  if (!purchase && !tuitionPayment) {
    await markPaymentWebhookEvent({
      event: reservation.event,
      status: "skipped",
      providerRef: reference,
    });
    return { received: true, skipped: true };
  }

  try {
    if (tuitionPayment) {
      const result = await reconcileSchoolTuitionPayment({ payment: tuitionPayment });
      await markPaymentWebhookEvent({
        event: reservation.event,
        status: "processed",
        providerRef: reference,
      });
      return { received: true, tuitionPayment: true, ...result };
    }

    const result = await reconcilePurchase({
      req,
      purchase,
      actorUserId: toIdString(purchase.userId),
      actorRole: "system",
      source: "webhook",
      reason: eventType,
    });

    await markPaymentWebhookEvent({
      event: reservation.event,
      status: "processed",
      purchaseId: purchase._id,
      providerRef: reference,
    });

    return { received: true, ...result };
  } catch (error) {
    await markPaymentWebhookEvent({
      event: reservation.event,
      status: "failed",
      purchaseId: purchase?._id || null,
      providerRef: reference,
      errorMessage: error.message || "Paystack webhook processing failed",
    });
    throw error;
  }
};

const STRIPE_SUCCESS_WEBHOOK_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

const STRIPE_FAILURE_WEBHOOK_EVENTS = new Set([
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

const getStripeSessionMetadata = (session = {}) =>
  session?.metadata || session?.raw?.metadata || {};

const getStripeSessionId = (session = {}) =>
  String(session?.id || session?.raw?.id || "").trim();

const getStripeProviderRef = (session = {}) => {
  const metadata = getStripeSessionMetadata(session);
  return String(metadata.providerRef || session?.reference || "").trim();
};

const getStripePurchaseId = (session = {}) => {
  const metadata = getStripeSessionMetadata(session);
  return String(metadata.purchaseId || session?.client_reference_id || session?.raw?.client_reference_id || "").trim();
};

const findStripePurchaseForSession = async (session = {}, fallbackSession = null) => {
  const sessions = [session, fallbackSession].filter(Boolean);

  for (const candidate of sessions) {
    const purchaseId = getStripePurchaseId(candidate);
    if (purchaseId) {
      const purchase = await Purchase.findById(purchaseId).catch(() => null);
      if (purchase) {
        return purchase;
      }
    }
  }

  for (const candidate of sessions) {
    const providerRef = getStripeProviderRef(candidate);
    if (providerRef) {
      const purchase = await Purchase.findOne({ providerRef }).catch(() => null);
      if (purchase) {
        return purchase;
      }
    }
  }

  for (const candidate of sessions) {
    const sessionId = getStripeSessionId(candidate);
    if (sessionId) {
      const purchase = await Purchase.findOne({
        provider: "stripe",
        providerSessionId: sessionId,
      }).catch(() => null);
      if (purchase) {
        return purchase;
      }
    }
  }

  return null;
};

const normalizeStripeSessionForVerification = (session = {}) => {
  const raw = session?.raw || session || {};
  const paymentStatus = String(session?.payment_status || raw.payment_status || "").trim().toLowerCase();
  const checkoutStatus = String(session?.status || raw.status || "").trim().toLowerCase();
  const amountMinor = Number(session?.amountMinor ?? raw.amount_total ?? 0) || 0;
  const rawTaxMinor = raw?.total_details?.amount_tax;
  const automaticTaxStatus = String(raw?.automatic_tax?.status || "")
    .trim()
    .toLowerCase();
  const taxProviderReported = Boolean(
    session?.taxProviderReported ??
      raw?.taxProviderReported ??
      (automaticTaxStatus === "complete" ||
        (rawTaxMinor != null && Number(rawTaxMinor) > 0))
  );

  let status = "pending";
  if (paymentStatus === "paid") {
    status = "success";
  } else if (
    ["failed", "canceled", "cancelled"].includes(paymentStatus) ||
    checkoutStatus === "expired"
  ) {
    status = "failed";
  }

  return {
    status,
    amountKobo: amountMinor,
    amountMinor,
    processingFeeAmount: Number(
      session?.processingFeeAmount ?? raw?.processingFeeAmount ?? 0
    ) || 0,
    taxAmount:
      Number(
        session?.taxAmount ??
          raw?.taxAmount ??
          (rawTaxMinor == null ? 0 : Number(rawTaxMinor) / 100)
      ) || 0,
    taxProviderReported,
    paidAt: session?.paidAt || raw?.paidAt || raw?.paid_at || null,
    currency: String(session?.currency || raw.currency || "USD").trim().toUpperCase() || "USD",
    raw,
  };
};

const handleStripeFailedCheckout = async ({
  purchase,
  eventType = "",
  providerRef = "",
} = {}) => {
  if (!purchase?._id) {
    return { purchase: null, success: false, skipped: true };
  }

  const currentStatus = String(purchase.status || "").trim().toLowerCase();
  if (["paid", "refunded"].includes(currentStatus)) {
    return { purchase, success: false, skipped: true };
  }

  const updatedPurchase = await updatePurchaseStatus(purchase, "failed").catch(() => purchase);
  await logPurchaseLifecycleEvent({
    type: "purchase_webhook_failed",
    purchase: updatedPurchase || purchase,
    userId: toIdString(purchase.userId),
    actorRole: "system",
    metadata: {
      source: "webhook",
      provider: "stripe",
      eventType,
      reason: "Stripe checkout did not complete",
    },
  }).catch(() => null);

  await logAnalyticsEvent({
    type: "purchase_failed",
    userId: toIdString(purchase.userId),
    actorRole: "system",
    targetId: purchase._id,
    targetType: "purchase",
    contentType: purchase.itemType,
    metadata: {
      creatorId: toIdString(purchase.creatorId),
      itemId: toIdString(purchase.itemId),
      amount: Number(purchase.amount || 0),
      provider: "stripe",
      providerRef,
      reason: "Stripe checkout did not complete",
    },
  }).catch(() => null);

  return {
    purchase: updatedPurchase || purchase,
    success: false,
    accessGranted: false,
    reason: "Stripe checkout did not complete",
  };
};

const constructStripeEventSafely = ({ rawBody = "", signature = "" } = {}) => {
  try {
    return constructStripeWebhookEvent({ rawBody, signature });
  } catch (error) {
    const status = /signature/i.test(error?.message || "") ? 401 : 500;
    throw createServiceError(error?.message || "Invalid Stripe webhook signature", status);
  }
};

const handleStripeWebhookEvent = async ({
  req = null,
  rawBody = "",
  signature = "",
} = {}) => {
  const event = constructStripeEventSafely({ rawBody, signature });
  const eventType = String(event?.type || "").trim();
  const eventSession = event?.data?.object || {};
  const providerRef = getStripeProviderRef(eventSession);
  const eventId = buildStripeEventId(event);
  const reservation = await reservePaymentWebhookEvent({
    provider: "stripe",
    eventId,
    eventType,
    providerRef,
    rawBody,
    payload: event,
    payloadSummary: {
      sessionId: getStripeSessionId(eventSession),
      providerRef,
      paymentStatus: String(eventSession?.payment_status || "").trim(),
      checkoutStatus: String(eventSession?.status || "").trim(),
    },
  });

  if (reservation.duplicate && reservation.retryable) {
    throw createServiceError("Stripe webhook processing is still in progress", 503);
  }

  if (reservation.duplicate && reservation.event?.status !== "failed") {
    const purchase = await findStripePurchaseForSession(eventSession).catch(() => null);
    await logDuplicateWebhookEvent({
      purchase,
      provider: "stripe",
      eventId,
      eventType,
    });
    return { received: true, duplicate: true };
  }

  if (!STRIPE_SUCCESS_WEBHOOK_EVENTS.has(eventType) && !STRIPE_FAILURE_WEBHOOK_EVENTS.has(eventType)) {
    await markPaymentWebhookEvent({
      event: reservation.event,
      status: "skipped",
      providerRef,
    });
    return { received: true, skipped: true };
  }

  try {
    if (STRIPE_FAILURE_WEBHOOK_EVENTS.has(eventType)) {
      const purchase = await findStripePurchaseForSession(eventSession);
      if (!purchase) {
        await markPaymentWebhookEvent({
          event: reservation.event,
          status: "skipped",
          providerRef,
        });
        return { received: true, skipped: true };
      }

      const result = await handleStripeFailedCheckout({
        purchase,
        eventType,
        providerRef: providerRef || purchase.providerRef,
      });
      await markPaymentWebhookEvent({
        event: reservation.event,
        status: "processed",
        purchaseId: purchase._id,
        providerRef: providerRef || purchase.providerRef,
      });
      return { received: true, ...result };
    }

    const sessionId = getStripeSessionId(eventSession);
    const verifiedSession = sessionId
      ? await retrieveCheckoutSession(sessionId)
      : eventSession;
    const purchase = await findStripePurchaseForSession(verifiedSession, eventSession);
    if (!purchase) {
      await markPaymentWebhookEvent({
        event: reservation.event,
        status: "skipped",
        providerRef: providerRef || getStripeProviderRef(verifiedSession),
      });
      return { received: true, skipped: true };
    }

    const result = await reconcileVerifiedPurchase({
      req,
      purchase,
      verified: normalizeStripeSessionForVerification(verifiedSession),
      actorUserId: toIdString(purchase.userId),
      actorRole: "system",
      source: "webhook",
      reason: eventType,
    });

    await markPaymentWebhookEvent({
      event: reservation.event,
      status: "processed",
      purchaseId: purchase._id,
      providerRef: purchase.providerRef,
    });

    return { received: true, ...result };
  } catch (error) {
    await markPaymentWebhookEvent({
      event: reservation.event,
      status: "failed",
      providerRef,
      errorMessage: error.message || "Stripe webhook processing failed",
    });
    throw error;
  }
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

  const disputes = await PaymentDispute.find({ purchaseId: purchase._id })
    .sort({ lastEventAt: 1, createdAt: 1, _id: 1 })
    .lean();
  const disputeIds = disputes.map((row) => row._id);

  const [events, entitlements, walletEntries] = await Promise.all([
    AnalyticsEvent.find({
      targetType: "purchase",
      targetId: purchase._id,
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean(),
    entitlementQuery,
    WalletEntry.find({
      $or: [
        {
          sourceId: purchase._id,
          sourceType: { $in: ["purchase", "refund"] },
        },
        ...(disputeIds.length
          ? [{ sourceId: { $in: disputeIds }, sourceType: "dispute" }]
          : []),
      ],
    })
      .sort({ effectiveAt: 1, createdAt: 1, _id: 1 })
      .lean(),
  ]);

  return {
    events,
    entitlements,
    walletEntries,
    disputes,
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
  const disputes = Array.isArray(artifacts?.disputes) ? artifacts.disputes : [];
  const lifecycle = buildPurchaseLifecyclePayload(purchase);
  const now = Date.now();
  const updatedAt = purchase?.updatedAt ? new Date(purchase.updatedAt).getTime() : now;
  const ageMinutes = Math.max(0, Math.round((now - updatedAt) / 60000));
  const saleCreditCount = walletEntries.filter((entry) => entry.entryType === "sale_credit").length;
  const platformFeeCount = walletEntries.filter((entry) => entry.entryType === "platform_fee").length;
  const refundDebitCount = walletEntries.filter((entry) => entry.entryType === "refund_debit").length;
  const chargebackDebitCount = walletEntries.filter(
    (entry) => entry.entryType === "chargeback_debit"
  ).length;
  const disputeAttentionCount = disputes.filter(
    (entry) =>
      ["manual_review", "held"].includes(
        String(entry?.financialState || "").trim().toLowerCase()
      )
  ).length;
  const isSubscription = purchase?.itemType === "subscription";
  const entitlementPresent = isSubscription
    ? Boolean(lifecycle.hasActiveAccess)
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
    needsAttention: Boolean(
      stuckPending || needsEntitlementRepair || needsWalletRepair || disputeAttentionCount
    ),
    disputeCount: disputes.length,
    disputeAttentionCount,
    chargebackDebitCount,
    walletEntryCount: walletEntries.length,
    refundEntryCount: refundDebitCount,
    entitlementCount: entitlements.length,
    lastEventType: lastEvent?.type || "",
    lastEventAt: lastEvent?.createdAt || null,
    canReconcile: purchase?.status !== "refunded" && purchase?.provider === "paystack",
    canRefund: purchase?.status === "paid",
    canCancelSubscription: lifecycle.canCancel,
    lifecycle,
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
      : row.entryType === "refund_debit"
        ? "Refund reversal booked"
      : "Wallet entry recorded",
  tone: row.entryType === "refund_debit" ? "danger" : "success",
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
  cancelSubscriptionPurchase,
  DEFAULT_STUCK_PENDING_MINUTES,
  LEGACY_SUPPORTED_PAYMENT_OPTIONS,
  buildPurchaseAdminDetail,
  buildTimelineEntryFromEvent,
  buildTransactionListItem,
  createServiceError,
  handlePaystackWebhookEvent,
  handleStripeWebhookEvent,
  initializeCheckout,
  refundPurchase,
  resumeSubscriptionRenewal,
  initializePaystackCheckout,
  initializeStripeCheckout,
  loadPurchaseOperationalArtifacts,
  normalizeType,
  reconcilePurchase,
  resolveCheckoutCurrency,
  resolveCheckoutTarget,
  selectProviderForCurrency,
  toLegacyCheckoutPayload,
  toPurchasePayload,
  validateWebhookSignature,
};
