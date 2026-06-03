import { resolveImage } from "../../api";
import { formatCreatorLaneLabel, normalizeCreatorLaneKeys } from "./creatorConfig";
import {
  buildCreatorAudiencePath,
  buildReleaseDetailPath,
} from "./upload/uploadAudienceUtils";

export const CREATOR_FAN_PAGE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "music", label: "Music" },
  { key: "books", label: "Books" },
  { key: "podcasts", label: "Podcasts" },
  { key: "videos", label: "Videos" },
  { key: "posts", label: "Posts" },
  { key: "store", label: "Store" },
];

const UPLOAD_PATHS = {
  music: "/creator/music/upload",
  bookPublishing: "/creator/books/upload",
  podcast: "/creator/podcasts/upload",
};

const SECTION_DEFAULTS = {
  overview: {
    title: "Fan Page overview",
    description:
      "See how your public creator page will feel to listeners and readers before they open it.",
  },
  music: {
    title: "Your next release",
    description:
      "Upload a track, album, or music video to make your public fan page feel alive.",
  },
  books: {
    title: "Your next book",
    description:
      "Upload a manuscript and cover artwork to build a reader-facing books shelf.",
  },
  podcasts: {
    title: "Your next episode",
    description:
      "Upload an episode to show listeners how your podcast lane will look in public.",
  },
  videos: {
    title: "Your next visual",
    description:
      "Upload a video release so your fan page can showcase premiere-ready visuals.",
  },
  posts: {
    title: "Your next public update",
    description:
      "Public creator posts help fans follow your journey between releases.",
  },
  store: {
    title: "Your next marketplace drop",
    description:
      "Marketplace products appear here when your approved seller store publishes them.",
  },
};

const padNumber = (value) => String(value || 0).padStart(2, "0");

const safeArray = (value) => (Array.isArray(value) ? value : []);

const toId = (value = {}) =>
  String(value?._id || value?.id || "").trim();

const toDateScore = (value = {}) => {
  const nextValue = value?.updatedAt || value?.createdAt || value?.time || null;
  const score = nextValue ? new Date(nextValue).getTime() : 0;
  return Number.isFinite(score) ? score : 0;
};

const isPublished = (value = {}) =>
  String(value?.publishedStatus || "")
    .trim()
    .toLowerCase() === "published";

const sortPreviewEntries = (entries = []) =>
  [...entries].sort((left, right) => {
    const publicationScore = Number(isPublished(right)) - Number(isPublished(left));
    if (publicationScore !== 0) {
      return publicationScore;
    }
    return toDateScore(right) - toDateScore(left);
  });

const resolveFallbackImage = (value = "") => resolveImage(value || "") || "";

const normalizeExternalUrl = (value = "", fallbackPrefix = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  if (/^https?:\/\//i.test(normalized) || /^spotify:/i.test(normalized)) {
    return normalized;
  }
  if (/^(www\.|open\.spotify\.com|spotify\.com|youtube\.com|www\.youtube\.com|m\.youtube\.com|youtu\.be)/i.test(normalized)) {
    return `https://${normalized}`;
  }
  return fallbackPrefix ? `${fallbackPrefix}${normalized}` : normalized;
};

const findLinkUrl = (links = [], label = "") =>
  String(
    (Array.isArray(links)
      ? links.find((entry) => String(entry?.label || "").trim().toLowerCase() === String(label || "").trim().toLowerCase())
      : null)?.url || ""
  ).trim();

export const formatCreatorFanPageFollowerCount = (value = 0) =>
  Number(value || 0).toLocaleString("en-US");

export const formatCreatorFanPageDuration = (seconds = 0) => {
  const totalSeconds = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${padNumber(remainingSeconds)}`;
};

export const getCreatorFanPageInitials = (value = "") =>
  String(value || "Creator")
    .split(/\s+/)
    .slice(0, 2)
    .map((entry) => entry[0] || "")
    .join("")
    .toUpperCase();

export const resolveCreatorFanPageTabKey = (value = "") => {
  const compact = String(value || "").trim().toLowerCase();
  if (compact === "bookpublishing" || compact === "books" || compact === "book") {
    return "books";
  }
  if (compact === "podcast" || compact === "podcasts") {
    return "podcasts";
  }
  if (compact === "video" || compact === "videos") {
    return "videos";
  }
  if (compact === "post" || compact === "posts" || compact === "updates") {
    return "posts";
  }
  if (compact === "store" || compact === "marketplace" || compact === "products") {
    return "store";
  }
  if (compact === "overview") {
    return "overview";
  }
  return "music";
};

const resolveSectionCategoryKey = (tabKey = "") => {
  if (tabKey === "books") {
    return "bookPublishing";
  }
  if (tabKey === "podcasts") {
    return "podcast";
  }
  return "music";
};

const resolveUploadPath = (categoryKey = "") =>
  UPLOAD_PATHS[categoryKey] || UPLOAD_PATHS.music;

const buildPublicPath = ({
  creatorProfileId = "",
  categoryKey = "music",
  previewItemId = "",
}) =>
  buildCreatorAudiencePath({
    creatorProfileId,
    categoryKey,
    previewItemId,
  }) || resolveUploadPath(categoryKey);

const buildFallbackItem = ({
  tabKey,
  creatorName,
  avatarUrl,
  heroUrl,
  publicPath,
  uploadPath,
}) => {
  const defaults = SECTION_DEFAULTS[tabKey] || SECTION_DEFAULTS.music;
  const itemType =
    tabKey === "books"
      ? "book"
      : tabKey === "podcasts"
        ? "podcast"
        : tabKey === "videos"
          ? "video"
          : tabKey === "posts"
            ? "post"
            : tabKey === "store"
              ? "product"
              : "track";

  return {
    id: "",
    title: defaults.title,
    subtitle: creatorName,
    description: defaults.description,
    imageUrl: heroUrl || avatarUrl,
    price: 0,
    duration: "",
    itemType,
    tabKey,
    categoryKey: resolveSectionCategoryKey(tabKey),
    releaseType:
      tabKey === "books"
        ? "Book"
        : tabKey === "podcasts"
          ? "Episode"
          : tabKey === "videos"
            ? "Video"
            : tabKey === "posts"
              ? "Public Post"
              : tabKey === "store"
                ? "Product"
                : "Release",
    genre: "",
    status: "draft",
    statusLabel: "No live release yet",
    detailPath: uploadPath,
    publicPath: publicPath || uploadPath,
    previewPath: uploadPath,
    uploadPath,
    metricValue: 0,
    metricLabel:
      tabKey === "books"
        ? "downloads"
        : tabKey === "videos"
          ? "views"
          : tabKey === "posts"
            ? "comments"
            : tabKey === "store"
              ? "products"
              : "plays",
    secondaryLine:
      tabKey === "books"
        ? "Upload a manuscript"
        : tabKey === "podcasts"
          ? "Upload an episode"
          : tabKey === "videos"
            ? "Upload a video"
            : tabKey === "posts"
              ? "Publish a public post"
              : tabKey === "store"
                ? "Publish a marketplace product"
                : "Upload a release",
    primaryActionLabel: "Open studio",
    detailActionLabel: "Open studio",
    durationSec: 0,
    audioUrl: "",
    previewAudioUrl: "",
    videoUrl: "",
    previewVideoUrl: "",
    previewStartSec: 0,
    previewLimitSec: 30,
    isPlayableAudio: false,
    isPlayableVideo: false,
  };
};

const normalizePreviewItem = ({
  entry,
  creatorName,
  creatorProfileId,
  tabKey,
  categoryKey,
  itemType,
  avatarUrl,
  heroUrl,
}) => {
  const id = toId(entry);
  const normalizedStatus = isPublished(entry) ? "published" : "draft";
  const uploadPath = resolveUploadPath(categoryKey);
  const fallbackPublicPath = buildPublicPath({
    creatorProfileId,
    categoryKey,
  });
  const publicPath = buildPublicPath({
    creatorProfileId,
    categoryKey,
    previewItemId: normalizedStatus === "published" ? id : "",
  });
  const detailPath = buildReleaseDetailPath({
    itemType,
    itemId: id,
    fallbackPath: publicPath || fallbackPublicPath || uploadPath,
  });

  const imageUrl =
    resolveFallbackImage(entry?.coverImageUrl) ||
    resolveFallbackImage(entry?.coverUrl) ||
    resolveFallbackImage(entry?.thumbnailUrl) ||
    heroUrl ||
    avatarUrl;
  const mediaType =
    String(
      entry?.mediaType ||
        (itemType === "video" ? "video" : "audio")
    )
      .trim()
      .toLowerCase() === "video"
      ? "video"
      : "audio";
  const audioUrl =
    mediaType === "audio" && ["track", "podcast"].includes(itemType)
      ? resolveFallbackImage(entry?.audioUrl) ||
        resolveFallbackImage(entry?.fullAudioUrl) ||
        ""
      : "";
  const previewAudioUrl =
    mediaType === "audio" && ["track", "podcast"].includes(itemType)
      ? resolveFallbackImage(entry?.previewUrl) || ""
      : "";
  const videoUrl =
    itemType === "video"
      ? resolveFallbackImage(entry?.videoUrl) || ""
      : "";
  const previewVideoUrl =
    itemType === "video"
      ? resolveFallbackImage(entry?.previewClipUrl) || ""
      : "";

  const price = Number(entry?.price ?? 0);
  const title =
    entry?.title ||
    entry?.caption ||
    SECTION_DEFAULTS[tabKey]?.title ||
    "Untitled release";
  const subtitle =
    entry?.artistName ||
    entry?.authorName ||
    entry?.podcastSeries ||
    entry?.seriesTitle ||
    creatorName;
  const duration =
    Number(entry?.durationSec || 0) > 0
      ? formatCreatorFanPageDuration(entry.durationSec)
      : "";
  const secondaryLine =
    itemType === "book"
      ? [
          entry?.genre || "",
          Number(entry?.pageCount || 0) > 0 ? `${Number(entry.pageCount)} pages` : "",
        ]
          .filter(Boolean)
          .join(" / ")
      : itemType === "podcast"
        ? [
            entry?.podcastSeries || entry?.podcastCategory || "",
            duration,
          ]
            .filter(Boolean)
            .join(" / ")
        : itemType === "video"
          ? [
              entry?.contentType || "Music video",
              duration,
            ]
              .filter(Boolean)
              .join(" / ")
          : [
              entry?.genre || entry?.releaseType || entry?.contentType || "",
              duration,
            ]
              .filter(Boolean)
              .join(" / ");

  return {
    id,
    title,
    subtitle,
    description:
      entry?.description ||
      SECTION_DEFAULTS[tabKey]?.description ||
      "This upload will appear here once the creator page refreshes.",
    imageUrl,
    price,
    duration,
    itemType,
    tabKey,
    categoryKey,
    releaseType:
      entry?.releaseType ||
      entry?.contentType ||
      (itemType === "book"
        ? "Book"
        : itemType === "podcast"
          ? "Episode"
          : itemType === "video"
            ? "Video"
            : "Single"),
    genre:
      entry?.genre ||
      entry?.podcastCategory ||
      entry?.language ||
      "",
    status: normalizedStatus,
    statusLabel:
      normalizedStatus === "published"
        ? "Live on public page"
        : "Draft in workspace",
    detailPath: detailPath || uploadPath,
    publicPath: publicPath || fallbackPublicPath || uploadPath,
    previewPath:
      normalizedStatus === "published"
        ? publicPath || fallbackPublicPath || detailPath || uploadPath
        : detailPath || uploadPath,
    uploadPath,
    metricValue: Number(
      entry?.playsCount ||
        entry?.playCount ||
        entry?.purchaseCount ||
        entry?.viewsCount ||
        0
    ),
    metricLabel:
      itemType === "book"
        ? "downloads"
        : itemType === "video"
          ? "views"
          : "plays",
    secondaryLine,
    primaryActionLabel:
      normalizedStatus === "published"
        ? itemType === "book"
          ? "Read preview"
          : itemType === "podcast"
            ? "Listen now"
            : itemType === "video"
              ? "Watch now"
              : "Play preview"
        : "Open studio",
    detailActionLabel:
      itemType === "book"
        ? "Open book"
        : itemType === "podcast"
          ? "Open episode"
          : itemType === "video"
            ? "Open video"
            : "Open release",
    durationSec: Number(entry?.durationSec || 0),
    audioUrl,
    previewAudioUrl,
    videoUrl,
    previewVideoUrl,
    previewStartSec: Math.max(0, Number(entry?.previewStartSec || 0)),
    previewLimitSec: Math.max(0, Number(entry?.previewLimitSec || 30)),
    isPlayableAudio: Boolean(audioUrl || previewAudioUrl),
    isPlayableVideo: itemType === "video" && Boolean(videoUrl || previewVideoUrl),
  };
};

const normalizePublicPath = (value = "", fallback = "") =>
  String(value || fallback || "").trim();

const getPublicItemMetric = (entry = {}, itemType = "") => {
  if (itemType === "book") {
    return Number(entry.purchaseCount || entry.downloadCount || 0);
  }
  if (itemType === "video") {
    return Number(entry.viewsCount || entry.metricValue || 0);
  }
  if (itemType === "post") {
    return Number(entry.commentsCount || entry.reactionsCount || 0);
  }
  if (itemType === "product") {
    return Number(entry.stock || 0);
  }
  return Number(entry.playsCount || entry.playCount || entry.metricValue || 0);
};

const normalizePublicFanPageItem = ({
  entry,
  creatorName,
  tabKey,
  itemType,
  fallbackImage,
  fallbackPath,
}) => {
  const id = String(entry?.id || entry?._id || "").trim();
  const mediaType = String(entry?.mediaType || "").trim().toLowerCase();
  const isVideo = itemType === "video" || mediaType === "video";
  const isAudio = ["track", "album", "podcast"].includes(itemType) && !isVideo;
  const isBook = itemType === "book" || mediaType === "document";
  const isProduct = itemType === "product";
  const isPost = itemType === "post";
  const imageUrl = resolveFallbackImage(
    entry?.coverUrl ||
      entry?.coverImageUrl ||
      entry?.thumbnailUrl ||
      entry?.imageUrl ||
      entry?.primaryImage?.secureUrl ||
      entry?.primaryImage?.url
  ) || fallbackImage;
  const publicPath = normalizePublicPath(
    entry?.publicPath || entry?.route || entry?.detailPath,
    fallbackPath
  );
  const title =
    entry?.title ||
    (isPost ? "Public creator update" : isProduct ? "Marketplace product" : "Creator release");
  const price = Number(entry?.price || 0);
  const duration =
    Number(entry?.durationSec || 0) > 0
      ? formatCreatorFanPageDuration(entry.durationSec)
      : "";
  const secondaryLine =
    entry?.secondaryLine ||
    (isBook
      ? [
          entry?.genre || "",
          Number(entry?.pageCount || 0) > 0 ? `${Number(entry.pageCount)} pages` : "",
          entry?.language || "",
        ]
          .filter(Boolean)
          .join(" / ")
      : isPost
        ? [
            Number(entry?.commentsCount || 0) ? `${Number(entry.commentsCount)} comments` : "",
            Number(entry?.reactionsCount || 0) ? `${Number(entry.reactionsCount)} reactions` : "",
          ]
            .filter(Boolean)
            .join(" / ")
        : isProduct
          ? [
              entry?.category || "Marketplace",
              Number(entry?.stock || 0) > 0 ? `${Number(entry.stock)} in stock` : "Limited stock",
            ]
              .filter(Boolean)
              .join(" / ")
          : [
              entry?.genre || entry?.releaseType || entry?.contentLabel || "",
              duration,
            ]
              .filter(Boolean)
              .join(" / "));

  return {
    id,
    title,
    subtitle:
      entry?.subtitle ||
      entry?.authorName ||
      entry?.podcastSeries ||
      entry?.seller?.storeName ||
      creatorName,
    description:
      entry?.description ||
      entry?.text ||
      SECTION_DEFAULTS[tabKey]?.description ||
      "Published creator content appears here.",
    imageUrl,
    price,
    currency: entry?.currency || "NGN",
    duration,
    itemType,
    tabKey,
    categoryKey: resolveSectionCategoryKey(tabKey),
    releaseType:
      entry?.releaseType ||
      entry?.contentLabel ||
      (isBook
        ? "Book"
        : itemType === "podcast"
          ? "Episode"
          : isVideo
            ? "Video"
            : isPost
              ? "Public Post"
              : isProduct
                ? "Product"
                : itemType === "album"
                  ? "Album"
                  : "Single"),
    genre: entry?.genre || entry?.category || "",
    status: "published",
    statusLabel:
      entry?.statusLabel ||
      (entry?.canAccessFull ? "Unlocked" : price > 0 ? "Premium" : "Public"),
    detailPath: publicPath,
    publicPath,
    previewPath: normalizePublicPath(entry?.previewUrl || entry?.previewPath, publicPath),
    uploadPath: fallbackPath,
    metricValue: getPublicItemMetric(entry, itemType),
    metricLabel:
      isBook
        ? "downloads"
        : isVideo
          ? "views"
          : isPost
            ? "comments"
            : isProduct
              ? "stock"
              : "plays",
    secondaryLine,
    primaryActionLabel:
      isBook
        ? "Read preview"
        : itemType === "podcast"
          ? "Listen now"
          : isVideo
            ? "Watch now"
            : isPost
              ? "Open post"
              : isProduct
                ? "View product"
                : "Play preview",
    detailActionLabel:
      price > 0 && !entry?.canAccessFull
        ? isProduct
          ? "Purchase"
          : "Purchase"
        : isBook
          ? "Open book"
          : itemType === "podcast"
            ? "Open episode"
            : isVideo
              ? "Open video"
              : isPost
                ? "Comment"
                : isProduct
                  ? "Purchase"
                  : "Open release",
    durationSec: Number(entry?.durationSec || 0),
    audioUrl:
      isAudio && (entry?.canAccessFull || Number(entry?.price || 0) <= 0)
        ? resolveFallbackImage(entry?.streamUrl || entry?.audioUrl)
        : "",
    previewAudioUrl:
      isAudio
        ? resolveFallbackImage(entry?.previewUrl || entry?.streamUrl || entry?.previewAudioUrl)
        : "",
    videoUrl:
      isVideo && (entry?.canAccessFull || Number(entry?.price || 0) <= 0)
        ? resolveFallbackImage(entry?.streamUrl || entry?.videoUrl)
        : "",
    previewVideoUrl:
      isVideo
        ? resolveFallbackImage(entry?.previewUrl || entry?.previewClipUrl || entry?.streamUrl)
        : "",
    previewStartSec: Math.max(0, Number(entry?.previewStartSec || 0)),
    previewLimitSec: Math.max(0, Number(entry?.previewLimitSec || 30)),
    canAccessFull: Boolean(entry?.canAccessFull),
    canBuy: Boolean(entry?.canBuy || (price > 0 && !entry?.canAccessFull)),
    canDownload: Boolean(entry?.canDownload),
    downloadUrl: entry?.downloadUrl || "",
    route: publicPath,
    isPlayableAudio: Boolean(
      isAudio && (entry?.previewUrl || entry?.streamUrl || entry?.audioUrl)
    ),
    isPlayableVideo: Boolean(
      isVideo && (entry?.previewUrl || entry?.previewClipUrl || entry?.streamUrl || entry?.videoUrl)
    ),
    commentsCount: Number(entry?.commentsCount || 0),
    reactionsCount: Number(entry?.reactionsCount || 0),
    shareCount: Number(entry?.shareCount || 0),
    stock: Number(entry?.stock || 0),
    seller: entry?.seller || null,
  };
};

const buildSection = ({
  key,
  label,
  title,
  description,
  items,
  publicPath,
  uploadPath,
  fallbackItem,
}) => {
  const queue = items.length ? items : [fallbackItem];
  return {
    key,
    label,
    title,
    description,
    featured: queue[0],
    items: queue,
    publicPath: publicPath || uploadPath,
    uploadPath,
  };
};

const buildPopularReleaseRows = ({
  items,
  creatorName,
  fallbackItem,
}) => {
  const baseRows = items.length ? items.slice(0, 3) : [fallbackItem];
  return baseRows.map((item, index) => ({
    id: item.id || `fallback-${index + 1}`,
    title: item.title,
    subtitle: item.subtitle || creatorName,
    listens: Number(item.metricValue || 0),
    duration: item.duration || "",
    imageUrl: item.imageUrl || fallbackItem.imageUrl,
    previewPath: item.previewPath,
    detailPath: item.detailPath,
    statusLabel: item.statusLabel,
  }));
};

export function buildCreatorFanPageDataFromPublicPayload(payload = {}) {
  const creator = payload?.creator || {};
  const subscription = payload?.subscription || {};
  const creatorName = creator?.displayName || "Creator";
  const creatorId = String(creator?.id || "").trim();
  const creatorUserId = String(creator?.userId || "").trim();
  const publicPaths = creator?.tabPaths || {};
  const creatorHomePath =
    creator?.canonicalPath ||
    publicPaths.home ||
    (creatorId ? `/creators/${encodeURIComponent(creatorId)}` : "/creators");
  const avatarUrl = resolveFallbackImage(creator?.avatarUrl) || "";
  const heroUrl = resolveFallbackImage(creator?.bannerUrl) || avatarUrl;
  const fallbackImage = heroUrl || avatarUrl;
  const lanes = normalizeCreatorLaneKeys(creator?.creatorTypes)
    .map((entry) => formatCreatorLaneLabel(entry))
    .filter(Boolean);
  const musicPath = publicPaths.music || creatorHomePath;
  const booksPath = publicPaths.books || creatorHomePath;
  const podcastsPath = publicPaths.podcasts || creatorHomePath;
  const videosPath = publicPaths.music || creatorHomePath;
  const postsPath = creatorHomePath;
  const storePath = payload?.marketplace?.storePath || publicPaths.store || `${creatorHomePath}/store`;

  const trackItems = safeArray(payload?.music?.tracks).map((entry) =>
    normalizePublicFanPageItem({
      entry,
      creatorName,
      tabKey: "music",
      itemType: "track",
      fallbackImage,
      fallbackPath: musicPath,
    })
  );
  const albumItems = safeArray(payload?.music?.albums).map((entry) =>
    normalizePublicFanPageItem({
      entry,
      creatorName,
      tabKey: "music",
      itemType: "album",
      fallbackImage,
      fallbackPath: publicPaths.albums || musicPath,
    })
  );
  const videoItems = safeArray(payload?.music?.videos).map((entry) =>
    normalizePublicFanPageItem({
      entry,
      creatorName,
      tabKey: "videos",
      itemType: "video",
      fallbackImage,
      fallbackPath: videosPath,
    })
  );
  const bookItems = safeArray(payload?.books).map((entry) =>
    normalizePublicFanPageItem({
      entry,
      creatorName,
      tabKey: "books",
      itemType: "book",
      fallbackImage,
      fallbackPath: booksPath,
    })
  );
  const podcastItems = safeArray(payload?.podcasts?.episodes).map((entry) =>
    normalizePublicFanPageItem({
      entry,
      creatorName,
      tabKey: "podcasts",
      itemType: "podcast",
      fallbackImage,
      fallbackPath: podcastsPath,
    })
  );
  const postItems = safeArray(payload?.posts).map((entry) =>
    normalizePublicFanPageItem({
      entry,
      creatorName,
      tabKey: "posts",
      itemType: "post",
      fallbackImage,
      fallbackPath: postsPath,
    })
  );
  const productItems = safeArray(payload?.marketplace?.products).map((entry) =>
    normalizePublicFanPageItem({
      entry,
      creatorName,
      tabKey: "store",
      itemType: "product",
      fallbackImage,
      fallbackPath: storePath || "/marketplace",
    })
  );

  const fallbackMusic = buildFallbackItem({
    tabKey: "music",
    creatorName,
    avatarUrl,
    heroUrl,
    publicPath: musicPath,
    uploadPath: musicPath,
  });
  const fallbackBooks = buildFallbackItem({
    tabKey: "books",
    creatorName,
    avatarUrl,
    heroUrl,
    publicPath: booksPath,
    uploadPath: booksPath,
  });
  const fallbackPodcasts = buildFallbackItem({
    tabKey: "podcasts",
    creatorName,
    avatarUrl,
    heroUrl,
    publicPath: podcastsPath,
    uploadPath: podcastsPath,
  });
  const fallbackVideos = buildFallbackItem({
    tabKey: "videos",
    creatorName,
    avatarUrl,
    heroUrl,
    publicPath: videosPath,
    uploadPath: videosPath,
  });
  const fallbackPosts = buildFallbackItem({
    tabKey: "posts",
    creatorName,
    avatarUrl,
    heroUrl,
    publicPath: postsPath,
    uploadPath: postsPath,
  });
  const fallbackStore = buildFallbackItem({
    tabKey: "store",
    creatorName,
    avatarUrl,
    heroUrl,
    publicPath: storePath || "/marketplace",
    uploadPath: storePath || "/marketplace",
  });

  const musicItems = [...trackItems, ...albumItems];
  const overviewItems = [
    ...musicItems,
    ...bookItems,
    ...podcastItems,
    ...videoItems,
    ...postItems,
    ...productItems,
  ];
  const overviewFallback =
    overviewItems[0] ||
    fallbackMusic ||
    fallbackBooks ||
    fallbackPodcasts ||
    fallbackVideos;
  const primaryMusic = musicItems[0] || fallbackMusic;
  const primaryBook = bookItems[0] || fallbackBooks;
  const primaryPodcast = podcastItems[0] || fallbackPodcasts;
  const primaryVideo = videoItems[0] || fallbackVideos;
  const primaryPost = postItems[0] || fallbackPosts;
  const primaryProduct = productItems[0] || fallbackStore;
  const stats = payload?.stats || {};

  const sections = {
    overview: buildSection({
      key: "overview",
      label: "Overview",
      title: "Premium Fan Overview",
      description:
        "A live snapshot of this creator's public releases, updates, products, and supporter access.",
      items: overviewItems,
      publicPath: creatorHomePath,
      uploadPath: creatorHomePath,
      fallbackItem: overviewFallback,
    }),
    music: buildSection({
      key: "music",
      label: "Music",
      title: "Music Releases",
      description: "Tracks, albums, and audio drops published for fans.",
      items: musicItems,
      publicPath: musicPath,
      uploadPath: musicPath,
      fallbackItem: fallbackMusic,
    }),
    books: buildSection({
      key: "books",
      label: "Books",
      title: "Books by the creator",
      description: "Published books, previews, and premium reader unlocks.",
      items: bookItems,
      publicPath: booksPath,
      uploadPath: booksPath,
      fallbackItem: fallbackBooks,
    }),
    podcasts: buildSection({
      key: "podcasts",
      label: "Podcasts",
      title: "Podcast Episodes",
      description: "Podcast episodes and spoken-word releases.",
      items: podcastItems,
      publicPath: podcastsPath,
      uploadPath: podcastsPath,
      fallbackItem: fallbackPodcasts,
    }),
    videos: buildSection({
      key: "videos",
      label: "Videos",
      title: "Video Library",
      description: "Music videos and visual drops published for fans.",
      items: videoItems,
      publicPath: videosPath,
      uploadPath: videosPath,
      fallbackItem: fallbackVideos,
    }),
    posts: buildSection({
      key: "posts",
      label: "Posts",
      title: "Public Posts",
      description: "Creator updates fans can read without logging in.",
      items: postItems,
      publicPath: postsPath,
      uploadPath: postsPath,
      fallbackItem: fallbackPosts,
    }),
    store: buildSection({
      key: "store",
      label: "Store",
      title: "Marketplace Products",
      description: "Approved marketplace drops from this creator.",
      items: productItems,
      publicPath: storePath || "/marketplace",
      uploadPath: storePath || "/marketplace",
      fallbackItem: fallbackStore,
    }),
  };

  const creatorLinks = Array.isArray(creator?.links) ? creator.links : [];
  const spotifyUrl =
    normalizeExternalUrl(findLinkUrl(creatorLinks, "spotify"), "https://open.spotify.com/artist/") ||
    musicPath;
  const youtubeUrl =
    normalizeExternalUrl(findLinkUrl(creatorLinks, "youtube"), "https://www.youtube.com/@") ||
    videosPath;

  return {
    creatorId,
    creatorUserId,
    creatorName,
    avatarUrl,
    heroUrl,
    followers: Number(stats.followersCount || creator.followersCount || 0),
    tagline:
      creator?.bio ||
      creator?.tagline ||
      "A premium fan page where supporters can stream, read, buy, follow, and unlock every creator drop in one place.",
    lanes: lanes.length ? lanes : ["Music", "Podcasts", "Book Publishing"],
    supportPrice: Number(subscription?.price ?? creator?.subscriptionPrice ?? 2000) || 2000,
    subscriptionBenefits: Array.isArray(subscription?.benefits)
      ? subscription.benefits.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [],
    tabs: CREATOR_FAN_PAGE_TABS,
    sidebarLinks: CREATOR_FAN_PAGE_TABS,
    sections,
    publicPaths: {
      home: creatorHomePath,
      music: musicPath,
      books: booksPath,
      podcasts: podcastsPath,
      videos: videosPath,
      posts: postsPath,
      store: storePath,
    },
    uploadPaths: {},
    stats: [
      {
        label: "Followers",
        value: formatCreatorFanPageFollowerCount(stats.followersCount || creator.followersCount || 0),
      },
      {
        label: "Plays",
        value: formatCreatorFanPageFollowerCount(stats.totalPlays || 0),
      },
      {
        label: "Music",
        value: Number(stats.totalTracks || 0) + Number(stats.totalAlbums || 0) + Number(stats.totalVideos || 0),
      },
      {
        label: "Books",
        value: Number(stats.totalBooks || bookItems.length || 0),
      },
      {
        label: "Posts",
        value: Number(stats.totalPosts || postItems.length || 0),
      },
      {
        label: "Products",
        value: Number(stats.totalProducts || productItems.length || 0),
      },
    ],
    music: {
      ...primaryMusic,
      coverUrl: primaryMusic.imageUrl,
      queueCount: String(Math.max(1, musicItems.length)).padStart(2, "0"),
      listeners: Number(primaryMusic.metricValue || 0),
    },
    popularReleases: buildPopularReleaseRows({
      items: musicItems,
      creatorName,
      fallbackItem: fallbackMusic,
    }),
    book: {
      ...primaryBook,
      author: primaryBook.subtitle,
      imprint: primaryBook.secondaryLine || primaryBook.genre || "Book publishing",
      coverUrl: primaryBook.imageUrl,
    },
    podcast: {
      ...primaryPodcast,
      series: primaryPodcast.subtitle,
      summary: primaryPodcast.description,
      coverUrl: primaryPodcast.imageUrl,
    },
    video: {
      ...primaryVideo,
      channel: creatorName,
      summary: primaryVideo.description,
      thumbnailUrl: primaryVideo.imageUrl,
    },
    post: primaryPost,
    product: primaryProduct,
    publicPosts: postItems,
    marketplaceProducts: productItems,
    marketplaceStorePath: storePath,
    marketplaceSeller: payload?.marketplace?.seller || null,
    platforms: [
      {
        label: "Stream on Spotify",
        tone: "dark",
        path: spotifyUrl,
        url: spotifyUrl,
      },
      {
        label: "Stream on Youtube",
        tone: "green",
        path: youtubeUrl,
        url: youtubeUrl,
      },
    ],
    supporterCopy:
      subscription?.description ||
      "Supporters unlock endless streams, premium downloads, and direct support access from the public page.",
    rewardsCopy:
      subscription?.isSubscribed
        ? "Membership is active. Premium streams and downloads are unlocked for this account."
        : "Support this creator to unlock premium streams, downloads, and member rewards.",
    viewer: payload?.viewer || {},
    subscription,
    creator,
  };
}

export function buildCreatorFanPageData({ creatorProfile, dashboard } = {}) {
  const creatorName =
    creatorProfile?.displayName ||
    creatorProfile?.fullName ||
    creatorProfile?.user?.name ||
    "Creator";
  const creatorProfileId = String(creatorProfile?._id || "").trim();
  const lanes = normalizeCreatorLaneKeys(creatorProfile?.creatorTypes)
    .map((entry) => formatCreatorLaneLabel(entry))
    .filter(Boolean);

  const musicContent = dashboard?.content?.music || {};
  const bookContent = dashboard?.content?.books || {};
  const podcastContent = dashboard?.content?.podcasts || {};

  const sortedTracks = sortPreviewEntries(safeArray(musicContent.tracks));
  const sortedAlbums = sortPreviewEntries(safeArray(musicContent.albums));
  const sortedVideos = sortPreviewEntries(safeArray(musicContent.videos));
  const sortedBooks = sortPreviewEntries(safeArray(bookContent.items));
  const sortedPodcasts = sortPreviewEntries(safeArray(podcastContent.episodes));

  const firstTrack = sortedTracks[0];
  const firstVideo = sortedVideos[0];
  const avatarUrl =
    resolveFallbackImage(creatorProfile?.user?.avatar) ||
    resolveFallbackImage(creatorProfile?.coverImageUrl) ||
    resolveFallbackImage(firstTrack?.coverImageUrl) ||
    resolveFallbackImage(firstVideo?.thumbnailUrl) ||
    "";
  const heroUrl =
    resolveFallbackImage(creatorProfile?.heroBannerUrl) ||
    resolveFallbackImage(creatorProfile?.coverImageUrl) ||
    resolveFallbackImage(firstTrack?.coverImageUrl) ||
    resolveFallbackImage(firstVideo?.thumbnailUrl) ||
    avatarUrl;

  const publicPaths = {
    music: buildPublicPath({ creatorProfileId, categoryKey: "music" }),
    books: buildPublicPath({ creatorProfileId, categoryKey: "bookPublishing" }),
    podcasts: buildPublicPath({ creatorProfileId, categoryKey: "podcast" }),
    videos: buildPublicPath({ creatorProfileId, categoryKey: "music" }),
  };

  const creatorLinks = Array.isArray(creatorProfile?.links) ? creatorProfile.links : [];
  const spotifyUrl =
    normalizeExternalUrl(
      findLinkUrl(creatorLinks, "spotify") || creatorProfile?.socialHandles?.spotify,
      "https://open.spotify.com/artist/"
    ) || publicPaths.music;
  const youtubeUrl =
    normalizeExternalUrl(
      findLinkUrl(creatorLinks, "youtube") || creatorProfile?.socialHandles?.youtube,
      "https://www.youtube.com/@"
    ) || publicPaths.videos;

  const fallbackMusic = buildFallbackItem({
    tabKey: "music",
    creatorName,
    avatarUrl,
    heroUrl,
    publicPath: publicPaths.music,
    uploadPath: UPLOAD_PATHS.music,
  });
  const fallbackBooks = buildFallbackItem({
    tabKey: "books",
    creatorName,
    avatarUrl,
    heroUrl,
    publicPath: publicPaths.books,
    uploadPath: UPLOAD_PATHS.bookPublishing,
  });
  const fallbackPodcasts = buildFallbackItem({
    tabKey: "podcasts",
    creatorName,
    avatarUrl,
    heroUrl,
    publicPath: publicPaths.podcasts,
    uploadPath: UPLOAD_PATHS.podcast,
  });
  const fallbackVideos = buildFallbackItem({
    tabKey: "videos",
    creatorName,
    avatarUrl,
    heroUrl,
    publicPath: publicPaths.videos,
    uploadPath: UPLOAD_PATHS.music,
  });
  const fallbackPosts = buildFallbackItem({
    tabKey: "posts",
    creatorName,
    avatarUrl,
    heroUrl,
    publicPath: "/home",
    uploadPath: "/home",
  });
  const fallbackStore = buildFallbackItem({
    tabKey: "store",
    creatorName,
    avatarUrl,
    heroUrl,
    publicPath: "/marketplace",
    uploadPath: "/marketplace/dashboard",
  });

  const trackItems = sortedTracks.map((entry) =>
    normalizePreviewItem({
      entry,
      creatorName,
      creatorProfileId,
      tabKey: "music",
      categoryKey: "music",
      itemType: "track",
      avatarUrl,
      heroUrl,
    })
  );
  const albumItems = sortedAlbums.map((entry) =>
    normalizePreviewItem({
      entry,
      creatorName,
      creatorProfileId,
      tabKey: "music",
      categoryKey: "music",
      itemType: "album",
      avatarUrl,
      heroUrl,
    })
  );
  const videoItems = sortedVideos.map((entry) =>
    normalizePreviewItem({
      entry,
      creatorName,
      creatorProfileId,
      tabKey: "videos",
      categoryKey: "music",
      itemType: "video",
      avatarUrl,
      heroUrl,
    })
  );
  const bookItems = sortedBooks.map((entry) =>
    normalizePreviewItem({
      entry,
      creatorName,
      creatorProfileId,
      tabKey: "books",
      categoryKey: "bookPublishing",
      itemType: "book",
      avatarUrl,
      heroUrl,
    })
  );
  const podcastItems = sortedPodcasts.map((entry) =>
    normalizePreviewItem({
      entry,
      creatorName,
      creatorProfileId,
      tabKey: "podcasts",
      categoryKey: "podcast",
      itemType: "podcast",
      avatarUrl,
      heroUrl,
    })
  );

  const musicItems = [...trackItems, ...albumItems];
  const overviewItems = [
    ...(musicItems.length ? musicItems : []),
    ...(bookItems.length ? bookItems : []),
    ...(podcastItems.length ? podcastItems : []),
    ...(videoItems.length ? videoItems : []),
  ];

  const overviewFallback = musicItems[0] || bookItems[0] || podcastItems[0] || videoItems[0] || fallbackMusic;
  const primaryMusic = musicItems[0] || fallbackMusic;
  const primaryBook = bookItems[0] || fallbackBooks;
  const primaryPodcast = podcastItems[0] || fallbackPodcasts;
  const primaryVideo = videoItems[0] || fallbackVideos;

  const sections = {
    overview: buildSection({
      key: "overview",
      label: "Overview",
      title: "Fan Page overview",
      description:
        "A quick live snapshot of how your public creator page presents your latest uploads.",
      items: overviewItems,
      publicPath: "/creator/fan-page-view",
      uploadPath: "/creator/dashboard",
      fallbackItem: overviewFallback,
    }),
    music: buildSection({
      key: "music",
      label: "Music",
      title: "Popular Releases",
      description: "Tracks, albums, and release-ready music uploads from your workspace.",
      items: musicItems,
      publicPath: publicPaths.music,
      uploadPath: UPLOAD_PATHS.music,
      fallbackItem: fallbackMusic,
    }),
    books: buildSection({
      key: "books",
      label: "Books",
      title: "Books by the creator",
      description: "Books uploaded in the creator workspace and ready for readers.",
      items: bookItems,
      publicPath: publicPaths.books,
      uploadPath: UPLOAD_PATHS.bookPublishing,
      fallbackItem: fallbackBooks,
    }),
    podcasts: buildSection({
      key: "podcasts",
      label: "Podcasts",
      title: "Featured Episode",
      description: "Podcast episodes queued for public listening and premium unlocks.",
      items: podcastItems,
      publicPath: publicPaths.podcasts,
      uploadPath: UPLOAD_PATHS.podcast,
      fallbackItem: fallbackPodcasts,
    }),
    videos: buildSection({
      key: "videos",
      label: "Videos",
      title: "Featured Visual",
      description: "Music videos and visual drops that will appear inside the public page.",
      items: videoItems,
      publicPath: publicPaths.videos,
      uploadPath: UPLOAD_PATHS.music,
      fallbackItem: fallbackVideos,
    }),
    posts: buildSection({
      key: "posts",
      label: "Posts",
      title: "Public Posts",
      description: "Public posts that keep fans close between major releases.",
      items: [],
      publicPath: "/home",
      uploadPath: "/home",
      fallbackItem: fallbackPosts,
    }),
    store: buildSection({
      key: "store",
      label: "Store",
      title: "Marketplace Products",
      description: "Approved store products that fans can purchase from the public page.",
      items: [],
      publicPath: "/marketplace",
      uploadPath: "/marketplace/dashboard",
      fallbackItem: fallbackStore,
    }),
  };

  return {
    creatorId: creatorProfileId,
    creatorUserId: String(creatorProfile?.user?._id || creatorProfile?.user?.id || "").trim(),
    creatorName,
    avatarUrl,
    heroUrl,
    followers: Number(
      creatorProfile?.user?.followersCount ||
        creatorProfile?.followersCount ||
        0
    ),
    tagline:
      creatorProfile?.bio ||
      creatorProfile?.tagline ||
      "A premium fan page where supporters can stream, preview, buy, and unlock every drop in one place.",
    lanes: lanes.length ? lanes : ["Music", "Podcasts", "Book Publishing"],
    supportPrice: Number(creatorProfile?.subscriptionPrice ?? 2000) || 2000,
    subscriptionBenefits: Array.isArray(creatorProfile?.subscriptionBenefits)
      ? creatorProfile.subscriptionBenefits.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [],
    tabs: CREATOR_FAN_PAGE_TABS,
    sidebarLinks: CREATOR_FAN_PAGE_TABS,
    sections,
    publicPaths,
    uploadPaths: {
      music: UPLOAD_PATHS.music,
      books: UPLOAD_PATHS.bookPublishing,
      podcasts: UPLOAD_PATHS.podcast,
      videos: UPLOAD_PATHS.music,
    },
    stats: [
      {
        label: "Tracks",
        value:
          Number(dashboard?.categories?.music?.uploads || 0) || musicItems.length || 0,
      },
      {
        label: "Books",
        value:
          Number(dashboard?.categories?.bookPublishing?.uploads || 0) ||
          bookItems.length ||
          0,
      },
      {
        label: "Episodes",
        value:
          Number(dashboard?.categories?.podcast?.uploads || 0) ||
          podcastItems.length ||
          0,
      },
      {
        label: "Videos",
        value: videoItems.length || 0,
      },
      {
        label: "Posts",
        value: 0,
      },
      {
        label: "Products",
        value: 0,
      },
    ],
    music: {
      ...primaryMusic,
      coverUrl: primaryMusic.imageUrl,
      queueCount: String(Math.max(1, musicItems.length)).padStart(2, "0"),
      listeners: Number(primaryMusic.metricValue || 0),
    },
    popularReleases: buildPopularReleaseRows({
      items: musicItems,
      creatorName,
      fallbackItem: fallbackMusic,
    }),
    book: {
      ...primaryBook,
      author: primaryBook.subtitle,
      imprint: primaryBook.secondaryLine || primaryBook.genre || "Book publishing",
      coverUrl: primaryBook.imageUrl,
    },
    podcast: {
      ...primaryPodcast,
      series: primaryPodcast.subtitle,
      summary: primaryPodcast.description,
      coverUrl: primaryPodcast.imageUrl,
    },
    video: {
      ...primaryVideo,
      channel: creatorName,
      summary: primaryVideo.description,
      thumbnailUrl: primaryVideo.imageUrl,
    },
    quickActions: [
      {
        key: "music",
        label: "Music Uploads",
        path: UPLOAD_PATHS.music,
        count: musicItems.length,
      },
      {
        key: "podcasts",
        label: "Podcast Uploads",
        path: UPLOAD_PATHS.podcast,
        count: podcastItems.length,
      },
      {
        key: "books",
        label: "Book Publishing Uploads",
        path: UPLOAD_PATHS.bookPublishing,
        count: bookItems.length,
      },
    ],
    platforms: [
      {
        label: "Stream on Spotify",
        tone: "dark",
        path: spotifyUrl,
        url: spotifyUrl,
      },
      {
        label: "Stream on Youtube",
        tone: "green",
        path: youtubeUrl,
        url: youtubeUrl,
      },
    ],
    supporterCopy:
      creatorProfile?.subscriptionDescription ||
      "Supporters unlock endless streams, premium downloads, and direct support access from the public page.",
    rewardsCopy:
      "Weekly rewards land here for top supporters and subscribers.",
  };
}
