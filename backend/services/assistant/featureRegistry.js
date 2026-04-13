const normalizeText = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const FEATURE_REGISTRY = [
  {
    id: "home",
    title: "Home",
    aliases: ["home", "feed", "timeline"],
    surface: "home",
    access: "authenticated",
    route: "/home",
    pathPatterns: [/^\/home\/?$/i],
    description: "Main feed, recommendations, and shortcuts.",
    safeDescription: "Browse the feed and open common features.",
    allowedActions: ["browse feed", "create post", "open messages"],
    quickPrompts: ["What can I do here?", "Open messages", "Find creators"],
  },
  {
    id: "messages",
    title: "Messages",
    aliases: ["messages", "inbox", "chat", "dm"],
    surface: "messages",
    access: "authenticated",
    route: "/messages",
    pathPatterns: [/^\/messages(?:[/?#].*)?$/i],
    description: "Private one-to-one and creator conversations.",
    safeDescription: "Open your inbox and continue chats.",
    allowedActions: ["open chat", "reply", "share"],
    quickPrompts: ["Open my inbox", "How do I message someone?", "Show recent chats"],
  },
  {
    id: "notifications",
    title: "Notifications",
    aliases: ["notifications", "alerts"],
    surface: "notifications",
    access: "authenticated",
    route: "/notifications",
    pathPatterns: [/^\/notifications(?:[/?#].*)?$/i],
    description: "Recent likes, comments, follows, and updates.",
    safeDescription: "Review recent activity and alert preferences.",
    allowedActions: ["mark read", "open item", "change preferences"],
    quickPrompts: ["Open notifications", "What do my alerts mean?", "Turn off some alerts"],
  },
  {
    id: "search",
    title: "Search",
    aliases: ["search", "find", "discover"],
    surface: "search",
    access: "authenticated",
    route: "/search",
    pathPatterns: [/^\/search(?:[/?#].*)?$/i],
    description: "Search users, posts, hashtags, and rooms.",
    safeDescription: "Search Tengacion content and people.",
    allowedActions: ["search users", "search posts", "search hashtags"],
    quickPrompts: ["Search for creators", "Find a post about music", "Show trending hashtags"],
  },
  {
    id: "creator_discovery",
    title: "Find Creators",
    aliases: ["find creators", "creator discovery", "discover creators", "creators"],
    surface: "discovery",
    access: "authenticated",
    route: "/find-creators",
    pathPatterns: [/^\/find-creators(?:[/?#].*)?$/i, /^\/creators(?:[/?#].*)?$/i],
    description: "Browse creators by name, category, and popularity.",
    safeDescription: "Open public creator profiles and hubs.",
    allowedActions: ["search creators", "open creator page", "follow creator"],
    quickPrompts: ["Find gospel creators", "Find book authors", "Find podcast hosts"],
  },
  {
    id: "profile_editor",
    title: "Profile",
    aliases: ["profile", "edit profile", "avatar", "bio", "profile picture"],
    surface: "profile",
    access: "authenticated",
    route: "/profile/:username",
    pathPatterns: [/^\/profile\/[^/?#]+(?:[/?#].*)?$/i],
    description: "Edit your public profile, picture, and bio.",
    safeDescription: "Update your own profile details.",
    allowedActions: ["edit profile", "change avatar", "update bio"],
    quickPrompts: ["How do I change my profile picture?", "How do I edit my bio?", "Open profile editor"],
  },
  {
    id: "creator_onboarding",
    title: "Creator Onboarding",
    aliases: ["become a creator", "creator onboarding", "creator signup"],
    surface: "creator_onboarding",
    access: "authenticated",
    route: "/creator",
    pathPatterns: [/^\/creator\/?$/i, /^\/creator\/register(?:[/?#].*)?$/i],
    description: "Start creator setup and choose your lanes.",
    safeDescription: "Begin creator registration and setup.",
    allowedActions: ["start onboarding", "choose creator types", "finish setup"],
    quickPrompts: ["How do I become a creator?", "Open creator onboarding", "What do I need to finish setup?"],
  },
  {
    id: "creator_dashboard",
    title: "Creator Dashboard",
    aliases: ["creator dashboard", "creator workspace", "creator hub"],
    surface: "creator_dashboard",
    access: "creator",
    route: "/creator/dashboard",
    pathPatterns: [/^\/creator\/dashboard(?:[/?#].*)?$/i],
    description: "Manage uploads, earnings, verification, and support.",
    safeDescription: "Open the creator workspace.",
    allowedActions: ["view analytics", "open uploads", "check earnings"],
    quickPrompts: ["Open my creator dashboard", "Show creator earnings", "What can I do in creator dashboard?"],
  },
  {
    id: "creator_fan_page_view",
    title: "Creator Fan Page Preview",
    aliases: ["fan page view", "creator fan page preview", "preview fan page", "preview creator page"],
    surface: "creator_dashboard",
    access: "creator",
    route: "/creator/fan-page-view",
    pathPatterns: [/^\/creator\/fan-page-view(?:[/?#].*)?$/i],
    description: "Preview the fan-facing creator page before sharing it publicly.",
    safeDescription: "Open the creator fan page preview.",
    allowedActions: ["preview public page", "check fan-facing details"],
    quickPrompts: ["Open my fan page preview", "Preview my creator page", "How do I see the preview?"],
  },
  {
    id: "creator_settings",
    title: "Creator Settings",
    aliases: ["creator settings", "creator preferences", "creator setup"],
    surface: "creator_dashboard",
    access: "creator",
    route: "/creator/settings",
    pathPatterns: [/^\/creator\/settings(?:[/?#].*)?$/i],
    description: "Manage creator-specific settings and publication preferences.",
    safeDescription: "Open creator settings.",
    allowedActions: ["update creator profile", "adjust publishing preferences"],
    quickPrompts: ["Open creator settings", "What can I change in creator settings?", "Update my creator preferences"],
  },
  {
    id: "creator_verification",
    title: "Creator Verification",
    aliases: ["creator verification", "verify creator", "verification"],
    surface: "creator_dashboard",
    access: "creator",
    route: "/creator/verification",
    pathPatterns: [/^\/creator\/verification(?:[/?#].*)?$/i],
    description: "Check the status of your creator verification flow.",
    safeDescription: "Open creator verification.",
    allowedActions: ["view verification status", "submit verification details"],
    quickPrompts: ["Open verification", "How do I verify my creator account?", "What is creator verification?"],
  },
  {
    id: "creator_support",
    title: "Creator Support",
    aliases: ["creator support", "creator help", "creator issue"],
    surface: "creator_dashboard",
    access: "creator",
    route: "/creator/support",
    pathPatterns: [/^\/creator\/support(?:[/?#].*)?$/i],
    description: "Get creator-specific help for uploads, earnings, and policy questions.",
    safeDescription: "Open creator support.",
    allowedActions: ["contact support", "review creator help"],
    quickPrompts: ["Open creator support", "I need help with my creator account", "Where is creator support?"],
  },
  {
    id: "creator_music_upload",
    title: "Music Upload",
    aliases: ["music upload", "upload a song", "upload music", "track upload"],
    surface: "creator_music_upload",
    access: "creator",
    route: "/creator/music/upload",
    pathPatterns: [/^\/creator\/music\/upload(?:[/?#].*)?$/i, /^\/creator\/music\/upload-studio(?:[/?#].*)?$/i],
    description: "Upload a song or release with artwork and metadata.",
    safeDescription: "Open the music upload studio.",
    allowedActions: ["upload song", "set metadata", "choose pricing"],
    quickPrompts: ["Help me upload a song", "Draft a release caption", "What fields do I need for music upload?"],
  },
  {
    id: "creator_books_upload",
    title: "Book Upload",
    aliases: ["book upload", "publish a book", "book publishing", "manuscript upload"],
    surface: "creator_books_upload",
    access: "creator",
    route: "/creator/books/upload",
    pathPatterns: [/^\/creator\/books\/upload(?:[/?#].*)?$/i],
    description: "Upload a digital book with cover and metadata.",
    safeDescription: "Open the book upload studio.",
    allowedActions: ["upload manuscript", "set book metadata", "publish book"],
    quickPrompts: ["Help me upload a book", "Draft a book blurb", "What do I need for book publishing?"],
  },
  {
    id: "creator_podcasts_upload",
    title: "Podcast Upload",
    aliases: ["podcast upload", "upload a podcast", "episode upload"],
    surface: "creator_podcasts_upload",
    access: "creator",
    route: "/creator/podcasts/upload",
    pathPatterns: [/^\/creator\/podcasts\/upload(?:[/?#].*)?$/i],
    description: "Upload a podcast episode with notes and transcript support.",
    safeDescription: "Open the podcast upload studio.",
    allowedActions: ["upload episode", "set show notes", "publish podcast"],
    quickPrompts: ["Help me upload a podcast", "Write a podcast teaser", "What do I need for episode upload?"],
  },
  {
    id: "creator_earnings",
    title: "Earnings",
    aliases: ["earnings", "creator earnings", "income", "revenue"],
    surface: "creator_finance",
    access: "creator",
    route: "/creator/earnings",
    pathPatterns: [/^\/creator\/earnings(?:[/?#].*)?$/i],
    description: "Review your creator earnings snapshot.",
    safeDescription: "Open creator earnings and balances.",
    allowedActions: ["review revenue", "check payout status", "view balances"],
    quickPrompts: ["Show my earnings", "Explain earnings in simple terms", "How do I check my balance?"],
  },
  {
    id: "creator_payouts",
    title: "Payouts",
    aliases: ["payouts", "withdraw earnings", "cash out", "withdraw", "bank"],
    surface: "creator_finance",
    access: "creator",
    route: "/creator/payouts",
    pathPatterns: [/^\/creator\/payouts(?:[/?#].*)?$/i],
    description: "Review payout readiness and withdrawal steps.",
    safeDescription: "Open payout readiness and secure withdrawal support.",
    allowedActions: ["check readiness", "review bank setup", "secure payout flow"],
    quickPrompts: ["How do I withdraw earnings?", "What does payout readiness mean?", "Open payout page"],
  },
  {
    id: "creator_page",
    title: "Public Creator Page",
    aliases: [
      "creator page",
      "creator's page",
      "public creator page",
      "fan page",
      "my creator page",
      "my creator's page",
      "my fan page",
      "my page",
      "public page",
    ],
    surface: "creator_dashboard",
    access: "creator",
    route: "/creator/:creatorId",
    pathPatterns: [/^\/creator\/[^/?#]+(?:[/?#].*)?$/i],
    description: "Open your public creator page where fans can view your profile and content.",
    safeDescription: "Open your public creator page.",
    allowedActions: ["open public page", "share creator page", "view audience-facing profile"],
    quickPrompts: ["Open my creator page", "Open my fan page", "How do I share my creator page?"],
  },
  {
    id: "settings_privacy",
    title: "Privacy Settings",
    aliases: ["privacy settings", "privacy", "visibility"],
    surface: "settings",
    access: "authenticated",
    route: "/settings/privacy",
    pathPatterns: [/^\/settings\/privacy(?:[/?#].*)?$/i],
    description: "Control profile visibility and message access.",
    safeDescription: "Open privacy controls.",
    allowedActions: ["change visibility", "manage message access"],
    quickPrompts: ["How do I change privacy?", "Open privacy settings", "Who can message me?"],
  },
  {
    id: "settings_security",
    title: "Security Settings",
    aliases: ["security settings", "password", "sessions", "security"],
    surface: "settings",
    access: "authenticated",
    route: "/settings/security",
    pathPatterns: [/^\/settings\/security(?:[/?#].*)?$/i],
    description: "Change passwords and review active sessions.",
    safeDescription: "Open security and session controls.",
    allowedActions: ["change password", "revoke sessions"],
    quickPrompts: ["How do I change my password?", "Open security settings", "How do I sign out other devices?"],
  },
  {
    id: "settings_notifications",
    title: "Notification Settings",
    aliases: ["notification settings", "alerts settings", "notification preferences"],
    surface: "settings",
    access: "authenticated",
    route: "/settings/notifications",
    pathPatterns: [/^\/settings\/notifications(?:[/?#].*)?$/i],
    description: "Control notification preferences and delivery.",
    safeDescription: "Open notification settings.",
    allowedActions: ["change alert preferences"],
    quickPrompts: ["Open notification settings", "How do I turn off alerts?", "Change my notification preferences"],
  },
  {
    id: "settings_display",
    title: "Display Settings",
    aliases: ["display settings", "appearance", "theme", "accessibility"],
    surface: "settings",
    access: "authenticated",
    route: "/settings/display",
    pathPatterns: [/^\/settings\/display(?:[/?#].*)?$/i],
    description: "Adjust the visual appearance and accessibility preferences.",
    safeDescription: "Open display settings.",
    allowedActions: ["change theme", "adjust accessibility"],
    quickPrompts: ["Open display settings", "How do I change the theme?", "Adjust my display preferences"],
  },
  {
    id: "settings_sound",
    title: "Sound Settings",
    aliases: ["sound settings", "audio", "volume", "mute"],
    surface: "settings",
    access: "authenticated",
    route: "/settings/sound",
    pathPatterns: [/^\/settings\/sound(?:[/?#].*)?$/i],
    description: "Control audio and playback sounds.",
    safeDescription: "Open sound settings.",
    allowedActions: ["mute sounds", "adjust playback audio"],
    quickPrompts: ["Open sound settings", "How do I mute sounds?", "Adjust audio settings"],
  },
  {
    id: "help_support",
    title: "Help & Support",
    aliases: ["help", "support", "help support", "contact support"],
    surface: "support",
    access: "authenticated",
    route: "/help-support",
    pathPatterns: [/^\/help-support(?:[/?#].*)?$/i],
    description: "Read support guidance and policy references.",
    safeDescription: "Open support guidance and contact paths.",
    allowedActions: ["report a problem", "read policy", "contact support"],
    quickPrompts: ["I need help", "How do I report abuse?", "Where is support?"],
  },
  {
    id: "feedback",
    title: "Feedback",
    aliases: ["feedback", "bug", "idea", "safety"],
    surface: "support",
    access: "authenticated",
    route: "/feedback",
    pathPatterns: [/^\/feedback(?:[/?#].*)?$/i],
    description: "Share a bug report, safety concern, or product idea.",
    safeDescription: "Open the feedback flow.",
    allowedActions: ["submit feedback", "report bug", "report safety issue"],
    quickPrompts: ["I want to report a bug", "I have a safety concern", "I want to suggest a feature"],
  },
  {
    id: "friends",
    title: "Friends",
    aliases: ["friends", "connections", "find friends"],
    surface: "social",
    access: "authenticated",
    route: "/friends",
    pathPatterns: [/^\/friends\/?$/i, /^\/find-friends(?:[/?#].*)?$/i],
    description: "Manage friendships and mutual connections.",
    safeDescription: "Open friends and connection management.",
    allowedActions: ["add friend", "message friend", "view requests"],
    quickPrompts: ["Find friends", "How do I accept a request?", "Open my friends page"],
  },
  {
    id: "groups",
    title: "Groups",
    aliases: ["groups", "communities"],
    surface: "social",
    access: "authenticated",
    route: "/groups",
    pathPatterns: [/^\/groups\/?$/i],
    description: "Browse social groups and community sharing.",
    safeDescription: "Open groups and community sharing.",
    allowedActions: ["open group", "share post", "join discussion"],
    quickPrompts: ["Open groups", "How do I share a post to a group?", "Find active communities"],
  },
  {
    id: "rooms",
    title: "Rooms",
    aliases: ["rooms", "audio rooms"],
    surface: "social",
    access: "authenticated",
    route: "/rooms",
    pathPatterns: [/^\/rooms\/?$/i],
    description: "Create and join community rooms for conversations.",
    safeDescription: "Open room discovery and room chats.",
    allowedActions: ["join room", "create room", "view room feed"],
    quickPrompts: ["Open rooms", "How do I join a room?", "Start a room"],
  },
  {
    id: "saved",
    title: "Saved",
    aliases: ["saved", "bookmarks"],
    surface: "social",
    access: "authenticated",
    route: "/saved",
    pathPatterns: [/^\/saved\/?$/i],
    description: "View content you bookmarked for later.",
    safeDescription: "Open saved items and bookmarks.",
    allowedActions: ["open saved post", "filter bookmarks"],
    quickPrompts: ["Open saved items", "How do I bookmark a post?", "Show my saved posts"],
  },
  {
    id: "memories",
    title: "Memories",
    aliases: ["memories", "on this day"],
    surface: "social",
    access: "authenticated",
    route: "/memories",
    pathPatterns: [/^\/memories\/?$/i],
    description: "Revisit moments from previous years.",
    safeDescription: "Open your personal memories view.",
    allowedActions: ["view memory", "share memory"],
    quickPrompts: ["Open memories", "What are memories?", "Show me this day in previous years"],
  },
  {
    id: "events",
    title: "Events",
    aliases: ["events", "event", "calendar"],
    surface: "social",
    access: "authenticated",
    route: "/events",
    pathPatterns: [/^\/events\/?$/i],
    description: "See upcoming events and event updates.",
    safeDescription: "Open event browsing and event tools.",
    allowedActions: ["open event", "share event"],
    quickPrompts: ["Open events", "Find upcoming events", "How do I post an event?"],
  },
  {
    id: "birthdays",
    title: "Birthdays",
    aliases: ["birthdays", "birthday", "wishes"],
    surface: "social",
    access: "authenticated",
    route: "/birthdays",
    pathPatterns: [/^\/birthdays\/?$/i],
    description: "View birthdays and send celebration messages.",
    safeDescription: "Open birthday reminders and wishes.",
    allowedActions: ["send birthday wish", "view birthdays"],
    quickPrompts: ["Open birthdays", "Write a birthday wish", "How do I celebrate someone?"],
  },
  {
    id: "calculator",
    title: "Calculator",
    aliases: ["calculator", "math", "calculate"],
    surface: "utility",
    access: "authenticated",
    route: "/calculator",
    pathPatterns: [/^\/calculator\/?$/i],
    description: "Quick in-app calculator and reasoning helper.",
    safeDescription: "Open the calculator and math helper.",
    allowedActions: ["calculate", "show steps"],
    quickPrompts: ["Open calculator", "Solve 12 * (8 + 4)", "Explain a math problem step by step"],
  },
  {
    id: "ads_manager",
    title: "Ads Manager",
    aliases: ["ads manager", "ads", "promote"],
    surface: "business",
    access: "authenticated",
    route: "/ads-manager",
    pathPatterns: [/^\/ads-manager\/?$/i],
    description: "Plan and manage promotion workflows.",
    safeDescription: "Open promotion tools.",
    allowedActions: ["open promotion tools", "review campaign setup"],
    quickPrompts: ["Open ads manager", "How do I promote a post?", "Explain promotion options"],
  },
  {
    id: "live",
    title: "Live",
    aliases: ["live", "go live", "watch live", "livestream"],
    surface: "live",
    access: "authenticated",
    route: "/live",
    pathPatterns: [/^\/live(?:[/?#].*)?$/i],
    description: "Discover live sessions and start your own stream.",
    safeDescription: "Open live discovery and streaming tools.",
    allowedActions: ["join live", "start live", "watch live"],
    quickPrompts: ["Open live", "How do I go live?", "Where do I watch live sessions?"],
  },
  {
    id: "live_go_live",
    title: "Go Live",
    aliases: ["go live", "start live", "start streaming"],
    surface: "live",
    access: "authenticated",
    route: "/live/go",
    pathPatterns: [/^\/live\/go(?:[/?#].*)?$/i],
    description: "Start a live room and prepare your stream.",
    safeDescription: "Open the live broadcast setup.",
    allowedActions: ["start stream", "configure stream"],
    quickPrompts: ["How do I go live?", "Open the live setup", "Start a live broadcast"],
  },
  {
    id: "live_watch",
    title: "Watch Live",
    aliases: ["watch live", "live room", "join live session"],
    surface: "live",
    access: "authenticated",
    route: "/live/watch/:roomName",
    pathPatterns: [/^\/live\/watch\/[^/?#]+(?:[/?#].*)?$/i],
    description: "Watch a live room or join an active broadcast.",
    safeDescription: "Open a live broadcast room.",
    allowedActions: ["watch live", "join room"],
    quickPrompts: ["Open live rooms", "Where do I watch a live session?", "Join live"],
  },
  {
    id: "news",
    title: "News",
    aliases: ["news", "world news", "local news"],
    surface: "news",
    access: "authenticated",
    route: "/news",
    pathPatterns: [/^\/news(?:[/?#].*)?$/i],
    description: "Browse Tengacion news, topics, and sources.",
    safeDescription: "Open news feed and topic pages.",
    allowedActions: ["browse topics", "open source page", "save article"],
    quickPrompts: ["Open news", "Show world news", "Find news about Africa"],
  },
  {
    id: "news_topic",
    title: "News Topic",
    aliases: ["news topic", "topic news", "topic page"],
    surface: "news",
    access: "authenticated",
    route: "/news/topic/:slug",
    pathPatterns: [/^\/news\/topic\/[^/?#]+(?:[/?#].*)?$/i],
    description: "Read a news topic page with related stories.",
    safeDescription: "Open a news topic page.",
    allowedActions: ["browse topic stories"],
    quickPrompts: ["Open this news topic", "Show more stories on this topic"],
  },
  {
    id: "news_source",
    title: "News Source",
    aliases: ["news source", "source page", "publisher page"],
    surface: "news",
    access: "authenticated",
    route: "/news/source/:slug",
    pathPatterns: [/^\/news\/source\/[^/?#]+(?:[/?#].*)?$/i],
    description: "Read stories from a specific source or publisher.",
    safeDescription: "Open a news source page.",
    allowedActions: ["browse source stories"],
    quickPrompts: ["Open this source", "Show more from this publisher"],
  },
  {
    id: "trending",
    title: "Trending",
    aliases: ["trending", "popular"],
    surface: "discover",
    access: "authenticated",
    route: "/trending",
    pathPatterns: [/^\/trending\/?$/i],
    description: "See what is currently popular on Tengacion.",
    safeDescription: "Open trending content and popular posts.",
    allowedActions: ["browse trending", "discover posts"],
    quickPrompts: ["Open trending", "What is trending right now?", "Find popular creators"],
  },
  {
    id: "professional_dashboard",
    title: "Professional Dashboard",
    aliases: ["dashboard", "professional dashboard"],
    surface: "business",
    access: "authenticated",
    route: "/dashboard",
    pathPatterns: [/^\/dashboard(?:[/?#].*)?$/i],
    description: "Open the broader professional dashboard for account-level insights.",
    safeDescription: "Open the professional dashboard.",
    allowedActions: ["review dashboard", "open analytics"],
    quickPrompts: ["Open dashboard", "What is on the dashboard?", "Show my professional dashboard"],
  },
  {
    id: "admin_dashboard",
    title: "Admin Dashboard",
    aliases: ["admin", "admin dashboard", "moderation", "audit logs"],
    surface: "admin",
    access: "admin",
    route: "/admin/dashboard",
    pathPatterns: [/^\/admin(?:[/?#].*)?$/i],
    description: "Admin-only moderation, analytics, and operations tools.",
    safeDescription: "Open admin operations for authorized staff only.",
    allowedActions: ["review moderation", "open audit logs", "review analytics"],
    quickPrompts: ["Open admin dashboard", "How do I review moderation?", "Show audit logs"],
  },
];

const SURFACE_FALLBACKS = {
  general: ["home", "messages", "notifications", "find_creators", "search"],
  home: ["home", "messages", "notifications", "find_creators", "search"],
  messages: ["messages", "notifications", "home", "search", "find_creators"],
  notifications: ["notifications", "messages", "home", "search"],
  profile: ["profile_editor", "settings_privacy", "settings_security", "home"],
  creator_onboarding: ["creator_onboarding", "creator_dashboard", "creator_support"],
  creator_dashboard: ["creator_dashboard", "creator_music_upload", "creator_books_upload", "creator_podcasts_upload", "creator_earnings", "creator_payouts"],
  creator_music_upload: ["creator_music_upload", "creator_dashboard"],
  creator_books_upload: ["creator_books_upload", "creator_dashboard"],
  creator_podcasts_upload: ["creator_podcasts_upload", "creator_dashboard"],
  creator_finance: ["creator_earnings", "creator_payouts", "creator_dashboard"],
  settings: ["settings_privacy", "settings_security", "help_support"],
  social: ["friends", "groups", "rooms", "saved", "memories", "events", "birthdays"],
  support: ["help_support", "feedback", "settings_security", "settings_privacy"],
  utility: ["calculator", "search", "home"],
  business: ["ads_manager", "creator_dashboard", "home"],
  live: ["live", "home", "notifications"],
  news: ["news", "trending", "home"],
  discover: ["trending", "creator_discovery", "search"],
  admin: ["admin_dashboard"],
};

const resolveSurfaceFromPath = (path = "") => {
  const route = normalizeText(path);
  if (!route) {
    return "general";
  }

  for (const feature of FEATURE_REGISTRY) {
    if ((feature.pathPatterns || []).some((pattern) => pattern.test(route))) {
      return feature.surface || "general";
    }
  }

  if (route.startsWith("/messages")) return "messages";
  if (route.startsWith("/notifications")) return "notifications";
  if (route.startsWith("/profile/")) return "profile";
  if (route.startsWith("/creator/music/upload")) return "creator_music_upload";
  if (route.startsWith("/creator/books/upload")) return "creator_books_upload";
  if (route.startsWith("/creator/podcasts/upload")) return "creator_podcasts_upload";
  if (route.startsWith("/creator/music")) return "creator_music_upload";
  if (route.startsWith("/creator/books")) return "creator_books_upload";
  if (route.startsWith("/creator/podcasts")) return "creator_podcasts_upload";
  if (route.startsWith("/creator/payouts") || route.startsWith("/creator/earnings")) return "creator_finance";
  if (route.startsWith("/creator/support")) return "support";
  if (route.startsWith("/creator/dashboard")) return "creator_dashboard";
  if (route.startsWith("/creator")) return "creator_onboarding";
  if (route.startsWith("/find-creators") || route.startsWith("/creators")) return "discovery";
  if (route.startsWith("/search")) return "search";
  if (route.startsWith("/settings")) return "settings";
  if (route.startsWith("/friends") || route.startsWith("/groups") || route.startsWith("/rooms") || route.startsWith("/saved") || route.startsWith("/memories") || route.startsWith("/events") || route.startsWith("/birthdays")) {
    return "social";
  }
  if (route.startsWith("/help-support") || route.startsWith("/feedback")) return "support";
  if (route.startsWith("/calculator")) return "utility";
  if (route.startsWith("/ads-manager")) return "business";
  if (route.startsWith("/live")) return "live";
  if (route.startsWith("/news")) return "news";
  if (route.startsWith("/trending")) return "discover";
  if (route.startsWith("/admin")) return "admin";
  return "general";
};

const scoreFeatureMatch = (feature, query) => {
  const needle = normalizeText(query);
  if (!needle) {
    return 0;
  }

  let score = 0;
  for (const alias of feature.aliases || []) {
    const normalizedAlias = normalizeText(alias);
    if (!normalizedAlias) continue;
    if (normalizedAlias === needle) {
      score += 80;
    } else if (normalizedAlias.includes(needle) || needle.includes(normalizedAlias)) {
      score += 42;
    }
  }

  if (normalizeText(feature.title).includes(needle)) score += 25;
  if (normalizeText(feature.description).includes(needle)) score += 12;
  if (normalizeText(feature.safeDescription).includes(needle)) score += 8;
  return score;
};

const canAccessFeature = (feature, access = "authenticated") => {
  const normalizedAccess = String(access || "authenticated").trim().toLowerCase() || "authenticated";
  if (feature?.access === "admin") {
    return normalizedAccess === "admin";
  }
  if (feature?.access === "creator") {
    return normalizedAccess === "creator" || normalizedAccess === "admin";
  }
  return true;
};

const findFeatureById = (featureId = "") =>
  FEATURE_REGISTRY.find((feature) => feature.id === String(featureId || "").trim()) || null;

const findFeatureByRoute = (route = "") => {
  const needle = normalizeText(route);
  if (!needle) {
    return null;
  }

  return (
    FEATURE_REGISTRY.find((feature) => (feature.pathPatterns || []).some((pattern) => pattern.test(needle))) ||
    null
  );
};

const findFeatureByIntent = (query = "", { access = "authenticated" } = {}) => {
  const normalizedAccess = String(access || "authenticated").trim().toLowerCase();
  const scored = FEATURE_REGISTRY.map((feature) => ({
    feature,
    score: scoreFeatureMatch(feature, query),
  }))
    .filter(({ feature, score }) => score > 0 && canAccessFeature(feature, normalizedAccess))
    .sort((left, right) => right.score - left.score);

  return scored[0]?.feature || null;
};

const listVisibleFeatures = ({ surface = "general", access = "authenticated" } = {}) => {
  const normalizedSurface = String(surface || "general").trim().toLowerCase() || "general";
  const normalizedAccess = String(access || "authenticated").trim().toLowerCase();
  const priorityIds = SURFACE_FALLBACKS[normalizedSurface] || SURFACE_FALLBACKS.general;
  const priority = new Map(priorityIds.map((id, index) => [id, index]));

  return FEATURE_REGISTRY.filter((feature) => {
    return canAccessFeature(feature, normalizedAccess);
  })
    .map((feature) => ({
      feature,
      priority: priority.has(feature.id) ? priority.get(feature.id) : 999,
    }))
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }
      return String(left.feature.title).localeCompare(String(right.feature.title));
    })
    .map(({ feature }) => feature);
};

const getSurfaceQuickPrompts = ({ surface = "general", access = "authenticated" } = {}) => {
  const visibleFeatures = listVisibleFeatures({ surface, access });
  const prompts = [];
  const seen = new Set();

  for (const feature of visibleFeatures) {
    for (const prompt of feature.quickPrompts || []) {
      const text = String(prompt || "").trim();
      if (!text) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      prompts.push(text);
      if (prompts.length >= 8) return prompts;
    }
  }

  return prompts;
};

const getSurfaceFeatureSummary = ({ surface = "general", access = "authenticated" } = {}) => {
  const visibleFeatures = listVisibleFeatures({ surface, access });
  return visibleFeatures.slice(0, 8).map((feature) => ({
    id: feature.id,
    title: feature.title,
    route: feature.route,
    surface: feature.surface,
    safeDescription: feature.safeDescription || feature.description || "",
    access: feature.access,
    allowedActions: [...(feature.allowedActions || [])],
  }));
};

const buildFeatureCard = (feature, { route = "", payload = {} } = {}) => ({
  type: "quick-link",
  title: feature.title,
  subtitle: feature.safeDescription || feature.description || "",
  description: feature.description || "",
  route: route || feature.route || "",
  payload: {
    featureId: feature.id,
    ...payload,
  },
});

const SAFE_ACTION_PERMISSIONS = FEATURE_REGISTRY.reduce((acc, feature) => {
  acc[feature.id] = {
    access: feature.access,
    route: feature.route,
    allowedActions: [...(feature.allowedActions || [])],
  };
  return acc;
}, {});

module.exports = {
  FEATURE_REGISTRY,
  buildFeatureCard,
  findFeatureById,
  findFeatureByIntent,
  findFeatureByRoute,
  canAccessFeature,
  SAFE_ACTION_PERMISSIONS,
  getSurfaceFeatureSummary,
  getSurfaceQuickPrompts,
  listVisibleFeatures,
  resolveSurfaceFromPath,
};
