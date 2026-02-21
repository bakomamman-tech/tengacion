import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../Navbar";
import { getFeed, resolveImage } from "../api";

const RANGE_OPTIONS = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "14d", label: "Last 14 days", days: 14 },
  { id: "28d", label: "Last 28 days", days: 28 },
];

const CREATOR_MENU = [
  { id: "home", label: "Home", icon: "home", route: "/home", active: false },
  {
    id: "insights",
    label: "Insights",
    icon: "insights",
    route: "/creator",
    active: true,
  },
  {
    id: "content",
    label: "Content",
    icon: "content",
    route: "/creator?tab=content",
    active: false,
  },
  {
    id: "monetization",
    label: "Monetization",
    icon: "monetization",
    route: "/creator?tab=monetization",
    active: false,
  },
  {
    id: "engagement",
    label: "Engagement",
    icon: "engagement",
    route: "/creator?tab=engagement",
    active: false,
  },
  {
    id: "tools",
    label: "All tools",
    icon: "tools",
    route: "/creator?tab=tools",
    active: false,
  },
];

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const percentNumber = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "Creator"
  )}&size=120&background=DFE8F6&color=1D3A6D`;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const average = (values) =>
  values.length
    ? values.reduce((sum, current) => sum + current, 0) / values.length
    : 0;

const getRangeDays = (rangeId) =>
  RANGE_OPTIONS.find((item) => item.id === rangeId)?.days || 28;

const formatChange = (value) => `${value >= 0 ? "+" : ""}${value}%`;

const getPostPreviewImage = (post) => {
  const mediaCandidate = Array.isArray(post?.media)
    ? post?.media?.[0]?.url || post?.media?.[0]
    : post?.media;

  return resolveImage(post?.image || post?.photo || mediaCandidate);
};

const estimatePostViews = (post, index) => {
  const likes = Number(post?.likes) || 0;
  const comments = Array.isArray(post?.comments) ? post.comments.length : 0;
  const textWeight = clamp((post?.text || "").length, 0, 220);

  return Math.max(85, 120 + likes * 16 + comments * 30 + textWeight + index * 13);
};

const buildTrendSeries = (days, seed, baseline, engagementRate) => {
  const now = new Date();

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(now);
    day.setDate(now.getDate() - (days - index - 1));

    const wave =
      Math.sin((index + seed) * 0.45) * 0.18 +
      Math.cos((index + seed) * 0.22) * 0.14;
    const trend = days > 1 ? (index / (days - 1)) * 0.16 : 0;
    const views = Math.max(40, Math.round(baseline * (1 + wave + trend)));
    const interactions = Math.max(
      8,
      Math.round(views * (engagementRate / 100) * 0.92 + ((index + seed) % 8))
    );

    return {
      label: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      views,
      interactions,
    };
  });
};

function DashboardIcon({ name }) {
  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3.5 10.8L12 3.8l8.5 7" />
        <path d="M6.8 9.9v10h10.4v-10" />
      </svg>
    );
  }

  if (name === "insights") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4.5 19.5h15" />
        <path d="M7.5 17V10" />
        <path d="M12 17V6.5" />
        <path d="M16.5 17v-8" />
      </svg>
    );
  }

  if (name === "content") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5" y="3.7" width="14" height="16.6" rx="2.4" />
        <path d="M8.4 8.1h7.2" />
        <path d="M8.4 12h7.2" />
        <path d="M8.4 15.9h4.4" />
      </svg>
    );
  }

  if (name === "monetization") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.8" y="6.7" width="16.4" height="10.6" rx="2.4" />
        <circle cx="12" cy="12" r="2.4" />
        <path d="M6.6 9.7h0.01" />
        <path d="M17.4 14.3h0.01" />
      </svg>
    );
  }

  if (name === "engagement") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5.4 6.1h13.2a2 2 0 0 1 2 2v7.1a2 2 0 0 1-2 2h-6.1l-4.6 3v-3H5.4a2 2 0 0 1-2-2V8.1a2 2 0 0 1 2-2z" />
      </svg>
    );
  }

  if (name === "tools") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" />
        <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" />
        <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" />
        <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" />
      </svg>
    );
  }

  if (name === "chevron-right") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 6.6L14.7 12 9 17.4" />
      </svg>
    );
  }

  if (name === "views") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2.8 12s3.2-5.4 9.2-5.4S21.2 12 21.2 12s-3.2 5.4-9.2 5.4S2.8 12 2.8 12z" />
        <circle cx="12" cy="12" r="2.4" />
      </svg>
    );
  }

  if (name === "interactions") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 20.2l-1.4-1.3C6.1 14.8 3.3 12.2 3.3 8.9A4.4 4.4 0 0 1 7.7 4.5c1.7 0 3.3.8 4.3 2.1 1-1.3 2.6-2.1 4.3-2.1a4.4 4.4 0 0 1 4.4 4.4c0 3.3-2.8 5.9-7.3 10l-1.4 1.3z" />
      </svg>
    );
  }

  if (name === "follows") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="9.4" cy="8.5" r="3.1" />
        <path d="M3.9 18.6c.8-2.7 2.9-4.3 5.5-4.3 2.6 0 4.7 1.6 5.5 4.3" />
        <path d="M18.1 9.4v5.2" />
        <path d="M15.5 12h5.2" />
      </svg>
    );
  }

  if (name === "link") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9.7 14.3L7.9 16a3.2 3.2 0 1 1-4.5-4.5l2.8-2.8a3.2 3.2 0 0 1 4.5 0" />
        <path d="M14.3 9.7L16 8a3.2 3.2 0 1 1 4.5 4.5l-2.8 2.8a3.2 3.2 0 0 1-4.5 0" />
        <path d="M8.8 15.2l6.4-6.4" />
      </svg>
    );
  }

  if (name === "shield-check") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3.7l7 2.4v5.6c0 4.1-2.5 7.5-7 8.8-4.5-1.3-7-4.7-7-8.8V6.1l7-2.4z" />
        <path d="M9 12.2l2.1 2.1 3.8-3.8" />
      </svg>
    );
  }

  if (name === "education") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3.5 9.1L12 5l8.5 4.1L12 13.2 3.5 9.1z" />
        <path d="M6.6 11.7v3.6c0 .6.4 1.1.9 1.3l4.5 1.7 4.5-1.7c.5-.2.9-.7.9-1.3v-3.6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}

export default function CreatorDashboard({ user }) {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState("28d");
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalLikes: 0,
    totalComments: 0,
    totalViews: 0,
    interactions: 0,
    netFollowers: 0,
    avgLikesPerPost: 0,
    engagementRate: 0,
    viewsGrowth: 0,
    interactionsGrowth: 0,
    followersGrowth: 0,
  });
  const [topPosts, setTopPosts] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCreatorStats = async () => {
      try {
        setLoading(true);
        const data = await getFeed();
        const ownPosts = Array.isArray(data) ? data.filter((post) => post.isOwner) : [];

        const withReach = ownPosts.map((post, index) => ({
          ...post,
          estimatedViews: estimatePostViews(post, index),
        }));

        const totalLikes = withReach.reduce(
          (sum, post) => sum + (Number(post.likes) || 0),
          0
        );
        const totalComments = withReach.reduce(
          (sum, post) => sum + (Array.isArray(post.comments) ? post.comments.length : 0),
          0
        );
        const totalViews = withReach.reduce(
          (sum, post) => sum + (post.estimatedViews || 0),
          0
        );
        const interactions = totalLikes + totalComments * 2;
        const netFollowers = Math.max(0, Math.round(interactions / 19));
        const avgLikesPerPost = ownPosts.length
          ? Math.round(totalLikes / ownPosts.length)
          : 0;
        const engagementRate = totalViews
          ? (interactions / totalViews) * 100
          : 0;

        const days = getRangeDays(dateRange);
        const seed = ownPosts.length * 17 + totalLikes * 3 + totalComments * 5;
        const baseline = Math.max(
          80,
          Math.round((totalViews || 260) / Math.max(ownPosts.length || 2, 2))
        );

        const series = buildTrendSeries(days, seed, baseline, engagementRate || 5);
        const pivot = Math.max(1, Math.floor(series.length / 2));
        const firstHalf = series.slice(0, pivot);
        const secondHalf = series.slice(pivot);

        const firstHalfViews = average(firstHalf.map((entry) => entry.views));
        const secondHalfViews = average(secondHalf.map((entry) => entry.views));
        const firstHalfInteractions = average(
          firstHalf.map((entry) => entry.interactions)
        );
        const secondHalfInteractions = average(
          secondHalf.map((entry) => entry.interactions)
        );

        const viewsGrowth = Math.round(
          ((secondHalfViews - firstHalfViews) / Math.max(firstHalfViews, 1)) * 100
        );
        const interactionsGrowth = Math.round(
          ((secondHalfInteractions - firstHalfInteractions) /
            Math.max(firstHalfInteractions, 1)) *
            100
        );
        const followersGrowth = Math.round(viewsGrowth * 0.4 + interactionsGrowth * 0.35);

        setStats({
          totalPosts: ownPosts.length,
          totalLikes,
          totalComments,
          totalViews,
          interactions,
          netFollowers,
          avgLikesPerPost,
          engagementRate,
          viewsGrowth,
          interactionsGrowth,
          followersGrowth,
        });

        setTopPosts(
          withReach
            .sort((a, b) => {
              const scoreA =
                (Number(a.likes) || 0) +
                (Array.isArray(a.comments) ? a.comments.length : 0) * 3;
              const scoreB =
                (Number(b.likes) || 0) +
                (Array.isArray(b.comments) ? b.comments.length : 0) * 3;
              return scoreB - scoreA;
            })
            .slice(0, 4)
        );

        setChartData(series);
      } catch (error) {
        console.error("Failed to load creator stats:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCreatorStats();
  }, [dateRange]);

  const rangeLabel = useMemo(() => {
    const days = getRangeDays(dateRange);
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));

    return `${start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} - ${end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`;
  }, [dateRange]);

  const chartModel = useMemo(() => {
    const width = 760;
    const height = 230;
    const padX = 28;
    const padY = 22;

    if (!chartData.length) {
      return {
        width,
        height,
        points: [],
        linePath: "",
        areaPath: "",
        ticks: [],
      };
    }

    const maxValue = Math.max(...chartData.map((entry) => entry.views), 1);
    const points = chartData.map((entry, index) => {
      const x =
        padX +
        (index * (width - padX * 2)) / Math.max(chartData.length - 1, 1);
      const y =
        height -
        padY -
        (Math.max(entry.views, 0) / maxValue) * (height - padY * 2);

      return { x, y, value: entry.views, label: entry.label };
    });

    const linePath = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const areaPath = `${linePath} L ${lastPoint.x} ${height - padY} L ${firstPoint.x} ${
      height - padY
    } Z`;

    const ticks = [0.25, 0.5, 0.75, 1].map((fraction) => ({
      y: height - padY - (height - padY * 2) * fraction,
      value: Math.round(maxValue * fraction),
    }));

    return {
      width,
      height,
      points,
      linePath,
      areaPath,
      ticks,
    };
  }, [chartData]);

  const weeklyGoals = useMemo(() => {
    const followerGoal = 24;
    const postGoal = 4;
    const interactionGoal = 500;

    return [
      {
        title: "Get 24 new followers",
        current: Math.min(followerGoal, Math.round(stats.netFollowers * 0.7)),
        goal: followerGoal,
      },
      {
        title: "Publish 4 posts",
        current: Math.min(postGoal, stats.totalPosts),
        goal: postGoal,
      },
      {
        title: "Reach 500 interactions",
        current: Math.min(interactionGoal, stats.interactions),
        goal: interactionGoal,
      },
    ];
  }, [stats.netFollowers, stats.totalPosts, stats.interactions]);

  const weeklyProgress = useMemo(() => {
    if (!weeklyGoals.length) {
      return 0;
    }

    const total = weeklyGoals.reduce(
      (sum, goal) => sum + Math.min(goal.current / goal.goal, 1),
      0
    );
    return Math.round((total / weeklyGoals.length) * 100);
  }, [weeklyGoals]);

  const daysLeft = useMemo(() => {
    const currentDay = new Date().getDay();
    const normalized = currentDay === 0 ? 7 : currentDay;
    return Math.max(1, 7 - normalized + 1);
  }, []);

  const creatorPulse = useMemo(() => {
    const bestEntry = chartData.reduce(
      (winner, current) => (current.views > winner.views ? current : winner),
      { label: "-", views: 0 }
    );

    return {
      bestWindow: bestEntry.label === "-" ? "-" : `${bestEntry.label}, 7:30 PM`,
      nicheScore: clamp(
        Math.round(54 + stats.engagementRate * 5 + stats.avgLikesPerPost * 0.06),
        10,
        98
      ),
      fanLoyalty: clamp(
        Math.round(32 + stats.totalComments * 1.4 + stats.totalPosts * 1.8),
        15,
        99
      ),
      streakDays: clamp(Math.round(stats.totalPosts * 1.7), 0, 40),
    };
  }, [
    chartData,
    stats.engagementRate,
    stats.avgLikesPerPost,
    stats.totalComments,
    stats.totalPosts,
  ]);

  const ideaSprint = useMemo(() => {
    const target = 5;
    const completed = Math.min(target, Math.max(1, Math.round(stats.totalPosts * 0.8)));
    return {
      completed,
      target,
      prompts: [
        "Film a 30-second behind-the-scenes clip",
        "Drop a poll to let fans pick your next post",
        "Remix your top post with a new hook line",
      ],
    };
  }, [stats.totalPosts]);

  const profileAvatar =
    resolveImage(user?.avatar || user?.profilePic) || fallbackAvatar(user?.name);

  const highlightPost = topPosts[0];
  const highlightPreview = getPostPreviewImage(highlightPost);

  return (
    <>
      <Navbar user={user} />

      <div className="app-shell creator-dashboard-shell">
        <aside className="creator-left-rail">
          <div className="creator-left-head">
            <h1>Creator dashboard</h1>
          </div>

          <nav className="creator-left-nav" aria-label="Creator dashboard menu">
            {CREATOR_MENU.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`creator-left-item ${item.active ? "active" : ""}`}
                onClick={() => navigate(item.route)}
              >
                <span className="creator-left-icon">
                  <DashboardIcon name={item.icon} />
                </span>
                <span className="creator-left-label">{item.label}</span>
                {!item.active && (
                  <span className="creator-left-arrow">
                    <DashboardIcon name="chevron-right" />
                  </span>
                )}
              </button>
            ))}
          </nav>

          <button type="button" className="creator-left-cta">
            Create a post
          </button>
        </aside>

        <main className="creator-dashboard creator-dashboard-v2">
          <section className="card creator-insights-panel">
            <div className="creator-section-top">
              <div>
                <h2>Insights</h2>
                <p>Learn how your profile is performing</p>
              </div>

              <div className="creator-insights-actions">
                <label className="creator-range-control" htmlFor="creator-range">
                  <span>{rangeLabel}</span>
                  <select
                    id="creator-range"
                    value={dateRange}
                    onChange={(event) => setDateRange(event.target.value)}
                  >
                    {RANGE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button type="button" className="creator-see-all">
                  See all
                </button>
              </div>
            </div>

            <div className="creator-kpi-row">
              <article className="creator-kpi-card active">
                <div className="creator-kpi-icon">
                  <DashboardIcon name="views" />
                </div>
                <p className="creator-kpi-title">Views</p>
                <p className="creator-kpi-value">{compactNumber.format(stats.totalViews)}</p>
                <p
                  className={`creator-kpi-growth ${
                    stats.viewsGrowth >= 0 ? "positive" : "negative"
                  }`}
                >
                  {formatChange(stats.viewsGrowth)}
                </p>
              </article>

              <article className="creator-kpi-card">
                <div className="creator-kpi-icon">
                  <DashboardIcon name="interactions" />
                </div>
                <p className="creator-kpi-title">Interactions</p>
                <p className="creator-kpi-value">
                  {compactNumber.format(stats.interactions)}
                </p>
                <p
                  className={`creator-kpi-growth ${
                    stats.interactionsGrowth >= 0 ? "positive" : "negative"
                  }`}
                >
                  {formatChange(stats.interactionsGrowth)}
                </p>
              </article>

              <article className="creator-kpi-card">
                <div className="creator-kpi-icon">
                  <DashboardIcon name="follows" />
                </div>
                <p className="creator-kpi-title">Net follows</p>
                <p className="creator-kpi-value">{compactNumber.format(stats.netFollowers)}</p>
                <p
                  className={`creator-kpi-growth ${
                    stats.followersGrowth >= 0 ? "positive" : "negative"
                  }`}
                >
                  {formatChange(stats.followersGrowth)}
                </p>
              </article>
            </div>

            <div className="creator-chart-shell">
              <svg viewBox={`0 0 ${chartModel.width} ${chartModel.height}`} role="img">
                {chartModel.ticks.map((tick) => (
                  <g key={`tick-${tick.value}`}>
                    <line
                      x1="24"
                      y1={tick.y}
                      x2={chartModel.width - 24}
                      y2={tick.y}
                      className="creator-chart-gridline"
                    />
                    <text x="2" y={tick.y + 4} className="creator-chart-y-label">
                      {compactNumber.format(tick.value)}
                    </text>
                  </g>
                ))}

                {chartModel.areaPath && (
                  <path d={chartModel.areaPath} className="creator-chart-area" />
                )}

                {chartModel.linePath && (
                  <path d={chartModel.linePath} className="creator-chart-line" />
                )}

                {chartModel.points.map((point, index) => (
                  <circle
                    key={`${point.label}-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={index % Math.ceil(chartModel.points.length / 7) === 0 ? 2.8 : 2.1}
                    className="creator-chart-dot"
                  />
                ))}
              </svg>

              <div
                className="creator-chart-label-row"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(chartData.length, 1)}, minmax(0, 1fr))`,
                }}
              >
                {chartData.map((entry, index) => {
                  const shouldRender =
                    index % Math.ceil(chartData.length / 6) === 0 ||
                    index === chartData.length - 1;
                  return (
                    <span key={`${entry.label}-${index}`}>
                      {shouldRender ? entry.label : ""}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="creator-insights-footer">
              <p>
                Engagement rate: {percentNumber.format(stats.engagementRate)}% from{" "}
                {stats.totalPosts} published post{stats.totalPosts === 1 ? "" : "s"}.
              </p>

              <button className="btn-secondary" type="button">
                Open analytics
              </button>
            </div>
          </section>

          <section className="card creator-content-panel">
            <div className="creator-section-top">
              <div>
                <h3>Content</h3>
                <p>
                  Access your published and scheduled posts and create new content all in one
                  place.
                </p>
              </div>

              <div className="creator-content-actions">
                <button className="creator-see-all" type="button">
                  See all
                </button>
                <button className="btn-secondary" type="button">
                  Create post
                </button>
              </div>
            </div>

            {loading ? (
              <div className="creator-loading-state">
                <div className="spinner" />
                <p>Loading your creator insights...</p>
              </div>
            ) : topPosts.length === 0 ? (
              <div className="creator-empty-state">
                <h4>No content analytics yet</h4>
                <p>Your performance cards will appear here after your first post.</p>
              </div>
            ) : (
              <>
                <article className="creator-highlight-post">
                  <div className="creator-highlight-media">
                    {highlightPreview ? (
                      <img src={highlightPreview} alt="Top performing post" />
                    ) : (
                      <div className="creator-placeholder-media">
                        {(user?.name || "Creator").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="creator-highlight-meta">
                    <p className="creator-highlight-label">Top performing post</p>
                    <p className="creator-highlight-text">
                      {highlightPost?.text?.trim()
                        ? `${highlightPost.text.slice(0, 140)}${
                            highlightPost.text.length > 140 ? "..." : ""
                          }`
                        : "No caption text on this post."}
                    </p>

                    <div className="creator-highlight-stats">
                      <span>{compactNumber.format(highlightPost?.estimatedViews || 0)} views</span>
                      <span>{Number(highlightPost?.likes) || 0} likes</span>
                      <span>
                        {Array.isArray(highlightPost?.comments)
                          ? highlightPost.comments.length
                          : 0}{" "}
                        comments
                      </span>
                    </div>
                  </div>
                </article>

                <div className="creator-top-posts-list">
                  {topPosts.map((post, index) => (
                    <article
                      key={post?._id || `creator-post-${index}`}
                      className="creator-top-post-item"
                    >
                      <div className="creator-post-rank">#{index + 1}</div>
                      <div className="creator-post-body">
                        <p>
                          {post?.text?.trim()
                            ? `${post.text.slice(0, 90)}${post.text.length > 90 ? "..." : ""}`
                            : "Photo post with no caption."}
                        </p>
                        <div className="creator-post-inline-stats">
                          <span>{Number(post?.likes) || 0} likes</span>
                          <span>
                            {Array.isArray(post?.comments) ? post.comments.length : 0} comments
                          </span>
                          <span>{compactNumber.format(post?.estimatedViews || 0)} views</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </main>

        <aside className="creator-right-rail">
          <section className="card creator-status-panel">
            <h3>Profile status</h3>

            <div className="creator-status-user">
              <img src={profileAvatar} alt={user?.name || "Creator"} />
              <div>
                <p>{user?.name || "Creator"}</p>
                <span>Profile health is strong.</span>
              </div>
            </div>

            <p className="creator-status-subhead">Your profile tools</p>

            <div className="creator-tool-list">
              <div className="creator-tool-row">
                <span className="creator-tool-icon">
                  <DashboardIcon name="link" />
                </span>
                <div>
                  <p>Linked channels</p>
                  <span>Publish to Facebook and WhatsApp in one click.</span>
                </div>
              </div>
              <div className="creator-tool-row">
                <span className="creator-tool-icon">
                  <DashboardIcon name="shield-check" />
                </span>
                <div>
                  <p>Profile recommendation</p>
                  <span>Eligible for recommendation to new audiences.</span>
                </div>
              </div>
              <div className="creator-tool-row">
                <span className="creator-tool-icon">
                  <DashboardIcon name="education" />
                </span>
                <div>
                  <p>Creator education</p>
                  <span>Three fresh lessons are waiting for your niche.</span>
                </div>
              </div>
            </div>
          </section>

          <section className="card creator-weekly-panel">
            <div className="creator-weekly-head">
              <h3>Weekly progress</h3>
              <div className="creator-weekly-meta">
                <button type="button" className="creator-see-all">
                  See all
                </button>
                <span>{daysLeft} day{daysLeft === 1 ? "" : "s"} left</span>
              </div>
            </div>

            <div className="creator-weekly-bar">
              <div style={{ width: `${weeklyProgress}%` }} />
            </div>

            <p className="creator-weekly-percent">{weeklyProgress}% completed</p>

            <div className="creator-weekly-list">
              {weeklyGoals.map((goal) => (
                <article key={goal.title} className="creator-goal-row">
                  <p>{goal.title}</p>
                  <span>
                    {goal.current}/{goal.goal}
                  </span>
                </article>
              ))}
            </div>
          </section>

          <section className="card creator-pulse-panel">
            <h3>Creator Pulse</h3>
            <p className="creator-pulse-copy">
              A custom growth signal to help you outpace creators in your lane.
            </p>

            <div className="creator-pulse-metrics">
              <article>
                <span>Best window</span>
                <p>{creatorPulse.bestWindow}</p>
              </article>
              <article>
                <span>Niche score</span>
                <p>{creatorPulse.nicheScore}/100</p>
              </article>
              <article>
                <span>Fan loyalty</span>
                <p>{creatorPulse.fanLoyalty}%</p>
              </article>
              <article>
                <span>Consistency streak</span>
                <p>{creatorPulse.streakDays} days</p>
              </article>
            </div>
          </section>

          <section className="card creator-idea-panel">
            <h3>Idea Sprint</h3>
            <p className="creator-pulse-copy">
              Standout mode: fast content prompts designed for your current momentum.
            </p>

            <div className="creator-idea-track">
              <div style={{ width: `${Math.round((ideaSprint.completed / ideaSprint.target) * 100)}%` }} />
            </div>
            <p className="creator-idea-progress">
              {ideaSprint.completed}/{ideaSprint.target} prompts completed this week
            </p>

            <div className="creator-idea-list">
              {ideaSprint.prompts.map((prompt) => (
                <article key={prompt}>
                  <p>{prompt}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="card creator-collab-panel">
            <h3>Collab Radar</h3>
            <p className="creator-pulse-copy">
              Standout feature: get partnership prompts based on your active audience.
            </p>

            <div className="creator-collab-list">
              <article>
                <p>Campus Style Brand</p>
                <span>Match 92% - Budget $180-$260</span>
              </article>
              <article>
                <p>Streetwear Pop-up Event</p>
                <span>Match 87% - Budget $140-$200</span>
              </article>
              <article>
                <p>Local Creator Meetup</p>
                <span>Match 81% - Networking boost</span>
              </article>
            </div>

            <button className="btn-primary creator-collab-cta" type="button">
              Send collab pitch
            </button>
          </section>
        </aside>
      </div>
    </>
  );
}
