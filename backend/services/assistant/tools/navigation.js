const {
  ASSISTANT_DESTINATIONS,
  emptyToolInputSchema,
  navigateToToolInputSchema,
  openUploadPageToolInputSchema,
} = require("../schemas");
const {
  buildAction,
  buildNavigateResponse,
  getCreatorRouteForDashboard,
  getCreatorPublicPageRoute,
  getCreatorRouteForOnboarding,
  getUploadRoute,
  getUserProfileRoute,
} = require("./shared");

const navigateToTool = {
  name: "navigateTo",
  description: "Route the user to a safe Tengacion page or in-app destination.",
  parameters: {
    type: "object",
    properties: {
      destination: { type: "string", enum: ASSISTANT_DESTINATIONS },
    },
    required: ["destination"],
    additionalProperties: false,
  },
  inputSchema: navigateToToolInputSchema,
  handler: async ({ destination }, context) => {
    const userId = context?.user?.id || "";

    if (destination === "home") {
      return buildNavigateResponse({
        message: "Taking you home.",
        route: "/home",
        label: "Home",
      });
    }

    if (destination === "messages") {
      return buildNavigateResponse({
        message: "Opening your messages.",
        route: "/messages",
        label: "Messages",
      });
    }

    if (destination === "notifications") {
      return buildNavigateResponse({
        message: "Opening notifications.",
        route: "/notifications",
        label: "Notifications",
      });
    }

    if (destination === "profile") {
      const route = await getUserProfileRoute(userId);
      return buildNavigateResponse({
        message: "Opening your profile.",
        route,
        label: "Profile",
      });
    }

    if (destination === "creator_dashboard") {
      const route = await getCreatorRouteForDashboard(userId);
      return buildNavigateResponse({
        message: route === "/creator" ? "Let's finish creator setup first." : "Opening your creator dashboard.",
        route,
        label: "Creator dashboard",
      });
    }

    if (destination === "creator_page") {
      const route = await getCreatorPublicPageRoute(userId);
      return buildNavigateResponse({
        message:
          route === "/creator/register"
            ? "You do not have a public creator page yet. Let's finish creator setup first."
            : "Opening your creator page.",
        route,
        label: "Creator page",
      });
    }

    if (destination === "settings") {
      return buildNavigateResponse({
        message: "Opening settings.",
        route: "/settings",
        label: "Settings",
      });
    }

    if (destination === "book_publishing") {
      const route = await getCreatorRouteForDashboard(userId);
      return buildNavigateResponse({
        message:
          route === "/creator"
            ? "Finish creator setup first, then we'll open book publishing."
            : "Opening book publishing.",
        route: route === "/creator" ? route : "/creator/books",
        label: "Book publishing",
      });
    }

    if (destination === "music_upload") {
      const route = await getUploadRoute(userId, "music");
      return buildNavigateResponse({
        message: route === "/creator" ? "Finish creator setup first, then upload your song." : "Opening music upload.",
        route,
        label: "Music upload",
      });
    }

    if (destination === "podcast_upload") {
      const route = await getUploadRoute(userId, "podcast");
      return buildNavigateResponse({
        message:
          route === "/creator"
            ? "Finish creator setup first, then upload your podcast."
            : "Opening podcast upload.",
        route,
        label: "Podcast upload",
      });
    }

    if (destination === "purchases") {
      return buildNavigateResponse({
        message: "Opening your purchases.",
        route: "/purchases",
        label: "Purchases",
      });
    }

    if (destination === "creator_onboarding") {
      const route = await getCreatorRouteForOnboarding(userId);
      return buildNavigateResponse({
        message: route === "/creator/dashboard" ? "You're already set up as a creator." : "Opening creator onboarding.",
        route,
        label: "Creator onboarding",
      });
    }

    if (destination === "find_creators") {
      return buildNavigateResponse({
        message: "Opening creator discovery.",
        route: "/find-creators",
        label: "Find creators",
      });
    }

    if (destination === "search") {
      return buildNavigateResponse({
        message: "Opening search.",
        route: "/search",
        label: "Search",
      });
    }

    if (destination === "dashboard") {
      return buildNavigateResponse({
        message: "Opening the professional dashboard.",
        route: "/dashboard",
        label: "Dashboard",
      });
    }

    return {
      message: "I can open home, messages, notifications, profile, creator page, creator dashboard, uploads, purchases, settings, search, and discovery.",
      actions: [],
      cards: [],
      requiresConfirmation: false,
      pendingAction: null,
    };
  },
};

const openCreatorOnboardingTool = {
  name: "openCreatorOnboarding",
  description: "Open the creator onboarding or registration flow.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  inputSchema: emptyToolInputSchema,
  handler: async (_args, context) => {
    const userId = context?.user?.id || "";
    const route = await getCreatorRouteForOnboarding(userId);
    return {
      message: route === "/creator/dashboard" ? "You are already set up as a creator." : "Opening creator onboarding.",
      actions: [buildAction(route, {}, "Creator onboarding")],
      cards: [],
      requiresConfirmation: false,
      pendingAction: null,
    };
  },
};

const openCreatorPageTool = {
  name: "openCreatorPage",
  description: "Open the logged-in user's public creator page or creator setup flow.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  inputSchema: emptyToolInputSchema,
  handler: async (_args, context) => {
    const userId = context?.user?.id || "";
    const route = await getCreatorPublicPageRoute(userId);
    return {
      message:
        route === "/creator/register"
          ? "You do not have a public creator page yet. Let's finish creator setup first."
          : "Opening your creator page.",
      actions: [buildAction(route, {}, "Creator page")],
      cards: [],
      requiresConfirmation: false,
      pendingAction: null,
    };
  },
};

const openUploadPageTool = {
  name: "openUploadPage",
  description: "Open the correct upload page for music, books, or podcasts.",
  parameters: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["music", "book", "podcast"] },
    },
    required: ["type"],
    additionalProperties: false,
  },
  inputSchema: openUploadPageToolInputSchema,
  handler: async ({ type }, context) => {
    const userId = context?.user?.id || "";
    const route = await getUploadRoute(userId, type);
    const label = type === "book" ? "Book upload" : type === "podcast" ? "Podcast upload" : "Music upload";
    return {
      message:
        route === "/creator"
          ? "Finish creator setup first, then we'll open the upload page."
          : `Opening ${label.toLowerCase()}.`,
      actions: [buildAction(route, {}, label)],
      cards: [],
      requiresConfirmation: false,
      pendingAction: null,
    };
  },
};

module.exports = {
  navigateToTool,
  openCreatorOnboardingTool,
  openCreatorPageTool,
  openUploadPageTool,
};
