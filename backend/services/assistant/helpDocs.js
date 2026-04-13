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
