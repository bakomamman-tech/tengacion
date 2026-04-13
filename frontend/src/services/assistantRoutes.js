const SAFE_ASSISTANT_ROUTE_PATTERNS = [
  /^\/home\/?$/i,
  /^\/messages(?:[/?#].*)?$/i,
  /^\/notifications(?:[/?#].*)?$/i,
  /^\/search(?:[/?#].*)?$/i,
  /^\/find-creators(?:[/?#].*)?$/i,
  /^\/creators(?:[/?#].*)?$/i,
  /^\/purchases(?:[/?#].*)?$/i,
  /^\/dashboard(?:[/?#].*)?$/i,
  /^\/settings(?:[/?#].*)?$/i,
  /^\/settings\/privacy(?:[/?#].*)?$/i,
  /^\/settings\/security(?:[/?#].*)?$/i,
  /^\/settings\/notifications(?:[/?#].*)?$/i,
  /^\/settings\/display(?:[/?#].*)?$/i,
  /^\/settings\/sound(?:[/?#].*)?$/i,
  /^\/help-support(?:[/?#].*)?$/i,
  /^\/feedback(?:[/?#].*)?$/i,
  /^\/friends(?:[/?#].*)?$/i,
  /^\/groups(?:[/?#].*)?$/i,
  /^\/rooms(?:[/?#].*)?$/i,
  /^\/saved(?:[/?#].*)?$/i,
  /^\/memories(?:[/?#].*)?$/i,
  /^\/events(?:[/?#].*)?$/i,
  /^\/birthdays(?:[/?#].*)?$/i,
  /^\/calculator(?:[/?#].*)?$/i,
  /^\/ads-manager(?:[/?#].*)?$/i,
  /^\/live(?:[/?#].*)?$/i,
  /^\/news(?:[/?#].*)?$/i,
  /^\/trending(?:[/?#].*)?$/i,
  /^\/reels(?:[/?#].*)?$/i,
  /^\/posts\/[^/?#]+(?:[/?#].*)?$/i,
  /^\/tracks\/[^/?#]+(?:[/?#].*)?$/i,
  /^\/books\/[^/?#]+(?:[/?#].*)?$/i,
  /^\/albums\/[^/?#]+(?:[/?#].*)?$/i,
  /^\/profile\/[^/?#]+(?:[/?#].*)?$/i,
  /^\/creator(?:[/?#].*)?$/i,
  /^\/creator\/register(?:[/?#].*)?$/i,
  /^\/creator\/dashboard(?:[/?#].*)?$/i,
  /^\/creator\/categories(?:[/?#].*)?$/i,
  /^\/creator\/music(?:[/?#].*)?$/i,
  /^\/creator\/music\/upload(?:[/?#].*)?$/i,
  /^\/creator\/books(?:[/?#].*)?$/i,
  /^\/creator\/books\/upload(?:[/?#].*)?$/i,
  /^\/creator\/podcasts(?:[/?#].*)?$/i,
  /^\/creator\/podcasts\/upload(?:[/?#].*)?$/i,
  /^\/creator\/earnings(?:[/?#].*)?$/i,
  /^\/creator\/payouts(?:[/?#].*)?$/i,
  /^\/creator\/settings(?:[/?#].*)?$/i,
  /^\/creator\/verification(?:[/?#].*)?$/i,
  /^\/creator\/support(?:[/?#].*)?$/i,
  /^\/creator\/fan-page-view(?:[/?#].*)?$/i,
  /^\/admin(?:[/?#].*)?$/i,
];

const isSafeAssistantRoute = (target = "") => {
  const route = String(target || "").trim();
  if (!route.startsWith("/")) {
    return false;
  }

  if (route.includes("://") || route.includes("\\") || route.includes("..")) {
    return false;
  }

  return SAFE_ASSISTANT_ROUTE_PATTERNS.some((pattern) => pattern.test(route));
};

const resolveAssistantSurface = (pathname = "") => {
  const route = String(pathname || "").trim().toLowerCase();
  if (!route) {return "general";}
  if (route.startsWith("/home")) {return "home";}
  if (route.startsWith("/messages")) {return "messages";}
  if (route.startsWith("/notifications")) {return "notifications";}
  if (route.startsWith("/profile/")) {return "profile";}
  if (route.startsWith("/creator/music/upload")) {return "creator_music_upload";}
  if (route.startsWith("/creator/books/upload")) {return "creator_books_upload";}
  if (route.startsWith("/creator/podcasts/upload")) {return "creator_podcasts_upload";}
  if (route.startsWith("/creator/earnings") || route.startsWith("/creator/payouts")) {return "creator_finance";}
  if (route.startsWith("/creator/dashboard")) {return "creator_dashboard";}
  if (
    /^\/creator\/[^/?#]+(?:[/?#].*)?$/i.test(route) &&
    !route.startsWith("/creator/register") &&
    !route.startsWith("/creator/dashboard") &&
    !route.startsWith("/creator/categories") &&
    !route.startsWith("/creator/music") &&
    !route.startsWith("/creator/books") &&
    !route.startsWith("/creator/podcasts") &&
    !route.startsWith("/creator/earnings") &&
    !route.startsWith("/creator/payouts") &&
    !route.startsWith("/creator/settings") &&
    !route.startsWith("/creator/verification") &&
    !route.startsWith("/creator/support") &&
    !route.startsWith("/creator/fan-page-view")
  ) {
    return "creator_page";
  }
  if (route.startsWith("/creator")) {return "creator";}
  if (route.startsWith("/find-creators") || route.startsWith("/creators")) {return "discovery";}
  if (route.startsWith("/search")) {return "search";}
  if (route.startsWith("/purchases")) {return "purchases";}
  if (route.startsWith("/settings")) {return "settings";}
  if (route.startsWith("/help-support") || route.startsWith("/feedback")) {return "support";}
  if (route.startsWith("/friends") || route.startsWith("/groups") || route.startsWith("/rooms") || route.startsWith("/saved") || route.startsWith("/memories") || route.startsWith("/events") || route.startsWith("/birthdays")) {
    return "social";
  }
  if (route.startsWith("/calculator")) {return "utility";}
  if (route.startsWith("/ads-manager")) {return "business";}
  if (route.startsWith("/live")) {return "live";}
  if (route.startsWith("/news")) {return "news";}
  if (route.startsWith("/trending") || route.startsWith("/reels")) {return "discover";}
  if (route.startsWith("/admin")) {return "admin";}
  return "general";
};

const resolveAssistantPageTitle = (pathname = "") => {
  const surface = resolveAssistantSurface(pathname);
  const map = {
    home: "Home",
    messages: "Messages",
    notifications: "Notifications",
    profile: "Profile",
    creator: "Creator workspace",
    creator_page: "Creator page",
    creator_dashboard: "Creator dashboard",
    creator_finance: "Creator finance",
    discovery: "Creator discovery",
    search: "Search",
    purchases: "Purchases",
    settings: "Settings",
    support: "Support",
    social: "Social",
    utility: "Calculator",
    business: "Ads manager",
    live: "Live",
    news: "News",
    discover: "Trending",
    admin: "Admin",
  };
  return map[surface] || "Tengacion";
};

const getAssistantSuggestions = (pathname = "") => {
  const surface = resolveAssistantSurface(pathname);
  const suggestionsBySurface = {
    home: ["What can I do here?", "Open messages", "Find creators", "Open settings"],
    messages: ["How do I message someone?", "Show recent chats", "Open notifications", "Take me home"],
    notifications: ["What do these alerts mean?", "Open messages", "Open settings", "Go home"],
    profile: ["How do I edit my bio?", "How do I change my photo?", "Show profile settings", "Open home"],
    creator: ["How do I become a creator?", "Open creator onboarding", "What can I do as a creator?", "Find my dashboard"],
    creator_page: ["Open my creator page", "Preview my fan page", "Share my creator page", "Open creator dashboard"],
    creator_dashboard: ["Open creator earnings", "Upload a song", "Publish a book", "Upload a podcast"],
    creator_finance: ["How do I withdraw earnings?", "Show payout readiness", "Open creator support", "Open earnings"],
    creator_music_upload: ["Draft a release caption", "What fields do I need?", "Write a song promo", "Open creator dashboard"],
    creator_books_upload: ["Draft a book blurb", "What do I need to publish?", "Write a launch post", "Open creator dashboard"],
    creator_podcasts_upload: ["Write a podcast teaser", "What do I need to upload?", "Summarize an episode", "Open creator dashboard"],
    discovery: ["Find gospel artists", "Find book authors", "Find podcast hosts", "Open search"],
    search: ["Search for creators", "Find a post", "Search books", "Find trending content"],
    purchases: ["What did I buy?", "Open a song I purchased", "Open a book I purchased", "Open home"],
    settings: ["Open privacy settings", "Open security settings", "Change notifications", "Adjust display"],
    support: ["How do I report abuse?", "I need help", "Send feedback", "Open privacy settings"],
    social: ["Open friends", "Open groups", "Open rooms", "Show memories"],
    utility: ["Solve 12 * (8 + 4)", "Explain percentages", "Check my answer", "Open home"],
    business: ["Open the dashboard", "What is ads manager?", "How do I promote a post?", "Open creator dashboard"],
    live: ["How do I go live?", "Open live rooms", "Join a live session", "Open home"],
    news: ["Open world news", "Find African news", "Show a news topic", "Open trending"],
    discover: ["What is trending now?", "Find popular creators", "Open reels", "Open news"],
    admin: ["Open admin dashboard", "Show audit logs", "Review moderation", "Open home"],
  };

  return suggestionsBySurface[surface] || ["What can Akuso do here?", "Open home", "Find creators", "Help me write a caption"];
};

const buildAssistantContext = (location = {}) => {
  const currentPath = String(location.pathname || "").trim();
  const currentSearch = String(location.search || "").trim();
  const surface = resolveAssistantSurface(currentPath);
  const searchParams = new URLSearchParams(currentSearch);
  const selectedChatId = surface === "messages" ? String(searchParams.get("chat") || "").trim() : "";

  return {
    currentPath,
    currentSearch,
    surface,
    pageTitle: resolveAssistantPageTitle(currentPath),
    selectedChatId,
    selectedContentId: "",
  };
};

export {
  SAFE_ASSISTANT_ROUTE_PATTERNS,
  buildAssistantContext,
  getAssistantSuggestions,
  isSafeAssistantRoute,
  resolveAssistantPageTitle,
  resolveAssistantSurface,
};
