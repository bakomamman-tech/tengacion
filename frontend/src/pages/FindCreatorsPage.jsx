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
  { id: "music", label: "Music Creators" },
  { id: "books", label: "Book Authors" },
  { id: "podcasts", label: "Podcast Hosts" },
];

const SORT_OPTIONS = [
  { id: "popular", label: "Popular" },
  { id: "newest", label: "Newest" },
  { id: "alphabetical", label: "A-Z" },
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
    [category, search, sort]
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
    setPage(1);
    setItems([]);
  };

  return (
    <section className="creator-discovery-page creator-discovery-theme">
      <SeoHead
        title="Discover African Creators, Music, Books & Podcasts | Tengacion"
        description="Browse Tengacion creators across music, books, and podcasts. Discover African artists, authors, and podcast hosts to follow and support."
        canonical="/creators"
        robots={isAliasRoute ? "noindex,follow" : "index,follow"}
        ogType="website"
        structuredData={structuredData}
      />
      <div className="creator-discovery-page__head">
        <div className="creator-discovery-page__title">
          <h1>Find Creators</h1>
          <p>Browse Tengacion creators, search by name or @handle, and connect without any friend requirement.</p>
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
          <strong>Discover every creator on Tengacion</strong>
          <small>Music artists, book authors, and podcast hosts all appear here.</small>
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

      <div className="creator-discovery-page__filters" role="tablist" aria-label="Creator categories">
        <div className="creator-summary-feed__tabs">
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
              }}
            >
              {option.label}
            </button>
          ))}
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
