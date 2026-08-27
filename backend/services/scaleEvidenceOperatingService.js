const mongoose = require("mongoose");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const User = require("../models/User");
const Purchase = require("../models/Purchase");
const Report = require("../models/Report");
const AdminComplaint = require("../models/AdminComplaint");
const CreatorPayoutRequest = require("../models/CreatorPayoutRequest");
const GrowthCalendarEntry = require("../models/GrowthCalendarEntry");
const ProductionSloPolicy = require("../models/ProductionSloPolicy");
const PartnerPilot = require("../models/PartnerPilot");
const ExpansionBet = require("../models/ExpansionBet");
const { buildDateRange, buildReliabilityHealth } = require("./analyticsService");
const { buildLaunchGrowthOperatingSystem } = require("./launchGrowthOperatingService");

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ROWS = 15000;
const STATUS_RANK = { healthy: 0, watch: 1, degraded: 2, incident: 3, blocked: 4 };

const ROADMAP_PACKAGES = Object.freeze([
  ["SCALE-031-02", "Four-week campaign and drop calendar"],
  ["SCALE-031-03", "Fan lifecycle retention interventions"],
  ["SCALE-031-04", "Privacy-safe partner reporting"],
  ["SCALE-031-05", "Akuso launch copilot"],
  ["SCALE-061-01", "Production SLOs and error budgets"],
  ["SCALE-061-02", "Performance, cost, and low-bandwidth controls"],
  ["SCALE-061-03", "Partner and sponsor pilots"],
  ["SCALE-061-04", "Governance and compliance readiness"],
  ["SCALE-061-05", "Ninety-day launch and scale report"],
  ["EXPANSION-001", "Expansion scorecard"],
].map(([key, title]) => ({ key, title, status: "COMPLETE" })));

const CALENDAR_TYPE_CATALOG = Object.freeze([
  { key: "featured_drop", title: "Featured Drop", owner: "Editorial and creator growth" },
  { key: "live_event", title: "Live Event", owner: "Live operations" },
  { key: "subscription_push", title: "Subscription Push", owner: "Lifecycle growth" },
  { key: "marketplace_spotlight", title: "Marketplace Spotlight", owner: "Marketplace growth" },
  { key: "fan_reminder", title: "Fan Reminder", owner: "Lifecycle growth" },
  { key: "editorial_collection", title: "Editorial Collection", owner: "Editorial" },
]);

const SLO_CATALOG = Object.freeze([
  { key: "checkout_initialization", title: "Checkout initialization", reliabilityKey: "payment_initialization", targetPercent: 99.5, windowDays: 28, owner: "Infrastructure and backend", runbookKey: "checkout_failure", userImpact: "Fans cannot start checkout.", rollbackPlan: "Disable the affected provider path and restore the last verified checkout configuration." },
  { key: "payment_verification", title: "Payment verification", reliabilityKey: "paystack_verification", targetPercent: 99.5, windowDays: 28, owner: "Payments", runbookKey: "paystack_verification", userImpact: "Paid fans may wait for confirmation.", rollbackPlan: "Pause acquisition, retry safe verification, and reconcile provider references." },
  { key: "entitlement_delivery", title: "Entitlement delivery", reliabilityKey: "entitlement_reconciliation", targetPercent: 99.9, windowDays: 28, owner: "Commerce platform", runbookKey: "entitlement_mismatch", userImpact: "A paid fan may not receive access.", rollbackPlan: "Stop affected offers and run entitlement reconciliation before resuming." },
  { key: "payout_completion", title: "Payout review and completion", reliabilityKey: "payout_blockers", targetPercent: 98, windowDays: 28, owner: "Finance operations", runbookKey: "payout_blocker", userImpact: "Creators receive earnings late.", rollbackPlan: "Pause automated batching and move affected requests to reviewed manual processing." },
  { key: "media_upload", title: "Media upload", reliabilityKey: "media_upload_failures", targetPercent: 99, windowDays: 28, owner: "Creator platform", runbookKey: "media_upload_failure", userImpact: "Creators cannot publish launch content.", rollbackPlan: "Disable the failing upload path and restore the last stable media configuration." },
  { key: "live_join", title: "Live create and join", reliabilityKey: "live_session_creation", targetPercent: 99, windowDays: 28, owner: "Live operations", runbookKey: "live_creation_failure", userImpact: "Creators cannot start or fans cannot join live sessions.", rollbackPlan: "Pause promoted live events and use the published fallback update path." },
  { key: "discovery_availability", title: "Discovery availability", reliabilityKey: "discovery_fallback_rate", targetPercent: 99.5, windowDays: 28, owner: "Discovery and analytics", runbookKey: "discovery_fallback_spike", userImpact: "Fans receive empty or generic discovery.", rollbackPlan: "Restore the last healthy ranking policy and keep a deterministic fallback active." },
  { key: "notification_delivery", title: "Notification delivery", reliabilityKey: "notification_delivery", targetPercent: 98, windowDays: 28, owner: "Lifecycle platform", runbookKey: "notification_delivery", userImpact: "Fans miss launches, renewals, or live reminders.", rollbackPlan: "Pause bulk sends, preserve consent, and switch to in-product reminders while delivery is repaired." },
  { key: "akuso_availability", title: "Akuso availability and eval quality", reliabilityKey: "akuso_latency_fallback", targetPercent: 99, windowDays: 28, owner: "Assistant platform", runbookKey: "akuso_eval_regression", userImpact: "Users receive slow, unavailable, or unsafe launch guidance.", rollbackPlan: "Route to reviewed deterministic help and disable affected model-backed launch capabilities." },
]);

const AKUSO_LAUNCH_CAPABILITIES = Object.freeze([
  { key: "creator_launch_checklist", title: "Creator launch checklist", contentType: "creator_checklist", reviewRequired: true },
  { key: "campaign_copy", title: "Campaign copy drafts", contentType: "campaign_copy", reviewRequired: true },
  { key: "fan_support_navigation", title: "Fan support navigation", contentType: "support_navigation", reviewRequired: false },
  { key: "payout_explanation", title: "Payout explanations", contentType: "payout_explanation", reviewRequired: true },
  { key: "renewal_help", title: "Renewal help", contentType: "renewal_help", reviewRequired: false },
  { key: "incident_summary", title: "Incident summaries", contentType: "incident_summary", reviewRequired: true },
]);

const PERFORMANCE_SURFACES = Object.freeze([
  { key: "creator_profile", lowBandwidthBehavior: "Load metadata and compressed artwork before optional media." },
  { key: "audio_preview", lowBandwidthBehavior: "Preload metadata only and require an explicit play action." },
  { key: "book_preview", lowBandwidthBehavior: "Render text and cover first; defer document preview pages." },
  { key: "saved_and_continue", lowBandwidthBehavior: "Keep compact pagination and resumable positions." },
  { key: "admin_operations", lowBandwidthBehavior: "Prefer aggregate JSON, bounded rows, and manual refresh." },
  { key: "akuso", lowBandwidthBehavior: "Use deterministic help and the fast model unless heavier reasoning is necessary." },
]);

const GOVERNANCE_CATALOG = Object.freeze([
  ["payments_payouts", "Payments and payout reconciliation", "Finance operations"],
  ["refunds_disputes", "Refund and dispute handling", "Finance and support"],
  ["rights_takedown", "Rights, claims, and takedown", "Trust and safety"],
  ["verification_impersonation", "Verification and impersonation", "Trust and safety"],
  ["privacy_retention", "Privacy and retention", "Privacy and engineering"],
  ["notification_consent", "Notification consent and frequency", "Lifecycle platform"],
  ["recommendation_complaints", "Recommendation complaint review", "Discovery and trust"],
  ["akuso_safety", "Akuso safety, evals, and memory", "Assistant platform"],
]);

const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));
const toId = (value) => String(value?._id || value || "");
const toDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const normalizeKey = (value = "") => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 100);
const inWindow = (value, start, end) => {
  const date = toDate(value);
  return Boolean(date && date >= start && date <= end);
};
const buildHttpError = (message, status = 400, details = undefined) => Object.assign(new Error(message), { status, details });
const assertObjectId = (value, label = "Id") => {
  if (!mongoose.Types.ObjectId.isValid(String(value || ""))) throw buildHttpError(`${label} is invalid`, 400);
};

const eventMatchesKey = (event = {}, key = "") => {
  const values = [event?.metadata?.campaignKey, event?.metadata?.reportingKey, event?.metadata?.ledgerTrackingKey]
    .map(normalizeKey)
    .filter(Boolean);
  return values.includes(normalizeKey(key));
};

const countEventTypes = (events = [], types = []) => events.reduce(
  (total, event) => total + (types.includes(String(event.type || "")) ? 1 : 0),
  0
);

const calendarReadinessChecks = (row = {}) => [
  { key: "owner", complete: Boolean(row.ownerName && row.ownerRole) },
  { key: "window", complete: Boolean(toDate(row.scheduledStartAt) && toDate(row.scheduledEndAt) && toDate(row.scheduledEndAt) > toDate(row.scheduledStartAt)) },
  { key: "audience", complete: Boolean(row.audience) },
  { key: "objective", complete: Boolean(row.objective) },
  { key: "cta", complete: Boolean(row.callToAction) },
  { key: "reporting", complete: Boolean(row.reportingKey) },
  { key: "scope", complete: Boolean((row.creatorIds || []).length || (row.contentIds || []).length) },
];

const serializeCalendarEntry = (row = {}, { events = [], purchases = [], now = new Date() } = {}) => {
  const start = toDate(row.scheduledStartAt) || now;
  const end = toDate(row.scheduledEndAt) || now;
  const duration = Math.max(DAY_MS, end.getTime() - start.getTime());
  const baselineStart = new Date(start.getTime() - duration);
  const keyEvents = events.filter((event) => eventMatchesKey(event, row.reportingKey || row.entryKey));
  const currentEvents = keyEvents.filter((event) => inWindow(event.createdAt, start, end));
  const creatorIds = new Set((row.creatorIds || []).map(toId));
  const scopedPurchases = purchases.filter((purchase) => creatorIds.has(toId(purchase.creatorId)));
  const currentPurchases = scopedPurchases.filter((purchase) => inWindow(purchase.paidAt || purchase.createdAt, start, end));
  const baselinePurchases = scopedPurchases.filter((purchase) => inWindow(purchase.paidAt || purchase.createdAt, baselineStart, new Date(start.getTime() - 1)));
  const paid = currentPurchases.filter((purchase) => purchase.status === "paid");
  const refunds = currentPurchases.filter((purchase) => purchase.status === "refunded");
  const earnings = paid.reduce((sum, purchase) => sum + Number(purchase.amount || 0) * Number(purchase.creatorShareRate || 0), 0);
  const checks = calendarReadinessChecks(row);
  const metrics = {
    impressions: countEventTypes(currentEvents, ["campaign_impression", "content_impression", "recommendation_impression"]),
    clicks: countEventTypes(currentEvents, ["campaign_clicked", "content_clicked", "recommendation_clicked"]),
    previews: countEventTypes(currentEvents, ["stream_started", "track_stream_started", "book_preview_started", "preview_started"]),
    purchases: paid.filter((purchase) => purchase.itemType !== "subscription").length,
    subscriptions: paid.filter((purchase) => purchase.itemType === "subscription").length,
    refunds: refunds.length,
    creatorEarnings: round(earnings),
    supportContacts: countEventTypes(currentEvents, ["support_contact_created", "support_escalated"]),
    hides: countEventTypes(currentEvents, ["campaign_hidden", "recommendation_hidden"]),
    reports: countEventTypes(currentEvents, ["campaign_reported", "content_reported"]),
  };
  const currentGross = round(paid.reduce((sum, purchase) => sum + Number(purchase.amount || 0), 0));
  const baselinePaid = baselinePurchases.filter((purchase) => purchase.status === "paid");
  const baselineGross = round(baselinePaid.reduce((sum, purchase) => sum + Number(purchase.amount || 0), 0));
  return {
    id: toId(row),
    title: row.title || "",
    entryKey: row.entryKey || "",
    type: row.type || "",
    status: row.status || "planned",
    campaignId: toId(row.campaign),
    scheduledStartAt: row.scheduledStartAt || null,
    scheduledEndAt: row.scheduledEndAt || null,
    ownerName: row.ownerName || "",
    ownerRole: row.ownerRole || "",
    audience: row.audience || "",
    objective: row.objective || "",
    callToAction: row.callToAction || "",
    reportingKey: row.reportingKey || "",
    reminderPlan: row.reminderPlan || "",
    creatorCount: creatorIds.size,
    contentCount: (row.contentIds || []).length,
    readinessState: checks.every((check) => check.complete) ? "ready" : "blocked",
    blockers: checks.filter((check) => !check.complete).map((check) => check.key),
    metrics,
    baselineComparison: {
      attributionMode: "eligible_creator_window",
      currentGross,
      baselineGross,
      grossChangePercent: baselineGross > 0 ? round(((currentGross - baselineGross) / baselineGross) * 100) : null,
      currentPurchases: paid.length,
      baselinePurchases: baselinePaid.length,
    },
    earningsNote: "Creator earnings include purchases with a stored creator-share rate; no missing rate is inferred.",
  };
};

const buildCampaignCalendar = ({ rows = [], events = [], purchases = [], now = new Date() } = {}) => {
  const entries = rows.map((row) => serializeCalendarEntry(row, { events, purchases, now }));
  const fourWeekEnd = new Date(now.getTime() + 28 * DAY_MS);
  const nextFourWeeks = entries.filter((entry) => {
    const start = toDate(entry.scheduledStartAt);
    return start && start >= now && start <= fourWeekEnd && entry.status !== "cancelled";
  });
  const scheduledTypes = new Set(nextFourWeeks.map((entry) => entry.type));
  return {
    summary: {
      total: entries.length,
      nextFourWeeks: nextFourWeeks.length,
      ready: nextFourWeeks.filter((entry) => entry.readinessState === "ready").length,
      active: entries.filter((entry) => entry.status === "live").length,
      coveragePercent: round((scheduledTypes.size / CALENDAR_TYPE_CATALOG.length) * 100),
    },
    typeCatalog: CALENDAR_TYPE_CATALOG,
    missingFourWeekTypes: CALENDAR_TYPE_CATALOG.filter((type) => !scheduledTypes.has(type.key)),
    entries,
  };
};

const buildFanRetentionInterventions = ({ users = [], events = [], purchases = [], now = new Date() } = {}) => {
  const eventsByUser = new Map();
  const purchasesByUser = new Map();
  events.forEach((event) => {
    const key = toId(event.userId);
    if (!key) return;
    if (!eventsByUser.has(key)) eventsByUser.set(key, []);
    eventsByUser.get(key).push(event);
  });
  purchases.forEach((purchase) => {
    const key = toId(purchase.userId);
    if (!key) return;
    if (!purchasesByUser.has(key)) purchasesByUser.set(key, []);
    purchasesByUser.get(key).push(purchase);
  });
  const interventions = [];
  users.forEach((user) => {
    const userId = toId(user);
    const userEvents = eventsByUser.get(userId) || [];
    const userPurchases = purchasesByUser.get(userId) || [];
    const types = new Set(userEvents.map((event) => event.type));
    const paid = userPurchases.filter((purchase) => purchase.status === "paid");
    const subscriptionRisk = userPurchases.some((purchase) => purchase.itemType === "subscription" && (purchase.status === "failed" || purchase.cancelAtPeriodEnd || (toDate(purchase.accessExpiresAt) && toDate(purchase.accessExpiresAt) <= new Date(now.getTime() + 7 * DAY_MS))));
    let key = "";
    let action = "";
    if (subscriptionRisk) [key, action] = ["renewal_risk", "Show renewal status, payment-update help, and cancellation controls."];
    else if (types.has("live_reminder_set") && !types.has("live_session_joined")) [key, action] = ["reminder_no_join", "Use one relationship-aware reminder and show the live fallback update."];
    else if (types.has("content_saved") && !types.has("continue_progress_saved")) [key, action] = ["saved_not_resumed", "Surface the saved item in Continue with freshness context."];
    else if ((types.has("stream_started") || types.has("track_stream_started") || types.has("preview_started")) && !paid.length) [key, action] = ["preview_no_purchase", "Return to the preview with price, entitlement, and refund clarity."];
    else if (paid.length === 1) [key, action] = ["purchase_no_repeat", "Show a low-frequency related creator or catalog return path."];
    else if (types.has("creator_followed") && !types.has("session_returned")) [key, action] = ["follow_no_return", "Prioritize a fresh followed-creator update over generic discovery."];
    else if (!types.has("creator_followed")) [key, action] = ["no_first_follow", "Offer one relevant creator follow after a meaningful browse or preview."];
    if (!key) return;
    const recentSends = userEvents.filter((event) => /notification_sent$/.test(event.type) && toDate(event.createdAt) >= new Date(now.getTime() - DAY_MS)).length;
    const complaint = userEvents.some((event) => ["notification_reported", "notification_complaint"].includes(event.type));
    let suppressionReason = "";
    if (user.notificationPrefs?.system === false) suppressionReason = "system_notifications_disabled";
    else if (complaint) suppressionReason = "notification_complaint_open";
    else if (recentSends >= 2) suppressionReason = "frequency_cap_reached";
    interventions.push({
      userId,
      key,
      action,
      deliveryState: suppressionReason ? "suppressed" : "eligible",
      suppressionReason,
      policyDimensions: {
        lifecycle: key,
        relationship: types.has("creator_followed") ? "followed_creator" : paid.length ? "paid_creator" : "unestablished",
        freshness: user.lastLogin && toDate(user.lastLogin) >= new Date(now.getTime() - 7 * DAY_MS) ? "recent" : "stale",
        engagement: userEvents.length >= 5 ? "high" : userEvents.length ? "light" : "none",
        consent: user.notificationPrefs?.system === false ? "opted_out" : "eligible",
        complaint: complaint ? "open" : "none",
      },
    });
  });
  const byType = interventions.reduce((counts, row) => {
    counts[row.key] = Number(counts[row.key] || 0) + 1;
    return counts;
  }, {});
  return {
    summary: {
      candidates: interventions.length,
      eligible: interventions.filter((row) => row.deliveryState === "eligible").length,
      suppressed: interventions.filter((row) => row.deliveryState === "suppressed").length,
    },
    byType,
    policy: {
      maximumLifecycleNotificationsPerDay: 2,
      suppressionReasonsVisible: true,
      requiredDimensions: ["lifecycle", "relationship", "freshness", "engagement", "consent", "complaint"],
    },
    interventions: interventions.slice(0, 500),
  };
};

const buildPartnerReporting = ({ launch = {}, calendar = {}, purchases = [], payouts = [], reports = [], complaints = [] } = {}) => {
  const paid = purchases.filter((purchase) => purchase.status === "paid");
  const refunded = purchases.filter((purchase) => purchase.status === "refunded");
  const gross = round(paid.reduce((sum, purchase) => sum + Number(purchase.amount || 0), 0));
  const creatorEarnings = round(paid.reduce((sum, purchase) => sum + Number(purchase.amount || 0) * Number(purchase.creatorShareRate || 0), 0));
  const completedPayouts = payouts.filter((payout) => payout.status === "paid");
  const payoutHours = completedPayouts.map((payout) => {
    const start = toDate(payout.requestedAt || payout.createdAt);
    const end = toDate(payout.paidAt);
    return start && end ? Math.max(0, (end - start) / (60 * 60 * 1000)) : null;
  }).filter((value) => value !== null);
  return {
    schemaVersion: "partner-report-v1",
    audiencePackages: ["labels", "publishers", "communities", "venues", "brands"],
    privacyBoundary: {
      aggregationOnly: true,
      excludedFields: ["user identity", "email or phone", "payment credentials", "provider references", "private content", "safety case details", "Akuso memory"],
      minimumCohortSize: 10,
    },
    creatorCohort: launch.creatorLifecycle?.summary || {},
    campaignImpact: {
      scheduled: calendar.summary?.total || 0,
      active: calendar.summary?.active || 0,
      aggregateMetrics: calendar.entries?.reduce((acc, entry) => {
        Object.entries(entry.metrics || {}).forEach(([key, value]) => { acc[key] = round(Number(acc[key] || 0) + Number(value || 0)); });
        return acc;
      }, {}) || {},
    },
    livePerformance: launch.launchCommandCenter?.launchMetrics?.live || {},
    subscriptionChurn: launch.fanLifecycle?.subscriptionDiagnostics || {},
    fanRetentionBySource: launch.firstWeekActivation?.bySource || [],
    commerce: { grossMerchandiseValue: gross, creatorEarnings, refundCount: refunded.length, paidOrders: paid.length },
    payoutTimeliness: { completed: completedPayouts.length, averageCompletionHours: payoutHours.length ? round(payoutHours.reduce((sum, value) => sum + value, 0) / payoutHours.length) : null },
    supportAndModeration: { reports: reports.length, supportContacts: complaints.length },
  };
};

const buildNotificationSnapshot = (events = []) => {
  const delivered = countEventTypes(events, ["notification_delivered"]);
  const failed = countEventTypes(events, ["notification_delivery_failed"]);
  const sent = events.filter((event) => /notification_sent$/.test(event.type)).length;
  const instrumented = delivered + failed > 0;
  const total = delivered + failed;
  const failureRate = total > 0 ? failed / total : null;
  return {
    key: "notification_delivery",
    status: !instrumented ? "watch" : failureRate > 0.1 ? "incident" : failureRate > 0.02 ? "degraded" : failureRate > 0.005 ? "watch" : "healthy",
    metric: { label: "Delivery failures", value: failed, total, rate: failureRate },
    details: { sent, delivered, failed, instrumentationComplete: instrumented },
    owner: "Lifecycle platform",
    nextAction: instrumented ? "Review failed deliveries and consent-safe retry behavior." : "Instrument provider delivery and failure callbacks before claiming this SLO is healthy.",
  };
};

const buildSloBudgets = ({ reliability = {}, policyRows = [], events = [] } = {}) => {
  const policyByKey = new Map(policyRows.map((row) => [row.key, row]));
  const reliabilityRows = [...(reliability.snapshots || []), buildNotificationSnapshot(events)];
  const reliabilityByKey = new Map(reliabilityRows.map((row) => [row.key, row]));
  const policies = SLO_CATALOG.map((definition) => {
    const override = policyByKey.get(definition.key) || {};
    const targetPercent = Number(override.targetPercent ?? definition.targetPercent);
    const windowDays = Number(override.windowDays ?? definition.windowDays);
    const calculatedBudgetMinutes = round(windowDays * 24 * 60 * (1 - targetPercent / 100));
    const budgetMinutes = Number(override.errorBudgetMinutes ?? calculatedBudgetMinutes);
    const snapshot = reliabilityByKey.get(definition.reliabilityKey) || { status: "watch", metric: {} };
    const rate = Number(snapshot.metric?.rate);
    const observedFailureMinutes = Number.isFinite(rate) ? round(rate * windowDays * 24 * 60) : 0;
    const consumedPercent = budgetMinutes > 0 ? round((observedFailureMinutes / budgetMinutes) * 100) : 0;
    const state = snapshot.status || "watch";
    const expansionBlocked = state === "blocked" || consumedPercent >= Number(override.expansionBlockAtPercentConsumed || 100) || snapshot.details?.instrumentationComplete === false;
    return {
      key: definition.key,
      title: override.title || definition.title,
      targetPercent,
      windowDays,
      errorBudgetMinutes: budgetMinutes,
      observedFailureMinutes,
      consumedPercent,
      state,
      owner: override.owner || definition.owner,
      runbookKey: override.runbookKey || definition.runbookKey,
      userImpact: override.userImpact || definition.userImpact,
      rollbackPlan: override.rollbackPlan || definition.rollbackPlan,
      ticketUrl: override.ticketUrl || "",
      enabled: override.enabled !== false,
      expansionBlocked,
      evidence: snapshot.metric || {},
    };
  });
  return {
    summary: {
      total: policies.length,
      exhausted: policies.filter((row) => row.consumedPercent >= 100).length,
      blocked: policies.filter((row) => row.expansionBlocked).length,
      expansionPaused: policies.some((row) => row.expansionBlocked),
    },
    states: ["watch", "degraded", "incident", "blocked"],
    policies,
  };
};

const buildPerformanceCost = ({ events = [] } = {}) => {
  const timed = events.filter((event) => Number.isFinite(Number(event?.metadata?.durationMs)));
  const payloads = events.filter((event) => Number.isFinite(Number(event?.metadata?.payloadBytes)));
  const akuso = timed.filter((event) => String(event.type || "").startsWith("akuso_"));
  const average = (rows, field) => rows.length ? round(rows.reduce((sum, row) => sum + Number(row.metadata?.[field] || 0), 0) / rows.length) : null;
  return {
    summary: {
      timedRequests: timed.length,
      averageRouteLatencyMs: average(timed, "durationMs"),
      averagePayloadBytes: average(payloads, "payloadBytes"),
      akusoAverageLatencyMs: average(akuso, "durationMs"),
      akusoModelCalls: countEventTypes(events, ["akuso_response"]),
      notificationSends: events.filter((event) => /notification_sent$/.test(event.type)).length,
    },
    measurementContract: ["route latency", "database hot spots", "media processing", "payload size", "live reliability", "Akuso cost and latency", "notification delivery cost"],
    instrumentationGaps: [
      timed.length ? null : "route_latency",
      payloads.length ? null : "payload_bytes",
      events.some((event) => Number.isFinite(Number(event?.metadata?.estimatedCostUsd))) ? null : "akuso_cost",
    ].filter(Boolean),
    lowBandwidth: {
      automaticSignals: ["Save-Data", "2g or slow-2g effective connection", "manual local preference"],
      surfaces: PERFORMANCE_SURFACES,
      heavyAkusoRule: "Use model-backed generation only when policy and task complexity require it; deterministic guidance remains the fallback.",
    },
  };
};

const serializePilot = (row = {}) => ({
  id: toId(row), name: row.name || "", pilotKey: row.pilotKey || "", type: row.type || "", status: row.status || "draft",
  sponsored: Boolean(row.sponsored), disclosureLabel: row.disclosureLabel || "", ownerName: row.ownerName || "", ownerRole: row.ownerRole || "",
  creatorScope: row.creatorScope || "", fanScope: row.fanScope || "", geography: row.geography || "", offer: row.offer || "",
  reportingPackage: row.reportingPackage || "", rightsAndModerationPlan: row.rightsAndModerationPlan || "", financePlan: row.financePlan || "",
  exitCriteria: row.exitCriteria || "", startAt: row.startAt || null, reviewAt: row.reviewAt || null,
  readinessState: row.sponsored && !row.disclosureLabel ? "blocked" : "ready",
});

const buildGovernanceReadiness = ({ sloBudgets = {}, launch = {}, partnerPilots = [] } = {}) => {
  const criticalReliability = Number(sloBudgets.summary?.blocked || 0);
  const supportQueues = launch.supportTrust?.queues || [];
  return {
    legalBoundary: "Operational evidence only. Legal sufficiency and jurisdiction-specific advice remain with qualified counsel.",
    manualOverrideRule: "Every manual override requires a named actor, reason, prior state, next review, and audit log.",
    checklists: GOVERNANCE_CATALOG.map(([key, title, owner]) => {
      let state = "ready";
      if (["payments_payouts", "privacy_retention", "notification_consent", "akuso_safety"].includes(key) && criticalReliability) state = "review";
      if (key === "rights_takedown" && supportQueues.some((queue) => Number(queue.overdue || 0) > 0)) state = "review";
      if (key === "rights_takedown" && partnerPilots.some((pilot) => pilot.status === "active" && !pilot.rightsAndModerationPlan)) state = "blocked";
      return { key, title, owner, state, evidenceRequired: true, counselRequired: ["privacy_retention", "rights_takedown", "refunds_disputes"].includes(key) };
    }),
  };
};

const serializeExpansionBet = (row = {}, expansionPaused = false) => {
  const scoreValues = ExpansionBet.SCORE_INPUT_KEYS.map((key) => Number(row.scores?.[key] || 0));
  const averageScore = round(scoreValues.reduce((sum, value) => sum + value, 0) / Math.max(1, scoreValues.length));
  const recommendedState = expansionPaused ? "hold" : averageScore >= 4 ? "expand" : averageScore >= 3 ? "controlled_launch" : averageScore >= 2 ? "seed" : "research";
  return {
    id: toId(row), name: row.name || "", betKey: row.betKey || "", marketOrSegment: row.marketOrSegment || "", state: row.state || "research",
    ownerName: row.ownerName || "", ownerRole: row.ownerRole || "", cohortDefinition: row.cohortDefinition || "", gate: row.gate || "",
    costCap: Number(row.costCap || 0), currency: row.currency || "NGN", successMetric: row.successMetric || "", stopCondition: row.stopCondition || "",
    reviewAt: row.reviewAt || null, scores: row.scores || {}, averageScore, recommendedState,
    transitionBlocked: expansionPaused && ["controlled_launch", "expand"].includes(row.state),
  };
};

const buildScaleReport = ({ launch = {}, calendar = {}, retention = {}, partner = {}, sloBudgets = {}, performance = {}, pilots = [], governance = {} } = {}) => {
  const governanceReviews = (governance.checklists || []).filter((row) => row.state !== "ready").length;
  let decision = "expand";
  let rationale = "Core launch evidence is inside guardrails; expansion bets may proceed through their own gates.";
  if (sloBudgets.summary?.expansionPaused) [decision, rationale] = ["invest_in_reliability_and_support", "At least one SLO budget or instrumentation gate pauses expansion."];
  else if (Number(retention.summary?.eligible || 0) > Number(launch.fanLifecycle?.summary?.returningFans || 0)) [decision, rationale] = ["invest_in_fan_retention", "Eligible lifecycle interventions exceed observed return evidence."];
  else if (!Number(launch.creatorLifecycle?.summary?.launchReady || 0)) [decision, rationale] = ["recruit_another_creator_cohort", "Creator launch-ready supply is below the next cohort gate."];
  else if (!pilots.some((pilot) => ["ready", "active"].includes(pilot.status))) [decision, rationale] = ["invest_in_partner_pilots", "No partner pilot has reached a ready or active state."];
  return {
    reportingWindow: "rolling_90_day_evidence_pack",
    sections: {
      launched: { roadmapPackages: ROADMAP_PACKAGES.length, campaigns: calendar.summary?.total || 0 },
      creatorCohort: launch.creatorLifecycle?.summary || {},
      earningsAndCommerce: partner.commerce || {},
      subscriptionsAndRetention: { subscriptions: launch.fanLifecycle?.subscriptionDiagnostics || {}, retention: retention.summary || {} },
      campaigns: calendar.summary || {},
      partners: { total: pilots.length, active: pilots.filter((pilot) => pilot.status === "active").length },
      reliabilityAndIncidents: sloBudgets.summary || {},
      supportAndModeration: partner.supportAndModeration || {},
      akuso: { capabilities: AKUSO_LAUNCH_CAPABILITIES.length, reliability: sloBudgets.policies?.find((row) => row.key === "akuso_availability") || {} },
      risks: { governanceReviews, instrumentationGaps: performance.instrumentationGaps || [] },
      investments: [decision],
    },
    decision: { key: decision, rationale, choices: ["expand", "recruit_another_creator_cohort", "invest_in_reliability_and_support", "invest_in_creator_supply", "invest_in_fan_retention", "invest_in_partner_pilots"] },
  };
};

const buildScaleEvidenceOperatingView = ({ launch = {}, reliability = {}, calendarRows = [], sloRows = [], pilotRows = [], betRows = [], events = [], users = [], purchases = [], payouts = [], reports = [], complaints = [], now = new Date() } = {}) => {
  const campaignCalendar = buildCampaignCalendar({ rows: calendarRows, events, purchases, now });
  const fanRetention = buildFanRetentionInterventions({ users, events, purchases, now });
  const partnerReporting = buildPartnerReporting({ launch, calendar: campaignCalendar, purchases, payouts, reports, complaints });
  const sloBudgets = buildSloBudgets({ reliability, policyRows: sloRows, events });
  const performanceCost = buildPerformanceCost({ events });
  const partnerPilots = pilotRows.map(serializePilot);
  const governance = buildGovernanceReadiness({ sloBudgets, launch, partnerPilots });
  const expansionScorecard = {
    states: ExpansionBet.EXPANSION_STATES,
    scoreInputs: ExpansionBet.SCORE_INPUT_KEYS,
    expansionPaused: Boolean(sloBudgets.summary.expansionPaused),
    bets: betRows.map((row) => serializeExpansionBet(row, sloBudgets.summary.expansionPaused)),
  };
  const scaleReport = buildScaleReport({ launch, calendar: campaignCalendar, retention: fanRetention, partner: partnerReporting, sloBudgets, performance: performanceCost, pilots: partnerPilots, governance });
  return {
    generatedAt: now,
    summary: {
      roadmapPackagesComplete: ROADMAP_PACKAGES.length,
      calendarCoveragePercent: campaignCalendar.summary.coveragePercent,
      retentionCandidates: fanRetention.summary.candidates,
      sloExpansionPaused: sloBudgets.summary.expansionPaused,
      activePilots: partnerPilots.filter((pilot) => pilot.status === "active").length,
      expansionBets: expansionScorecard.bets.length,
      decision: scaleReport.decision.key,
    },
    roadmapPackages: ROADMAP_PACKAGES,
    campaignCalendar,
    fanRetention,
    partnerReporting,
    akusoLaunchCopilot: { capabilities: AKUSO_LAUNCH_CAPABILITIES, reviewRule: "Generated campaign, finance, checklist, and incident copy remains a draft until an authorized human publishes it.", evalSuites: ["launch_campaign", "creator_cohort", "support_escalation", "unsafe_finance_refusal", "privacy_boundary"] },
    sloBudgets,
    performanceCost,
    partnerPilots: { types: PartnerPilot.PARTNER_PILOT_TYPES, pilots: partnerPilots },
    governance,
    scaleReport,
    expansionScorecard,
  };
};

const buildScaleEvidenceOperatingSystem = async (filters = {}) => {
  const dates = buildDateRange(filters);
  const historyStart = new Date(dates.start.getTime() - Math.max(DAY_MS, dates.end - dates.start));
  const [launch, reliability, calendarRows, sloRows, pilotRows, betRows, events, users, purchases, payouts, reports, complaints] = await Promise.all([
    buildLaunchGrowthOperatingSystem(filters),
    buildReliabilityHealth(filters),
    GrowthCalendarEntry.find({ scheduledEndAt: { $gte: historyStart }, scheduledStartAt: { $lte: new Date(dates.end.getTime() + 28 * DAY_MS) } }).sort({ scheduledStartAt: 1 }).lean(),
    ProductionSloPolicy.find({}).sort({ key: 1 }).lean(),
    PartnerPilot.find({}).sort({ reviewAt: 1 }).limit(500).lean(),
    ExpansionBet.find({}).sort({ reviewAt: 1 }).limit(500).lean(),
    AnalyticsEvent.find({ createdAt: { $gte: historyStart, $lte: dates.end } }).select("type userId targetId targetType contentType metadata createdAt").sort({ createdAt: -1 }).limit(MAX_ROWS).lean(),
    User.find({ createdAt: { $lte: dates.end } }).select("_id createdAt lastLogin notificationPrefs").limit(MAX_ROWS).lean(),
    Purchase.find({ createdAt: { $gte: historyStart, $lte: dates.end } }).select("userId creatorId itemType amount creatorShareRate status paidAt accessExpiresAt cancelAtPeriodEnd canceledAt createdAt").limit(MAX_ROWS).lean(),
    CreatorPayoutRequest.find({ requestedAt: { $gte: dates.start, $lte: dates.end } }).select("status amount requestedAt reviewedAt paidAt createdAt").limit(MAX_ROWS).lean(),
    Report.find({ createdAt: { $gte: dates.start, $lte: dates.end } }).select("status createdAt").limit(MAX_ROWS).lean(),
    AdminComplaint.find({ createdAt: { $gte: dates.start, $lte: dates.end } }).select("status createdAt").limit(MAX_ROWS).lean(),
  ]);
  return {
    filters: { range: dates.range, startDate: dates.start, endDate: dates.end },
    ...buildScaleEvidenceOperatingView({ launch, reliability, calendarRows, sloRows, pilotRows, betRows, events, users, purchases, payouts, reports, complaints }),
  };
};

const createCalendarEntry = async ({ payload = {}, adminUserId } = {}) => {
  const type = String(payload.type || "").trim().toLowerCase();
  if (!GrowthCalendarEntry.GROWTH_CALENDAR_TYPES.includes(type)) throw buildHttpError("Calendar entry type is invalid", 400);
  const title = String(payload.title || "").trim();
  const entryKey = normalizeKey(payload.entryKey || title);
  if (!title || !entryKey) throw buildHttpError("Calendar title and key are required", 400);
  const row = new GrowthCalendarEntry({
    title, entryKey, type, status: "planned", campaign: payload.campaign || null,
    scheduledStartAt: payload.scheduledStartAt, scheduledEndAt: payload.scheduledEndAt,
    ownerName: String(payload.ownerName || "").trim(), ownerRole: String(payload.ownerRole || "Product and growth").trim(),
    audience: String(payload.audience || "").trim(), objective: String(payload.objective || "").trim(), callToAction: String(payload.callToAction || "").trim(),
    reportingKey: normalizeKey(payload.reportingKey || entryKey), creatorIds: Array.isArray(payload.creatorIds) ? payload.creatorIds : [], contentIds: Array.isArray(payload.contentIds) ? payload.contentIds : [],
    reminderPlan: String(payload.reminderPlan || "").trim(), baselineWindowDays: Number(payload.baselineWindowDays || 28),
    createdBy: adminUserId, lastChangedBy: adminUserId, statusHistory: [{ status: "planned", actorId: adminUserId, reason: "Calendar entry created" }],
  });
  await row.save();
  return serializeCalendarEntry(row.toObject());
};

const updateCalendarEntry = async ({ entryId, updates = {}, adminUserId } = {}) => {
  assertObjectId(entryId, "Calendar entry id");
  const row = await GrowthCalendarEntry.findById(entryId);
  if (!row) throw buildHttpError("Calendar entry not found", 404);
  const nextStatus = String(updates.status || row.status).trim().toLowerCase();
  if (!GrowthCalendarEntry.GROWTH_CALENDAR_STATUSES.includes(nextStatus)) throw buildHttpError("Calendar status is invalid", 400);
  const transitions = { planned: ["planned", "ready", "cancelled"], ready: ["ready", "planned", "live", "cancelled"], live: ["live", "completed", "cancelled"], completed: ["completed"], cancelled: ["cancelled"] };
  if (!transitions[row.status].includes(nextStatus)) throw buildHttpError(`Calendar entry cannot move from ${row.status} to ${nextStatus}`, 409);
  ["title", "campaign", "scheduledStartAt", "scheduledEndAt", "ownerName", "ownerRole", "audience", "objective", "callToAction", "creatorIds", "contentIds", "reminderPlan", "baselineWindowDays"].forEach((field) => { if (updates[field] !== undefined) row[field] = updates[field]; });
  if (updates.reportingKey !== undefined) row.reportingKey = normalizeKey(updates.reportingKey);
  if (["ready", "live"].includes(nextStatus)) {
    const blockers = calendarReadinessChecks(row).filter((check) => !check.complete).map((check) => check.key);
    if (blockers.length) throw buildHttpError("Calendar entry is not ready", 409, { blockers });
  }
  if (nextStatus !== row.status) {
    const reason = String(updates.reason || "").trim();
    if (!reason) throw buildHttpError("A reason is required for calendar status changes", 400);
    row.status = nextStatus;
    row.statusHistory.push({ status: nextStatus, actorId: adminUserId || null, reason });
  }
  row.lastChangedBy = adminUserId || null;
  await row.save();
  return serializeCalendarEntry(row.toObject());
};

const upsertSloPolicy = async ({ key, payload = {}, adminUserId } = {}) => {
  const normalizedKey = normalizeKey(key || payload.key);
  const definition = SLO_CATALOG.find((row) => row.key === normalizedKey);
  if (!definition) throw buildHttpError("SLO policy key is invalid", 400);
  const reason = String(payload.reason || "").trim();
  if (!reason) throw buildHttpError("A reason is required for SLO policy changes", 400);
  const targetPercent = Number(payload.targetPercent ?? definition.targetPercent);
  const windowDays = Number(payload.windowDays ?? definition.windowDays);
  const errorBudgetMinutes = Number(payload.errorBudgetMinutes ?? round(windowDays * 24 * 60 * (1 - targetPercent / 100)));
  const values = {
    key: normalizedKey, title: String(payload.title || definition.title).trim(), targetPercent, windowDays, errorBudgetMinutes,
    warnAtPercentConsumed: Number(payload.warnAtPercentConsumed ?? 50), expansionBlockAtPercentConsumed: Number(payload.expansionBlockAtPercentConsumed ?? 100),
    owner: String(payload.owner || definition.owner).trim(), runbookKey: normalizeKey(payload.runbookKey || definition.runbookKey),
    userImpact: String(payload.userImpact || definition.userImpact).trim(), rollbackPlan: String(payload.rollbackPlan || definition.rollbackPlan).trim(),
    ticketUrl: String(payload.ticketUrl || "").trim(), enabled: payload.enabled !== false, changedBy: adminUserId, changeReason: reason,
  };
  const row = await ProductionSloPolicy.findOne({ key: normalizedKey });
  if (row) {
    Object.assign(row, values);
    row.changeHistory.push({ at: new Date(), actorId: adminUserId || null, reason, targetPercent, windowDays });
    await row.save();
    return row.toObject();
  }
  const created = await ProductionSloPolicy.create({ ...values, changeHistory: [{ actorId: adminUserId || null, reason, targetPercent, windowDays }] });
  return created.toObject();
};

const createPartnerPilot = async ({ payload = {}, adminUserId } = {}) => {
  const type = String(payload.type || "").trim().toLowerCase();
  if (!PartnerPilot.PARTNER_PILOT_TYPES.includes(type)) throw buildHttpError("Partner pilot type is invalid", 400);
  const name = String(payload.name || "").trim();
  const pilotKey = normalizeKey(payload.pilotKey || name);
  if (!name || !pilotKey) throw buildHttpError("Pilot name and key are required", 400);
  const row = new PartnerPilot({
    name, pilotKey, type, status: "draft", sponsored: Boolean(payload.sponsored), disclosureLabel: String(payload.disclosureLabel || "").trim(),
    ownerName: String(payload.ownerName || "").trim(), ownerRole: String(payload.ownerRole || "Partnerships").trim(),
    creatorScope: String(payload.creatorScope || "").trim(), fanScope: String(payload.fanScope || "").trim(), geography: String(payload.geography || "").trim(),
    offer: String(payload.offer || "").trim(), reportingPackage: String(payload.reportingPackage || "").trim(), rightsAndModerationPlan: String(payload.rightsAndModerationPlan || "").trim(),
    financePlan: String(payload.financePlan || "").trim(), exitCriteria: String(payload.exitCriteria || "").trim(), startAt: payload.startAt || null, reviewAt: payload.reviewAt,
    createdBy: adminUserId, lastChangedBy: adminUserId, statusHistory: [{ status: "draft", actorId: adminUserId, reason: "Partner pilot created" }],
  });
  await row.save();
  return serializePilot(row.toObject());
};

const updatePartnerPilot = async ({ pilotId, updates = {}, adminUserId } = {}) => {
  assertObjectId(pilotId, "Partner pilot id");
  const row = await PartnerPilot.findById(pilotId);
  if (!row) throw buildHttpError("Partner pilot not found", 404);
  const nextStatus = String(updates.status || row.status).trim().toLowerCase();
  if (!PartnerPilot.PARTNER_PILOT_STATUSES.includes(nextStatus)) throw buildHttpError("Partner pilot status is invalid", 400);
  const transitions = {
    draft: ["draft", "ready", "exited"], ready: ["ready", "draft", "active", "paused", "exited"],
    active: ["active", "paused", "completed", "exited"], paused: ["paused", "ready", "active", "exited"],
    completed: ["completed"], exited: ["exited"],
  };
  if (!transitions[row.status].includes(nextStatus)) throw buildHttpError(`Partner pilot cannot move from ${row.status} to ${nextStatus}`, 409);
  ["name", "sponsored", "disclosureLabel", "ownerName", "ownerRole", "creatorScope", "fanScope", "geography", "offer", "reportingPackage", "rightsAndModerationPlan", "financePlan", "exitCriteria", "startAt", "reviewAt"].forEach((field) => {
    if (updates[field] !== undefined) row[field] = updates[field];
  });
  if (["ready", "active"].includes(nextStatus)) {
    const required = ["ownerName", "creatorScope", "fanScope", "geography", "offer", "reportingPackage", "rightsAndModerationPlan", "financePlan", "exitCriteria", "reviewAt"];
    const blockers = required.filter((field) => !row[field]);
    if (row.sponsored && !row.disclosureLabel) blockers.push("disclosureLabel");
    if (blockers.length) throw buildHttpError("Partner pilot is not ready", 409, { blockers });
  }
  if (nextStatus !== row.status) {
    const reason = String(updates.reason || "").trim();
    if (!reason) throw buildHttpError("A reason is required for partner pilot status changes", 400);
    row.status = nextStatus;
    row.statusHistory.push({ status: nextStatus, actorId: adminUserId || null, reason });
  }
  row.lastChangedBy = adminUserId || null;
  await row.save();
  return serializePilot(row.toObject());
};

const createExpansionBet = async ({ payload = {}, adminUserId } = {}) => {
  const name = String(payload.name || "").trim();
  const betKey = normalizeKey(payload.betKey || name);
  if (!name || !betKey) throw buildHttpError("Expansion bet name and key are required", 400);
  const scores = ExpansionBet.SCORE_INPUT_KEYS.reduce((result, key) => ({ ...result, [key]: Number(payload.scores?.[key]) }), {});
  const row = new ExpansionBet({
    name, betKey, marketOrSegment: String(payload.marketOrSegment || "").trim(), state: "research",
    ownerName: String(payload.ownerName || "").trim(), ownerRole: String(payload.ownerRole || "Growth and partnerships").trim(),
    cohortDefinition: String(payload.cohortDefinition || "").trim(), gate: String(payload.gate || "").trim(), costCap: Number(payload.costCap || 0), currency: String(payload.currency || "NGN").trim().toUpperCase(),
    successMetric: String(payload.successMetric || "").trim(), stopCondition: String(payload.stopCondition || "").trim(), reviewAt: payload.reviewAt, scores,
    createdBy: adminUserId, lastChangedBy: adminUserId, stateHistory: [{ state: "research", actorId: adminUserId, reason: "Expansion bet created" }],
  });
  await row.save();
  return serializeExpansionBet(row.toObject());
};

const updateExpansionBet = async ({ betId, updates = {}, adminUserId, expansionPaused = false } = {}) => {
  assertObjectId(betId, "Expansion bet id");
  const row = await ExpansionBet.findById(betId);
  if (!row) throw buildHttpError("Expansion bet not found", 404);
  const nextState = String(updates.state || row.state).trim().toLowerCase();
  if (!ExpansionBet.EXPANSION_STATES.includes(nextState)) throw buildHttpError("Expansion state is invalid", 400);
  if (expansionPaused && ["controlled_launch", "expand"].includes(nextState)) throw buildHttpError("Expansion is paused by an exhausted or uninstrumented critical SLO", 409);
  ["name", "marketOrSegment", "ownerName", "ownerRole", "cohortDefinition", "gate", "costCap", "currency", "successMetric", "stopCondition", "reviewAt"].forEach((field) => { if (updates[field] !== undefined) row[field] = updates[field]; });
  if (updates.scores) ExpansionBet.SCORE_INPUT_KEYS.forEach((key) => { if (updates.scores[key] !== undefined) row.scores[key] = Number(updates.scores[key]); });
  if (nextState !== row.state) {
    const reason = String(updates.reason || "").trim();
    if (!reason) throw buildHttpError("A reason is required for expansion state changes", 400);
    row.state = nextState;
    row.stateHistory.push({ state: nextState, actorId: adminUserId || null, reason });
  }
  row.lastChangedBy = adminUserId || null;
  await row.save();
  return serializeExpansionBet(row.toObject(), expansionPaused);
};

module.exports = {
  AKUSO_LAUNCH_CAPABILITIES,
  CALENDAR_TYPE_CATALOG,
  GOVERNANCE_CATALOG,
  PERFORMANCE_SURFACES,
  ROADMAP_PACKAGES,
  SLO_CATALOG,
  buildCampaignCalendar,
  buildFanRetentionInterventions,
  buildNotificationSnapshot,
  buildPartnerReporting,
  buildPerformanceCost,
  buildScaleEvidenceOperatingSystem,
  buildScaleEvidenceOperatingView,
  buildScaleReport,
  buildSloBudgets,
  calendarReadinessChecks,
  createCalendarEntry,
  createExpansionBet,
  createPartnerPilot,
  serializeCalendarEntry,
  serializeExpansionBet,
  serializePilot,
  updateCalendarEntry,
  updateExpansionBet,
  updatePartnerPilot,
  upsertSloPolicy,
};
