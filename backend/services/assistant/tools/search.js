const Album = require("../../../models/Album");
const Book = require("../../../models/Book");
const Post = require("../../../models/Post");
const Track = require("../../../models/Track");
const { buildCreatorDiscoveryDirectory } = require("../../creatorDiscoveryService");
const {
  buildAction,
  buildCard,
  escapeRegExp,
  safeText,
} = require("./shared");
const {
  ASSISTANT_SEARCH_CONTENT_TYPES,
  searchContentToolInputSchema,
  searchCreatorsToolInputSchema,
} = require("../schemas");

const searchCreatorsTool = {
  name: "searchCreators",
  description: "Search Tengacion creators using a query and optional category.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", minLength: 1, maxLength: 120 },
      category: { type: "string", enum: ["music", "books", "podcasts", "all"] },
    },
    required: ["query"],
    additionalProperties: false,
  },
  inputSchema: searchCreatorsToolInputSchema,
  handler: async ({ query, category = "all" }, context) => {
    const viewerId = context?.user?.id || "";
    const normalizedQuery = safeText(query, 120);
    const search = normalizedQuery
      .replace(/^find\s+/i, "")
      .replace(/^search\s+(for\s+)?/i, "")
      .replace(/\b(creators?|creator|people|profiles?|accounts?)\b$/i, "")
      .trim();
    const payload = await buildCreatorDiscoveryDirectory({
      viewerId,
      search: search || normalizedQuery,
      category,
      sort: "popular",
      page: 1,
      limit: 5,
    });
    const items = Array.isArray(payload?.items) ? payload.items.slice(0, 5) : [];

    return {
      message:
        items.length > 0
        ? `I found ${items.length} creator${items.length === 1 ? "" : "s"} for "${search || normalizedQuery}".`
        : `I couldn't find creators for "${search || normalizedQuery}". Try a broader search or open creator discovery.`,
      actions: [
        buildAction("/find-creators", {
          search: search || normalizedQuery,
          category: category === "all" ? undefined : category,
        }),
      ],
      cards: items.map((item) =>
        buildCard({
          type: "creator",
          title: safeText(item.name || "Creator", 120),
          subtitle: safeText(item.username ? `@${item.username}` : item.category || "Creator", 120),
          description: safeText(item.bio || "A creator on Tengacion.", 240),
          route: safeText(item.route || `/creator/${item.creatorId || ""}`, 160),
          payload: {
            creatorId: item.creatorId || "",
            userId: item.userId || "",
            username: item.username || "",
            category: item.category || "",
          },
        })
      ),
      requiresConfirmation: false,
      pendingAction: null,
    };
  },
};

const normalizeContentType = (value = "all") => {
  const lower = String(value || "all").trim().toLowerCase();
  return ASSISTANT_SEARCH_CONTENT_TYPES.includes(lower) ? lower : "all";
};

const searchContentTool = {
  name: "searchContent",
  description: "Search public Tengacion content across posts, tracks, books, and albums.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", minLength: 1, maxLength: 120 },
      type: { type: "string", enum: ASSISTANT_SEARCH_CONTENT_TYPES },
    },
    required: ["query"],
    additionalProperties: false,
  },
  inputSchema: searchContentToolInputSchema,
  handler: async ({ query, type = "all" }) => {
    const normalizedType = normalizeContentType(type);
    const text = safeText(query, 120);
    const regex = new RegExp(escapeRegExp(text), "i");
    const cards = [];

    const activeFilters = {
      isPublished: { $ne: false },
      archivedAt: null,
    };

    const searchPosts = async () => {
      const posts = await Post.find(
        {
          privacy: "public",
          $or: [{ text: regex }, { hashtags: regex }],
        },
        "_id text author hashtags createdAt"
      )
        .populate({
          path: "author",
          select: "_id name username avatar",
        })
        .sort({ createdAt: -1 })
        .limit(3)
        .lean();

      posts.forEach((post) => {
        cards.push(
          buildCard({
            type: "content",
            title: safeText(post?.text || "Post", 120),
            subtitle: "Post",
            description: safeText(
              Array.isArray(post?.hashtags) ? post.hashtags.map((tag) => `#${tag}`).join(" ") : "",
              240
            ),
            route: `/posts/${post._id}`,
            payload: {
              itemType: "post",
              itemId: String(post._id || ""),
              authorUsername: post?.author?.username || "",
            },
          })
        );
      });
    };

    const searchTracks = async () => {
      const trackQuery = {
        ...activeFilters,
        $or: [
          { title: regex },
          { description: regex },
          { genre: regex },
          { artistName: regex },
          { podcastSeries: regex },
          { showNotes: regex },
          { episodeTags: regex },
        ],
      };
      if (normalizedType === "podcasts") {
        trackQuery.kind = "podcast";
      }
      const tracks = await Track.find(trackQuery)
        .sort({ createdAt: -1 })
        .limit(3)
        .lean();

      tracks.forEach((track) => {
        cards.push(
          buildCard({
            type: "content",
            title: safeText(track.title || "Track", 120),
            subtitle: track.kind === "podcast" ? "Podcast episode" : "Music track",
            description: safeText(track.description || track.podcastSeries || track.genre || "", 240),
            route: `/tracks/${track._id}`,
            payload: {
              itemType: track.kind === "podcast" ? "podcast" : "track",
              itemId: String(track._id || ""),
              creatorId: String(track.creatorId || ""),
            },
          })
        );
      });
    };

    const searchBooks = async () => {
      const books = await Book.find(
        {
          ...activeFilters,
          $or: [
            { title: regex },
            { description: regex },
            { authorName: regex },
            { genre: regex },
            { subtitle: regex },
            { previewExcerptText: regex },
            { tableOfContents: regex },
            { tags: regex },
          ],
        },
        "_id title description authorName genre createdAt"
      )
        .sort({ createdAt: -1 })
        .limit(3)
        .lean();

      books.forEach((book) => {
        cards.push(
          buildCard({
            type: "content",
            title: safeText(book.title || "Book", 120),
            subtitle: "Book",
            description: safeText(book.description || book.genre || "", 240),
            route: `/books/${book._id}`,
            payload: {
              itemType: "book",
              itemId: String(book._id || ""),
              creatorId: String(book.creatorId || ""),
            },
          })
        );
      });
    };

    const searchAlbums = async () => {
      const albums = await Album.find(
        {
          ...activeFilters,
          $or: [{ title: regex }, { description: regex }, { releaseType: regex }],
        },
        "_id title description creatorId createdAt"
      )
        .sort({ createdAt: -1 })
        .limit(3)
        .lean();

      albums.forEach((album) => {
        cards.push(
          buildCard({
            type: "content",
            title: safeText(album.title || "Album", 120),
            subtitle: "Album",
            description: safeText(album.description || "", 240),
            route: `/albums/${album._id}`,
            payload: {
              itemType: "album",
              itemId: String(album._id || ""),
              creatorId: String(album.creatorId || ""),
            },
          })
        );
      });
    };

    if (normalizedType === "posts") {
      await searchPosts();
    } else if (normalizedType === "tracks") {
      await searchTracks();
    } else if (normalizedType === "books") {
      await searchBooks();
    } else if (normalizedType === "albums") {
      await searchAlbums();
    } else if (normalizedType === "podcasts") {
      await searchTracks();
    } else {
      await Promise.all([searchPosts(), searchTracks(), searchBooks(), searchAlbums()]);
    }

    const uniqueCards = [];
    const seenRoutes = new Set();
    for (const card of cards) {
      const routeKey = String(card.route || `${card.type}:${card.title}`).trim();
      if (seenRoutes.has(routeKey)) {
        continue;
      }
      seenRoutes.add(routeKey);
      uniqueCards.push(card);
    }

    return {
      message:
        uniqueCards.length > 0
          ? `I found ${uniqueCards.length} result${uniqueCards.length === 1 ? "" : "s"} for "${text}".`
          : `I couldn't find content for "${text}". Try a different phrase or open search.`,
      actions: [buildAction("/search", { q: text, type: normalizedType === "all" ? "posts" : normalizedType })],
      cards: uniqueCards,
      requiresConfirmation: false,
      pendingAction: null,
    };
  },
};

module.exports = {
  searchCreatorsTool,
  searchContentTool,
};
