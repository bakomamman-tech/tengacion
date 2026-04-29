import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import QuickAccessLayout from "../components/QuickAccessLayout";
import ProductGrid from "../components/marketplace/ProductGrid";
import { useAuth } from "../context/AuthContext";
import {
  MARKETPLACE_CATEGORY_SUGGESTIONS,
  MARKETPLACE_DELIVERY_OPTIONS,
  fetchMarketplaceHome,
} from "../services/marketplaceService";

import "../components/marketplace/marketplace.css";

const defaultFilters = {
  search: "",
  category: "",
  state: "",
  city: "",
  deliveryOption: "",
  sort: "latest",
};

const sidebarNav = [
  { id: "browse", label: "Browse all", description: "Reset filters and explore everything.", action: "reset" },
  { id: "orders", label: "Buying", description: "Track orders and recent purchases.", path: "/marketplace/orders" },
  { id: "register", label: "Marketplace access", description: "Register your seller profile.", path: "/marketplace/register" },
  { id: "dashboard", label: "Selling", description: "Manage listings and orders.", path: "/marketplace/dashboard" },
  { id: "payouts", label: "Payouts", description: "Review settlement history.", path: "/marketplace/payouts" },
];

export default function MarketplacePage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState(defaultFilters);
  const [payload, setPayload] = useState({
    products: [],
    featuredProducts: [],
    latestProducts: [],
    trendingSellers: [],
    categories: [],
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMarketplace = useCallback(async (nextFilters = defaultFilters) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchMarketplaceHome(nextFilters);
      setPayload(response || {});
    } catch (err) {
      const message = err?.message || "Could not load the marketplace right now.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarketplace(defaultFilters);
  }, [loadMarketplace]);

  const totals = useMemo(() => {
    const stateSet = new Set();
    [...(payload.products || []), ...(payload.featuredProducts || []), ...(payload.latestProducts || [])]
      .forEach((product) => {
        if (product?.state) {
          stateSet.add(product.state);
        }
      });

    return {
      totalProducts: Number(payload.total || payload.products?.length || 0),
      totalSellers: Number(payload.trendingSellers?.length || 0),
      totalStates: stateSet.size,
    };
  }, [payload]);

  const categories = useMemo(() => {
    const merged = [
      ...(Array.isArray(payload.categories) ? payload.categories : []),
      ...MARKETPLACE_CATEGORY_SUGGESTIONS,
    ]
      .map((entry) => (typeof entry === "string" ? entry : entry?.value || ""))
      .filter(Boolean);

    return [...new Set(merged)].slice(0, 10);
  }, [payload.categories]);

  const highlightedProducts = useMemo(() => {
    const primary = Array.isArray(payload.products) ? payload.products : [];
    const fallback = Array.isArray(payload.latestProducts) ? payload.latestProducts : [];
    return (primary.length ? primary : fallback).slice(0, 12);
  }, [payload.latestProducts, payload.products]);

  const locationLabel = useMemo(() => {
    const label = [filters.city, filters.state].filter(Boolean).join(", ");
    if (label) {
      return label;
    }

    const firstProduct =
      highlightedProducts[0] ||
      payload.featuredProducts?.[0] ||
      payload.latestProducts?.[0] ||
      null;

    return firstProduct?.location?.label || "Nigeria";
  }, [filters.city, filters.state, highlightedProducts, payload.featuredProducts, payload.latestProducts]);

  const hasActiveFilters = useMemo(
    () => Object.entries(filters).some(([key, value]) => key !== "sort" && Boolean(value)),
    [filters]
  );

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const applyFilters = () => {
    loadMarketplace(filters);
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    loadMarketplace(defaultFilters);
  };

  const applyQuickFilter = (patch = {}) => {
    const nextFilters = { ...filters, ...patch };
    setFilters(nextFilters);
    loadMarketplace(nextFilters);
  };

  return (
    <QuickAccessLayout
      user={user}
      title="Marketplace"
      subtitle="Discover approved sellers, browse location-aware listings, and open your own storefront from the same marketplace."
      showAppSidebar={false}
      showRightRail={false}
      showHero={false}
      shellClassName="quick-access-shell--marketplace"
      mainClassName="quick-access-main--marketplace"
    >
      <div className="marketplace-page marketplace-facebook-shell">
        <aside className="marketplace-facebook-sidebar marketplace-shell-card">
          <div className="marketplace-facebook-sidebar__header">
            <div>
              <span className="marketplace-section__eyebrow">Marketplace</span>
              <h2>Browse like a buyer. Launch like a seller.</h2>
            </div>
            <p className="marketplace-muted">
              Facebook-inspired browsing with Tengacion&apos;s seller verification layered in.
            </p>
          </div>

          <form
            className="marketplace-facebook-search"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search Marketplace"
              aria-label="Search Marketplace"
            />
            <button type="submit" className="marketplace-primary-btn">
              <span className="marketplace-btn__icon" aria-hidden="true">
                &gt;
              </span>
              Search
            </button>
          </form>

          <div className="marketplace-facebook-nav">
            {sidebarNav.map((item) =>
              item.path ? (
                <Link key={item.id} className="marketplace-facebook-nav__item" to={item.path}>
                  <span className="marketplace-facebook-nav__icon" aria-hidden="true">
                    {item.label
                      .split(" ")
                      .map((word) => word[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </Link>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  className="marketplace-facebook-nav__item"
                  onClick={resetFilters}
                >
                  <span className="marketplace-facebook-nav__icon" aria-hidden="true">
                    BA
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              )
            )}
          </div>

          <div className="marketplace-facebook-sidebar__cta">
            <Link className="marketplace-primary-btn" to="/marketplace/register">
              <span className="marketplace-btn__icon" aria-hidden="true">
                +
              </span>
              Create new listing
            </Link>
            <Link className="marketplace-secondary-btn" to="/marketplace/register">
              <span className="marketplace-btn__icon" aria-hidden="true">
                &gt;
              </span>
              Seller registration
            </Link>
          </div>

          <section className="marketplace-facebook-sidebar__card">
            <div className="marketplace-facebook-sidebar__card-head">
              <strong>Location</strong>
              <span>{locationLabel}</span>
            </div>
            <p className="marketplace-muted">
              Switch state and city filters to make the feed feel local, just like the marketplace flow in your reference.
            </p>
          </section>

          <section className="marketplace-facebook-sidebar__card">
            <div className="marketplace-facebook-sidebar__card-head">
              <strong>Categories</strong>
              <span>{categories.length} available</span>
            </div>
            <div className="marketplace-facebook-category-list">
              {categories.map((category) => {
                const active = filters.category === category;
                return (
                  <button
                    key={category}
                    type="button"
                    className={`marketplace-facebook-category-chip${active ? " is-active" : ""}`}
                    onClick={() => applyQuickFilter({ category: active ? "" : category })}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        <div className="marketplace-facebook-feed">
          <section className="marketplace-shell-card marketplace-facebook-banner">
            <div>
              <span className="marketplace-section__eyebrow">
                {hasActiveFilters ? "Filtered picks" : "Today's picks"}
              </span>
              <h2 className="marketplace-section__title">
                {hasActiveFilters ? "Marketplace matches for your current filters" : "Today's picks"}
              </h2>
              <p className="marketplace-section__copy">
                Explore trusted products, store highlights, and location-aware listings in a calmer storefront experience built for Tengacion buyers and verified sellers.
              </p>
            </div>

            <div className="marketplace-facebook-banner__meta">
              <span>{Number(totals.totalProducts || 0).toLocaleString()} live listings</span>
              <span>{Number(totals.totalSellers || 0).toLocaleString()} approved sellers</span>
              <span>{locationLabel}</span>
            </div>
          </section>

          <div className="marketplace-facebook-highlight-grid">
            <section className="marketplace-shell-card marketplace-facebook-trust">
              <div className="marketplace-section__head">
                <div>
                  <span className="marketplace-section__eyebrow">Seller access</span>
                  <h3>Built for verified storefronts</h3>
                </div>
              </div>

              <div className="marketplace-summary-grid">
                <article className="marketplace-summary-card">
                  <strong>{Number(totals.totalProducts || 0).toLocaleString()}</strong>
                  <span>Live products</span>
                </article>
                <article className="marketplace-summary-card">
                  <strong>{Number(totals.totalStates || 0).toLocaleString()}</strong>
                  <span>States represented</span>
                </article>
                <article className="marketplace-summary-card">
                  <strong>CAC</strong>
                  <span>Seller registration required</span>
                </article>
              </div>

              <p className="marketplace-muted">
                Sellers register with payout details, home and office addresses, phone number, CAC certificate, and their linked Tengacion account information before publishing.
              </p>

              <div className="marketplace-cta-row">
                <Link className="marketplace-primary-btn" to="/marketplace/register">
                  <span className="marketplace-btn__icon" aria-hidden="true">
                    +
                  </span>
                  Register as seller
                </Link>
                <Link className="marketplace-ghost-btn" to="/marketplace/orders">
                  <span className="marketplace-btn__icon" aria-hidden="true">
                    &gt;
                  </span>
                  View buying activity
                </Link>
              </div>
            </section>

            <section className="marketplace-shell-card marketplace-facebook-sellers">
              <div className="marketplace-section__head">
                <div>
                  <span className="marketplace-section__eyebrow">Stores</span>
                  <h3>Trending seller picks</h3>
                </div>
              </div>

              {(payload.trendingSellers || []).length ? (
                <div className="marketplace-facebook-seller-list">
                  {(payload.trendingSellers || []).slice(0, 4).map((seller, index) => (
                    <article key={seller._id} className="marketplace-facebook-seller-row">
                      <span className="marketplace-facebook-seller-row__rank">{index + 1}</span>
                      <div>
                        <strong>{seller.storeName}</strong>
                        <span>{seller.location?.label || "Nigeria"}</span>
                      </div>
                      <Link
                        className="marketplace-link"
                        to={`/marketplace/store/${encodeURIComponent(seller.slug || seller._id)}`}
                      >
                        Open
                      </Link>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="marketplace-empty-state">
                  <strong>Trending sellers will appear here</strong>
                  <p>Once approved storefronts publish products, this card will spotlight them.</p>
                </div>
              )}
            </section>
          </div>

          <section className="marketplace-shell-card marketplace-facebook-filters">
            <div className="marketplace-section__head">
              <div>
                <span className="marketplace-section__eyebrow">Refine feed</span>
                <h3>Category, location, delivery, and sort</h3>
              </div>
            </div>

            <div className="marketplace-filter-grid">
              <div className="marketplace-filter">
                <label htmlFor="marketplace-filter-category">Category</label>
                <select
                  id="marketplace-filter-category"
                  value={filters.category}
                  onChange={(event) => updateFilter("category", event.target.value)}
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="marketplace-filter">
                <label htmlFor="marketplace-filter-state">State</label>
                <input
                  id="marketplace-filter-state"
                  value={filters.state}
                  onChange={(event) => updateFilter("state", event.target.value)}
                  placeholder="Lagos"
                />
              </div>

              <div className="marketplace-filter">
                <label htmlFor="marketplace-filter-city">City</label>
                <input
                  id="marketplace-filter-city"
                  value={filters.city}
                  onChange={(event) => updateFilter("city", event.target.value)}
                  placeholder="Ikeja"
                />
              </div>

              <div className="marketplace-filter">
                <label htmlFor="marketplace-filter-delivery">Delivery</label>
                <select
                  id="marketplace-filter-delivery"
                  value={filters.deliveryOption}
                  onChange={(event) => updateFilter("deliveryOption", event.target.value)}
                >
                  <option value="">All delivery types</option>
                  {MARKETPLACE_DELIVERY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="marketplace-filter-grid marketplace-filter-grid--secondary">
              <div className="marketplace-filter">
                <label htmlFor="marketplace-filter-sort">Sort</label>
                <select
                  id="marketplace-filter-sort"
                  value={filters.sort}
                  onChange={(event) => updateFilter("sort", event.target.value)}
                >
                  <option value="latest">Latest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                </select>
              </div>
            </div>

            <div className="marketplace-inline-actions">
              <button type="button" className="marketplace-primary-btn" onClick={applyFilters}>
                <span className="marketplace-btn__icon" aria-hidden="true">
                  &gt;
                </span>
                Apply filters
              </button>
              <button type="button" className="marketplace-ghost-btn" onClick={resetFilters}>
                <span className="marketplace-btn__icon" aria-hidden="true">
                  x
                </span>
                Reset
              </button>
            </div>
          </section>

          {error ? (
            <div className="marketplace-error-state">
              <strong>Marketplace unavailable</strong>
              <p>{error}</p>
              <button type="button" className="marketplace-primary-btn" onClick={() => loadMarketplace(filters)}>
                <span className="marketplace-btn__icon" aria-hidden="true">
                  &gt;
                </span>
                Try again
              </button>
            </div>
          ) : null}

          {loading ? <div className="marketplace-loading-state">Loading marketplace...</div> : null}

          {!loading ? (
            <>
              <section className="marketplace-panel marketplace-facebook-section">
                <div className="marketplace-section__head">
                  <div>
                    <span className="marketplace-section__eyebrow">Main feed</span>
                    <h2 className="marketplace-section__title">
                      {hasActiveFilters ? "Matching listings" : "Today's picks"}
                    </h2>
                    <p className="marketplace-section__copy">
                      {hasActiveFilters
                        ? "These listings match your current search, category, and delivery filters."
                        : "A clean, scrollable grid of listings designed to feel familiar while staying uniquely Tengacion."}
                    </p>
                  </div>
                </div>

                <ProductGrid
                  products={highlightedProducts}
                  emptyTitle="No products matched those filters"
                  emptyCopy="Try a broader search, switch location, or remove a delivery filter."
                />
              </section>

              <section className="marketplace-panel marketplace-facebook-section">
                <div className="marketplace-section__head">
                  <div>
                    <span className="marketplace-section__eyebrow">Featured</span>
                    <h2 className="marketplace-section__title">Featured products</h2>
                  </div>
                </div>
                <ProductGrid
                  products={payload.featuredProducts || []}
                  emptyTitle="Featured products are coming soon"
                  emptyCopy="Fresh marketplace listings will show up here as sellers publish them."
                />
              </section>

              <section className="marketplace-panel marketplace-facebook-section">
                <div className="marketplace-section__head">
                  <div>
                    <span className="marketplace-section__eyebrow">Fresh listings</span>
                    <h2 className="marketplace-section__title">Latest arrivals</h2>
                  </div>
                </div>
                <ProductGrid
                  products={payload.latestProducts || []}
                  emptyTitle="New listings will appear here soon"
                  emptyCopy="Approved sellers can start filling this feed after onboarding."
                />
              </section>
            </>
          ) : null}
        </div>
      </div>
    </QuickAccessLayout>
  );
}
