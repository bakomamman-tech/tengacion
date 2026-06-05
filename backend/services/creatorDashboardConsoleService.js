const { buildPurchaseLifecyclePayload } = require("./purchaseLifecycleService");
const {
  computePurchaseRevenueShare,
} = require("./creatorRevenueSharePolicy");
const DEFAULT_LIMITS = {
  actionPrompts: 5,
  akusoTemplates: 4,
  catalogGrowthPrompts: 5,
  metadataFixes: 6,
  recentSales: 6,
  recentSubscribers: 6,
  topContent: 5,
};

const DESCRIPTION_MIN_CHARS = 90;
const DESCRIPTION_MIN_WORDS = 12;

const ISSUE_WEIGHTS = {
  high: 18,
  medium: 12,
  low: 8,
};

const SEVERITY_RANK = {
  high: 3,
  medium: 2,
  low: 1,
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

const toText = (value = "") => String(value || "").trim();

const toMoney = (value = 0) => Math.max(0, Math.round(Number(value || 0)));

const toNumber = (value = 0) => Math.max(0, Number(value || 0));

const countWords = (value = "") => {
  const text = toText(value);
  if (!text) {
    return 0;
  }
  return text.split(/\s+/).filter(Boolean).length;
};

const toTimestamp = (value) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
};

const sortByRecent = (left, right) =>
  toTimestamp(right.paidAt || right.updatedAt || right.createdAt) -
  toTimestamp(left.paidAt || left.updatedAt || left.createdAt);

const buildBuyerPayload = (user = null) => {
  if (!user || typeof user !== "object" || !user._id) {
    return null;
  }

  return {
    id: toIdString(user._id),
    name: user.name || user.username || "Fan",
    username: user.username || "",
    avatar: typeof user.avatar === "string" ? user.avatar : user.avatar?.url || "",
  };
};

const getContentRoute = (item = {}) => {
  if (item.category === "books" || item.itemType === "book") {
    return "/creator/books";
  }
  if (item.category === "podcasts" || item.contentType === "podcast") {
    return "/creator/podcasts";
  }
  return "/creator/music";
};

const getPurchaseItemLabel = (itemType = "") => {
  const normalized = String(itemType || "").trim().toLowerCase();
  if (normalized === "track") return "Track";
  if (normalized === "book") return "Book";
  if (normalized === "album") return "Album";
  if (normalized === "video") return "Video";
  if (normalized === "subscription") return "Membership";
  return "Content";
};

const buildContentItem = (entry = {}, overrides = {}) => {
  const item = {
    id: toIdString(entry._id || entry.id),
    itemType: overrides.itemType || "track",
    itemKey: `${overrides.purchaseItemType || overrides.itemType || "track"}:${toIdString(entry._id || entry.id)}`,
    purchaseItemType: overrides.purchaseItemType || overrides.itemType || "track",
    category: overrides.category || "music",
    contentType: overrides.contentType || entry.contentType || overrides.itemType || "track",
    title: entry.title || overrides.fallbackTitle || "Untitled content",
    description: entry.description || "",
    status: entry.publishedStatus || "draft",
    price: toMoney(entry.price),
    earnings: toMoney(entry.earnings),
    purchases: toNumber(entry.purchaseCount),
    engagement: toNumber(
      overrides.engagement ??
        entry.playsCount ??
        entry.playCount ??
        entry.viewsCount ??
        entry.downloadCount ??
        entry.purchaseCount
    ),
    updatedAt: entry.updatedAt || entry.createdAt || null,
    createdAt: entry.createdAt || null,
    actionTo: "",
    raw: entry,
  };

  item.actionTo = getContentRoute(item);
  return item;
};

const buildContentItems = ({
  musicTracks = [],
  podcastTracks = [],
  books = [],
  albums = [],
  videos = [],
} = {}) => [
  ...musicTracks.map((entry) =>
    buildContentItem(entry, {
      itemType: "track",
      purchaseItemType: "track",
      category: "music",
      contentType: "track",
      engagement: entry.playsCount,
      fallbackTitle: "Untitled track",
    })
  ),
  ...podcastTracks.map((entry) =>
    buildContentItem(entry, {
      itemType: "podcast",
      purchaseItemType: "track",
      category: "podcasts",
      contentType: "podcast",
      engagement: entry.playsCount,
      fallbackTitle: "Untitled episode",
    })
  ),
  ...books.map((entry) =>
    buildContentItem(entry, {
      itemType: "book",
      purchaseItemType: "book",
      category: "books",
      contentType: "book",
      engagement: entry.downloadCount || entry.purchaseCount,
      fallbackTitle: "Untitled book",
    })
  ),
  ...albums.map((entry) =>
    buildContentItem(entry, {
      itemType: "album",
      purchaseItemType: "album",
      category: "music",
      contentType: "album",
      engagement: entry.playCount,
      fallbackTitle: "Untitled album",
    })
  ),
  ...videos.map((entry) =>
    buildContentItem(entry, {
      itemType: "video",
      purchaseItemType: "video",
      category: "music",
      contentType: "video",
      engagement: entry.viewsCount,
      fallbackTitle: "Untitled video",
    })
  ),
].filter((item) => item.id);

const buildContentLookup = (contentItems = []) =>
  new Map(contentItems.map((item) => [item.itemKey, item]));

const hasMedia = (...values) => values.some((value) => Boolean(toText(value)));

const hasListValue = (value) => {
  if (Array.isArray(value)) {
    return value.some((entry) => Boolean(toText(entry)));
  }
  return Boolean(toText(value));
};

const isWeakDescription = (value = "") => {
  const text = toText(value);
  return !text || text.length < DESCRIPTION_MIN_CHARS || countWords(text) < DESCRIPTION_MIN_WORDS;
};

const hasSubscriptionPackage = (profile = {}) =>
  Boolean(toText(profile.subscriptionDescription)) ||
  (Array.isArray(profile.subscriptionBenefits) &&
    profile.subscriptionBenefits.some((benefit) => Boolean(toText(benefit))));

const getCategoryLabel = (category = "") => {
  if (category === "books") return "Books";
  if (category === "podcasts") return "Podcasts";
  if (category === "music") return "Music";
  return "Catalog";
};

const getItemLabel = (item = {}) => {
  if (item.itemType === "book") return "book";
  if (item.itemType === "podcast") return "episode";
  if (item.itemType === "album") return "album";
  if (item.itemType === "video") return "video";
  return "track";
};

const itemHasCoverArt = (item = {}) => {
  const raw = item.raw || {};
  if (item.itemType === "album") {
    return hasMedia(raw.coverUrl, raw.coverImageUrl);
  }
  return hasMedia(raw.coverImageUrl, raw.coverUrl);
};

const itemHasPreview = (item = {}) => {
  const raw = item.raw || {};
  if (item.itemType === "book") {
    return hasMedia(raw.previewUrl, raw.previewExcerptText);
  }
  if (item.itemType === "album") {
    return Array.isArray(raw.tracks) && raw.tracks.some((track) => hasMedia(track.previewUrl));
  }
  if (item.itemType === "video") {
    return hasMedia(raw.previewClipUrl);
  }
  return hasMedia(raw.previewUrl, raw.previewSampleUrl, raw.previewClipUrl);
};

const itemHasCategorySignal = (item = {}) => {
  const raw = item.raw || {};
  if (item.itemType === "track") {
    return hasListValue(raw.genre);
  }
  if (item.itemType === "podcast") {
    return hasListValue(raw.podcastCategory) || hasListValue(raw.episodeTags);
  }
  if (item.itemType === "book") {
    return hasListValue(raw.genre) || hasListValue(raw.tags);
  }
  if (item.itemType === "album") {
    return hasListValue(raw.releaseType || raw.contentType);
  }
  return hasListValue(raw.contentType || raw.creatorCategory);
};

const getHealthStatus = ({ score = 0, itemCount = 0, issueCount = 0 } = {}) => {
  if (!itemCount) {
    return {
      key: "empty",
      label: "Needs first item",
      tone: "warning",
    };
  }
  if (score >= 85 && issueCount === 0) {
    return {
      key: "strong",
      label: "Strong",
      tone: "success",
    };
  }
  if (score >= 75) {
    return {
      key: "watch",
      label: "Watch",
      tone: "neutral",
    };
  }
  if (score >= 55) {
    return {
      key: "needs_work",
      label: "Needs work",
      tone: "warning",
    };
  }
  return {
    key: "at_risk",
    label: "At risk",
    tone: "danger",
  };
};

const buildIssue = (item = {}, issue = {}) => {
  const severity = ["high", "medium", "low"].includes(issue.severity)
    ? issue.severity
    : "medium";
  const tone = issue.tone || (severity === "high" ? "warning" : "neutral");
  return {
    key: issue.key,
    title: issue.title,
    description: issue.description,
    field: issue.field || "",
    severity,
    tone,
    impact: Number(issue.impact || ISSUE_WEIGHTS[severity] || ISSUE_WEIGHTS.medium),
    actionLabel: issue.actionLabel || "Review",
    actionTo: issue.actionTo || item.actionTo || "/creator/dashboard",
    itemId: item.id,
    itemType: item.itemType,
    itemTitle: item.title,
    category: item.category,
    updatedAt: item.updatedAt || item.createdAt || null,
  };
};

const sortIssues = (issues = []) =>
  [...issues].sort(
    (left, right) =>
      Number(right.impact || 0) - Number(left.impact || 0) ||
      Number(SEVERITY_RANK[right.severity] || 0) - Number(SEVERITY_RANK[left.severity] || 0) ||
      toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt)
  );

const getMetadataFixesForItem = (item = {}) => {
  const raw = item.raw || {};
  const fixes = [];

  if (!toText(item.title) || /^untitled/i.test(item.title)) {
    fixes.push("Title");
  }
  if (!toText(item.description)) {
    fixes.push("Description");
  }

  if (item.itemType === "track" || item.itemType === "podcast") {
    if (!hasMedia(raw.coverImageUrl, raw.coverUrl)) {
      fixes.push("Cover image");
    }
    if (item.price > 0 && !hasMedia(raw.previewUrl)) {
      fixes.push("Paid preview");
    }
    if (item.itemType === "track" && !toText(raw.genre)) {
      fixes.push("Genre");
    }
    if (item.itemType === "podcast") {
      if (!toText(raw.podcastSeries)) {
        fixes.push("Series name");
      }
      if (!toText(raw.showNotes)) {
        fixes.push("Show notes");
      }
    }
  }

  if (item.itemType === "book") {
    if (!hasMedia(raw.coverImageUrl, raw.coverUrl)) {
      fixes.push("Cover image");
    }
    if (!toText(raw.authorName)) {
      fixes.push("Author name");
    }
    if (!toText(raw.fileFormat)) {
      fixes.push("File format");
    }
    if (item.price > 0 && !hasMedia(raw.previewUrl, raw.previewExcerptText)) {
      fixes.push("Paid preview");
    }
  }

  if (item.itemType === "album") {
    if (!hasMedia(raw.coverUrl, raw.coverImageUrl)) {
      fixes.push("Cover image");
    }
    if (!toNumber(raw.totalTracks)) {
      fixes.push("Track count");
    }
  }

  if (item.itemType === "video") {
    if (!hasMedia(raw.coverImageUrl)) {
      fixes.push("Thumbnail");
    }
    if (item.price > 0 && !hasMedia(raw.previewClipUrl)) {
      fixes.push("Paid preview");
    }
  }

  return fixes;
};

const buildMetadataFixes = (contentItems = [], limit = DEFAULT_LIMITS.metadataFixes) =>
  contentItems
    .map((item) => ({
      id: item.id,
      itemType: item.itemType,
      contentType: item.contentType,
      title: item.title,
      status: item.status,
      missingFields: getMetadataFixesForItem(item),
      actionLabel: "Fix metadata",
      actionTo: item.actionTo,
      updatedAt: item.updatedAt,
    }))
    .filter((item) => item.missingFields.length)
    .sort(
      (left, right) =>
        right.missingFields.length - left.missingFields.length ||
        toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt)
    )
    .slice(0, limit);

const getCatalogIssuesForItem = (item = {}, { profile = {} } = {}) => {
  const issues = [];
  const itemLabel = getItemLabel(item);
  const engagement = toNumber(item.engagement);
  const purchases = toNumber(item.purchases);
  const purchaseRate = engagement > 0 ? (purchases / engagement) * 100 : 0;

  if (!itemHasCoverArt(item)) {
    issues.push(
      buildIssue(item, {
        key: "missing_cover_art",
        title: "Add cover art",
        description: `${item.title} needs cover art before it can stand out in discovery and checkout.`,
        field: "cover",
        severity: "high",
        actionLabel: "Add cover",
        impact: 20,
      })
    );
  }

  if (!toText(item.description)) {
    issues.push(
      buildIssue(item, {
        key: "missing_description",
        title: "Write a description",
        description: `${item.title} needs a clear ${itemLabel} description before promotion.`,
        field: "description",
        severity: "high",
        actionLabel: "Write description",
        impact: 18,
      })
    );
  } else if (isWeakDescription(item.description)) {
    issues.push(
      buildIssue(item, {
        key: "weak_description",
        title: "Strengthen description",
        description: `${item.title} has a short description. Add audience, mood, value, or story context.`,
        field: "description",
        severity: "medium",
        actionLabel: "Improve description",
      })
    );
  }

  if (!itemHasCategorySignal(item)) {
    issues.push(
      buildIssue(item, {
        key: "missing_category_signal",
        title: "Add category signals",
        description: `${item.title} is missing genre, category, or topic signals that help ranking and browsing.`,
        field: "category",
        severity: "medium",
        actionLabel: "Add tags",
      })
    );
  }

  if (item.price > 0 && !itemHasPreview(item)) {
    issues.push(
      buildIssue(item, {
        key: "missing_paid_preview",
        title: "Add a paid preview",
        description: `${item.title} is paid content without a preview path for fans.`,
        field: "preview",
        severity: "high",
        actionLabel: "Add preview",
        impact: 20,
      })
    );
  }

  if (item.price <= 0 && !hasSubscriptionPackage(profile)) {
    issues.push(
      buildIssue(item, {
        key: "missing_price_or_package",
        title: "Add a paid offer",
        description: `${item.title} is free and your fan pass packaging is not set yet.`,
        field: "pricing",
        severity: "low",
        actionLabel: "Package fan pass",
        actionTo: "/creator/settings",
      })
    );
  }

  if (item.price > 0 && engagement >= 50 && purchases === 0) {
    issues.push(
      buildIssue(item, {
        key: "high_preview_abandonment",
        title: "Review preview abandonment",
        description: `${item.title} has ${engagement} engagement signals but no paid purchases yet.`,
        field: "conversion",
        severity: "high",
        actionLabel: "Review offer",
        impact: 22,
      })
    );
  } else if (item.price > 0 && engagement >= 40 && purchaseRate < 2) {
    issues.push(
      buildIssue(item, {
        key: "low_preview_conversion",
        title: "Review pricing",
        description: `${item.title} is converting ${purchaseRate.toFixed(1)}% of engagement into purchases.`,
        field: "conversion",
        severity: "medium",
        actionLabel: "Review pricing",
      })
    );
  }

  return issues;
};

const buildCatalogHealth = ({
  contentItems = [],
  profile = {},
} = {}) => {
  const itemHealth = contentItems.map((item) => {
    const issues = sortIssues(getCatalogIssuesForItem(item, { profile }));
    const issueImpact = issues.reduce((sum, issue) => sum + Number(issue.impact || 0), 0);
    const score = Math.max(0, Math.min(100, Math.round(100 - issueImpact)));
    const status = getHealthStatus({
      score,
      itemCount: 1,
      issueCount: issues.length,
    });

    return {
      id: item.id,
      itemType: item.itemType,
      contentType: item.contentType,
      title: item.title,
      category: item.category,
      score,
      status: status.key,
      label: status.label,
      tone: status.tone,
      issueCount: issues.length,
      topIssue: issues[0] || null,
      actionTo: item.actionTo,
      issues,
    };
  });

  const issues = sortIssues(itemHealth.flatMap((item) => item.issues));
  const itemCount = itemHealth.length;
  const score = itemCount
    ? Math.round(itemHealth.reduce((sum, item) => sum + Number(item.score || 0), 0) / itemCount)
    : 0;
  const status = getHealthStatus({
    score,
    itemCount,
    issueCount: issues.length,
  });
  const categories = new Map();

  itemHealth.forEach((item) => {
    const key = item.category || "catalog";
    const bucket = categories.get(key) || {
      category: key,
      label: getCategoryLabel(key),
      itemCount: 0,
      scoreTotal: 0,
      issueCount: 0,
      issues: [],
    };
    bucket.itemCount += 1;
    bucket.scoreTotal += Number(item.score || 0);
    bucket.issueCount += Number(item.issueCount || 0);
    bucket.issues.push(...item.issues);
    categories.set(key, bucket);
  });

  return {
    score,
    status: status.key,
    label: status.label,
    tone: status.tone,
    itemCount,
    issueCount: issues.length,
    highImpactIssueCount: issues.filter((issue) => issue.severity === "high").length,
    monetizedItems: contentItems.filter((item) => Number(item.price || 0) > 0).length,
    itemsNeedingWork: itemHealth.filter((item) => Number(item.issueCount || 0) > 0).length,
    topIssue: issues[0] || null,
    topIssues: issues.slice(0, 6),
    highestImpactItems: itemHealth
      .filter((item) => item.issueCount > 0)
      .sort(
        (left, right) =>
          Number(right.issueCount || 0) - Number(left.issueCount || 0) ||
          Number(left.score || 0) - Number(right.score || 0)
      )
      .slice(0, 4),
    byCategory: [...categories.values()].map((bucket) => {
      const categoryScore = bucket.itemCount
        ? Math.round(bucket.scoreTotal / bucket.itemCount)
        : 0;
      const categoryStatus = getHealthStatus({
        score: categoryScore,
        itemCount: bucket.itemCount,
        issueCount: bucket.issueCount,
      });
      return {
        category: bucket.category,
        label: bucket.label,
        score: categoryScore,
        status: categoryStatus.key,
        tone: categoryStatus.tone,
        itemCount: bucket.itemCount,
        issueCount: bucket.issueCount,
        topIssue: sortIssues(bucket.issues)[0] || null,
      };
    }),
  };
};

const buildTopContent = (contentItems = [], limit = DEFAULT_LIMITS.topContent) =>
  contentItems
    .map((item) => ({
      id: item.id,
      itemType: item.itemType,
      contentType: item.contentType,
      title: item.title,
      status: item.status,
      earnings: item.earnings,
      purchases: item.purchases,
      engagement: item.engagement,
      price: item.price,
      actionLabel: "Open workspace",
      actionTo: item.actionTo,
      updatedAt: item.updatedAt,
    }))
    .sort(
      (left, right) =>
        Number(right.earnings || 0) - Number(left.earnings || 0) ||
        Number(right.purchases || 0) - Number(left.purchases || 0) ||
        Number(right.engagement || 0) - Number(left.engagement || 0) ||
        toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt)
    )
    .slice(0, limit);

const buildRecentSales = ({
  purchases = [],
  contentLookup,
  limit = DEFAULT_LIMITS.recentSales,
} = {}) =>
  purchases
    .filter((purchase) => String(purchase?.itemType || "").toLowerCase() !== "subscription")
    .sort(sortByRecent)
    .slice(0, limit)
    .map((purchase) => {
      const itemType = String(purchase?.itemType || "").trim().toLowerCase();
      const itemId = toIdString(purchase?.itemId);
      const item = contentLookup.get(`${itemType}:${itemId}`);
      const { grossAmount, creatorAmount } =
        computePurchaseRevenueShare(purchase);

      return {
        id: toIdString(purchase?._id),
        purchaseId: toIdString(purchase?._id),
        itemType,
        itemId,
        itemTitle: item?.title || getPurchaseItemLabel(itemType),
        itemLabel: getPurchaseItemLabel(itemType),
        buyer: buildBuyerPayload(purchase?.userId),
        amount: grossAmount,
        creatorAmount: toMoney(creatorAmount),
        currency: purchase?.currency || "NGN",
        provider: purchase?.provider || "",
        providerRef: purchase?.providerRef || "",
        paidAt: purchase?.paidAt || purchase?.updatedAt || purchase?.createdAt || null,
        actionTo: "/creator/earnings",
      };
    });

const buildRecentSubscribers = ({
  purchases = [],
  limit = DEFAULT_LIMITS.recentSubscribers,
} = {}) =>
  purchases
    .filter((purchase) => String(purchase?.itemType || "").toLowerCase() === "subscription")
    .sort(sortByRecent)
    .slice(0, limit)
    .map((purchase) => {
      const lifecycle = buildPurchaseLifecyclePayload(purchase);
      const { grossAmount, creatorAmount } =
        computePurchaseRevenueShare(purchase);

      return {
        id: toIdString(purchase?._id),
        purchaseId: toIdString(purchase?._id),
        buyer: buildBuyerPayload(purchase?.userId),
        amount: grossAmount,
        creatorAmount: toMoney(creatorAmount),
        currency: purchase?.currency || "NGN",
        lifecycleStatus: lifecycle.lifecycleStatus,
        label: lifecycle.label,
        accessExpiresAt: lifecycle.expiresAt || purchase?.accessExpiresAt || null,
        paidAt: purchase?.paidAt || purchase?.updatedAt || purchase?.createdAt || null,
        actionTo: "/creator/earnings",
      };
    });

const buildFunnel = ({ contentItems = [], purchases = [] } = {}) => {
  const publishedItems = contentItems.filter((item) =>
    ["published", "under_review"].includes(String(item.status || "").trim().toLowerCase())
  );
  const paidItems = contentItems.filter((item) => Number(item.price || 0) > 0);
  const engagement = contentItems.reduce((sum, item) => sum + toNumber(item.engagement), 0);
  const paidPurchases = purchases.filter(
    (purchase) => String(purchase?.itemType || "").trim().toLowerCase() !== "subscription"
  ).length;
  const subscribers = purchases.filter(
    (purchase) => String(purchase?.itemType || "").trim().toLowerCase() === "subscription"
  ).length;
  const conversionRate = engagement > 0 ? Number(((paidPurchases / engagement) * 100).toFixed(1)) : 0;

  return {
    basis: "content_counters",
    contentItems: contentItems.length,
    publishedItems: publishedItems.length,
    paidItems: paidItems.length,
    engagement,
    paidPurchases,
    subscribers,
    engagementToPurchaseRate: conversionRate,
  };
};

const pushPrompt = (prompts, prompt) => {
  if (!prompt?.key || prompts.some((entry) => entry.key === prompt.key)) {
    return;
  }
  prompts.push(prompt);
};

const buildCatalogGrowthPrompts = ({
  catalogHealth = {},
  topContent = [],
  recentSales = [],
  recentSubscribers = [],
  profile = {},
  funnel = {},
  limit = DEFAULT_LIMITS.catalogGrowthPrompts,
} = {}) => {
  const prompts = [];
  const topIssue = catalogHealth.topIssue || null;
  const topPreviewIssue = (catalogHealth.topIssues || []).find((issue) => issue.key === "missing_paid_preview");
  const conversionIssue = (catalogHealth.topIssues || []).find((issue) =>
    ["high_preview_abandonment", "low_preview_conversion"].includes(issue.key)
  );

  if (topIssue) {
    pushPrompt(prompts, {
      key: `catalog_${topIssue.key}_${topIssue.itemType}_${topIssue.itemId}`,
      title: topIssue.title || "Improve catalog quality",
      description: topIssue.description || "Review the highest-impact catalog fix.",
      actionLabel: topIssue.actionLabel || "Review",
      actionTo: topIssue.actionTo || "/creator/dashboard",
      tone: topIssue.tone || "warning",
      priority: Number(topIssue.impact || 0),
      source: "catalog_health",
    });
  }

  if (topPreviewIssue && topPreviewIssue.key !== topIssue?.key) {
    pushPrompt(prompts, {
      key: `catalog_preview_${topPreviewIssue.itemType}_${topPreviewIssue.itemId}`,
      title: "Add a preview before promotion",
      description: `${topPreviewIssue.itemTitle} needs a fan-safe preview before paid traffic.`,
      actionLabel: "Add preview",
      actionTo: topPreviewIssue.actionTo || "/creator/dashboard",
      tone: "warning",
      priority: 19,
      source: "catalog_health",
    });
  }

  if (!hasSubscriptionPackage(profile) || !recentSubscribers.length) {
    pushPrompt(prompts, {
      key: "catalog_subscription_package",
      title: "Package your fan pass",
      description: "Give supporters a clear monthly reason to join before the next announcement.",
      actionLabel: "Edit package",
      actionTo: "/creator/settings",
      tone: "neutral",
      priority: hasSubscriptionPackage(profile) ? 8 : 14,
      source: "subscription_packaging",
    });
  }

  if (conversionIssue) {
    pushPrompt(prompts, {
      key: `catalog_pricing_${conversionIssue.itemType}_${conversionIssue.itemId}`,
      title: "Review pricing and preview fit",
      description: conversionIssue.description,
      actionLabel: "Review pricing",
      actionTo: conversionIssue.actionTo || "/creator/dashboard",
      tone: "warning",
      priority: Number(conversionIssue.impact || 12),
      source: "catalog_conversion",
    });
  }

  const top = topContent[0];
  if (top && Number(top.engagement || 0) > 0) {
    pushPrompt(prompts, {
      key: `catalog_promote_${top.itemType}_${top.id}`,
      title: "Promote to followers",
      description: `${top.title} has the strongest current signal. Turn it into a fan update.`,
      actionLabel: "Preview fan page",
      actionTo: "/creator/fan-page-view",
      tone: "success",
      priority: recentSales.length ? 7 : 10,
      source: "catalog_momentum",
    });
  }

  if (!recentSales.length && Number(funnel.paidItems || 0) > 0) {
    pushPrompt(prompts, {
      key: "catalog_first_paid_sale",
      title: "Recover the first paid sale",
      description: "Your paid catalog is ready for a clearer launch push.",
      actionLabel: "Open catalog",
      actionTo: top?.actionTo || "/creator/fan-page-view",
      tone: "neutral",
      priority: 9,
      source: "sales_recovery",
    });
  }

  return prompts
    .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0))
    .slice(0, limit);
};

const buildTemplate = ({
  key,
  title,
  description,
  prompt,
  actionTo = "/creator/dashboard",
  item = null,
} = {}) => ({
  key,
  title,
  description,
  prompt,
  actionLabel: "Copy prompt",
  actionTo,
  mode: "writing",
  requiresReview: true,
  item: item
    ? {
        id: item.id,
        itemType: item.itemType,
        title: item.title,
      }
    : null,
});

const buildAkusoTemplates = ({
  contentItems = [],
  catalogHealth = {},
  profile = {},
  topContent = [],
  limit = DEFAULT_LIMITS.akusoTemplates,
} = {}) => {
  const creatorName = toText(profile.displayName || profile.fullName) || "my Tengacion creator page";
  const descriptionIssues = catalogHealth.topIssues || [];
  const trackItem =
    contentItems.find((item) =>
      ["track", "podcast"].includes(item.itemType) && isWeakDescription(item.description)
    ) ||
    contentItems.find((item) => ["track", "podcast"].includes(item.itemType)) ||
    null;
  const bookItem =
    contentItems.find((item) => item.itemType === "book" && isWeakDescription(item.description)) ||
    contentItems.find((item) => item.itemType === "book") ||
    null;
  const launchItem =
    topContent[0] ||
    contentItems.find((item) => Number(item.price || 0) > 0) ||
    contentItems[0] ||
    null;
  const needsDescription = descriptionIssues.some((issue) =>
    ["missing_description", "weak_description"].includes(issue.key)
  );
  const trackTitle = trackItem?.title || "my next track";
  const bookTitle = bookItem?.title || "my next book";
  const launchTitle = launchItem?.title || "my next release";

  const templates = [
    buildTemplate({
      key: "track_description",
      title: "Track description",
      description: trackItem
        ? `Draft stronger copy for ${trackTitle}.`
        : "Draft truthful copy for the next track.",
      actionTo: trackItem?.actionTo || "/creator/music",
      item: trackItem,
      prompt: `Draft three truthful Tengacion track descriptions for "${trackTitle}". Keep each under 90 words, avoid unsupported claims, use placeholders for missing genre or mood details, and remind me to review before publishing.`,
    }),
    buildTemplate({
      key: "book_blurb",
      title: "Book blurb",
      description: bookItem
        ? `Shape a fan-facing blurb for ${bookTitle}.`
        : "Shape a fan-facing book blurb.",
      actionTo: bookItem?.actionTo || "/creator/books",
      item: bookItem,
      prompt: `Draft three concise book blurbs for "${bookTitle}" on Tengacion. Keep them specific, avoid inventing plot details, include placeholders for audience and genre if missing, and make the final copy ready for my review.`,
    }),
    buildTemplate({
      key: "subscription_benefits",
      title: "Fan pass benefits",
      description: hasSubscriptionPackage(profile)
        ? "Refine the monthly supporter package."
        : "Create a clearer monthly supporter package.",
      actionTo: "/creator/settings",
      prompt: `Draft six clear monthly fan pass benefits for ${creatorName}. Keep them practical, avoid promising unsupported perks, and include one short checkout description I can review before publishing.`,
    }),
    buildTemplate({
      key: "launch_announcement",
      title: "Launch announcement",
      description: launchItem
        ? `Write a fan update for ${launchTitle}.`
        : "Write a fan update for the next release.",
      actionTo: launchItem?.actionTo || "/creator/fan-page-view",
      item: launchItem,
      prompt: `Draft three Tengacion launch announcements for "${launchTitle}". Keep the tone warm and direct, mention that fans should preview or unlock it in the app only if that is true, and mark any missing details as placeholders for my review.`,
    }),
  ];

  return templates
    .filter((template) => Boolean(template.key && template.prompt))
    .sort((left, right) => {
      if (needsDescription && left.key === "track_description") return -1;
      if (needsDescription && right.key === "track_description") return 1;
      return 0;
    })
    .slice(0, limit);
};

const buildActionPrompts = ({
  activation = {},
  payoutReadiness = {},
  catalogGrowthPrompts = [],
  metadataFixes = [],
  topContent = [],
  recentSales = [],
  recentSubscribers = [],
  contentItems = [],
  funnel = {},
  limit = DEFAULT_LIMITS.actionPrompts,
} = {}) => {
  const prompts = [];

  if (activation?.nextStep) {
    pushPrompt(prompts, {
      key: `activation_${activation.nextStep.key}`,
      title: activation.nextStep.label || "Continue creator setup",
      description: activation.nextStep.description || "Finish the next creator activation step.",
      actionLabel: activation.nextStep.actionLabel || "Continue setup",
      actionTo: activation.nextStep.actionTo || "/creator/dashboard",
      tone: "warning",
    });
  }

  if (payoutReadiness && payoutReadiness.ready === false) {
    pushPrompt(prompts, {
      key: "payout_readiness",
      title: payoutReadiness.label || "Payout readiness needs attention",
      description: payoutReadiness.nextStep || "Complete payout details before withdrawals are available.",
      actionLabel: "Review payouts",
      actionTo: "/creator/payouts",
      tone: "warning",
    });
  }

  if (metadataFixes.length) {
    pushPrompt(prompts, {
      key: "metadata_fixes",
      title: `${metadataFixes.length} content metadata fix${metadataFixes.length === 1 ? "" : "es"}`,
      description: `${metadataFixes[0].title} is missing ${metadataFixes[0].missingFields.slice(0, 2).join(", ")}.`,
      actionLabel: "Fix metadata",
      actionTo: metadataFixes[0].actionTo || "/creator/dashboard",
      tone: "neutral",
    });
  }

  catalogGrowthPrompts.slice(0, 2).forEach((prompt) => {
    pushPrompt(prompts, {
      key: `growth_${prompt.key}`,
      title: prompt.title,
      description: prompt.description,
      actionLabel: prompt.actionLabel,
      actionTo: prompt.actionTo,
      tone: prompt.tone || "neutral",
    });
  });

  const top = topContent[0];
  if (top && Number(top.engagement || 0) > 0) {
    pushPrompt(prompts, {
      key: "promote_top_content",
      title: "Double down on your top content",
      description: `${top.title} leads with ${top.engagement} engagement signal${top.engagement === 1 ? "" : "s"}.`,
      actionLabel: "Open workspace",
      actionTo: top.actionTo || "/creator/dashboard",
      tone: "success",
    });
  }

  if (!recentSubscribers.length) {
    pushPrompt(prompts, {
      key: "subscription_packaging",
      title: "Package your fan pass",
      description: "Make the monthly supporter benefit clear before promoting your creator page.",
      actionLabel: "Edit settings",
      actionTo: "/creator/settings",
      tone: "neutral",
    });
  }

  if (!recentSales.length && Number(funnel.paidItems || 0) > 0) {
    pushPrompt(prompts, {
      key: "share_paid_content",
      title: "Share your paid catalog",
      description: "You have paid content ready, but no confirmed sales in the current dashboard sample.",
      actionLabel: "Preview fan page",
      actionTo: "/creator/fan-page-view",
      tone: "neutral",
    });
  }

  if (!contentItems.length) {
    pushPrompt(prompts, {
      key: "publish_first_content",
      title: "Publish your first creator item",
      description: "Start with one upload so fans have something concrete to support.",
      actionLabel: "Start upload",
      actionTo: "/creator/categories",
      tone: "warning",
    });
  }

  return prompts.slice(0, limit);
};

const buildCreatorDashboardConsole = ({
  activation = {},
  content = {},
  payoutReadiness = {},
  profile = {},
  purchases = [],
} = {}) => {
  const contentItems = buildContentItems(content);
  const contentLookup = buildContentLookup(contentItems);
  const recentSales = buildRecentSales({ purchases, contentLookup });
  const recentSubscribers = buildRecentSubscribers({ purchases });
  const topContent = buildTopContent(contentItems);
  const metadataFixes = buildMetadataFixes(contentItems);
  const funnel = buildFunnel({ contentItems, purchases });
  const catalogHealth = buildCatalogHealth({ contentItems, profile });
  const catalogGrowthPrompts = buildCatalogGrowthPrompts({
    catalogHealth,
    topContent,
    recentSales,
    recentSubscribers,
    profile,
    funnel,
  });
  const akusoTemplates = buildAkusoTemplates({
    contentItems,
    catalogHealth,
    profile,
    topContent,
  });
  const actionPrompts = buildActionPrompts({
    activation,
    payoutReadiness,
    catalogGrowthPrompts,
    metadataFixes,
    topContent,
    recentSales,
    recentSubscribers,
    contentItems,
    funnel,
  });

  return {
    funnel,
    actionPrompts,
    topContent,
    metadataFixes,
    catalogHealth,
    catalogGrowthPrompts,
    akusoTemplates,
    recentSales,
    recentSubscribers,
  };
};

module.exports = {
  buildCreatorDashboardConsole,
  buildCatalogHealth,
  buildContentItems,
  buildMetadataFixes,
  buildTopContent,
};
