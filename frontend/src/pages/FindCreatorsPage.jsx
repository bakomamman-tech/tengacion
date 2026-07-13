import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";

import { getCreatorDiscovery } from "../api";
import SeoHead from "../components/seo/SeoHead";
import CreatorDiscoveryCard from "../components/creatorDiscovery/CreatorDiscoveryCard";
import CreatorDiscoveryIcon from "../components/creatorDiscovery/CreatorDiscoveryIcon";
import { useAuth } from "../context/AuthContext";
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from "../lib/seo";

import "../components/creatorDiscovery/creatorDiscovery.css";
import "./findCreatorsPage.css";

const CATEGORY_TABS = [
  { id: "all", label: "All Creators", icon: "sparkles" },
  { id: "music", label: "Music", icon: "music" },
  { id: "books", label: "Books", icon: "book" },
  { id: "podcasts", label: "Podcasts", icon: "microphone" },
];

const SORT_OPTIONS = [
  { id: "popular", label: "Popular" },
  { id: "newest", label: "Newest" },
  { id: "alphabetical", label: "A-Z" },
];

const QUICK_FILTERS = [
  { id: "trending", label: "Trending", icon: "sparkles", category: "all", sort: "popular" },
  { id: "music", label: "Music", icon: "music", category: "music", sort: "popular" },
  { id: "books", label: "Books", icon: "book", category: "books", sort: "popular" },
  { id: "podcasts", label: "Podcasts", icon: "microphone", category: "podcasts", sort: "popular" },
  { id: "new", label: "New Creators", icon: "users", category: "all", sort: "newest" },
  { id: "marketplace", label: "Marketplace", icon: "arrowUpRight", path: "/marketplace" },
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
  const appliedSearchRef = useRef("");

  const commitSearch = useCallback((value) => {
    const nextSearch = String(value || "").trim();
    if (appliedSearchRef.current !== nextSearch) {
      appliedSearchRef.current = nextSearch;
      setItems([]);
      setSearch(nextSearch);
    }
    setPage(1);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      commitSearch(searchInput);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [commitSearch, searchInput]);

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
    const shouldReload = Boolean(
      search || category !== "all" || sort !== "popular" || verifiedOnly || page !== 1
    );
    appliedSearchRef.current = "";
    setSearchInput("");
    setSearch("");
    setCategory("all");
    setSort("popular");
    setVerifiedOnly(false);
    setPage(1);
    if (shouldReload) {
      setItems([]);
    }
  };

  const applyQuickFilter = (filter) => {
    if (!filter || filter.path) {
      return;
    }
    const nextCategory = filter.category || "all";
    const nextSort = filter.sort || "popular";
    const nextVerifiedOnly = Boolean(filter.verifiedOnly);
    if (
      category === nextCategory
      && sort === nextSort
      && verifiedOnly === nextVerifiedOnly
    ) {
      return;
    }
    setItems([]);
    setPage(1);
    setCategory(nextCategory);
    setSort(nextSort);
    setVerifiedOnly(nextVerifiedOnly);
  };

  const isQuickFilterActive = (filter) =>
    !filter.path
    && category === filter.category
    && sort === filter.sort
    && verifiedOnly === Boolean(filter.verifiedOnly);

  const selectedCategory = CATEGORY_TABS.find((tab) => tab.id === category) || CATEGORY_TABS[0];
  const hasActiveFilters = Boolean(
    searchInput.trim() || search || category !== "all" || sort !== "popular" || verifiedOnly
  );
  const resultsHeading = search
    ? `Results for “${search}”`
    : category !== "all"
      ? `${selectedCategory.label} creators`
      : sort === "newest"
        ? "New creators to discover"
        : "Creators worth discovering";

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
      <header className="creator-discovery-page__head creator-discovery-hero">
        <div className="creator-discovery-hero__topline">
          <span className="creator-discovery-eyebrow">
            <CreatorDiscoveryIcon name="sparkles" size={16} />
            Tengacion creator directory
          </span>
          <div className="creator-summary-feed__toolbar creator-discovery-hero__toolbar">
            <Link to={backLink} className="creator-secondary-btn">
              <CreatorDiscoveryIcon name="arrowLeft" size={17} />
              {backLabel}
            </Link>
            <button
              type="button"
              className="creator-secondary-btn creator-discovery-reset-btn"
              onClick={handleReset}
              disabled={!hasActiveFilters}
            >
              <CreatorDiscoveryIcon name="reset" size={17} />
              Reset filters
            </button>
          </div>
        </div>

        <div className="creator-discovery-hero__content">
          <div className="creator-discovery-page__title">
            <h1>
              Discover creators
              <span> on Tengacion.</span>
            </h1>
            <p>
              Browse music artists, authors, and podcast creators across Africa. Find new talent,
              explore original work, and support creators directly.
            </p>
            <div className="creator-discovery-hero__proof" aria-label="Creator directory benefits">
              <span>
                <CreatorDiscoveryIcon name="badgeCheck" size={17} />
                Verified profiles
              </span>
              <span>
                <CreatorDiscoveryIcon name="users" size={17} />
                Follow for free
              </span>
              <span>
                <CreatorDiscoveryIcon name="wallet" size={17} />
                Support directly
              </span>
            </div>
          </div>

          <aside className="creator-discovery-hero__spotlight" aria-label="Creator categories">
            <span className="creator-discovery-hero__spotlight-kicker">Explore across</span>
            <strong>One home for African creativity.</strong>
            <div className="creator-discovery-hero__category-list">
              <span>
                <CreatorDiscoveryIcon name="music" size={19} />
                Music
              </span>
              <span>
                <CreatorDiscoveryIcon name="book" size={19} />
                Books
              </span>
              <span>
                <CreatorDiscoveryIcon name="microphone" size={19} />
                Podcasts
              </span>
            </div>
            <small>Meet the people behind the work, then follow, subscribe, or visit their page.</small>
          </aside>
        </div>
      </header>

      <div className="creator-discovery-page__banner" role="status" aria-live="polite">
        <div className="creator-discovery-page__banner-copy">
          <span className="creator-discovery-page__banner-icon" aria-hidden="true">
            <CreatorDiscoveryIcon name="sparkles" size={19} />
          </span>
          <span>
            <strong>African creator discovery starts here</strong>
            <small>Search by name or handle, then refine the directory to match your interests.</small>
          </span>
        </div>
        <span className="creator-discovery-page__results-pill">{resultsLabel}</span>
      </div>

      <section className="creator-discovery-controls" aria-label="Find and filter creators">
        <div className="creator-discovery-search-block">
          <div className="creator-discovery-controls__heading">
            <label htmlFor="creator-directory-search">Search creators</label>
            <small>Try a creator name, username, or @handle.</small>
          </div>
          <form
            className="creator-discovery-page__search-row"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              commitSearch(searchInput);
            }}
          >
            <span className="creator-discovery-page__search-icon" aria-hidden="true">
              <CreatorDiscoveryIcon name="search" size={21} />
            </span>
            <input
              id="creator-directory-search"
              className="creator-discovery-page__search"
              value={searchInput}
              onChange={(event) => applySearch(event.target.value)}
              placeholder="Search creator name or @handle"
            />
            {searchInput ? (
              <button
                type="button"
                className="creator-discovery-page__search-clear"
                aria-label="Clear creator search"
                onClick={() => applySearch("")}
              >
                <CreatorDiscoveryIcon name="x" size={18} />
              </button>
            ) : null}
            <button type="submit" className="creator-primary-btn creator-discovery-page__search-submit">
              <CreatorDiscoveryIcon name="search" size={18} />
              Search
            </button>
          </form>
        </div>

        <div className="creator-discovery-page__filters" aria-label="Creator categories">
          <div className="creator-discovery-filter-group creator-discovery-filter-group--quick">
            <div className="creator-discovery-filter-group__label">
              <span>Quick discovery</span>
              <small>Jump into what is moving now</small>
            </div>
            <div className="creator-summary-feed__tabs" aria-label="Quick creator filters">
              {QUICK_FILTERS.map((filter) =>
                filter.path ? (
                  <Link
                    key={filter.id}
                    to={filter.path}
                    className="creator-discovery-tab creator-discovery-tab--link"
                  >
                    {filter.label}
                    <CreatorDiscoveryIcon name={filter.icon} size={16} />
                  </Link>
                ) : (
                  <button
                    key={filter.id}
                    type="button"
                    aria-pressed={isQuickFilterActive(filter)}
                    className={`creator-discovery-tab ${isQuickFilterActive(filter) ? "is-active" : ""}`}
                    onClick={() => applyQuickFilter(filter)}
                  >
                    <CreatorDiscoveryIcon name={filter.icon} size={16} />
                    {filter.label}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="creator-discovery-filters__refine">
            <div className="creator-discovery-filter-group">
              <div className="creator-discovery-filter-group__label">
                <span>Creator type</span>
              </div>
              <div
                className="creator-summary-feed__tabs creator-summary-feed__tabs--compact"
                role="group"
                aria-label="Detailed creator categories"
              >
                {CATEGORY_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={category === tab.id}
                    className={`creator-discovery-tab ${category === tab.id ? "is-active" : ""}`}
                    onClick={() => {
                      if (category === tab.id && !verifiedOnly) {
                        return;
                      }
                      setItems([]);
                      setPage(1);
                      setCategory(tab.id);
                      setVerifiedOnly(false);
                    }}
                  >
                    <CreatorDiscoveryIcon name={tab.icon} size={16} />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="creator-discovery-filter-group creator-discovery-filter-group--sort">
              <div className="creator-discovery-filter-group__label">
                <span>
                  <CreatorDiscoveryIcon name="sliders" size={16} />
                  Sort & refine
                </span>
              </div>
              <div className="creator-discovery-pagination" aria-label="Sort creators">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={sort === option.id ? "is-active" : ""}
                    aria-pressed={sort === option.id}
                    onClick={() => {
                      if (sort === option.id) {
                        return;
                      }
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
                  className={`creator-discovery-verified-filter ${verifiedOnly ? "is-active" : ""}`}
                  aria-pressed={verifiedOnly}
                  onClick={() => {
                    setItems([]);
                    setPage(1);
                    setVerifiedOnly((current) => !current);
                  }}
                >
                  <CreatorDiscoveryIcon name="badgeCheck" size={17} />
                  Verified only
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="creator-discovery-results-head">
        <div>
          <span className="creator-discovery-results-head__eyebrow">Creator directory</span>
          <h2>{resultsHeading}</h2>
          <p>Explore profiles, original releases, and ways to support the people you discover.</p>
        </div>
        <div className="creator-discovery-results-head__context" aria-label="Active result filters">
          <span>{selectedCategory.label}</span>
          {verifiedOnly ? (
            <span>
              <CreatorDiscoveryIcon name="badgeCheck" size={15} />
              Verified
            </span>
          ) : null}
          {hasActiveFilters ? (
            <button type="button" onClick={handleReset}>Clear all</button>
          ) : null}
        </div>
      </div>

      {loading && !items.length ? (
        <div className="creator-discovery-grid" aria-busy="true" aria-label="Loading creator results">
          <DiscoverySkeleton />
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
          <div className="creator-discovery-grid" aria-label="Creator results">
            {items.map((item) => (
              <CreatorDiscoveryCard key={String(item?.creatorId || item?.id || item?.route)} item={item} />
            ))}
          </div>
          <div className="creator-discovery-page__footer">
            <small>
              Showing {items.length.toLocaleString()} of {total.toLocaleString()} creators
            </small>
            <div className="creator-discovery-pagination">
              <button
                type="button"
                className="creator-discovery-load-more"
                onClick={handleLoadMore}
                disabled={!hasMore || loadingMore}
              >
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
