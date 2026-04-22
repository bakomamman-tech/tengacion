import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { getCreatorSummaryFeed } from "../../api";
import CreatorSummaryCard from "./CreatorSummaryCard";

import "./creatorDiscovery.css";

const CATEGORY_TABS = [
  { id: "all", label: "All" },
  { id: "music", label: "Music" },
  { id: "books", label: "Books" },
  { id: "podcasts", label: "Podcasts" },
];

const MODE_TABS = [
  { id: "mixed", label: "Trending" },
  { id: "latest", label: "Latest" },
  { id: "classic", label: "Old but Gold" },
];

const FEED_LIMIT = 8;
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const getItemKey = (item = {}) => String(item?.contentId || item?.id || "").trim();

const snapshotItems = (items = []) => items.map((item) => getItemKey(item)).filter(Boolean).join("|");

const uniqueItems = (items = []) => {
  const seen = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const key = getItemKey(item) || `${item?.title || ""}:${item?.creatorId || ""}`;
    if (!key || seen.has(key)) {
      continue;
    }
    seen.set(key, item);
  }
  return Array.from(seen.values());
};

function SummarySkeleton() {
  return (
    <div className="creator-summary-feed__skeleton">
      <div className="creator-summary-feed__skeleton-media" />
      <div className="creator-summary-feed__skeleton-body">
        <div className="creator-summary-feed__skeleton-line creator-summary-feed__skeleton-line--wide" />
        <div className="creator-summary-feed__skeleton-line creator-summary-feed__skeleton-line--medium" />
        <div className="creator-summary-feed__skeleton-line" />
        <div className="creator-summary-feed__skeleton-line creator-summary-feed__skeleton-line--short" />
      </div>
    </div>
  );
}

export default function CreatorSummaryFeed({
  className = "",
  limit = FEED_LIMIT,
  initialCategory = "all",
  lockCategory = false,
  title = "Discover Feed",
  description = "Fresh and older creator releases from music, books, and podcasts on Tengacion.",
  bannerTitle = "All creator content in one place",
  actionPath = "/creators",
  actionLabel = "Find Creators",
  emptyTitle = "No creator releases found",
  emptyDescription = "Use Find Creators to browse creators, or refresh this feed a little later.",
}) {
  const [category, setCategory] = useState(initialCategory);
  const [mode, setMode] = useState("mixed");
  const [items, setItems] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);
  const [pendingRefresh, setPendingRefresh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState("");
  const requestSeqRef = useRef(0);
  const snapshotRef = useRef("");
  const hasItems = items.length > 0;

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  const applyFeedPayload = useCallback(
    (payload, { silent = false, forceApply = false } = {}) => {
      const nextItems = uniqueItems(Array.isArray(payload?.items) ? payload.items : []);
      const nextSnapshot = snapshotItems(nextItems);
      const previousSnapshot = snapshotRef.current;
      const isSnapshotChanged = previousSnapshot && previousSnapshot !== nextSnapshot;

      snapshotRef.current = nextSnapshot;
      setTotal(Number(payload?.total || nextItems.length || 0));
      setLastRefreshedAt(payload?.refreshedAt || new Date().toISOString());

      if (forceApply || !isSnapshotChanged || !silent || !items.length) {
        setItems(nextItems);
        setPendingItems([]);
        setPendingRefresh(false);
        return;
      }

      setPendingItems(nextItems);
      setPendingRefresh(true);
    },
    [items.length]
  );

  const loadFeed = useCallback(
    async ({ silent = false, forceApply = false } = {}) => {
      const requestId = ++requestSeqRef.current;
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError("");
      }

      try {
        const payload = await getCreatorSummaryFeed({
          category,
          mode,
          page: 1,
          limit,
        });

        if (requestId !== requestSeqRef.current) {
          return;
        }

        applyFeedPayload(payload, { silent, forceApply });
      } catch (err) {
        if (requestId !== requestSeqRef.current) {
          return;
        }

        if (!silent || !hasItems) {
          setError(err?.message || "Could not load creator releases.");
        }
      } finally {
        if (requestId === requestSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [applyFeedPayload, category, hasItems, limit, mode]
  );

  useEffect(() => {
    void loadFeed({ silent: false, forceApply: true });
  }, [category, loadFeed, mode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadFeed({ silent: true });
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [loadFeed]);

  const visibleItems = items;
  const refreshedLabel = useMemo(() => {
    if (!lastRefreshedAt) {
      return "Waiting for releases...";
    }

    const timestamp = new Date(lastRefreshedAt);
    if (Number.isNaN(timestamp.getTime())) {
      return "Updated recently";
    }

    return `Updated ${timestamp.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }, [lastRefreshedAt]);

  const onShowPendingRefresh = () => {
    if (!pendingItems.length) {
      return;
    }
    setItems(pendingItems);
    setPendingItems([]);
    setPendingRefresh(false);
  };

  return (
    <section className={`creator-summary-feed creator-discovery-theme ${className}`.trim()}>
      <div className="creator-summary-feed__head">
        <div className="creator-summary-feed__title">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="creator-summary-feed__toolbar">
          <Link to={actionPath} className="creator-primary-btn">
            {actionLabel}
          </Link>
          <button
            type="button"
            className="creator-secondary-btn"
            onClick={() => loadFeed({ silent: false, forceApply: true })}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="creator-summary-feed__banner">
        <div>
          <strong>{bannerTitle}</strong>
          <small>{refreshedLabel}</small>
        </div>
        <small>{total ? `${total} releases tracked` : "No releases loaded yet"}</small>
      </div>

      {!lockCategory ? (
        <div className="creator-summary-feed__tabs" role="tablist" aria-label="Creator summary categories">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={category === tab.id}
              className={`creator-discovery-tab ${category === tab.id ? "is-active" : ""}`}
              onClick={() => setCategory(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="creator-summary-feed__tabs" role="tablist" aria-label="Creator summary modes">
        {MODE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            className={`creator-discovery-chip ${mode === tab.id ? "is-active" : ""}`}
            onClick={() => setMode(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {pendingRefresh ? (
        <button
          type="button"
          className="creator-summary-feed__banner"
          onClick={onShowPendingRefresh}
        >
          <div>
            <strong>New creator items available</strong>
            <small>Tap to update the feed without losing your place.</small>
          </div>
          <small>{pendingItems.length} new items</small>
        </button>
      ) : null}

      {loading && !items.length ? (
        <div className="creator-summary-feed__list" aria-busy="true">
          <SummarySkeleton />
          <SummarySkeleton />
        </div>
      ) : error ? (
        <div className="creator-summary-feed__empty">
          <strong>Could not load the creator feed</strong>
          <p>{error}</p>
          <button
            type="button"
            className="creator-secondary-btn"
            onClick={() => loadFeed({ silent: false, forceApply: true })}
          >
            Try again
          </button>
        </div>
      ) : visibleItems.length ? (
        <div className="creator-summary-feed__list">
          {visibleItems.map((item) => (
            <CreatorSummaryCard key={getItemKey(item)} item={item} />
          ))}
        </div>
      ) : (
        <div className="creator-summary-feed__empty">
          <strong>{emptyTitle}</strong>
          <p>{emptyDescription}</p>
          <Link to={actionPath} className="creator-primary-btn">
            {actionLabel}
          </Link>
        </div>
      )}
    </section>
  );
}
