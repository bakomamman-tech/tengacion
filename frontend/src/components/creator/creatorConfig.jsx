export const CREATOR_CATEGORY_CONFIG = {
  music: {
    key: "music",
    title: "Music",
    shortTitle: "Music",
    description: "Publish music releases from a focused audio-first studio built for artwork, metadata, drafts, and launch-ready pricing.",
    route: "/creator/music",
    uploadRoute: "/creator/music/upload",
    uploadTitle: "Music Uploads",
    uploadDescription: "Upload music only with track metadata, cover art, full audio, optional previews, and release-ready controls.",
    uploadButtonLabel: "Music Uploads",
    dashboardKey: "music",
    metricLabel: "releases",
    accent: "var(--creator-accent-music)",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 4.4v10.2a3.6 3.6 0 1 1-1.5-2.9V7.6l-6 1.3v7.1a3.6 3.6 0 1 1-1.5-2.9V7l9-2.6Z" />
      </svg>
    ),
  },
  bookPublishing: {
    key: "bookPublishing",
    title: "Book Publishing",
    shortTitle: "Book Publishing",
    description: "Publish digital books from a dedicated manuscript studio with elegant metadata, pricing, and supported file formats.",
    route: "/creator/books",
    uploadRoute: "/creator/books/upload",
    uploadTitle: "Book Publishing Uploads",
    uploadDescription: "Upload books only with manuscript files, author metadata, cover art, pricing, and language details.",
    uploadButtonLabel: "Book Publishing Uploads",
    dashboardKey: "bookPublishing",
    metricLabel: "titles",
    accent: "var(--creator-accent-books)",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17.5a2.5 2.5 0 0 0-2.5-2.5H5V4.5Zm2.5-1A1 1 0 0 0 6.5 4.5V15h10a3.9 3.9 0 0 1 1 .1V3.5H7.5Zm9 15H7.1a1.6 1.6 0 0 0 0 3.2h11.4v-3.2h-2Z" />
      </svg>
    ),
  },
  podcast: {
    key: "podcast",
    title: "Podcast",
    shortTitle: "Podcast",
    description: "Publish podcast episodes from a dedicated spoken-word studio with seasons, series identity, audio or video uploads, premium gating, and transcripts.",
    route: "/creator/podcasts",
    uploadRoute: "/creator/podcasts/upload",
    uploadTitle: "Podcast Uploads",
    uploadDescription: "Upload podcast episodes only with series metadata, audio or video media, previews, transcripts, and clean premium controls.",
    uploadButtonLabel: "Podcast Uploads",
    dashboardKey: "podcast",
    metricLabel: "episodes",
    accent: "var(--creator-accent-podcasts)",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.2a6.8 6.8 0 0 0-6.8 6.8c0 2 1 3.9 2.5 5l1.1-1.4a4.9 4.9 0 1 1 6.4 0l1.1 1.4a6.8 6.8 0 0 0-4.3-11.8Zm0 4.1A2.7 2.7 0 0 0 9.3 10c0 1 .6 2 1.5 2.5V16a1.2 1.2 0 1 0 2.4 0v-3.5c.9-.5 1.5-1.5 1.5-2.5A2.7 2.7 0 0 0 12 7.3Zm-5.7 9.4A9.7 9.7 0 0 1 3.5 10h1.8a8 8 0 0 0 2.3 5.6l-1.3 1.1Zm11.4 0-1.3-1.1A8 8 0 0 0 18.7 10h1.8a9.7 9.7 0 0 1-2.8 6.7Z" />
      </svg>
    ),
  },
};

export const CREATOR_CATEGORY_ORDER = ["music", "bookPublishing", "podcast"];

export const normalizeCreatorLaneKey = (value = "") => {
  const compact = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  if (!compact) {
    return "";
  }
  if (compact === "music" || compact === "songs" || compact === "audio") {
    return "music";
  }
  if (compact === "book" || compact === "books" || compact === "bookpublishing" || compact === "publishing") {
    return "bookPublishing";
  }
  if (compact === "podcast" || compact === "podcasts") {
    return "podcast";
  }
  return "";
};

export const normalizeCreatorLaneKeys = (values = []) => {
  const list = Array.isArray(values) ? values : [values];
  return [...new Set(
    list
      .map((entry) => normalizeCreatorLaneKey(entry))
      .filter((entry) => CREATOR_CATEGORY_ORDER.includes(entry))
  )];
};

export const formatCreatorLaneLabel = (value = "") => {
  const normalized = normalizeCreatorLaneKey(value);
  return CREATOR_CATEGORY_CONFIG[normalized]?.title || "";
};

export const CREATOR_STATIC_NAV = [
  { key: "dashboard", label: "Overview", route: "/creator/dashboard" },
  { key: "earnings", label: "Earnings", route: "/creator/earnings" },
  { key: "payouts", label: "Payouts", route: "/creator/payouts" },
  { key: "settings", label: "Account Settings", route: "/creator/settings" },
  { key: "verification", label: "Copyright & Verification", route: "/creator/verification" },
  { key: "support", label: "Support", route: "/creator/support" },
];

export const formatCurrency = (value = 0) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export const formatShortDate = (value) => {
  if (!value) {
    return "Just now";
  }
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "Just now";
  }
};

export const getStatusTone = (status = "") => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "active" || normalized === "published" || normalized === "passed") {
    return "success";
  }
  if (normalized === "flagged" || normalized === "under_review" || normalized === "pending_review") {
    return "warning";
  }
  if (normalized === "blocked" || normalized === "restricted") {
    return "danger";
  }
  return "neutral";
};
