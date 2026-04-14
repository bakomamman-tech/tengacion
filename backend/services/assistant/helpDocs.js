const { FEATURE_REGISTRY, findFeatureByIntent, listVisibleFeatures } = require("./featureRegistry");

const normalizeText = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const HELP_ARTICLES = [
  {
    id: "upload-music",
    title: "How to upload a song",
    summary: "Open the music upload studio, add your track details, and publish when it is ready.",
    featureId: "creator_music_upload",
    route: "/creator/music/upload",
    keywords: ["music", "song", "track", "release", "upload"],
    steps: [
      "Open the music upload studio from the creator dashboard.",
      "Add your title, artwork, audio file, description, and pricing details.",
      "Review the preview carefully, then publish when everything is correct.",
    ],
  },
  {
    id: "publish-book",
    title: "How to publish a book",
    summary: "Open the book upload studio and add your manuscript, cover, and metadata.",
    featureId: "creator_books_upload",
    route: "/creator/books/upload",
    keywords: ["book", "books", "publish", "manuscript", "author"],
    steps: [
      "Open the book publishing workspace.",
      "Upload your manuscript and cover artwork.",
      "Complete the metadata fields and publish once the draft is final.",
    ],
  },
  {
    id: "upload-podcast",
    title: "How to upload a podcast",
    summary: "Use the podcast upload studio for episodes, artwork, notes, and transcript support.",
    featureId: "creator_podcasts_upload",
    route: "/creator/podcasts/upload",
    keywords: ["podcast", "episode", "show notes", "upload"],
    steps: [
      "Open the podcast upload studio.",
      "Add the episode media, title, show notes, and transcript if you have one.",
      "Review the details and publish only when you are satisfied with the preview.",
    ],
  },
  {
    id: "become-creator",
    title: "How to become a creator",
    summary: "Start creator onboarding, choose your content lanes, and finish your creator profile.",
    featureId: "creator_onboarding",
    route: "/creator",
    keywords: ["creator", "become a creator", "creator onboarding", "signup"],
    steps: [
      "Open creator onboarding from your navigation or ask Akuso to take you there.",
      "Complete the registration flow and select the lanes you want to publish in.",
      "Finish your setup so the dashboard and upload studios become available.",
    ],
  },
  {
    id: "creator-categories",
    title: "How to manage creator categories",
    summary: "Open Creator Categories to enable the lanes you want on your profile, save them, and jump into each upload workspace.",
    featureId: "creator_categories",
    route: "/creator/categories",
    keywords: ["creator categories", "creator lanes", "content categories", "creator types"],
    steps: [
      "Open Creator Categories from the creator workspace.",
      "Select the lanes you want active on your profile and save the category selection.",
      "Use the lane cards to open the related workspace or upload page after the change is saved.",
    ],
  },
  {
    id: "creator-music-workspace",
    title: "How to manage your music catalog",
    summary: "Use the music workspace to review tracks, albums, and videos, then edit metadata or jump into the upload studio.",
    featureId: "creator_music_workspace",
    route: "/creator/music",
    keywords: ["music workspace", "music catalog", "edit track", "album metadata", "music video"],
    steps: [
      "Open the creator music workspace to see published and draft releases.",
      "Choose the release you want to update and edit the metadata fields shown on the page.",
      "Use the dedicated music upload page when you want to add a new track, album, or video.",
    ],
  },
  {
    id: "creator-books-workspace",
    title: "How to manage your book catalog",
    summary: "Use the books workspace to review draft and published books, then update metadata or open the upload page for a new title.",
    featureId: "creator_books_workspace",
    route: "/creator/books",
    keywords: ["books workspace", "book catalog", "edit book metadata", "published books"],
    steps: [
      "Open the creator books workspace to review your current titles.",
      "Pick a book entry and update the cover, file, price, or metadata fields as needed.",
      "Open the dedicated book upload page when you want to publish a new manuscript.",
    ],
  },
  {
    id: "creator-podcasts-workspace",
    title: "How to manage your podcast episodes",
    summary: "Use the podcasts workspace to review episodes, update metadata, and jump to the upload page for new releases.",
    featureId: "creator_podcasts_workspace",
    route: "/creator/podcasts",
    keywords: ["podcast workspace", "podcast catalog", "edit episode", "manage podcast episodes"],
    steps: [
      "Open the creator podcasts workspace to view your episode list and series overview.",
      "Choose an episode to edit its title, notes, files, and publishing status.",
      "Open the dedicated podcast upload page when you want to add a new episode.",
    ],
  },
  {
    id: "creator-subscription",
    title: "How to subscribe to a creator",
    summary: "Open the creator membership page, review the monthly benefits, and continue through the built-in secure checkout.",
    featureId: "creator_subscription",
    route: "/creators/:creatorId/subscribe",
    keywords: ["subscribe to creator", "creator membership", "fan pass", "creator subscription"],
    steps: [
      "Open the creator membership page from the public creator profile.",
      "Review the supporter benefits, monthly price, and what content the membership unlocks.",
      "Use the built-in secure checkout flow to start the subscription; Akuso will not process payment directly.",
    ],
  },
  {
    id: "find-creators",
    title: "How to find creators",
    summary: "Use discovery or search to find creators by name, genre, category, or handle.",
    featureId: "creator_discovery",
    route: "/find-creators",
    keywords: ["creator", "creators", "find", "discover", "artist", "author", "podcaster"],
    steps: [
      "Open creator discovery or search.",
      "Search by name, genre, category, or @handle.",
      "Open the public creator page when you find the person you want.",
    ],
  },
  {
    id: "settings-hub",
    title: "How to use the settings hub",
    summary: "Open Settings to review privacy, security, notifications, display, and sound controls from one place.",
    featureId: "settings_hub",
    route: "/settings",
    keywords: ["settings", "settings hub", "account settings", "privacy hub"],
    steps: [
      "Open the Settings hub from the app navigation.",
      "Review the account overview cards to see your current privacy, audio, and theme choices.",
      "Open the specific settings page you need for security, privacy, notifications, display, or sound.",
    ],
  },
  {
    id: "profile-edit",
    title: "How to edit your profile",
    summary: "Open your profile editor to update your picture, bio, and public details.",
    featureId: "profile_editor",
    route: "/profile/:username",
    keywords: ["profile", "picture", "avatar", "bio", "edit profile"],
    steps: [
      "Open your own profile page.",
      "Update your avatar, bio, and other public details.",
      "Save the changes and refresh the profile if needed.",
    ],
  },
  {
    id: "notifications",
    title: "How to manage notifications",
    summary: "Open Notifications to review recent activity, mark items as read, and jump into the related page or message.",
    featureId: "notifications",
    route: "/notifications",
    keywords: ["notifications", "alerts", "mentions", "messages", "mark as read"],
    steps: [
      "Open Notifications to review recent mentions, messages, follows, and other activity.",
      "Use the notification rows to open the related post, message, or profile directly.",
      "Open Notification settings if you want to change which alerts are delivered to you.",
    ],
  },
  {
    id: "report-abuse",
    title: "How to report abuse",
    summary: "Use the feedback and support flow to report harmful content, scams, or safety issues.",
    featureId: "feedback",
    route: "/feedback?type=safety",
    keywords: ["report", "abuse", "safety", "harassment", "scam"],
    steps: [
      "Open Help & Support or the feedback flow.",
      "Choose a safety concern or bug report.",
      "Describe the issue briefly and include enough detail for the support team to review it safely.",
    ],
  },
  {
    id: "privacy",
    title: "How to change privacy settings",
    summary: "Open privacy settings to control visibility and message permissions.",
    featureId: "settings_privacy",
    route: "/settings/privacy",
    keywords: ["privacy", "visibility", "settings", "messages"],
    steps: [
      "Open Settings.",
      "Choose Privacy settings.",
      "Update profile visibility, message permissions, and list controls as needed.",
    ],
  },
  {
    id: "security",
    title: "How to improve account security",
    summary: "Use security settings to review sessions, passwords, and sign-in protection.",
    featureId: "settings_security",
    route: "/settings/security",
    keywords: ["security", "password", "session", "account"],
    steps: [
      "Open Security settings.",
      "Review active sessions and sign out anything unfamiliar.",
      "Change your password if anything feels suspicious.",
    ],
  },
  {
    id: "friends-hub",
    title: "How to use the friends hub",
    summary: "Open Friends to review requests, suggestions, close-friends lists, birthdays, and your current network.",
    featureId: "friends",
    route: "/friends",
    keywords: ["friends hub", "friend requests", "close friends", "people you may know"],
    steps: [
      "Open the Friends page to see requests, suggestions, birthdays, and custom lists.",
      "Use the request actions to accept, reject, or cancel pending connections.",
      "Open a profile or message thread directly from the Friends hub when you want to continue the conversation.",
    ],
  },
  {
    id: "buy-content",
    title: "How to buy creator content",
    summary: "Open the item page, review the details, and finish checkout through the secure flow.",
    featureId: "purchases",
    route: "/purchases",
    keywords: ["buy", "purchase", "payment", "content", "book", "song", "album"],
    steps: [
      "Open the content page or your purchases area.",
      "Review the item carefully before you pay.",
      "Complete checkout through the secure payment flow only.",
    ],
  },
  {
    id: "go-live",
    title: "How to go live",
    summary: "Open the live setup page, review your quota and stream controls, then start the broadcast when your camera and microphone are ready.",
    featureId: "live_go_live",
    route: "/live/go",
    keywords: ["go live", "start live", "start streaming", "live quota", "broadcast"],
    steps: [
      "Open the Go Live page and review the current live quota and any active session state.",
      "Prepare the stream title, camera, microphone, and chat controls before you begin.",
      "Start the live broadcast through the built-in streaming flow and stop it from the same controls when you are done.",
    ],
  },
  {
    id: "news-feed",
    title: "How to use Tengacion News",
    summary: "Open News to browse rights-aware stories, switch tabs, save items, follow sources, and open the original reporting.",
    featureId: "news",
    route: "/news",
    keywords: ["news", "news tabs", "save article", "follow source", "world news"],
    steps: [
      "Open the News page and switch between the available tabs such as For You, Local, Nigeria, and World.",
      "Open a story or cluster card to see more context and source information.",
      "Use the built-in controls to save articles, follow sources, share items, or report a problem with a story.",
    ],
  },
  {
    id: "withdraw-earnings",
    title: "How to review earnings and payouts",
    summary: "Open earnings and payout pages to review readiness, then use the secure withdrawal flow.",
    featureId: "creator_payouts",
    route: "/creator/payouts",
    keywords: ["withdraw", "earnings", "payout", "bank", "money"],
    steps: [
      "Open the creator earnings or payouts page.",
      "Review payout readiness and secure account details.",
      "Use only the built-in withdrawal flow; Akuso will not move money directly.",
    ],
  },
  {
    id: "onboarding",
    title: "How to finish onboarding",
    summary: "Open Onboarding to review your remaining setup steps before you continue into the main Tengacion experience.",
    featureId: "onboarding",
    route: "/onboarding",
    keywords: ["onboarding", "finish setup", "account setup", "welcome setup"],
    steps: [
      "Open the onboarding flow from your account navigation or a guided prompt.",
      "Review the remaining setup steps and complete anything still required for your account.",
      "Continue into the main app once the onboarding flow confirms your setup is complete.",
    ],
  },
];

const scoreHelpArticle = (article, query) => {
  const needle = normalizeText(query);
  if (!needle) {
    return 0;
  }

  let score = 0;
  const searchable = [
    article.title,
    article.summary,
    ...(article.keywords || []),
    ...(article.steps || []),
  ]
    .map((entry) => normalizeText(entry))
    .join(" | ");

  if (searchable.includes(needle)) {
    score += 60;
  }

  for (const keyword of article.keywords || []) {
    const normalized = normalizeText(keyword);
    if (!normalized) continue;
    if (needle === normalized) {
      score += 30;
    } else if (needle.includes(normalized) || normalized.includes(needle)) {
      score += 14;
    }
  }

  if (normalizeText(article.title).includes(needle)) {
    score += 18;
  }
  if (normalizeText(article.summary).includes(needle)) {
    score += 10;
  }

  return score;
};

const searchHelpArticles = (query = "", { limit = 4 } = {}) => {
  const scored = HELP_ARTICLES.map((article) => ({
    article,
    score: scoreHelpArticle(article, query),
  }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);

  return scored.slice(0, limit).map(({ article }) => ({
    id: article.id,
    title: article.title,
    summary: article.summary,
    route: article.route,
    feature: article.featureId ? FEATURE_REGISTRY.find((feature) => feature.id === article.featureId) || null : null,
    steps: [...(article.steps || [])],
  }));
};

const getHelpArticleByFeatureId = (featureId = "") =>
  HELP_ARTICLES.find((article) => article.featureId === String(featureId || "").trim()) || null;

const getHelpPrompts = ({ featureId = "", surface = "general" } = {}) => {
  const article = getHelpArticleByFeatureId(featureId);
  if (article) {
    return [
      `How do I use ${article.title.toLowerCase()}?`,
      `What should I do first on ${article.title.toLowerCase()}?`,
      `Show me the steps for ${article.title.toLowerCase()}`,
    ];
  }

  const visible = listVisibleFeatures({ surface, access: "authenticated" });
  const match = visible[0] || findFeatureByIntent(surface);
  if (match) {
    return [
      `How do I use ${match.title.toLowerCase()}?`,
      `What can I do on ${match.title.toLowerCase()}?`,
      `Open ${match.title.toLowerCase()}`,
    ];
  }

  return [];
};

module.exports = {
  HELP_ARTICLES,
  getHelpArticleByFeatureId,
  getHelpPrompts,
  searchHelpArticles,
};
