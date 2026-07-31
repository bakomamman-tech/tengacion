import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Navbar from "../Navbar";
import Sidebar from "../Sidebar";
import PostCard from "../components/PostCard";
import SeoHead from "../components/seo/SeoHead";
import { getFeed } from "../api";

import "./trending.css";

const FILTERS = [
  { id: "hot", label: "Hot now", description: "Fast-rising conversations", icon: "spark" },
  { id: "new", label: "Newest", description: "Fresh from the community", icon: "clock" },
  { id: "top", label: "Top posts", description: "Most engaged posts", icon: "trophy" },
  { id: "following", label: "Following", description: "People you follow", icon: "users" },
];

const CATEGORIES = [
  { id: "all", label: "All topics", icon: "compass" },
  { id: "technology", label: "Technology", icon: "code" },
  { id: "design", label: "Design", icon: "palette" },
  { id: "business", label: "Business", icon: "briefcase" },
  { id: "creative", label: "Creative", icon: "sparkles" },
  { id: "entertainment", label: "Entertainment", icon: "play" },
  { id: "news", label: "News", icon: "news" },
];

const CATEGORY_KEYWORDS = {
  technology: [
    "ai",
    "app",
    "code",
    "coding",
    "developer",
    "digital",
    "innovation",
    "mobile",
    "software",
    "startup",
    "tech",
    "technology",
    "web",
  ],
  design: ["art", "brand", "design", "designer", "fashion", "graphic", "illustration", "product", "ui", "ux"],
  business: ["business", "career", "commerce", "economy", "entrepreneur", "finance", "founder", "market", "money", "sales"],
  creative: ["author", "book", "creative", "creator", "drawing", "photography", "poetry", "story", "writing"],
  entertainment: ["comedy", "concert", "entertainment", "film", "gaming", "movie", "music", "show", "sport", "video"],
  news: ["breaking", "community", "current", "headline", "local", "news", "nigeria", "politics", "report", "world"],
};

const ICON_PATHS = {
  spark: ["M5 18.5 9 13l3 2 4-7 3 2.5", "M5 18.5h14"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"],
  trophy: ["M8 4h8v5a4 4 0 0 1-8 0Z", "M12 13v4", "M8 21h8", "M5 6H3v1a4 4 0 0 0 4 4", "M19 6h2v1a4 4 0 0 1-4 4"],
  users: ["M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M3 21a6 6 0 0 1 12 0", "M16 4.5a3.5 3.5 0 0 1 0 6.5", "M17 15a5 5 0 0 1 4 5"],
  compass: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "m15.5 8.5-2 5-5 2 2-5Z"],
  code: ["m8 8-4 4 4 4", "m16 8 4 4-4 4", "m14 5-4 14"],
  palette: ["M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h4.5A4.5 4.5 0 0 0 21 8.5C21 5.5 17 3 12 3Z", "M7.5 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z", "M10 6.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z", "M15 6.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"],
  briefcase: ["M4 8h16v10.5A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5Z", "M9 8V5h6v3", "M4 13h16", "M10 12v2h4v-2"],
  sparkles: ["m12 3 1.2 3.3L16.5 8l-3.3 1.2L12 12.5l-1.2-3.3L7.5 8l3.3-1.7Z", "m18.5 13 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z", "m5.5 14 1 2.5L9 17.5l-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z"],
  play: ["M5 4.5h14A1.5 1.5 0 0 1 20.5 6v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5Z", "m10 9 5 3-5 3Z"],
  news: ["M5 4h11v16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z", "M16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3", "M7.5 8h6", "M7.5 12h6", "M7.5 16h4"],
  search: ["m20 20-3.8-3.8", "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z"],
  refresh: ["M20 7v5h-5", "M4 17v-5h5", "M6.1 8.1A7 7 0 0 1 18.7 7L20 12", "M4 12l1.3 5A7 7 0 0 0 17.9 15.9"],
  close: ["m7 7 10 10", "M17 7 7 17"],
  posts: ["M6 6.5h9", "M6 11.5h12", "M6 16.5h8", "M4.5 4h15A1.5 1.5 0 0 1 21 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-13A1.5 1.5 0 0 1 4.5 4Z"],
  comment: ["M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H9l-4 4v-4.5A2.5 2.5 0 0 1 2.5-2.5Z"],
  alert: ["M12 4 3 20h18Z", "M12 9v4", "M12 17h.01"],
  info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 11v6", "M12 7h.01"],
  arrow: ["M5 12h14", "m14 7 5 5-5 5"],
};

function TrendingIcon({ name, size = 18, className = "" }) {
  const paths = ICON_PATHS[name] || ICON_PATHS.spark;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

const safeNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
};

const getPostLikes = (post) => safeNumber(post?.likesCount ?? post?.likes);
const getPostComments = (post) =>
  safeNumber(post?.commentsCount ?? (Array.isArray(post?.comments) ? post.comments.length : 0));
const getPostShares = (post) => safeNumber(post?.shareCount ?? post?.sharesCount);
const getPostEngagement = (post) =>
  getPostLikes(post) + getPostComments(post) + getPostShares(post);

const getPostCreatedAt = (post) => {
  const timestamp = new Date(post?.createdAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getHotScore = (post) => {
  const weightedEngagement =
    getPostLikes(post) * 2 + getPostComments(post) * 4 + getPostShares(post) * 5;
  const ageHours = Math.max(0, (Date.now() - getPostCreatedAt(post)) / 3_600_000);
  return (weightedEngagement + 1) / Math.pow(ageHours + 2, 0.82);
};

const normalizeSearchValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^#+/, "");

const getPostSearchText = (post) =>
  [
    post?.text,
    post?.name,
    post?.username,
    post?.feeling,
    post?.location,
    post?.category,
    post?.topic,
    ...(Array.isArray(post?.hashtags) ? post.hashtags : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const getPostTokens = (post) =>
  new Set(
    getPostSearchText(post)
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );

const postMatchesCategory = (post, category) => {
  if (category === "all") {
    return true;
  }

  const explicitCategory = normalizeSearchValue(post?.category || post?.topic);
  if (explicitCategory === category) {
    return true;
  }

  const tokens = getPostTokens(post);
  return (CATEGORY_KEYWORDS[category] || []).some((keyword) => tokens.has(keyword));
};

const getAuthorId = (post) =>
  String(post?.user?._id || post?.author?._id || post?.authorId || "").trim();

const normalizeUserIds = (items) =>
  new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => String(item?._id || item?.id || item || "").trim())
      .filter(Boolean)
  );

const isFollowingPost = (post, followingIds) =>
  Boolean(
    post?.viewerFollowsAuthor ||
      post?.isFollowing ||
      post?.following ||
      followingIds.has(getAuthorId(post))
  );

const formatMetric = (value) =>
  new Intl.NumberFormat("en", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);

const getPrimaryCategory = (post) =>
  CATEGORIES.slice(1).find((category) => postMatchesCategory(post, category.id)) || CATEGORIES[0];

function TrendingSkeleton() {
  return (
    <div className="trending-skeleton-list" aria-label="Loading trending posts" aria-busy="true">
      {[0, 1, 2].map((item) => (
        <div className="trending-skeleton" key={item} aria-hidden="true">
          <div className="trending-skeleton__head">
            <span className="trending-skeleton__avatar" />
            <div>
              <span />
              <span />
            </div>
          </div>
          <span className="trending-skeleton__line trending-skeleton__line--wide" />
          <span className="trending-skeleton__line" />
          <span className="trending-skeleton__media" />
        </div>
      ))}
    </div>
  );
}

export default function Trending({ user }) {
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState("hot");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const requestSequenceRef = useRef(0);

  const loadTrendingPosts = useCallback(async ({ refresh = false } = {}) => {
    const requestSequence = ++requestSequenceRef.current;

    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const data = await getFeed();
      if (requestSequence !== requestSequenceRef.current) {
        return;
      }
      setPosts(Array.isArray(data) ? data : []);
      setLastUpdatedAt(new Date());
    } catch (err) {
      if (requestSequence === requestSequenceRef.current) {
        setError(err?.message || "We could not load trending posts right now.");
      }
    } finally {
      if (requestSequence === requestSequenceRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadTrendingPosts();
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [loadTrendingPosts]);

  const followingIds = useMemo(() => normalizeUserIds(user?.following), [user?.following]);
  const normalizedQuery = normalizeSearchValue(query);

  const visiblePosts = useMemo(() => {
    let nextPosts = posts.filter((post) => postMatchesCategory(post, category));

    if (normalizedQuery) {
      nextPosts = nextPosts.filter((post) =>
        getPostSearchText(post).includes(normalizedQuery)
      );
    }

    if (filter === "following") {
      nextPosts = nextPosts.filter((post) => isFollowingPost(post, followingIds));
    }

    nextPosts = [...nextPosts].sort((a, b) => {
      if (filter === "new") {
        return getPostCreatedAt(b) - getPostCreatedAt(a);
      }
      if (filter === "top") {
        return getPostEngagement(b) - getPostEngagement(a);
      }
      return getHotScore(b) - getHotScore(a);
    });

    return filter === "top" ? nextPosts.slice(0, 10) : nextPosts;
  }, [category, filter, followingIds, normalizedQuery, posts]);

  const metrics = useMemo(() => {
    const engagements = visiblePosts.reduce(
      (total, post) => total + getPostEngagement(post),
      0
    );
    const creators = new Set(
      visiblePosts
        .map((post) => getAuthorId(post) || normalizeSearchValue(post?.username || post?.name))
        .filter(Boolean)
    ).size;

    return [
      {
        id: "posts",
        label: "Posts in view",
        value: formatMetric(visiblePosts.length),
        detail: "Matching your filters",
        icon: "posts",
      },
      {
        id: "engagement",
        label: "Engagements",
        value: formatMetric(engagements),
        detail: "Likes, replies and shares",
        icon: "comment",
      },
      {
        id: "creators",
        label: "Creators",
        value: formatMetric(creators),
        detail: "Driving the conversation",
        icon: "users",
      },
    ];
  }, [visiblePosts]);

  const topTopics = useMemo(() => {
    const hashtagCounts = new Map();

    posts.forEach((post) => {
      (Array.isArray(post?.hashtags) ? post.hashtags : []).forEach((hashtag) => {
        const id = normalizeSearchValue(hashtag);
        if (id) {
          hashtagCounts.set(id, (hashtagCounts.get(id) || 0) + 1);
        }
      });
    });

    const hashtags = Array.from(hashtagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, count]) => ({ id, label: `#${id}`, count, type: "hashtag" }));

    if (hashtags.length >= 3) {
      return hashtags;
    }

    return CATEGORIES.slice(1)
      .map((item) => ({
        id: item.id,
        label: item.label,
        count: posts.filter((post) => postMatchesCategory(post, item.id)).length,
        type: "category",
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [posts]);

  const activeFilter = FILTERS.find((item) => item.id === filter) || FILTERS[0];
  const activeCategory = CATEGORIES.find((item) => item.id === category) || CATEGORIES[0];
  const hasActiveFilters = filter !== "hot" || category !== "all" || Boolean(normalizedQuery);
  const updatedLabel = lastUpdatedAt
    ? lastUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "Not updated yet";

  const resetFilters = () => {
    setFilter("hot");
    setCategory("all");
    setQuery("");
  };

  const selectTopic = (topic) => {
    if (topic.type === "hashtag") {
      setCategory("all");
      setQuery(topic.label);
    } else {
      setCategory(topic.id);
      setQuery("");
    }
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <SeoHead
        title="Trending on Tengacion | Community Conversations"
        description="See fast-rising conversations, fresh posts, and the creators shaping the Tengacion community."
        canonical="/trending"
        robots="noindex,follow"
      />
      <Navbar user={user} />
      <div className="app-shell trending-shell">
        <aside className="sidebar">
          <Sidebar user={user} />
        </aside>

        <main className="feed trending-page" id="trending-content">
          <section className="trending-hero" aria-labelledby="trending-heading">
            <div className="trending-hero__signal" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="trending-hero__topline">
              <span className="trending-eyebrow">
                <TrendingIcon name="spark" size={16} />
                Live community pulse
              </span>
              <span className="trending-live-status">
                <i aria-hidden="true" />
                Updated {updatedLabel}
              </span>
            </div>
            <div className="trending-hero__content">
              <div>
                <h1 id="trending-heading">See what Tengacion is talking about.</h1>
                <p>
                  Find fast-rising conversations, fresh perspectives, and standout
                  creators—all ranked from real community activity.
                </p>
              </div>
              <div className="trending-hero__actions">
                <label className="trending-search">
                  <TrendingIcon name="search" size={19} />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search posts, people or topics"
                    aria-label="Search trending posts"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Clear trending search"
                    >
                      <TrendingIcon name="close" size={17} />
                    </button>
                  ) : null}
                </label>
                <button
                  type="button"
                  className="trending-refresh"
                  onClick={() => loadTrendingPosts({ refresh: true })}
                  disabled={refreshing}
                >
                  <TrendingIcon
                    name="refresh"
                    size={18}
                    className={refreshing ? "is-spinning" : ""}
                  />
                  {refreshing ? "Refreshing" : "Refresh"}
                </button>
              </div>
            </div>
          </section>

          <section className="trending-controls" aria-label="Trending filters">
            <div className="trending-controls__section">
              <div className="trending-section-heading">
                <div>
                  <span>Rank by</span>
                  <h2>Choose your pulse</h2>
                </div>
                <small>{activeFilter.description}</small>
              </div>
              <div className="trending-filter-tabs" role="tablist" aria-label="Rank trending posts">
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={filter === item.id ? "is-active" : ""}
                    role="tab"
                    aria-selected={filter === item.id}
                    onClick={() => setFilter(item.id)}
                  >
                    <span className="trending-control-icon">
                      <TrendingIcon name={item.icon} size={18} />
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="trending-controls__section trending-controls__section--categories">
              <div className="trending-section-heading">
                <div>
                  <span>Explore by interest</span>
                  <h2>Browse topics</h2>
                </div>
                <small>{activeCategory.label}</small>
              </div>
              <div className="trending-category-list" aria-label="Filter by topic">
                {CATEGORIES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={category === item.id ? "is-active" : ""}
                    aria-pressed={category === item.id}
                    onClick={() => setCategory(item.id)}
                  >
                    <TrendingIcon name={item.icon} size={17} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="trending-overview" aria-label="Current trend summary">
            {metrics.map((metric) => (
              <article className={`trending-metric trending-metric--${metric.id}`} key={metric.id}>
                <span className="trending-metric__icon">
                  <TrendingIcon name={metric.icon} size={20} />
                </span>
                <div>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small>{metric.detail}</small>
                </div>
              </article>
            ))}
          </section>

          {error && posts.length > 0 ? (
            <div className="trending-inline-alert" role="status">
              <TrendingIcon name="alert" size={18} />
              <span>{error} Your previous results are still available.</span>
              <button type="button" onClick={() => loadTrendingPosts({ refresh: true })}>
                Try again
              </button>
            </div>
          ) : null}

          <section className="trending-results" aria-labelledby="trending-results-heading">
            <div className="trending-results__heading">
              <div>
                <span>Community conversations</span>
                <h2 id="trending-results-heading">
                  {filter === "new" ? "Latest posts" : filter === "following" ? "From people you follow" : "Trending now"}
                </h2>
                <p aria-live="polite">
                  {loading
                    ? "Loading conversations"
                    : `${visiblePosts.length} ${visiblePosts.length === 1 ? "post" : "posts"} found`}
                </p>
              </div>
              {hasActiveFilters ? (
                <button type="button" className="trending-clear-filters" onClick={resetFilters}>
                  <TrendingIcon name="close" size={16} />
                  Clear filters
                </button>
              ) : null}
            </div>

            <div className="trending-feed">
              {loading ? (
                <TrendingSkeleton />
              ) : error && posts.length === 0 ? (
                <div className="trending-state trending-state--error" role="alert">
                  <span className="trending-state__icon">
                    <TrendingIcon name="alert" size={26} />
                  </span>
                  <h3>Trending is taking a moment</h3>
                  <p>{error}</p>
                  <button type="button" onClick={() => loadTrendingPosts()}>
                    <TrendingIcon name="refresh" size={17} />
                    Try again
                  </button>
                </div>
              ) : visiblePosts.length === 0 ? (
                <div className="trending-state">
                  <span className="trending-state__icon">
                    <TrendingIcon name="search" size={26} />
                  </span>
                  <h3>No conversations match yet</h3>
                  <p>Try another topic, change the ranking, or clear your search.</p>
                  <button type="button" onClick={resetFilters}>
                    Show all trending posts
                  </button>
                </div>
              ) : (
                visiblePosts.map((post, index) => {
                  const postCategory = getPrimaryCategory(post);
                  return (
                    <article className="trending-feed-item" key={post._id || `${post.username}-${index}`}>
                      <div className="trending-feed-item__context">
                        <span className="trending-rank">
                          {filter === "new" ? "New" : `#${String(index + 1).padStart(2, "0")}`}
                        </span>
                        <span>
                          <TrendingIcon name={postCategory.icon} size={15} />
                          {postCategory.label}
                        </span>
                        <small>{formatMetric(getPostEngagement(post))} engagements</small>
                      </div>
                      <PostCard
                        post={post}
                        onShareCreated={(sharedPost) => {
                          if (!sharedPost?._id) {
                            return;
                          }
                          setPosts((previous) => [
                            sharedPost,
                            ...previous.filter((entry) => entry._id !== sharedPost._id),
                          ]);
                        }}
                        onDelete={(id) =>
                          setPosts((previous) => previous.filter((entry) => entry._id !== id))
                        }
                        onEdit={(updatedPost) =>
                          setPosts((previous) =>
                            previous.map((entry) =>
                              entry._id === updatedPost._id ? updatedPost : entry
                            )
                          )
                        }
                      />
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </main>

        <aside className="trending-right-rail" aria-label="Trending insights">
          <section className="trending-rail-card trending-topics-card">
            <div className="trending-rail-card__heading">
              <div>
                <span>Discover</span>
                <h2>Topics with momentum</h2>
              </div>
              <TrendingIcon name="spark" size={20} />
            </div>
            {topTopics.length ? (
              <ol className="trending-topic-list">
                {topTopics.map((topic, index) => (
                  <li key={`${topic.type}-${topic.id}`}>
                    <button type="button" onClick={() => selectTopic(topic)}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{topic.label}</strong>
                        <small>{topic.count} {topic.count === 1 ? "post" : "posts"}</small>
                      </div>
                      <TrendingIcon name="arrow" size={16} />
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="trending-rail-card__empty">
                Topic momentum will appear as the community adds hashtags and conversations.
              </p>
            )}
          </section>

          <section className="trending-rail-card trending-ranking-card">
            <span className="trending-ranking-card__icon">
              <TrendingIcon name="info" size={20} />
            </span>
            <h2>How ranking works</h2>
            <p>
              Hot posts balance reactions, replies, shares, and freshness. Top posts
              emphasize total engagement, while Newest stays chronological.
            </p>
            <div className="trending-ranking-card__footer">
              <span>Last refreshed</span>
              <strong>{updatedLabel}</strong>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
