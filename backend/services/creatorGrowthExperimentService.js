const AnalyticsEvent = require("../models/AnalyticsEvent");
const CreatorProfile = require("../models/CreatorProfile");
const { logAnalyticsEvent } = require("./analyticsService");

const GROWTH_EXPERIMENT_EVENT_TYPES = new Set([
  "shown",
  "acted_on",
  "dismissed",
]);

const CREATOR_GROWTH_EXPERIMENTS = Object.freeze([
  {
    key: "first_paid_product_launch",
    title: "Launch your first paid product",
    description: "Finish a paid release that fans can preview, understand, and unlock.",
    actionLabel: "Open publishing lanes",
    actionTo: "/creator/categories",
    source: "paid_product_launch",
  },
  {
    key: "subscription_packaging",
    title: "Package your fan pass",
    description: "Give supporters a clear monthly price, promise, and benefit set.",
    actionLabel: "Edit fan pass",
    actionTo: "/creator/settings",
    source: "subscription_packaging",
  },
  {
    key: "profile_trust_readiness",
    title: "Complete profile trust signals",
    description: "Strengthen identity, profile, payout, and catalog signals before promotion.",
    actionLabel: "Review creator profile",
    actionTo: "/creator/settings",
    source: "profile_trust",
  },
  {
    key: "catalog_freshness",
    title: "Refresh your catalog",
    description: "Keep the fan page current with a recent, complete release.",
    actionLabel: "Open catalog",
    actionTo: "/creator/categories",
    source: "catalog_freshness",
  },
  {
    key: "follower_announcement",
    title: "Draft a follower announcement",
    description: "Use a reviewable Akuso template to turn the strongest release into a fan update.",
    actionLabel: "Copy announcement prompt",
    actionTo: "/creator/fan-page-view",
    source: "follower_announcement",
    templateKey: "launch_announcement",
  },
]);

const EXPERIMENT_BY_KEY = new Map(
  CREATOR_GROWTH_EXPERIMENTS.map((experiment) => [experiment.key, experiment])
);

const toId = (value) => {
  if (!value) return "";
  if (value._id && value._id !== value) return toId(value._id);
  return String(value);
};

const toTimestamp = (value) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
};

const hasText = (value) => Boolean(String(value || "").trim());

const hasSubscriptionPackage = (profile = {}) =>
  Boolean(hasText(profile.subscriptionDescription)) ||
  (Array.isArray(profile.subscriptionBenefits) &&
    profile.subscriptionBenefits.some((benefit) => hasText(benefit)));

const getCreatorStage = ({ activation = {}, contentItems = [], recentSales = [], recentSubscribers = [] } = {}) => {
  if (Number(activation.progressPercent || 0) < 100) return "foundation";
  if (!contentItems.length || !contentItems.some((item) => Number(item.price || 0) > 0)) {
    return "monetization";
  }
  if (!recentSales.length) return "conversion";
  if (!recentSubscribers.length) return "retention";
  return "growth";
};

const buildEventSummary = (growthEvents = []) => {
  const byPrompt = new Map();
  for (const event of Array.isArray(growthEvents) ? growthEvents : []) {
    const key = String(event?.targetId || event?.promptKey || "").trim();
    const eventType = String(event?.contentType || event?.eventType || "").trim().toLowerCase();
    if (!EXPERIMENT_BY_KEY.has(key) || !GROWTH_EXPERIMENT_EVENT_TYPES.has(eventType)) continue;
    const bucket = byPrompt.get(key) || {
      shown: 0,
      actedOn: 0,
      dismissed: 0,
      lastShownAt: null,
      lastActedOnAt: null,
      lastDismissedAt: null,
    };
    if (eventType === "shown") {
      bucket.shown += 1;
      if (toTimestamp(event.createdAt) > toTimestamp(bucket.lastShownAt)) bucket.lastShownAt = event.createdAt;
    } else if (eventType === "acted_on") {
      bucket.actedOn += 1;
      if (toTimestamp(event.createdAt) > toTimestamp(bucket.lastActedOnAt)) bucket.lastActedOnAt = event.createdAt;
    } else if (eventType === "dismissed") {
      bucket.dismissed += 1;
      if (toTimestamp(event.createdAt) > toTimestamp(bucket.lastDismissedAt)) bucket.lastDismissedAt = event.createdAt;
    }
    byPrompt.set(key, bucket);
  }
  return byPrompt;
};

const buildChecklist = ({ key, activation = {}, followerCount = 0, payoutReadiness = {}, profile = {}, contentItems = [], recentSales = [], recentSubscribers = [], now = new Date() } = {}) => {
  const paidItems = contentItems.filter((item) => Number(item.price || 0) > 0);
  const itemsWithPreview = paidItems.filter((item) => {
    const raw = item.raw || {};
    return hasText(raw.previewUrl || raw.previewClipUrl || raw.previewExcerptText || raw.previewSampleUrl);
  });
  const latestContentAt = contentItems.reduce(
    (latest, item) => Math.max(latest, toTimestamp(item.updatedAt || item.createdAt)),
    0
  );
  const isFresh = latestContentAt > 0 && now.getTime() - latestContentAt <= 45 * 24 * 60 * 60 * 1000;

  const checklists = {
    first_paid_product_launch: [
      { key: "paid_item", label: "Create a paid catalog item", complete: paidItems.length > 0 },
      { key: "preview", label: "Add a fan-safe preview", complete: itemsWithPreview.length > 0 },
      { key: "first_sale", label: "Confirm the first paid sale", complete: recentSales.length > 0 },
    ],
    subscription_packaging: [
      { key: "benefits", label: "Describe monthly fan benefits", complete: hasSubscriptionPackage(profile) },
      { key: "price", label: "Set a subscription price", complete: Number(profile.subscriptionPrice || 0) > 0 },
      { key: "subscriber", label: "Confirm the first subscriber", complete: recentSubscribers.length > 0 },
    ],
    profile_trust_readiness: [
      { key: "activation", label: "Complete creator activation", complete: Number(activation.progressPercent || 0) >= 100 },
      { key: "bio", label: "Add a creator bio", complete: hasText(profile.bio) },
      { key: "payout", label: "Complete payout readiness", complete: payoutReadiness.ready === true },
    ],
    catalog_freshness: [
      { key: "catalog", label: "Publish at least one catalog item", complete: contentItems.length > 0 },
      { key: "fresh", label: "Update or publish within 45 days", complete: isFresh },
      { key: "complete", label: "Keep current items promotion-ready", complete: contentItems.length > 0 && contentItems.every((item) => hasText(item.title) && hasText(item.description)) },
    ],
    follower_announcement: [
      { key: "release", label: "Choose a release to promote", complete: contentItems.length > 0 },
      { key: "audience", label: "Build a follower audience", complete: Number(followerCount || 0) > 0 },
      { key: "draft", label: "Open a reviewable announcement draft", complete: false },
    ],
  };

  return checklists[key] || [];
};

const PRIORITY_BY_STAGE = {
  foundation: ["profile_trust_readiness", "first_paid_product_launch", "subscription_packaging", "catalog_freshness", "follower_announcement"],
  monetization: ["first_paid_product_launch", "subscription_packaging", "profile_trust_readiness", "catalog_freshness", "follower_announcement"],
  conversion: ["follower_announcement", "first_paid_product_launch", "catalog_freshness", "subscription_packaging", "profile_trust_readiness"],
  retention: ["subscription_packaging", "follower_announcement", "catalog_freshness", "profile_trust_readiness", "first_paid_product_launch"],
  growth: ["catalog_freshness", "follower_announcement", "subscription_packaging", "profile_trust_readiness", "first_paid_product_launch"],
};

const buildCreatorGrowthExperiments = ({
  activation = {},
  contentItems = [],
  followerCount = 0,
  growthEvents = [],
  payoutReadiness = {},
  profile = {},
  recentSales = [],
  recentSubscribers = [],
  now = new Date(),
} = {}) => {
  const stage = getCreatorStage({ activation, contentItems, recentSales, recentSubscribers });
  const eventSummary = buildEventSummary(growthEvents);
  const priorities = PRIORITY_BY_STAGE[stage] || PRIORITY_BY_STAGE.foundation;

  const experiments = priorities.map((key) => {
    const definition = EXPERIMENT_BY_KEY.get(key);
    const events = eventSummary.get(key) || {
      shown: 0,
      actedOn: 0,
      dismissed: 0,
      lastShownAt: null,
      lastActedOnAt: null,
      lastDismissedAt: null,
    };
    const checklist = buildChecklist({
      key,
      activation,
      followerCount,
      payoutReadiness,
      profile,
      contentItems,
      recentSales,
      recentSubscribers,
      now,
    });
    const completedSteps = checklist.filter((step) => step.complete).length;
    const completed = checklist.length > 0 && completedSteps === checklist.length;
    const dismissedAfterAction =
      toTimestamp(events.lastDismissedAt) > toTimestamp(events.lastActedOnAt);
    const actedOnAt = toTimestamp(events.lastActedOnAt);

    return {
      ...definition,
      stage,
      checklist,
      completedSteps,
      totalSteps: checklist.length,
      progressPercent: checklist.length ? Math.round((completedSteps / checklist.length) * 100) : 0,
      completed,
      status: completed ? "completed" : dismissedAfterAction ? "dismissed" : events.actedOn ? "active" : "ready",
      measurement: {
        shown: events.shown,
        actedOn: events.actedOn,
        dismissed: events.dismissed,
        publishCompleted: actedOnAt > 0 && contentItems.some((item) => toTimestamp(item.createdAt) > actedOnAt),
        purchaseLift: actedOnAt > 0
          ? recentSales.filter((sale) => toTimestamp(sale.paidAt) > actedOnAt).length
          : 0,
        subscriptionLift: actedOnAt > 0
          ? recentSubscribers.filter((subscriber) => toTimestamp(subscriber.paidAt) > actedOnAt).length
          : 0,
      },
    };
  });

  const visible = experiments.filter((experiment) => experiment.status !== "dismissed");
  return {
    stage,
    experiments: visible.slice(0, 4),
    dismissedCount: experiments.length - visible.length,
    summary: {
      shown: experiments.reduce((sum, item) => sum + Number(item.measurement.shown || 0), 0),
      actedOn: experiments.reduce((sum, item) => sum + Number(item.measurement.actedOn || 0), 0),
      dismissed: experiments.reduce((sum, item) => sum + Number(item.measurement.dismissed || 0), 0),
      completed: experiments.filter((item) => item.completed).length,
    },
  };
};

const listCreatorGrowthExperimentEvents = async ({ userId, lookbackDays = 120 } = {}) => {
  const cutoff = new Date(Date.now() - Math.max(30, Number(lookbackDays) || 120) * 24 * 60 * 60 * 1000);
  return AnalyticsEvent.find({
    userId,
    type: "creator_growth_prompt",
    targetType: "creator_growth_prompt",
    createdAt: { $gte: cutoff },
  })
    .select("targetId contentType createdAt metadata")
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
};

const recordCreatorGrowthExperimentEvent = async ({ userId, promptKey, eventType } = {}) => {
  const key = String(promptKey || "").trim();
  const normalizedEventType = String(eventType || "").trim().toLowerCase();
  if (!EXPERIMENT_BY_KEY.has(key)) {
    const error = new Error("Invalid creator growth prompt");
    error.status = 400;
    throw error;
  }
  if (!GROWTH_EXPERIMENT_EVENT_TYPES.has(normalizedEventType)) {
    const error = new Error("Invalid creator growth event type");
    error.status = 400;
    throw error;
  }

  const profile = await CreatorProfile.findOne({ userId }).select("_id").lean();
  if (!profile?._id) {
    const error = new Error("Creator profile not found");
    error.status = 404;
    throw error;
  }

  if (normalizedEventType === "shown") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const alreadyRecorded = await AnalyticsEvent.exists({
      userId,
      type: "creator_growth_prompt",
      targetType: "creator_growth_prompt",
      targetId: key,
      contentType: "shown",
      createdAt: { $gte: startOfDay },
    });
    if (alreadyRecorded) {
      return { accepted: true, deduplicated: true };
    }
  }

  const definition = EXPERIMENT_BY_KEY.get(key);
  const stored = await logAnalyticsEvent({
    type: "creator_growth_prompt",
    userId,
    actorRole: "creator",
    targetId: key,
    targetType: "creator_growth_prompt",
    contentType: normalizedEventType,
    metadata: {
      creatorId: toId(profile._id),
      promptKey: key,
      source: definition.source,
    },
  });

  return { accepted: Boolean(stored), deduplicated: false };
};

module.exports = {
  CREATOR_GROWTH_EXPERIMENTS,
  GROWTH_EXPERIMENT_EVENT_TYPES,
  buildCreatorGrowthExperiments,
  listCreatorGrowthExperimentEvents,
  recordCreatorGrowthExperimentEvent,
};
