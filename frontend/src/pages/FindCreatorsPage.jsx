import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";

import { getCreatorDiscovery } from "../api";
import SeoHead from "../components/seo/SeoHead";
import CreatorDiscoveryCard from "../components/creatorDiscovery/CreatorDiscoveryCard";
import { useAuth } from "../context/AuthContext";
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from "../lib/seo";

import "../components/creatorDiscovery/creatorDiscovery.css";

const CATEGORY_TABS = [
  { id: "all", label: "All Creators" },
  { id: "music", label: "Music" },
  { id: "books", label: "Books" },
  { id: "podcasts", label: "Podcasts" },
];

const SORT_OPTIONS = [
  { id: "popular", label: "Popular" },
  { id: "newest", label: "Newest" },
  { id: "alphabetical", label: "A-Z" },
];

const QUICK_FILTERS = [
  { id: "trending", label: "Trending", category: "all", sort: "popular" },
  { id: "music", label: "Music", category: "music", sort: "popular" },
  { id: "books", label: "Books", category: "books", sort: "popular" },
  { id: "podcasts", label: "Podcasts", category: "podcasts", sort: "popular" },
  { id: "new", label: "New Creators", category: "all", sort: "newest" },
  { id: "marketplace", label: "Marketplace", path: "/marketplace" },
];

const PAGE_SIZE = 12;

const uniqueCreators = (items = []) => {
  const seen = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const key = String(item?.creatorId || item?.id || item?.route || "").trim();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.set(key, item);
  }
  return Array.from(seen.values());
};

const DiscoverySkeleton = () => (
  <div className="creator-discovery-skeleton">
    <div className="creator-discovery-skeleton__media" />
    <div className="creator-discovery-skeleton__body">
      <div className="creator-discovery-skeleton__line creator-discovery-skeleton__line--wide" />
      <div className="creator-discovery-skeleton__line creator-discovery-skeleton__line--medium" />
      <div className="creator-discovery-skeleton__line" />
      <div className="creator-discovery-skeleton__line creator-discovery-skeleton__line--short" />
    </div>
  </div>
);

export default function FindCreatorsPage() {
  const location = useLocation();
  const auth = useAuth();
  const user = auth?.user ?? null;
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("popular");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const fetchCreators = useCallback(
    async ({ nextPage = 1, replace = true } = {}) => {
      const requestId = ++requestSeqRef.current;
      if (replace) {
        setLoading(true);
        setError("");
      } else {
        setLoadingMore(true);
      }

      try {
        const payload = await getCreatorDiscovery({
          category,
          search,
          sort,
          verifiedOnly,
          page: nextPage,
          limit: PAGE_SIZE,
        });

        if (requestId !== requestSeqRef.current) {
          return;
        }

        const nextItems = uniqueCreators(Array.isArray(payload?.items) ? payload.items : []);
        setHasMore(Boolean(payload?.hasMore));
        setTotal(Number(payload?.total || nextItems.length || 0));
        setItems((current) => (replace ? nextItems : uniqueCreators([...current, ...nextItems])));
      } catch (err) {
        if (requestId !== requestSeqRef.current) {
          return;
        }
        setError(err?.message || "Could not load creators.");
        toast.error(err?.message || "Could not load creators.");
      } finally {
        if (requestId === requestSeqRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [category, search, sort, verifiedOnly]
  );

  useEffect(() => {
    void fetchCreators({ nextPage: page, replace: page === 1 });
  }, [fetchCreators, page]);

  const resultsLabel = useMemo(() => {
    if (loading && !items.length) {
      return "Loading creators...";
    }
    if (error) {
      return "Creator search paused";
    }
    return `${total.toLocaleString()} creators found`;
  }, [error, items.length, loading, total]);
  const isAliasRoute = location.pathname.startsWith("/find-creators");
  const backLink = user ? "/home" : "/login";
  const backLabel = user ? "Back to feed" : "Log in";
  const structuredData = useMemo(
    () => [
      buildWebSiteJsonLd(),
      buildOrganizationJsonLd(),
      buildBreadcrumbJsonLd([{ name: "Creators", url: "/creators" }]),
    ],
    []
  );

  const applySearch = (value) => {
    setSearchInput(value);
  };

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) {
      return;
    }
    setPage((current) => current + 1);
  };

  const handleReset = () => {
    setSearchInput("");
    setSearch("");
    setCategory("all");
    setSort("popular");
    setVerifiedOnly(false);
    setPage(1);
    setItems([]);
  };

  const applyQuickFilter = (filter) => {
    if (!filter || filter.path) {
      return;
    }
    setItems([]);
    setPage(1);
    setCategory(filter.category || "all");
    setSort(filter.sort || "popular");
    setVerifiedOnly(Boolean(filter.verifiedOnly));
  };

  const isQuickFilterActive = (filter) =>
    !filter.path
    && category === filter.category
    && sort === filter.sort
    && verifiedOnly === Boolean(filter.verifiedOnly);

  return (
    <section className="creator-discovery-page creator-discovery-theme">
      <SeoHead
        title="Find African Musicians, Authors, Podcasters & Digital Creators | Tengacion"
        description="Find African musicians, authors, podcasters, educators, performers, and digital creators. Explore public profiles and support their work on Tengacion."
        canonical="/creators"
        robots={isAliasRoute ? "noindex,follow" : "index,follow"}
        ogType="website"
        structuredData={structuredData}
      />
      <div className="creator-discovery-page__head">
        <div className="creator-discovery-page__title">
          <h1>Discover Creators on Tengacion</h1>
          <p>
            Browse music artists, authors, and podcast creators across Africa. Find new talent,
            explore albums, and support creators directly.
          </p>
        </div>
        <div className="creator-summary-feed__toolbar">
          <Link to={backLink} className="creator-secondary-btn">
            {backLabel}
          </Link>
          <button type="button" className="creator-primary-btn" onClick={handleReset}>
            Reset filters
          </button>
        </div>
      </div>

      <div className="creator-discovery-page__banner">
        <div>
          <strong>African creator discovery starts here</strong>
          <small>Filter by music, books, podcasts, marketplace activity, trending creators, and new creators.</small>
        </div>
        <small>{resultsLabel}</small>
      </div>

      <div className="creator-discovery-page__search-row">
        <input
          className="creator-discovery-page__search"
          value={searchInput}
          onChange={(event) => applySearch(event.target.value)}
          placeholder="Search creator name or @handle"
          aria-label="Search creators"
        />
        <button
          type="button"
          className="creator-secondary-btn"
          onClick={() => {
            setSearch(searchInput.trim());
            setPage(1);
          }}
        >
          Search
        </button>
      </div>

      <div className="creator-discovery-page__filters" aria-label="Creator categories">
        <div className="creator-summary-feed__tabs" aria-label="Quick creator filters">
          {QUICK_FILTERS.map((filter) =>
            filter.path ? (
              <Link key={filter.id} to={filter.path} className="creator-discovery-tab">
                {filter.label}
              </Link>
            ) : (
              <button
                key={filter.id}
                type="button"
                aria-pressed={isQuickFilterActive(filter)}
                className={`creator-discovery-tab ${isQuickFilterActive(filter) ? "is-active" : ""}`}
                onClick={() => applyQuickFilter(filter)}
              >
                {filter.label}
              </button>
            )
          )}
        </div>
        <div className="creator-summary-feed__tabs creator-summary-feed__tabs--compact" role="tablist" aria-label="Detailed creator categories">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={category === tab.id}
              className={`creator-discovery-tab ${category === tab.id ? "is-active" : ""}`}
              onClick={() => {
                setItems([]);
                setPage(1);
                setCategory(tab.id);
                setVerifiedOnly(false);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="creator-discovery-pagination" aria-label="Sort creators">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={sort === option.id ? "is-active" : ""}
              onClick={() => {
                setItems([]);
                setPage(1);
                setSort(option.id);
                if (option.id !== "popular") {
                  setVerifiedOnly(false);
                }
              }}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            className={verifiedOnly ? "is-active" : ""}
            aria-pressed={verifiedOnly}
            onClick={() => {
              setItems([]);
              setPage(1);
              setVerifiedOnly((current) => !current);
            }}
          >
            Verified only
          </button>
        </div>
      </div>

      {loading && !items.length ? (
        <div className="creator-discovery-grid" aria-busy="true">
          <DiscoverySkeleton />
          <DiscoverySkeleton />
          <DiscoverySkeleton />
        </div>
      ) : error ? (
        <div className="creator-discovery-empty">
          <strong>Could not load creator discovery</strong>
          <p>{error}</p>
          <button type="button" className="creator-primary-btn" onClick={() => fetchCreators({ nextPage: 1, replace: true })}>
            Try again
          </button>
        </div>
      ) : items.length ? (
        <>
          <div className="creator-discovery-grid">
            {items.map((item) => (
              <CreatorDiscoveryCard key={String(item?.creatorId || item?.id || item?.route)} item={item} />
            ))}
          </div>
          <div className="creator-discovery-page__footer">
            <small>
              Showing {items.length.toLocaleString()} of {total.toLocaleString()} creators
            </small>
            <div className="creator-discovery-pagination">
              <button type="button" onClick={handleLoadMore} disabled={!hasMore || loadingMore}>
                {loadingMore ? "Loading..." : hasMore ? "Load more" : "End of results"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="creator-discovery-empty">
          <strong>No creators matched your search</strong>
          <p>Try another name, username, or switch categories to discover more creators.</p>
          <button type="button" className="creator-primary-btn" onClick={handleReset}>
            Clear search
          </button>
        </div>
      )}
    </section>
  );
}
