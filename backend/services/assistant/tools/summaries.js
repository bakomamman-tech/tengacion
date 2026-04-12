const Notification = require("../../../models/Notification");
const Purchase = require("../../../models/Purchase");
const User = require("../../../models/User");
const { resolvePurchasableItem } = require("../../catalogService");
const { emptyToolInputSchema } = require("../schemas");
const {
  buildAction,
  buildCard,
  getCreatorProfile,
  safeText,
  creatorIsReady,
} = require("./shared");

const getNotificationsSummaryTool = {
  name: "getNotificationsSummary",
  description: "Summarize the logged-in user's recent notifications without exposing hidden metadata.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  inputSchema: emptyToolInputSchema,
  handler: async (_args, context) => {
    const userId = context?.user?.id || "";
    const activeExpiryFilter = {
      $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: { $exists: false } }],
    };
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({
        recipient: userId,
        ...activeExpiryFilter,
      })
        .sort({ createdAt: -1 })
        .limit(4)
        .populate("sender", "_id name username avatar")
        .lean(),
      Notification.countDocuments({
        recipient: userId,
        read: false,
        ...activeExpiryFilter,
      }),
    ]);

    const cards = notifications.map((notification) =>
      buildCard({
        type: "notification",
        title: safeText(notification?.sender?.name || notification?.sender?.username || "Notification", 120),
        subtitle: safeText(notification.type || "update", 80),
        description: safeText(notification.text || notification.metadata?.previewText || "", 240),
        route: "/notifications",
        payload: {
          notificationId: String(notification._id || ""),
          read: Boolean(notification.read),
        },
      })
    );

    return {
      message:
        unreadCount > 0
          ? `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.`
          : "You are caught up on notifications.",
      actions: [buildAction("/notifications")],
      cards,
      requiresConfirmation: false,
      pendingAction: null,
    };
  },
};

const getPurchasesSummaryTool = {
  name: "getPurchasesSummary",
  description: "Summarize the logged-in user's recent purchases and open the purchases page.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  inputSchema: emptyToolInputSchema,
  handler: async (_args, context) => {
    const userId = context?.user?.id || "";
    const purchases = await Purchase.find({ userId }).sort({ createdAt: -1 }).limit(4).lean();
    const cards = [];

    for (const purchase of purchases) {
      const itemType = safeText(purchase.itemType || "purchase", 30).toLowerCase();
      const resolvedItem = await resolvePurchasableItem(itemType, purchase.itemId);
      cards.push(
        buildCard({
          type: "purchase",
          title: safeText(resolvedItem?.title || `${itemType} purchase`, 120),
          subtitle: safeText(purchase.status || "paid", 60),
          description: safeText(
            `${Number(purchase.amount || 0).toLocaleString("en-NG")} ${String(purchase.currency || "NGN").toUpperCase()}`,
            120
          ),
          route:
            resolvedItem?.itemType === "track"
              ? `/tracks/${resolvedItem.itemId}`
              : resolvedItem?.itemType === "book"
                ? `/books/${resolvedItem.itemId}`
                : resolvedItem?.itemType === "album"
                  ? `/albums/${resolvedItem.itemId}`
                  : "/purchases",
          payload: {
            purchaseId: String(purchase._id || ""),
            itemType: purchase.itemType || "",
            itemId: String(purchase.itemId || ""),
          },
        })
      );
    }

    return {
      message:
        purchases.length > 0
          ? `You have ${purchases.length} purchase${purchases.length === 1 ? "" : "s"}.`
          : "You haven't made any purchases yet.",
      actions: [buildAction("/purchases")],
      cards,
      requiresConfirmation: false,
      pendingAction: null,
    };
  },
};

const getQuickLinksTool = {
  name: "getQuickLinks",
  description: "Return shortcuts relevant to the authenticated user and their creator status.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  inputSchema: emptyToolInputSchema,
  handler: async (_args, context) => {
    const userId = context?.user?.id || "";
    const [user, creatorProfile] = await Promise.all([
      User.findById(userId).select("name username").lean(),
      getCreatorProfile(userId),
    ]);

    const cards = [
      buildCard({
        type: "quick-link",
        title: "Home",
        subtitle: "Go back to your feed",
        description: "Open the main Tengacion home screen.",
        route: "/home",
        payload: { destination: "home" },
      }),
      buildCard({
        type: "quick-link",
        title: "Messages",
        subtitle: "Open your inbox",
        description: "Jump to the messenger experience inside Home.",
        route: "/messages",
        payload: { destination: "messages" },
      }),
      buildCard({
        type: "quick-link",
        title: "Notifications",
        subtitle: "See recent activity",
        description: "Open the notifications center.",
        route: "/notifications",
        payload: { destination: "notifications" },
      }),
      buildCard({
        type: "quick-link",
        title: "Purchases",
        subtitle: "View your library",
        description: "Open your purchases and unlocked items.",
        route: "/purchases",
        payload: { destination: "purchases" },
      }),
    ];

    if (creatorIsReady(creatorProfile)) {
      const creatorTypes = Array.isArray(creatorProfile?.creatorTypes)
        ? creatorProfile.creatorTypes.map((entry) => String(entry || "").trim().toLowerCase())
        : [];

      cards.push(
        buildCard({
          type: "quick-link",
          title: "Creator dashboard",
          subtitle: "Manage your creator tools",
          description: "Open the creator dashboard and upload workspace.",
          route: "/creator/dashboard",
          payload: { destination: "creator_dashboard" },
        })
      );

      if (!creatorTypes.length || creatorTypes.includes("music")) {
        cards.push(
          buildCard({
            type: "quick-link",
            title: "Upload music",
            subtitle: "Add a song or release",
            description: "Open the music upload studio.",
            route: "/creator/music/upload",
            payload: { destination: "music_upload" },
          })
        );
      }

      if (!creatorTypes.length || creatorTypes.includes("bookpublishing")) {
        cards.push(
          buildCard({
            type: "quick-link",
            title: "Book publishing",
            subtitle: "Publish a book",
            description: "Open the book publishing workspace.",
            route: "/creator/books",
            payload: { destination: "book_publishing" },
          })
        );
      }

      if (!creatorTypes.length || creatorTypes.includes("podcast")) {
        cards.push(
          buildCard({
            type: "quick-link",
            title: "Upload podcast",
            subtitle: "Add an episode",
            description: "Open the podcast upload studio.",
            route: "/creator/podcasts/upload",
            payload: { destination: "podcast_upload" },
          })
        );
      }
    } else {
      cards.push(
        buildCard({
          type: "quick-link",
          title: "Become a creator",
          subtitle: "Start onboarding",
          description: "Open the creator sign-up flow.",
          route: "/creator",
          payload: { destination: "creator_onboarding" },
        })
      );
    }

    if (user?.username) {
      cards.push(
        buildCard({
          type: "quick-link",
          title: "My profile",
          subtitle: `@${user.username}`,
          description: "Open your public profile.",
          route: `/profile/${user.username}`,
          payload: { destination: "profile" },
        })
      );
    }

    return {
      message: "Here are a few shortcuts based on your account.",
      actions: [],
      cards,
      requiresConfirmation: false,
      pendingAction: null,
    };
  },
};

module.exports = {
  getNotificationsSummaryTool,
  getPurchasesSummaryTool,
  getQuickLinksTool,
};
