const SUBSCRIPTION_GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;

const toDate = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isSubscriptionPurchase = (purchase = {}) =>
  String(purchase?.itemType || "").trim().toLowerCase() === "subscription";

const isSubscriptionAccessActive = (purchase = {}, { at = new Date() } = {}) => {
  if (!isSubscriptionPurchase(purchase)) {
    return false;
  }

  if (String(purchase?.status || "").trim().toLowerCase() !== "paid") {
    return false;
  }

  const expiresAt = toDate(purchase?.accessExpiresAt);
  if (!expiresAt) {
    return true;
  }

  return expiresAt.getTime() > new Date(at).getTime();
};

const resolveSubscriptionLifecycle = (purchase = {}, { at = new Date() } = {}) => {
  const now = new Date(at);
  const status = String(purchase?.status || "").trim().toLowerCase();
  const expiresAt = toDate(purchase?.accessExpiresAt);
  const canceledAt = toDate(purchase?.canceledAt);
  const refundedAt = toDate(purchase?.refundedAt);
  const cancelAtPeriodEnd = Boolean(purchase?.cancelAtPeriodEnd);
  const hasActiveAccess = isSubscriptionAccessActive(purchase, { at: now });
  const msUntilExpiry = expiresAt ? expiresAt.getTime() - now.getTime() : Number.POSITIVE_INFINITY;
  const inGracePeriod =
    hasActiveAccess &&
    cancelAtPeriodEnd &&
    Number.isFinite(msUntilExpiry) &&
    msUntilExpiry <= SUBSCRIPTION_GRACE_PERIOD_MS;

  let lifecycleStatus = "not_subscribed";
  let label = "Not subscribed";

  if (status === "refunded") {
    lifecycleStatus = "refunded";
    label = "Refunded";
  } else if (status === "pending" || status === "abandoned" || status === "failed") {
    lifecycleStatus = status || "pending";
    label = status ? `${status[0].toUpperCase()}${status.slice(1)}` : "Pending";
  } else if (hasActiveAccess && inGracePeriod) {
    lifecycleStatus = "grace_period";
    label = "Grace period";
  } else if (hasActiveAccess && cancelAtPeriodEnd) {
    lifecycleStatus = "cancel_scheduled";
    label = "Ends at period end";
  } else if (hasActiveAccess) {
    lifecycleStatus = "active";
    label = "Active";
  } else if (status === "paid" && expiresAt && expiresAt.getTime() <= now.getTime()) {
    lifecycleStatus = "expired";
    label = "Expired";
  } else if (status === "paid") {
    lifecycleStatus = "active";
    label = "Active";
  }

  return {
    lifecycleStatus,
    label,
    hasActiveAccess,
    isSubscribed: hasActiveAccess,
    cancelAtPeriodEnd,
    inGracePeriod,
    canCancel: hasActiveAccess && !cancelAtPeriodEnd,
    canRenew: ["expired", "refunded"].includes(lifecycleStatus),
    expiresAt,
    canceledAt,
    refundedAt,
  };
};

const buildPurchaseLifecyclePayload = (purchase = {}, { at = new Date() } = {}) => {
  if (!isSubscriptionPurchase(purchase)) {
    const status = String(purchase?.status || "").trim().toLowerCase();
    return {
      lifecycleStatus: status || "pending",
      label: status ? `${status[0].toUpperCase()}${status.slice(1)}` : "Pending",
      isSubscribed: false,
      hasActiveAccess: status === "paid",
      cancelAtPeriodEnd: false,
      inGracePeriod: false,
      canCancel: false,
      canRenew: false,
      expiresAt: null,
      canceledAt: null,
      refundedAt: toDate(purchase?.refundedAt),
    };
  }

  const resolved = resolveSubscriptionLifecycle(purchase, { at });
  return {
    lifecycleStatus: resolved.lifecycleStatus,
    label: resolved.label,
    isSubscribed: resolved.isSubscribed,
    hasActiveAccess: resolved.hasActiveAccess,
    cancelAtPeriodEnd: resolved.cancelAtPeriodEnd,
    inGracePeriod: resolved.inGracePeriod,
    canCancel: resolved.canCancel,
    canRenew: resolved.canRenew,
    expiresAt: resolved.expiresAt,
    canceledAt: resolved.canceledAt,
    refundedAt: resolved.refundedAt,
  };
};

module.exports = {
  SUBSCRIPTION_GRACE_PERIOD_MS,
  buildPurchaseLifecyclePayload,
  isSubscriptionAccessActive,
  isSubscriptionPurchase,
  resolveSubscriptionLifecycle,
};
