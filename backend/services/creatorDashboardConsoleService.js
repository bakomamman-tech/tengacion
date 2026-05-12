const { buildPurchaseLifecyclePayload } = require("./purchaseLifecycleService");

const CREATOR_SHARE_RATE = 0.4;
const DEFAULT_LIMITS = {
  actionPrompts: 5,
  metadataFixes: 6,
  recentSales: 6,
  recentSubscribers: 6,
  topContent: 5,
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
      const grossAmount = toMoney(purchase?.amount);

      return {
        id: toIdString(purchase?._id),
        purchaseId: toIdString(purchase?._id),
        itemType,
        itemId,
        itemTitle: item?.title || getPurchaseItemLabel(itemType),
        itemLabel: getPurchaseItemLabel(itemType),
        buyer: buildBuyerPayload(purchase?.userId),
        amount: grossAmount,
        creatorAmount: toMoney(grossAmount * CREATOR_SHARE_RATE),
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
      const grossAmount = toMoney(purchase?.amount);

      return {
        id: toIdString(purchase?._id),
        purchaseId: toIdString(purchase?._id),
        buyer: buildBuyerPayload(purchase?.userId),
        amount: grossAmount,
        creatorAmount: toMoney(grossAmount * CREATOR_SHARE_RATE),
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

const buildActionPrompts = ({
  activation = {},
  payoutReadiness = {},
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
  purchases = [],
} = {}) => {
  const contentItems = buildContentItems(content);
  const contentLookup = buildContentLookup(contentItems);
  const recentSales = buildRecentSales({ purchases, contentLookup });
  const recentSubscribers = buildRecentSubscribers({ purchases });
  const topContent = buildTopContent(contentItems);
  const metadataFixes = buildMetadataFixes(contentItems);
  const funnel = buildFunnel({ contentItems, purchases });
  const actionPrompts = buildActionPrompts({
    activation,
    payoutReadiness,
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
    recentSales,
    recentSubscribers,
  };
};

module.exports = {
  buildCreatorDashboardConsole,
  buildContentItems,
  buildMetadataFixes,
  buildTopContent,
};
