const mongoose = require("mongoose");

const Album = require("../../models/Album");
const Book = require("../../models/Book");
const CreatorProfile = require("../../models/CreatorProfile");
const MarketplaceProduct = require("../../models/MarketplaceProduct");
const MarketplaceSeller = require("../../models/MarketplaceSeller");
const Post = require("../../models/Post");
const Track = require("../../models/Track");
const Video = require("../../models/Video");
const {
  normalizePublicText,
  uniquePublicActivity,
} = require("../../utils/publicText");
const { findCreatorProfileByReference } = require("../creatorLookupService");
const {
  PRIVATE_CREATOR_ALIAS_SEGMENTS,
  buildCreatorIdPath,
  buildCreatorPublicPath,
  normalizeCreatorUsername,
} = require("../publicRouteService");
const {
  DEFAULT_DESCRIPTION,
  DEFAULT_IMAGE_ALT,
  DEFAULT_IMAGE_PATH,
  DEFAULT_OG_TYPE,
  DEFAULT_TITLE,
  DEFAULT_TWITTER_CARD,
  SITE_NAME,
  SITE_URL,
  normalizePathname,
  toAbsoluteUrl,
  toCanonicalUrl,
} = require("./siteSeo");

const ACTIVE_TRACK_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_BOOK_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_ALBUM_FILTER = { status: "published", isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_VIDEO_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_MARKETPLACE_PRODUCT_FILTER = {
  isPublished: true,
  isHidden: false,
  moderationStatus: "approved",
};
const ACTIVE_MARKETPLACE_SELLER_FILTER = {
  status: "approved",
  isActive: true,
};
const ACTIVE_PUBLIC_POST_FILTER = {
  privacy: "public",
  visibility: "public",
  audience: { $in: ["public", null] },
  moderationStatus: { $in: ["approved", "ALLOW"] },
  sensitiveContent: { $ne: true },
  reviewRequired: { $ne: true },
};
const CATEGORY_PREVIEW_LIMIT = 8;
const HOME_TITLE = "Tengacion | Africa's Social Commerce & Creator Monetization Platform";
const HOME_DESCRIPTION =
  "Create, connect, sell, stream, and earn on Tengacion, Africa's social commerce and creator monetization platform.";

const PUBLIC_INFO_PAGES = {
  "/creators": {
    title: "Find African Musicians, Authors, Podcasters & Digital Creators | Tengacion",
    description:
      "Find African musicians, authors, podcasters, educators, performers, and digital creators. Explore public profiles and support their work on Tengacion.",
    canonicalPath: "/creators",
    previewTitle: "Find creators on Tengacion",
    previewDescription:
      "Discover music artists, authors, and creators across Tengacion.",
  },
  "/music": {
    title: "Discover African Gospel, Afrobeat & Independent Music Creators | Tengacion",
    description:
      "Discover African gospel, Afrobeat, and independent music creators. Stream public songs, albums, previews, and new releases on Tengacion.",
    canonicalPath: "/music",
    previewTitle: "Discover music on Tengacion",
    previewDescription:
      "Browse public songs, albums, and creator drops on Tengacion.",
  },
  "/books": {
    title: "Books & Digital Reading by African Creators | Tengacion",
    description:
      "Discover public books, digital reading releases, and creator publishing pages on Tengacion.",
    canonicalPath: "/books",
    previewTitle: "Discover books on Tengacion",
    previewDescription:
      "Browse books and digital reading releases from Tengacion creators.",
  },
  "/podcasts": {
    title: "Podcasts & Spoken-Word Episodes | Tengacion",
    description:
      "Listen to public podcast episodes and spoken-word releases from Tengacion creators across Africa.",
    canonicalPath: "/podcasts",
    previewTitle: "Discover podcasts on Tengacion",
    previewDescription:
      "Browse podcasts and spoken-word releases from Tengacion creators.",
  },
  "/marketplace": {
    title: "Shop Products from Verified African Creators & Sellers | Tengacion",
    description:
      "Shop products from verified African creators and approved sellers, with visible prices, product photos, local pickup, and delivery-ready listings on Tengacion.",
    canonicalPath: "/marketplace",
    previewTitle: "Tengacion Marketplace",
    previewDescription:
      "Shop approved sellers, product listings, local pickup, and delivery-ready marketplace items on Tengacion.",
  },
  "/activity": {
    title: "Public Social Activity | Tengacion",
    description:
      "See recent public creator updates, social posts, reactions, comments, and activity signals across Tengacion.",
    canonicalPath: "/activity",
    previewTitle: "Public activity on Tengacion",
    previewDescription:
      "Browse recent public posts, creator updates, reactions, comments, and social activity from Tengacion members.",
  },
  "/about": {
    title: "About Tengacion | African Creator Discovery Platform",
    description:
      "Learn about Tengacion, a creator and social platform for discovering African music, books, podcasts, and public creator profiles.",
    canonicalPath: "/about",
    previewTitle: "About Tengacion",
    previewDescription:
      "Tengacion helps fans discover African creators across music, books, podcasts, videos, and public profiles.",
    previewItems: [
      { label: "Creator profiles", description: "Public pages connect releases, activity, and catalog depth back to the person behind the work." },
      { label: "Marketplace trust", description: "Approved sellers and visible commerce rules help buyers understand product and delivery expectations." },
      { label: "Public safety routes", description: "Terms, privacy, child safety, copyright, refunds, and reports are available outside the logged-in app." },
    ],
  },
  "/how-it-works": {
    title: "How Tengacion Works | Creator Discovery, Profiles & Releases",
    description:
      "See how Tengacion connects public creator profiles, releases, discovery categories, and fan support across music, books, and podcasts.",
    canonicalPath: "/how-it-works",
    previewTitle: "How Tengacion works",
    previewDescription:
      "Creator profiles anchor public releases, category discovery, and shareable pages on Tengacion.",
  },
  "/for-creators": {
    title: "For Creators | Publish Music, Books & Podcasts on Tengacion",
    description:
      "Tengacion helps creators present public profiles, publish releases, and build discovery across music, books, podcasts, and fan communities.",
    canonicalPath: "/for-creators",
    previewTitle: "For creators on Tengacion",
    previewDescription:
      "Build a public creator presence for music, books, podcasts, videos, and fan discovery.",
  },
  "/for-music-artists": {
    title: "For Music Artists | Share Songs, Albums & Videos on Tengacion",
    description:
      "Music artists can use Tengacion to share public songs, albums, videos, and creator profiles for fan discovery.",
    canonicalPath: "/for-music-artists",
    previewTitle: "For music artists on Tengacion",
    previewDescription:
      "Make songs, albums, videos, and artist profiles easier for fans to discover and share.",
  },
  "/for-authors": {
    title: "For Authors | Publish Books and Reading Releases on Tengacion",
    description:
      "Authors can use Tengacion public creator pages to present books, reading releases, descriptions, previews, and author profiles.",
    canonicalPath: "/for-authors",
    previewTitle: "For authors on Tengacion",
    previewDescription:
      "Present books, reading releases, descriptions, previews, and author profiles in one public catalog.",
  },
  "/for-podcasters": {
    title: "For Podcasters | Share Podcast Episodes on Tengacion",
    description:
      "Podcasters can publish public episodes and creator pages on Tengacion for discoverable spoken-word and audio series.",
    canonicalPath: "/for-podcasters",
    previewTitle: "For podcasters on Tengacion",
    previewDescription:
      "Connect public podcast episodes and spoken-word releases to a discoverable creator profile.",
  },
  "/safety": {
    title: "Safety & Moderation | Tengacion",
    description:
      "Learn how Tengacion approaches community safety, copyright screening, moderation, reporting, and trustworthy public creator discovery.",
    canonicalPath: "/safety",
    previewTitle: "Safety and moderation on Tengacion",
    previewDescription:
      "Review Tengacion safety, copyright, moderation, reporting, and public discovery trust principles.",
  },
  "/child-safety": {
    title: "Child Safety Policy | Tengacion",
    description:
      "Review Tengacion child safety rules, reporting paths, and escalation principles for content or activity involving minors.",
    canonicalPath: "/child-safety",
    previewTitle: "Child safety on Tengacion",
    previewDescription:
      "Tengacion blocks suspected child exploitation, escalates urgent reports, and gives the public a child safety reporting path.",
    previewItems: [
      { label: "Blocked conduct", description: "Exploitation, grooming, coercion, sexualized minor content, and unsafe contact are prohibited." },
      { label: "Urgent reports", description: "Child safety reports should include usernames, links, timestamps, and context where available." },
      { label: "Escalation", description: "Severe reports can trigger account restriction, evidence preservation, and external escalation where required." },
    ],
  },
  "/moderation-policy": {
    title: "Content Moderation Policy | Tengacion",
    description:
      "Learn how Tengacion reviews reports, copyright concerns, unsafe content, marketplace abuse, and creator trust issues.",
    canonicalPath: "/moderation-policy",
    previewTitle: "Content moderation on Tengacion",
    previewDescription:
      "Tengacion uses reporting, review queues, restrictions, and admin action to protect public discovery and creator trust.",
  },
  "/refund-policy": {
    title: "Refund Policy | Tengacion",
    description:
      "Understand Tengacion refund review principles for digital purchases, marketplace orders, failed payments, and duplicate charges.",
    canonicalPath: "/refund-policy",
    previewTitle: "Tengacion refund policy",
    previewDescription:
      "Review how Tengacion handles failed payments, duplicate charges, entitlement issues, marketplace order problems, and refund requests.",
  },
  "/creator-monetization-terms": {
    title: "Creator Monetization Terms | Tengacion",
    description:
      "Review Tengacion creator monetization terms for paid releases, subscriptions, earnings, payout readiness, and platform review.",
    canonicalPath: "/creator-monetization-terms",
    previewTitle: "Creator monetization terms",
    previewDescription:
      "Creator monetization on Tengacion depends on accurate rights, eligible content, payout readiness, and platform review.",
  },
  "/marketplace-seller-terms": {
    title: "Marketplace Seller Terms | Tengacion",
    description:
      "Review Tengacion marketplace seller terms for store approval, product accuracy, delivery expectations, disputes, and payouts.",
    canonicalPath: "/marketplace-seller-terms",
    previewTitle: "Marketplace seller terms",
    previewDescription:
      "Marketplace sellers must keep listings accurate, fulfill orders responsibly, and follow Tengacion review and payout rules.",
  },
  "/terms": {
    title: "Terms of Service | Tengacion",
    description:
      "Read the Tengacion Terms of Service covering platform rules, creator responsibilities, and paid features.",
    canonicalPath: "/terms",
    previewTitle: "Tengacion Terms of Service",
    previewDescription:
      "Review account rules, content standards, creator monetization, marketplace selling, payments, refunds, reports, and enforcement.",
    previewItems: [
      { label: "Age and account rules", description: "Users must meet age requirements, keep account details accurate, and use the platform lawfully." },
      { label: "Creator and seller responsibility", description: "Uploads, listings, payouts, and monetization require eligible content and accurate information." },
      { label: "Payments and disputes", description: "Refund and payment issues are reviewed with transaction references, order details, and platform records." },
    ],
  },
  "/privacy": {
    title: "Privacy Policy | Tengacion",
    description:
      "Learn how Tengacion processes account information, creator content, and privacy controls across the platform.",
    canonicalPath: "/privacy",
    previewTitle: "Tengacion Privacy Policy",
    previewDescription:
      "Learn how Tengacion uses account, creator, marketplace, payment, safety, and technical information to operate and protect the platform.",
    previewItems: [
      { label: "Information used", description: "Account details, public content, payment references, reports, security events, and technical logs support platform operation." },
      { label: "Controls and requests", description: "Users can request access, correction, deletion, or privacy review through public support routes." },
      { label: "Safety retention", description: "Some records may be retained for disputes, fraud, safety, accounting, legal obligations, or platform integrity." },
    ],
  },
  "/community-guidelines": {
    title: "Community Guidelines | Tengacion",
    description:
      "Review Tengacion community guidelines for respectful participation, safety, moderation, and reporting.",
    canonicalPath: "/community-guidelines",
    previewTitle: "Tengacion Community Guidelines",
    previewDescription:
      "Review standards for respectful participation, prohibited content, creator rights, marketplace trust, reporting, and enforcement.",
    previewItems: [
      { label: "Respectful participation", description: "Harassment, threats, impersonation, coordinated abuse, spam, and scams are not allowed." },
      { label: "Creator and rights standards", description: "Creators must publish work they own or have permission to use." },
      { label: "Marketplace trust", description: "Listings must use accurate product, price, condition, stock, pickup, and delivery details." },
    ],
  },
  "/copyright-policy": {
    title: "Copyright Policy | Tengacion",
    description:
      "Understand how Tengacion handles copyright screening, creator responsibilities, and flagged uploads.",
    canonicalPath: "/copyright-policy",
    previewTitle: "Tengacion Copyright Policy",
    previewDescription:
      "Understand creator upload responsibility, rights reports, takedown review, creator responses, and payout-sensitive copyright handling.",
    previewItems: [
      { label: "Creator responsibility", description: "Creators must own or have permission to upload and monetize music, books, podcasts, videos, images, and metadata." },
      { label: "Takedown reports", description: "Rights owners should include work title, rights owner, source URL, Tengacion URL, contact email, and issue details." },
      { label: "Repeat issues", description: "Repeated infringement claims or false ownership statements can restrict creator tools, payouts, and account access." },
    ],
  },
  "/contact": {
    title: "Contact Tengacion | Copyright, Safety and Privacy Reports",
    description:
      "Contact Tengacion for copyright, safety, privacy, abuse, and public platform reports without needing to log in.",
    canonicalPath: "/contact",
    previewTitle: "Contact Tengacion",
    previewDescription:
      "Send public copyright, safety, privacy, and abuse reports to Tengacion for admin review.",
  },
  "/developer-contact": {
    title: "Developer Contact | Tengacion",
    description:
      "Find Tengacion developer contact information and support details.",
    canonicalPath: "/developer-contact",
  },
};

const NOINDEX_PAGE_CONFIG = [
  {
    patterns: ["/login"],
    title: "Log In | Tengacion",
    description: "Log in to Tengacion to access your feed, creators, purchases, and messages.",
    canonicalPath: "/login",
  },
  {
    patterns: ["/register", "/signup", "/kaduna-got-talent/register"],
    title: "Create Account | Tengacion",
    description: "Create your Tengacion account to connect with creators, friends, and communities.",
  },
  {
    patterns: ["/forgot-password", "/reset-password", "/verify-email"],
    title: "Account Access | Tengacion",
    description: "Manage password recovery, email verification, and secure access for your Tengacion account.",
  },
  {
    patterns: ["/settings", "/settings/*"],
    title: "Settings | Tengacion",
    description: "Private Tengacion account settings.",
  },
  {
    patterns: ["/messages", "/messages/*"],
    title: "Messages | Tengacion",
    description: "Private Tengacion messaging area.",
  },
  {
    patterns: ["/notifications", "/notifications/*"],
    title: "Notifications | Tengacion",
    description: "Private Tengacion notifications page.",
  },
  {
    patterns: ["/dashboard", "/dashboard/*", "/creator/dashboard", "/creator/dashboard/*"],
    title: "Dashboard | Tengacion",
    description: "Private Tengacion dashboard and creator workspace.",
  },
  {
    patterns: ["/home", "/trending", "/news", "/news/*", "/live", "/live/*", "/gaming", "/reels"],
    title: "Tengacion App | Tengacion",
    description: "Private Tengacion app experience.",
  },
  {
    patterns: ["/search", "/profile/*", "/friends", "/find-friends", "/rooms", "/events", "/birthdays", "/saved", "/groups"],
    title: "Private Page | Tengacion",
    description: "Private Tengacion page.",
  },
  {
    patterns: ["/payment/verify", "/payments/*", "/purchases", "/purchases/*"],
    title: "Payments | Tengacion",
    description: "Private Tengacion payments and purchases page.",
  },
  {
    patterns: ["/onboarding", "/creator/register", "/creator/fan-page-view", "/creator/categories", "/creator/earnings", "/creator/payouts", "/creator/settings", "/creator/verification", "/creator/support", "/creator/music", "/creator/music/*", "/creator/books", "/creator/books/*", "/creator/podcasts", "/creator/podcasts/*"],
    title: "Creator Workspace | Tengacion",
    description: "Private Tengacion creator workspace.",
  },
  {
    patterns: ["/admin", "/admin/*"],
    title: "Admin | Tengacion",
    description: "Private Tengacion admin area.",
  },
  {
    patterns: [
      "/marketplace/register",
      "/marketplace/become-seller",
      "/marketplace/dashboard",
      "/marketplace/orders",
      "/marketplace/payouts",
    ],
    title: "Marketplace Account | Tengacion",
    description: "Private Tengacion marketplace account page.",
  },
  {
    patterns: ["/creator/*/subscribe", "/creators/*/subscribe"],
    title: "Subscribe | Tengacion",
    description: "Private Tengacion subscription flow.",
  },
];

const escapeHtml = (value = "") =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const escapeHtmlAttribute = (value = "") =>
  escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const safeJsonLd = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

const truncateText = (value = "", maxLength = 160) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
};

const pickText = (...values) => {
  for (const value of values) {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
};

const resolveUserAvatar = (user = {}) => {
  if (!user) {
    return "";
  }
  if (typeof user.avatar === "string") {
    return user.avatar;
  }
  return user.avatar?.url || "";
};

const buildWebSiteJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: toCanonicalUrl("/"),
});

const buildOrganizationJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: toCanonicalUrl("/"),
  logo: toAbsoluteUrl(DEFAULT_IMAGE_PATH),
});

const buildBreadcrumbJsonLd = (items = []) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: String(item?.name || "").trim(),
    item: toAbsoluteUrl(item?.url || "/"),
  })),
});

const buildItemListJsonLd = ({ name = "Tengacion public directory", items = [] } = {}) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name,
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: String(item?.label || "").trim(),
    url: toCanonicalUrl(item?.href || "/"),
  })),
});

const buildPreviewMarkup = ({ title = SITE_NAME, description = DEFAULT_DESCRIPTION } = {}) =>
  `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p>`;

const buildSeoPayload = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  canonicalPath = "/",
  robots = "index,follow",
  ogType = DEFAULT_OG_TYPE,
  image = DEFAULT_IMAGE_PATH,
  imageAlt = DEFAULT_IMAGE_ALT,
  structuredData = [],
  previewHtml = "",
  previewTitle = "",
  previewDescription = "",
  statusCode = 200,
} = {}) => {
  const canonicalUrl = toCanonicalUrl(canonicalPath);
  const imageUrl = toAbsoluteUrl(image || DEFAULT_IMAGE_PATH);
  const normalizedDescription = truncateText(description || DEFAULT_DESCRIPTION, 180) || DEFAULT_DESCRIPTION;
  const resolvedStructuredData = [
    buildWebSiteJsonLd(),
    buildOrganizationJsonLd(),
    ...(Array.isArray(structuredData) ? structuredData.filter(Boolean) : []),
  ];

  return {
    title,
    description: normalizedDescription,
    canonicalUrl,
    canonicalPath: normalizePathname(canonicalPath),
    robots,
    ogTitle: title,
    ogDescription: normalizedDescription,
    ogType,
    ogUrl: canonicalUrl,
    ogImage: imageUrl,
    ogImageAlt: imageAlt || DEFAULT_IMAGE_ALT,
    twitterCard: DEFAULT_TWITTER_CARD,
    twitterTitle: title,
    twitterDescription: normalizedDescription,
    twitterImage: imageUrl,
    twitterImageAlt: imageAlt || DEFAULT_IMAGE_ALT,
    structuredData: resolvedStructuredData,
    previewHtml:
      previewHtml ||
      buildPreviewMarkup({
        title: previewTitle || title,
        description: previewDescription || normalizedDescription,
      }),
    statusCode,
    xRobotsTag: String(robots || "").toLowerCase().includes("noindex") ? robots : "",
  };
};

const buildHomePreviewMarkup = () => {
  const links = [
    { href: "/about", label: "About Tengacion" },
    { href: "/how-it-works", label: "How Tengacion works" },
    { href: "/creators", label: "Find creators" },
    { href: "/music", label: "Music releases" },
    { href: "/books", label: "Books" },
    { href: "/podcasts", label: "Podcasts" },
    { href: "/marketplace", label: "Marketplace" },
    { href: "/activity", label: "Public activity" },
    { href: "/for-creators", label: "For creators" },
    { href: "/community-guidelines", label: "Community guidelines" },
    { href: "/child-safety", label: "Child safety" },
    { href: "/refund-policy", label: "Refund policy" },
    { href: "/contact", label: "Contact and reports" },
  ];

  return [
    '<section class="seo-home-preview">',
    `  <h1>${escapeHtml("Africa's social commerce and creator monetization platform")}</h1>`,
    `  <p>${escapeHtml(HOME_DESCRIPTION)}</p>`,
    '  <nav aria-label="Public Tengacion sections">',
    ...links.map(
      (link) =>
        `    <a href="${escapeHtmlAttribute(link.href)}">${escapeHtml(link.label)}</a>`
    ),
    "  </nav>",
    "  <ul>",
    `    <li>${escapeHtml("Explore public creator profiles and catalog pages.")}</li>`,
    `    <li>${escapeHtml("See public posts, reactions, comments, and creator activity signals.")}</li>`,
    `    <li>${escapeHtml("Discover songs, albums, books, and podcast episodes from African creators.")}</li>`,
    `    <li>${escapeHtml("Creators and approved sellers can receive earnings from successful purchases and request eligible payouts.")}</li>`,
    `    <li>${escapeHtml("Review Tengacion terms, privacy, copyright, and community standards.")}</li>`,
    "  </ul>",
    "</section>",
  ].join("\n");
};

const buildHomePageSeo = () =>
  buildSeoPayload({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    canonicalPath: "/",
    robots: "index,follow",
    previewHtml: buildHomePreviewMarkup(),
  });

const getEntryTime = (entry = {}) => new Date(entry?.updatedAt || entry?.createdAt || 0).getTime() || 0;

const getCreatorName = (profile = {}) =>
  pickText(profile?.displayName, profile?.fullName, profile?.userId?.name, "Tengacion Creator");

const getCreatorPathFromProfile = (profile = {}) =>
  buildCreatorPublicPath({
    creatorId: profile?._id || profile,
    username: profile?.userId?.username,
  });

const mapCreatorItem = (profile = {}) => ({
  href: getCreatorPathFromProfile(profile),
  label: getCreatorName(profile),
  description: pickText(
    profile?.tagline,
    profile?.bio,
    Array.isArray(profile?.creatorTypes) && profile.creatorTypes.length
      ? `Creator categories: ${profile.creatorTypes.join(", ")}.`
      : "",
    "Public creator profile on Tengacion."
  ),
});

const mapReleaseCreator = (entry = {}) => {
  const profile = entry?.creatorId || {};
  return {
    name: getCreatorName(profile),
    path: getCreatorPathFromProfile(profile),
  };
};

const getMarketplaceImage = (product = {}) => {
  const images = Array.isArray(product.images) ? product.images : [];
  const first = images[0] || {};
  return pickText(first.secureUrl, first.url, DEFAULT_IMAGE_PATH);
};

const getMarketplaceProductPath = (product = {}) =>
  `/marketplace/product/${encodeURIComponent(product.slug || product._id || "")}`;

const getMarketplaceStorePath = (seller = {}) =>
  `/marketplace/store/${encodeURIComponent(seller.slug || seller._id || "")}`;

const getMarketplaceSellerLocation = (seller = {}) =>
  [seller.city, seller.state].filter(Boolean).join(", ");

const getMarketplaceProductDescription = (product = {}) => {
  const seller = product?.seller || {};
  const sellerName = pickText(seller.storeName, "an approved Tengacion seller");
  const location = getMarketplaceSellerLocation(seller) || [product.city, product.state].filter(Boolean).join(", ");
  return truncateText(
    pickText(
      product.description,
      product.category && location
        ? `${product.title} is a ${product.category} listing from ${sellerName} in ${location}.`
        : "",
      `${product.title || "This marketplace product"} from ${sellerName} on Tengacion Marketplace.`
    ),
    180
  );
};

const fetchCreatorDirectoryItems = async (limit = CATEGORY_PREVIEW_LIMIT) => {
  const [musicRows, podcastRows, bookRows, albumRows, videoRows] = await Promise.all([
    Track.aggregate([
      { $match: { ...ACTIVE_TRACK_FILTER, kind: { $in: ["music", null] } } },
      { $group: { _id: "$creatorId", updatedAt: { $max: "$updatedAt" }, createdAt: { $max: "$createdAt" } } },
    ]),
    Track.aggregate([
      { $match: { ...ACTIVE_TRACK_FILTER, kind: "podcast" } },
      { $group: { _id: "$creatorId", updatedAt: { $max: "$updatedAt" }, createdAt: { $max: "$createdAt" } } },
    ]),
    Book.aggregate([
      { $match: ACTIVE_BOOK_FILTER },
      { $group: { _id: "$creatorId", updatedAt: { $max: "$updatedAt" }, createdAt: { $max: "$createdAt" } } },
    ]),
    Album.aggregate([
      { $match: ACTIVE_ALBUM_FILTER },
      { $group: { _id: "$creatorId", updatedAt: { $max: "$updatedAt" }, createdAt: { $max: "$createdAt" } } },
    ]),
    Video.aggregate([
      { $match: { ...ACTIVE_VIDEO_FILTER, creatorProfileId: { $ne: null } } },
      { $group: { _id: "$creatorProfileId", updatedAt: { $max: "$updatedAt" }, createdAt: { $max: "$createdAt" } } },
    ]),
  ]);

  const latestByCreator = new Map();
  [...musicRows, ...podcastRows, ...bookRows, ...albumRows, ...videoRows].forEach((row) => {
    const creatorId = String(row?._id || "");
    if (!creatorId) {
      return;
    }
    const nextTime = getEntryTime(row);
    const current = latestByCreator.get(creatorId) || 0;
    if (nextTime >= current) {
      latestByCreator.set(creatorId, nextTime);
    }
  });

  const creatorIds = Array.from(latestByCreator.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit * 3)
    .map(([creatorId]) => creatorId);

  if (!creatorIds.length) {
    return [];
  }

  const creators = await CreatorProfile.find({ _id: { $in: creatorIds }, status: "active" })
    .select("_id displayName fullName tagline bio creatorTypes userId")
    .populate("userId", "name username")
    .lean();
  const byId = new Map(creators.map((profile) => [String(profile?._id || ""), profile]));

  return creatorIds
    .map((creatorId) => byId.get(creatorId))
    .filter(Boolean)
    .slice(0, limit)
    .map(mapCreatorItem);
};

const fetchMusicDirectoryItems = async (limit = CATEGORY_PREVIEW_LIMIT) => {
  const [tracks, albums] = await Promise.all([
    Track.find({ ...ACTIVE_TRACK_FILTER, kind: { $in: ["music", null] } })
      .select("_id title description genre artistName creatorId updatedAt createdAt")
      .populate({
        path: "creatorId",
        select: "displayName fullName userId",
        populate: { path: "userId", select: "name username" },
      })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean(),
    Album.find(ACTIVE_ALBUM_FILTER)
      .select("_id title description releaseType totalTracks creatorId updatedAt createdAt")
      .populate({
        path: "creatorId",
        select: "displayName fullName userId",
        populate: { path: "userId", select: "name username" },
      })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  return [
    ...tracks.map((track) => {
      const creator = mapReleaseCreator(track);
      return {
        href: `/tracks/${track._id}`,
        label: track.title || "Music release",
        description: pickText(
          track.description,
          track.genre ? `${creator.name} - ${track.genre}` : "",
          `Music release by ${creator.name} on Tengacion.`
        ),
        updatedAt: track.updatedAt,
        createdAt: track.createdAt,
      };
    }),
    ...albums.map((album) => {
      const creator = mapReleaseCreator(album);
      const trackCount = Number(album.totalTracks || 0);
      return {
        href: `/albums/${album._id}`,
        label: album.title || "Album",
        description: pickText(
          album.description,
          `${album.releaseType || "Album"} by ${creator.name}${trackCount ? ` with ${trackCount} tracks` : ""}.`
        ),
        updatedAt: album.updatedAt,
        createdAt: album.createdAt,
      };
    }),
  ]
    .sort((a, b) => getEntryTime(b) - getEntryTime(a))
    .slice(0, limit);
};

const fetchBookDirectoryItems = async (limit = CATEGORY_PREVIEW_LIMIT) =>
  (
    await Book.find(ACTIVE_BOOK_FILTER)
      .select("_id title description subtitle genre authorName creatorId updatedAt createdAt")
      .populate({
        path: "creatorId",
        select: "displayName fullName userId",
        populate: { path: "userId", select: "name username" },
      })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean()
  ).map((book) => {
    const creator = mapReleaseCreator(book);
    return {
      href: `/books/${book._id}`,
      label: book.title || "Book",
      description: pickText(
        book.description,
        book.subtitle,
        book.genre ? `${book.genre} book by ${pickText(book.authorName, creator.name)}.` : "",
        `Book by ${pickText(book.authorName, creator.name)} on Tengacion.`
      ),
    };
  });

const fetchPodcastDirectoryItems = async (limit = CATEGORY_PREVIEW_LIMIT) =>
  (
    await Track.find({ ...ACTIVE_TRACK_FILTER, kind: "podcast" })
      .select("_id title description showNotes podcastSeries podcastCategory creatorId updatedAt createdAt")
      .populate({
        path: "creatorId",
        select: "displayName fullName userId",
        populate: { path: "userId", select: "name username" },
      })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean()
  ).map((episode) => {
    const creator = mapReleaseCreator(episode);
    return {
      href: `/tracks/${episode._id}`,
      label: episode.title || "Podcast episode",
      description: pickText(
        episode.description,
        episode.showNotes,
        episode.podcastSeries ? `${episode.podcastSeries} by ${creator.name}.` : "",
        episode.podcastCategory ? `${episode.podcastCategory} podcast episode on Tengacion.` : "",
        `Podcast episode by ${creator.name} on Tengacion.`
      ),
    };
  });

const fetchMarketplaceDirectoryItems = async (limit = CATEGORY_PREVIEW_LIMIT) =>
  (
    await MarketplaceProduct.find(ACTIVE_MARKETPLACE_PRODUCT_FILTER)
      .select("_id title slug description category price currency city state seller updatedAt createdAt")
      .populate("seller", "_id storeName slug city state status isActive")
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit * 2)
      .lean()
  )
    .filter((product) => product?.seller?.status === "approved" && product?.seller?.isActive)
    .slice(0, limit)
    .map((product) => ({
      href: getMarketplaceProductPath(product),
      label: product.title || "Marketplace product",
      description: getMarketplaceProductDescription(product),
    }));

const getPublicActivityAuthorName = (post = {}) =>
  pickText(post?.author?.name, post?.author?.username, "Tengacion member");

const getPublicActivityDescription = (post = {}) => {
  const engagement = [
    `${Number(post?.reactionsCount || 0)} reactions`,
    `${Number(post?.commentsCount || 0)} comments`,
    `${Number(post?.shareCount || 0)} shares`,
  ].join(", ");

  return pickText(
    normalizePublicText(post.text),
    post?.audio?.title ? `Shared ${post.audio.title} with the community.` : "",
    engagement
  );
};

const fetchActivityDirectoryItems = async (limit = CATEGORY_PREVIEW_LIMIT) =>
  uniquePublicActivity(
    await Post.find(ACTIVE_PUBLIC_POST_FILTER)
      .select("_id author text type reactionsCount commentsCount shareCount audio updatedAt createdAt")
      .populate("author", "name username")
      .sort({ createdAt: -1 })
      .limit(limit * 2)
      .lean()
  )
    .slice(0, limit)
    .map((post) => {
      const authorName = getPublicActivityAuthorName(post);
      const postType = String(post?.type || "post").replace(/_/g, " ");
      return {
        href: `/activity#post-${post._id}`,
        label: `${authorName} shared a ${postType}`,
        description: getPublicActivityDescription(post),
        updatedAt: post.updatedAt,
        createdAt: post.createdAt,
      };
    });

const DIRECTORY_PAGE_CONFIG = {
  "/creators": {
    listName: "Public creators on Tengacion",
    emptyText: "Public creator profiles will appear here as creators publish music, books, podcasts, or videos.",
    loadItems: fetchCreatorDirectoryItems,
  },
  "/music": {
    listName: "Public music releases on Tengacion",
    emptyText: "Public songs and albums will appear here as creators publish music releases.",
    loadItems: fetchMusicDirectoryItems,
  },
  "/books": {
    listName: "Public books on Tengacion",
    emptyText: "Public books and reading releases will appear here as authors publish.",
    loadItems: fetchBookDirectoryItems,
  },
  "/podcasts": {
    listName: "Public podcasts on Tengacion",
    emptyText: "Public podcast episodes will appear here as creators publish spoken-word releases.",
    loadItems: fetchPodcastDirectoryItems,
  },
  "/marketplace": {
    listName: "Tengacion Marketplace products",
    emptyText: "Published marketplace products will appear here as approved sellers list items.",
    loadItems: fetchMarketplaceDirectoryItems,
  },
  "/activity": {
    listName: "Public Tengacion social activity",
    emptyText: "Public posts, creator updates, reactions, and comments will appear here as the community grows.",
    loadItems: fetchActivityDirectoryItems,
  },
};

const buildDirectoryPreviewMarkup = ({ title, description, items = [], emptyText = "" } = {}) => {
  const parts = [
    '<section class="seo-directory-preview">',
    `  <h1>${escapeHtml(title)}</h1>`,
    `  <p>${escapeHtml(description)}</p>`,
  ];

  if (items.length) {
    parts.push('  <ul aria-label="Public Tengacion links">');
    items.forEach((item) => {
      parts.push("    <li>");
      if (item.href) {
        parts.push(`      <a href="${escapeHtmlAttribute(item.href)}">${escapeHtml(item.label)}</a>`);
      } else {
        parts.push(`      <strong>${escapeHtml(item.label)}</strong>`);
      }
      if (item.description) {
        parts.push(`      <p>${escapeHtml(truncateText(item.description, 180))}</p>`);
      }
      parts.push("    </li>");
    });
    parts.push("  </ul>");
  } else if (emptyText) {
    parts.push(`  <p>${escapeHtml(emptyText)}</p>`);
  }

  parts.push("</section>");
  return parts.join("\n");
};

const buildDirectoryPageSeo = async (pathname, page) => {
  const directory = DIRECTORY_PAGE_CONFIG[pathname];
  if (!directory) {
    const previewItems = Array.isArray(page.previewItems) ? page.previewItems.filter(Boolean) : [];
    return buildSeoPayload({
      ...page,
      structuredData: [
        buildBreadcrumbJsonLd([
          { name: "Tengacion", url: "/" },
          { name: page.previewTitle || page.title, url: page.canonicalPath || pathname },
        ]),
      ],
      previewHtml: previewItems.length
        ? buildDirectoryPreviewMarkup({
            title: page.previewTitle || page.title,
            description: page.previewDescription || page.description,
            items: previewItems,
          })
        : undefined,
    });
  }

  let items = [];
  try {
    items = await directory.loadItems(CATEGORY_PREVIEW_LIMIT);
  } catch (error) {
    console.warn("Failed to build public directory SEO preview:", pathname, error?.message || error);
  }

  const previewTitle = page.previewTitle || page.title;
  const previewDescription = page.previewDescription || page.description;
  const structuredData = [
    buildBreadcrumbJsonLd([
      { name: "Tengacion", url: "/" },
      { name: previewTitle, url: page.canonicalPath || pathname },
    ]),
  ];

  if (items.length) {
    structuredData.push(buildItemListJsonLd({ name: directory.listName, items }));
  }

  return buildSeoPayload({
    ...page,
    structuredData,
    previewHtml: buildDirectoryPreviewMarkup({
      title: previewTitle,
      description: previewDescription,
      items,
      emptyText: directory.emptyText,
    }),
  });
};

const replaceTagAttribute = (html, key, attribute, value) =>
  html.replace(
    new RegExp(`(<[^>]+data-seo-key="${key}"[^>]*\\b${attribute}=")([^"]*)(")`, "i"),
    `$1${escapeHtmlAttribute(value)}$3`
  );

const replaceTagContent = (html, key, value) =>
  html.replace(
    new RegExp(`(<[^>]+data-seo-key="${key}"[^>]*>)([\\s\\S]*?)(</[^>]+>)`, "i"),
    `$1${value}$3`
  );

const renderSeoHtml = (template = "", seo = {}) => {
  let html = String(template || "");
  if (!html) {
    return html;
  }

  html = replaceTagContent(html, "title", escapeHtml(seo.title || DEFAULT_TITLE));
  html = replaceTagAttribute(html, "description", "content", seo.description || DEFAULT_DESCRIPTION);
  html = replaceTagAttribute(html, "canonical", "href", seo.canonicalUrl || toCanonicalUrl("/"));
  html = replaceTagAttribute(html, "robots", "content", seo.robots || "index,follow");
  html = replaceTagAttribute(html, "og:title", "content", seo.ogTitle || seo.title || DEFAULT_TITLE);
  html = replaceTagAttribute(html, "og:description", "content", seo.ogDescription || seo.description || DEFAULT_DESCRIPTION);
  html = replaceTagAttribute(html, "og:type", "content", seo.ogType || DEFAULT_OG_TYPE);
  html = replaceTagAttribute(html, "og:url", "content", seo.ogUrl || seo.canonicalUrl || toCanonicalUrl("/"));
  html = replaceTagAttribute(html, "og:image", "content", seo.ogImage || toAbsoluteUrl(DEFAULT_IMAGE_PATH));
  html = replaceTagAttribute(html, "og:image:alt", "content", seo.ogImageAlt || DEFAULT_IMAGE_ALT);
  html = replaceTagAttribute(html, "twitter:card", "content", seo.twitterCard || DEFAULT_TWITTER_CARD);
  html = replaceTagAttribute(html, "twitter:title", "content", seo.twitterTitle || seo.title || DEFAULT_TITLE);
  html = replaceTagAttribute(html, "twitter:description", "content", seo.twitterDescription || seo.description || DEFAULT_DESCRIPTION);
  html = replaceTagAttribute(html, "twitter:image", "content", seo.twitterImage || toAbsoluteUrl(DEFAULT_IMAGE_PATH));
  html = replaceTagAttribute(html, "twitter:image:alt", "content", seo.twitterImageAlt || DEFAULT_IMAGE_ALT);
  html = replaceTagContent(
    html,
    "structured-data",
    safeJsonLd(
      Array.isArray(seo.structuredData) && seo.structuredData.length === 1
        ? seo.structuredData[0]
        : seo.structuredData || []
    )
  );
  html = replaceTagContent(html, "boot-preview", seo.previewHtml || buildPreviewMarkup());

  return html;
};

const buildStaticPageSeo = async (pathname) => {
  const page = PUBLIC_INFO_PAGES[pathname];
  if (!page) {
    return null;
  }
  return buildDirectoryPageSeo(pathname, page);
};

const buildNoIndexPageSeo = (pathname) => {
  for (const entry of NOINDEX_PAGE_CONFIG) {
    if (entry.patterns.some((pattern) => matchesPathPattern(pathname, pattern))) {
      return buildSeoPayload({
        title: entry.title,
        description: entry.description,
        canonicalPath: entry.canonicalPath || pathname,
        robots: "noindex,nofollow",
        previewTitle: entry.title,
        previewDescription: entry.description,
      });
    }
  }

  return buildSeoPayload({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: pathname,
    robots: "noindex,nofollow",
  });
};

const matchesPathPattern = (pathname, pattern) => {
  const cleanPath = normalizePathname(pathname);
  const cleanPattern = normalizePathname(pattern);

  if (cleanPattern.endsWith("/*")) {
    const prefix = cleanPattern.slice(0, -2);
    return cleanPath === prefix || cleanPath.startsWith(`${prefix}/`);
  }

  if (cleanPattern.includes("*")) {
    const regexSource = cleanPattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\\\*/g, "[^/]+");
    return new RegExp(`^${regexSource}$`, "i").test(cleanPath);
  }

  return cleanPath === cleanPattern;
};

const resolveCreatorCounts = async (creatorId, creatorUserId = "") => {
  const [tracksCount, albumsCount, booksCount, podcastsCount, videosCount] = await Promise.all([
    Track.countDocuments({ creatorId, kind: { $in: ["music", null] }, ...ACTIVE_TRACK_FILTER }),
    Album.countDocuments({ creatorId, ...ACTIVE_ALBUM_FILTER }),
    Book.countDocuments({ creatorId, ...ACTIVE_BOOK_FILTER }),
    Track.countDocuments({ creatorId, kind: "podcast", ...ACTIVE_TRACK_FILTER }),
    Video.countDocuments({
      archivedAt: null,
      isPublished: { $ne: false },
      $or: [{ creatorProfileId: creatorId }, { userId: String(creatorUserId || "") }],
    }),
  ]);

  return {
    tracksCount,
    albumsCount,
    booksCount,
    podcastsCount,
    videosCount,
  };
};

const hasMeaningfulSeoCopy = (...values) =>
  values.some((value) => String(value || "").replace(/\s+/g, " ").trim().length >= 24);

const totalCreatorItems = (counts = {}) =>
  Number(counts.tracksCount || 0) +
  Number(counts.albumsCount || 0) +
  Number(counts.booksCount || 0) +
  Number(counts.podcastsCount || 0) +
  Number(counts.videosCount || 0);

const buildCreatorCanonicalPath = (profile, tab = "home") =>
  buildCreatorPublicPath({
    creatorId: String(profile?._id || ""),
    username: profile?.userId?.username,
    tab,
  });

const buildCreatorDescription = ({ displayName, profile, counts, tab = "home" }) => {
  const creatorBio = pickText(profile?.tagline, profile?.bio);
  const defaultsByTab = {
    home: `Explore ${displayName} on Tengacion. Discover public music, books, podcasts, and updates from this creator.`,
    music: `Stream public singles, albums, and videos from ${displayName} on Tengacion.`,
    albums: `Explore public albums and EP releases from ${displayName} on Tengacion.`,
    podcasts: `Listen to public podcast episodes and spoken-word releases from ${displayName} on Tengacion.`,
    books: `Browse public books and digital releases from ${displayName} on Tengacion.`,
  };

  if (tab === "home" && creatorBio) {
    const totalItems = totalCreatorItems(counts);
    const coverage = totalItems > 0
      ? `Discover ${totalItems} public release${totalItems === 1 ? "" : "s"} from this creator.`
      : "Discover this creator's public profile and updates.";
    return truncateText(`${defaultsByTab.home} ${coverage} ${creatorBio}`, 180);
  }

  if (creatorBio && tab !== "home") {
    return truncateText(`${defaultsByTab[tab] || defaultsByTab.home} ${creatorBio}`, 180);
  }

  return truncateText(pickText(defaultsByTab[tab], defaultsByTab.home, creatorBio), 180);
};

const buildCreatorSeo = async ({ creatorRef, tab = "home", requestedPath = "/" } = {}) => {
  const profile = await findCreatorProfileByReference({
    creatorRef,
    populate: "name username avatar country links tagline bio genres heroBannerUrl coverImageUrl",
    lean: true,
  });

  if (!profile) {
    return buildSeoPayload({
      title: "Creator Not Found | Tengacion",
      description: DEFAULT_DESCRIPTION,
      canonicalPath: buildCreatorIdPath({ creatorId: creatorRef }),
      robots: "noindex,nofollow",
      statusCode: 404,
    });
  }

  const counts = await resolveCreatorCounts(profile._id, profile?.userId?._id || profile?.userId || "");
  const displayName = pickText(profile.displayName, profile.fullName, profile?.userId?.name, "Creator");
  const titleByTab = {
    home: `${displayName} on Tengacion | Music, Books, Podcasts & Updates`,
    music: `${displayName} Music on Tengacion | Singles, Videos & Releases`,
    albums: `${displayName} Albums on Tengacion | EPs & Projects`,
    podcasts: `${displayName} Podcasts on Tengacion | Episodes & Spoken Word`,
    books: `${displayName} Books on Tengacion | Reading & Publishing`,
  };
  const canonicalPath = buildCreatorCanonicalPath(profile, tab);
  const image = pickText(
    profile.heroBannerUrl,
    profile.coverImageUrl,
    resolveUserAvatar(profile.userId),
    DEFAULT_IMAGE_PATH
  );
  const sameAs = Array.isArray(profile.links)
    ? profile.links.map((entry) => String(entry?.url || "").trim()).filter(Boolean)
    : [];
  const normalizedRequestedPath = normalizePathname(requestedPath);
  const tabIndexability = {
    home: totalCreatorItems(counts) > 0 || hasMeaningfulSeoCopy(profile?.tagline, profile?.bio),
    music: Number(counts.tracksCount || 0) > 0 || Number(counts.videosCount || 0) > 0,
    albums: Number(counts.albumsCount || 0) > 0,
    podcasts: Number(counts.podcastsCount || 0) > 0,
    books: Number(counts.booksCount || 0) > 0,
  };
  const pageIsIndexable = tab === "home" ? tabIndexability.home : Boolean(tabIndexability[tab]);
  const isCanonicalRequest = normalizedRequestedPath === normalizePathname(canonicalPath);
  const breadcrumbItems = [
    { name: "Creators", url: "/creators" },
    { name: displayName, url: buildCreatorCanonicalPath(profile, "home") },
  ];

  if (tab !== "home") {
    breadcrumbItems.push({
      name: tab === "albums" ? "Albums" : tab === "books" ? "Books" : tab === "podcasts" ? "Podcasts" : "Music",
      url: canonicalPath,
    });
  }

  return buildSeoPayload({
    title: titleByTab[tab] || titleByTab.home,
    description: buildCreatorDescription({ displayName, profile, counts, tab }),
    canonicalPath,
    robots: pageIsIndexable && isCanonicalRequest ? "index,follow" : "noindex,follow",
    ogType: "profile",
    image,
    imageAlt: `${displayName} on Tengacion`,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        name: `${displayName} on Tengacion`,
        url: toCanonicalUrl(canonicalPath),
        description: buildCreatorDescription({ displayName, profile, counts, tab: "home" }),
        mainEntity: {
          "@type": "Person",
          name: displayName,
          description: pickText(profile.tagline, profile.bio),
          image: toAbsoluteUrl(image),
          sameAs,
          knowsAbout: Array.isArray(profile.genres) ? profile.genres.filter(Boolean).slice(0, 8) : undefined,
        },
      },
      buildBreadcrumbJsonLd(breadcrumbItems),
    ],
    previewTitle: titleByTab[tab] || titleByTab.home,
    previewDescription:
      buildCreatorDescription({ displayName, profile, counts, tab: "home" }) ||
      `Explore ${displayName} across music, books, and podcasts on Tengacion.`,
  });
};

const buildTrackSeo = async (trackId) => {
  if (!mongoose.Types.ObjectId.isValid(trackId)) {
    return buildSeoPayload({
      title: "Release Not Found | Tengacion",
      description: DEFAULT_DESCRIPTION,
      canonicalPath: `/tracks/${trackId}`,
      robots: "noindex,nofollow",
      statusCode: 404,
    });
  }

  const track = await Track.findOne({ _id: trackId, ...ACTIVE_TRACK_FILTER })
    .populate({
      path: "creatorId",
      select: "displayName fullName userId",
      populate: { path: "userId", select: "name username" },
    })
    .lean();

  if (!track) {
    return buildSeoPayload({
      title: "Release Not Found | Tengacion",
      description: DEFAULT_DESCRIPTION,
      canonicalPath: `/tracks/${trackId}`,
      robots: "noindex,nofollow",
      statusCode: 404,
    });
  }

  const creatorName = pickText(
    track?.creatorId?.displayName,
    track?.creatorId?.fullName,
    track?.creatorId?.userId?.name,
    "Tengacion Creator"
  );
  const isPodcast = String(track.kind || "").toLowerCase() === "podcast";
  const title = isPodcast && track.podcastSeries
    ? `${track.title} | ${track.podcastSeries} on Tengacion`
    : `${track.title} by ${creatorName} | Tengacion`;
  const description = truncateText(
    pickText(
      track.description,
      track.showNotes,
      track.genre
        ? `${track.title} by ${creatorName} on Tengacion in ${track.genre}.`
        : "",
      track.podcastCategory
        ? `Listen to ${track.title} from ${creatorName} on Tengacion in ${track.podcastCategory}.`
        : "",
      isPodcast
        ? `Listen to ${track.title} from ${creatorName} on Tengacion.`
        : `Stream ${track.title} by ${creatorName} on Tengacion.`
    ),
    180
  );
  const image = pickText(track.coverImageUrl, DEFAULT_IMAGE_PATH);
  const creatorPath = buildCreatorPublicPath({
    creatorId: track?.creatorId?._id || track?.creatorId || "",
    username: track?.creatorId?.userId?.username,
  });
  const jsonLd = isPodcast
    ? {
        "@context": "https://schema.org",
        "@type": "PodcastEpisode",
        name: track.title || "Podcast episode",
        description,
        url: toCanonicalUrl(`/tracks/${track._id}`),
        image: toAbsoluteUrl(image),
        datePublished: track.releaseDate || track.createdAt || undefined,
        partOfSeries: track.podcastSeries
          ? {
              "@type": "PodcastSeries",
              name: track.podcastSeries,
            }
          : undefined,
        associatedMedia: {
          "@type": "MediaObject",
          duration: track.durationSec ? `PT${Number(track.durationSec)}S` : undefined,
        },
        actor: {
          "@type": "Person",
          name: creatorName,
        },
      }
    : {
        "@context": "https://schema.org",
        "@type": "MusicRecording",
        name: track.title || "Track",
        description,
        url: toCanonicalUrl(`/tracks/${track._id}`),
        image: toAbsoluteUrl(image),
        datePublished: track.releaseDate || track.createdAt || undefined,
        duration: track.durationSec ? `PT${Number(track.durationSec)}S` : undefined,
        byArtist: {
          "@type": "Person",
          name: creatorName,
          url: toCanonicalUrl(creatorPath),
        },
        inAlbum: undefined,
      };

  return buildSeoPayload({
    title,
    description,
    canonicalPath: `/tracks/${track._id}`,
    ogType: isPodcast ? "article" : "music.song",
    image,
    imageAlt: `${track.title} by ${creatorName}`,
    structuredData: [
      jsonLd,
      buildBreadcrumbJsonLd([
        { name: "Creators", url: "/creators" },
        { name: creatorName, url: creatorPath },
        { name: track.title || "Track", url: `/tracks/${track._id}` },
      ]),
    ],
  });
};

const buildBookSeo = async (bookId) => {
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return buildSeoPayload({
      title: "Book Not Found | Tengacion",
      description: DEFAULT_DESCRIPTION,
      canonicalPath: `/books/${bookId}`,
      robots: "noindex,nofollow",
      statusCode: 404,
    });
  }

  const book = await Book.findOne({ _id: bookId, ...ACTIVE_BOOK_FILTER })
    .populate({
      path: "creatorId",
      select: "displayName fullName userId",
      populate: { path: "userId", select: "name username" },
    })
    .lean();

  if (!book) {
    return buildSeoPayload({
      title: "Book Not Found | Tengacion",
      description: DEFAULT_DESCRIPTION,
      canonicalPath: `/books/${bookId}`,
      robots: "noindex,nofollow",
      statusCode: 404,
    });
  }

  const creatorName = pickText(
    book?.creatorId?.displayName,
    book?.creatorId?.fullName,
    book?.creatorId?.userId?.name,
    book.authorName,
    "Tengacion Creator"
  );
  const description = truncateText(
    pickText(
      book.description,
      book.subtitle,
      book.previewExcerptText,
      book.genre ? `${book.title} is a ${book.genre} release by ${creatorName} on Tengacion.` : "",
      `Discover ${book.title} by ${creatorName} on Tengacion.`
    ),
    180
  );
  const image = pickText(book.coverImageUrl, DEFAULT_IMAGE_PATH);
  const creatorPath = buildCreatorPublicPath({
    creatorId: book?.creatorId?._id || book?.creatorId || "",
    username: book?.creatorId?.userId?.username,
  });

  return buildSeoPayload({
    title: `${book.title} by ${creatorName} | Tengacion`,
    description,
    canonicalPath: `/books/${book._id}`,
    ogType: "book",
    image,
    imageAlt: `${book.title} cover`,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "Book",
        name: book.title || "Book",
        description,
        url: toCanonicalUrl(`/books/${book._id}`),
        image: toAbsoluteUrl(image),
        author: {
          "@type": "Person",
          name: creatorName,
          url: toCanonicalUrl(creatorPath),
        },
        bookFormat: book.fileFormat ? `https://schema.org/${String(book.fileFormat).toUpperCase()}` : undefined,
        inLanguage: book.language || undefined,
        datePublished: book.createdAt || undefined,
      },
      buildBreadcrumbJsonLd([
        { name: "Creators", url: "/creators" },
        { name: creatorName, url: creatorPath },
        { name: book.title || "Book", url: `/books/${book._id}` },
      ]),
    ],
  });
};

const buildAlbumSeo = async (albumId) => {
  if (!mongoose.Types.ObjectId.isValid(albumId)) {
    return buildSeoPayload({
      title: "Album Not Found | Tengacion",
      description: DEFAULT_DESCRIPTION,
      canonicalPath: `/albums/${albumId}`,
      robots: "noindex,nofollow",
      statusCode: 404,
    });
  }

  const album = await Album.findOne({ _id: albumId, ...ACTIVE_ALBUM_FILTER })
    .populate({
      path: "creatorId",
      select: "displayName fullName userId",
      populate: { path: "userId", select: "name username" },
    })
    .lean();

  if (!album) {
    return buildSeoPayload({
      title: "Album Not Found | Tengacion",
      description: DEFAULT_DESCRIPTION,
      canonicalPath: `/albums/${albumId}`,
      robots: "noindex,nofollow",
      statusCode: 404,
    });
  }

  const creatorName = pickText(
    album?.creatorId?.displayName,
    album?.creatorId?.fullName,
    album?.creatorId?.userId?.name,
    "Tengacion Creator"
  );
  const image = pickText(album.coverUrl, DEFAULT_IMAGE_PATH);
  const trackCount = Number(album.totalTracks || (Array.isArray(album.tracks) ? album.tracks.length : 0) || 0);
  const description = truncateText(
    pickText(
      album.description,
      album.releaseType
        ? `${album.title} is a ${album.releaseType} by ${creatorName} on Tengacion with ${trackCount} ${trackCount === 1 ? "track" : "tracks"}.`
        : "",
      `${album.title} by ${creatorName} on Tengacion with ${trackCount} ${trackCount === 1 ? "track" : "tracks"}.`
    ),
    180
  );
  const creatorPath = buildCreatorPublicPath({
    creatorId: album?.creatorId?._id || album?.creatorId || "",
    username: album?.creatorId?.userId?.username,
  });

  return buildSeoPayload({
    title: `${album.title} by ${creatorName} | Tengacion`,
    description,
    canonicalPath: `/albums/${album._id}`,
    ogType: "music.album",
    image,
    imageAlt: `${album.title} cover art`,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "MusicAlbum",
        name: album.title || "Album",
        description,
        url: toCanonicalUrl(`/albums/${album._id}`),
        image: toAbsoluteUrl(image),
        datePublished: album.createdAt || undefined,
        byArtist: {
          "@type": "Person",
          name: creatorName,
          url: toCanonicalUrl(creatorPath),
        },
        numTracks: trackCount || undefined,
      },
      buildBreadcrumbJsonLd([
        { name: "Creators", url: "/creators" },
        { name: creatorName, url: creatorPath },
        { name: album.title || "Album", url: `/albums/${album._id}` },
      ]),
    ],
  });
};

const resolveMarketplaceProduct = async (idOrSlug = "") => {
  const raw = String(idOrSlug || "").trim();
  if (!raw) {
    return null;
  }

  const lookup = mongoose.Types.ObjectId.isValid(raw)
    ? { _id: raw }
    : { slug: raw.toLowerCase() };

  const product = await MarketplaceProduct.findOne({
    ...lookup,
    ...ACTIVE_MARKETPLACE_PRODUCT_FILTER,
  })
    .populate("seller", "_id storeName slug city state status isActive updatedAt createdAt")
    .lean();

  if (!product || product?.seller?.status !== "approved" || !product?.seller?.isActive) {
    return null;
  }

  return product;
};

const buildMarketplaceProductSeo = async (idOrSlug) => {
  const product = await resolveMarketplaceProduct(idOrSlug);
  const fallbackPath = `/marketplace/product/${encodeURIComponent(idOrSlug || "")}`;

  if (!product) {
    return buildSeoPayload({
      title: "Marketplace Product Not Found | Tengacion",
      description: DEFAULT_DESCRIPTION,
      canonicalPath: fallbackPath,
      robots: "noindex,nofollow",
      statusCode: 404,
    });
  }

  const seller = product.seller || {};
  const canonicalPath = getMarketplaceProductPath(product);
  const image = getMarketplaceImage(product);
  const description = getMarketplaceProductDescription(product);
  const sellerName = pickText(seller.storeName, "Tengacion Marketplace seller");
  const availability = Number(product.stock || 0) > 0
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";

  return buildSeoPayload({
    title: `${product.title} | Tengacion Marketplace`,
    description,
    canonicalPath,
    ogType: "product",
    image,
    imageAlt: `${product.title} marketplace listing`,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.title || "Marketplace product",
        description,
        url: toCanonicalUrl(canonicalPath),
        image: image ? [toAbsoluteUrl(image)] : undefined,
        category: product.category || undefined,
        sku: String(product._id || ""),
        brand: {
          "@type": "Brand",
          name: sellerName,
        },
        offers: {
          "@type": "Offer",
          url: toCanonicalUrl(canonicalPath),
          priceCurrency: product.currency || "NGN",
          price: Number(product.price || 0),
          availability,
          itemCondition:
            product.condition === "used"
              ? "https://schema.org/UsedCondition"
              : "https://schema.org/NewCondition",
          seller: {
            "@type": "Organization",
            name: sellerName,
            url: toCanonicalUrl(getMarketplaceStorePath(seller)),
          },
        },
      },
      buildBreadcrumbJsonLd([
        { name: "Marketplace", url: "/marketplace" },
        { name: sellerName, url: getMarketplaceStorePath(seller) },
        { name: product.title || "Product", url: canonicalPath },
      ]),
    ],
    previewTitle: `${product.title} | Tengacion Marketplace`,
    previewDescription: description,
  });
};

const buildMarketplaceStoreDescription = (seller = {}) => {
  const location = getMarketplaceSellerLocation(seller);
  if (seller.storeName && location) {
    return `${seller.storeName} is an approved Tengacion marketplace store serving ${location}. Browse live product listings and delivery options.`;
  }
  if (seller.storeName) {
    return `${seller.storeName} is an approved Tengacion marketplace store. Browse live product listings and delivery options.`;
  }
  return "Browse this approved Tengacion marketplace store and its live product listings.";
};

const buildMarketplaceStoreSeo = async (idOrSlug) => {
  const raw = String(idOrSlug || "").trim();
  const lookup = mongoose.Types.ObjectId.isValid(raw)
    ? { _id: raw }
    : { slug: raw.toLowerCase() };
  const fallbackPath = `/marketplace/store/${encodeURIComponent(raw || "")}`;

  const seller = await MarketplaceSeller.findOne({
    ...lookup,
    ...ACTIVE_MARKETPLACE_SELLER_FILTER,
  }).lean();

  if (!seller) {
    return buildSeoPayload({
      title: "Marketplace Store Not Found | Tengacion",
      description: DEFAULT_DESCRIPTION,
      canonicalPath: fallbackPath,
      robots: "noindex,nofollow",
      statusCode: 404,
    });
  }

  const products = await MarketplaceProduct.find({
    ...ACTIVE_MARKETPLACE_PRODUCT_FILTER,
    seller: seller._id,
  })
    .select("_id title slug description category images updatedAt createdAt")
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(CATEGORY_PREVIEW_LIMIT)
    .lean();
  const canonicalPath = getMarketplaceStorePath(seller);
  const description = truncateText(buildMarketplaceStoreDescription(seller), 180);
  const productItems = products.map((product) => ({
    href: getMarketplaceProductPath(product),
    label: product.title || "Marketplace product",
    description: getMarketplaceProductDescription({ ...product, seller }),
  }));

  return buildSeoPayload({
    title: `${seller.storeName || "Marketplace Store"} | Tengacion Marketplace Store`,
    description,
    canonicalPath,
    ogType: "website",
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "Store",
        name: seller.storeName || "Tengacion Marketplace Store",
        description,
        url: toCanonicalUrl(canonicalPath),
        address: getMarketplaceSellerLocation(seller)
          ? {
              "@type": "PostalAddress",
              addressLocality: seller.city || undefined,
              addressRegion: seller.state || undefined,
              addressCountry: "NG",
            }
          : undefined,
      },
      ...(productItems.length
        ? [buildItemListJsonLd({ name: `${seller.storeName || "Store"} products`, items: productItems })]
        : []),
      buildBreadcrumbJsonLd([
        { name: "Marketplace", url: "/marketplace" },
        { name: seller.storeName || "Store", url: canonicalPath },
      ]),
    ],
    previewHtml: buildDirectoryPreviewMarkup({
      title: `${seller.storeName || "Marketplace Store"} on Tengacion`,
      description,
      items: productItems,
      emptyText: "This approved seller has no live marketplace products yet.",
    }),
  });
};

const resolveDynamicSeo = async (pathname) => {
  const creatorMatch = pathname.match(/^\/creators\/([^/]+)(?:\/(music|albums|podcasts|books))?$/i);
  if (creatorMatch) {
    return buildCreatorSeo({
      creatorRef: creatorMatch[1],
      tab: String(creatorMatch[2] || "home").toLowerCase(),
      requestedPath: pathname,
    });
  }

  const creatorAliasMatch = pathname.match(/^\/creator\/([^/]+)(?:\/(music|albums|podcasts|books))?$/i);
  if (
    creatorAliasMatch
    && !PRIVATE_CREATOR_ALIAS_SEGMENTS.has(normalizeCreatorUsername(creatorAliasMatch[1]))
  ) {
    return buildCreatorSeo({
      creatorRef: creatorAliasMatch[1],
      tab: String(creatorAliasMatch[2] || "home").toLowerCase(),
      requestedPath: pathname,
    });
  }

  const trackMatch = pathname.match(/^\/tracks\/([^/]+)$/i);
  if (trackMatch) {
    return buildTrackSeo(trackMatch[1]);
  }

  const bookMatch = pathname.match(/^\/books\/([^/]+)$/i);
  if (bookMatch) {
    return buildBookSeo(bookMatch[1]);
  }

  const albumMatch = pathname.match(/^\/albums\/([^/]+)$/i);
  if (albumMatch) {
    return buildAlbumSeo(albumMatch[1]);
  }

  const marketplaceProductMatch = pathname.match(/^\/marketplace\/product\/([^/]+)$/i);
  if (marketplaceProductMatch) {
    return buildMarketplaceProductSeo(marketplaceProductMatch[1]);
  }

  const marketplaceStoreMatch = pathname.match(/^\/marketplace\/store\/([^/]+)$/i);
  if (marketplaceStoreMatch) {
    return buildMarketplaceStoreSeo(marketplaceStoreMatch[1]);
  }

  return null;
};

const resolvePageSeo = async ({ path = "/" } = {}) => {
  const pathname = normalizePathname(path);

  if (pathname === "/") {
    return buildHomePageSeo();
  }

  if (pathname === "/find-creators") {
    return buildSeoPayload({
      ...PUBLIC_INFO_PAGES["/creators"],
      canonicalPath: "/creators",
      robots: "noindex,follow",
      previewTitle: "Find creators on Tengacion",
      previewDescription:
        "Discover music artists, authors, and creators across Tengacion.",
    });
  }

  const staticPageSeo = await buildStaticPageSeo(pathname);
  if (staticPageSeo) {
    return staticPageSeo;
  }

  const dynamicSeo = await resolveDynamicSeo(pathname);
  if (dynamicSeo) {
    return dynamicSeo;
  }

  return buildNoIndexPageSeo(pathname);
};

module.exports = {
  renderSeoHtml,
  resolvePageSeo,
};
