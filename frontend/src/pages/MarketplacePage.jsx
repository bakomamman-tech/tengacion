import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import QuickAccessLayout from "../components/QuickAccessLayout";
import MarketplaceIcon from "../components/marketplace/MarketplaceIcon";
import ProductGrid from "../components/marketplace/ProductGrid";
import SeoHead from "../components/seo/SeoHead";
import { useAuth } from "../context/AuthContext";
import {
  buildBreadcrumbJsonLd,
  buildCanonicalUrl,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from "../lib/seo";
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

const MARKETPLACE_TITLE = "Shop Products from Verified African Creators & Sellers | Tengacion";
const MARKETPLACE_DESCRIPTION =
  "Shop products from verified African creators and approved sellers, with visible prices, product photos, local pickup, and delivery-ready listings on Tengacion.";

const sidebarNav = [
  { id: "browse", icon: "compass", label: "Browse all", description: "Reset filters and explore everything.", action: "reset" },
  { id: "orders", icon: "receipt", label: "Buying", description: "Track orders and recent purchases.", path: "/marketplace/orders" },
  { id: "register", icon: "store", label: "Marketplace access", description: "Register your seller profile.", path: "/marketplace/register" },
  { id: "dashboard", icon: "grid", label: "Selling", description: "Manage listings and orders.", path: "/marketplace/dashboard" },
  { id: "payouts", icon: "wallet", label: "Payouts", description: "Review settlement history.", path: "/marketplace/payouts" },
];

const getProductKey = (product = {}) =>
  String(product._id || product.id || product.slug || `${product.title || ""}:${product.seller?._id || product.sellerId || ""}`).trim();

const uniqueProducts = (products = []) => {
  const seen = new Map();
  for (const product of Array.isArray(products) ? products : []) {
    const key = getProductKey(product);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.set(key, product);
  }
  return Array.from(seen.values());
};

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
    const products = uniqueProducts([
      ...(payload.products || []),
      ...(payload.featuredProducts || []),
      ...(payload.latestProducts || []),
    ]);

    products.forEach((product) => {
        if (product?.state) {
          stateSet.add(product.state);
        }
      });

    return {
      totalProducts: Number(payload.total || products.length || 0),
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

  const allProducts = useMemo(
    () =>
      uniqueProducts([
        ...(payload.products || []),
        ...(payload.featuredProducts || []),
        ...(payload.latestProducts || []),
      ]),
    [payload.featuredProducts, payload.latestProducts, payload.products]
  );

  const highlightedProducts = useMemo(() => {
    const primary = uniqueProducts(payload.products || []);
    return (primary.length ? primary : allProducts).slice(0, 12);
  }, [allProducts, payload.products]);

  const highlightedProductKeys = useMemo(
    () => new Set(highlightedProducts.map((product) => getProductKey(product)).filter(Boolean)),
    [highlightedProducts]
  );

  const featuredProducts = useMemo(
    () =>
      uniqueProducts(payload.featuredProducts || [])
        .filter((product) => !highlightedProductKeys.has(getProductKey(product)))
        .slice(0, 8),
    [highlightedProductKeys, payload.featuredProducts]
  );

  const secondaryProductKeys = useMemo(
    () => new Set([...highlightedProductKeys, ...featuredProducts.map((product) => getProductKey(product))]),
    [featuredProducts, highlightedProductKeys]
  );

  const latestProducts = useMemo(
    () =>
      uniqueProducts(payload.latestProducts || [])
        .filter((product) => !secondaryProductKeys.has(getProductKey(product)))
        .slice(0, 8),
    [payload.latestProducts, secondaryProductKeys]
  );

  const seoStructuredData = useMemo(() => {
    const items = highlightedProducts.slice(0, 8).map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: product?.title || "Marketplace product",
      url: buildCanonicalUrl(`/marketplace/product/${product?.slug || product?._id || ""}`),
    }));

    return [
      buildWebSiteJsonLd(),
      buildOrganizationJsonLd(),
      buildBreadcrumbJsonLd([
        { name: "Tengacion", url: "/" },
        { name: "Marketplace", url: "/marketplace" },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Tengacion Marketplace products",
        itemListElement: items,
      },
    ];
  }, [highlightedProducts]);

  const locationLabel = useMemo(() => {
    const label = [filters.city, filters.state].filter(Boolean).join(", ");
    if (label) {
      return label;
    }

    const firstProduct =
      highlightedProducts[0] ||
      featuredProducts[0] ||
      latestProducts[0] ||
      allProducts[0] ||
      null;

    return firstProduct?.location?.label || "Nigeria";
  }, [allProducts, featuredProducts, filters.city, filters.state, highlightedProducts, latestProducts]);

  const hasActiveFilters = useMemo(
    () => Object.entries(filters).some(([key, value]) => key !== "sort" && Boolean(value)),
    [filters]
  );

  const activeFilterCount = useMemo(
    () => Object.entries(filters).filter(([key, value]) => key !== "sort" && Boolean(value)).length,
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
      showNavbar={Boolean(user)}
      shellClassName="quick-access-shell--marketplace"
      mainClassName="quick-access-main--marketplace"
    >
      <SeoHead
        title={MARKETPLACE_TITLE}
        description={MARKETPLACE_DESCRIPTION}
        canonical="/marketplace"
        robots="index,follow"
        structuredData={seoStructuredData}
      />
      <div className="marketplace-page marketplace-facebook-shell">
        <aside className="marketplace-facebook-sidebar marketplace-shell-card">
          <div className="marketplace-facebook-sidebar__header">
            <div className="marketplace-facebook-sidebar__brandline">
              <span className="marketplace-section__eyebrow">Marketplace</span>
              <span className="marketplace-live-label">
                <span aria-hidden="true" /> Live
              </span>
            </div>
            <h2>Browse like a buyer. Launch like a seller.</h2>
            <p className="marketplace-muted">
              Discover useful finds nearby and shop storefronts backed by Tengacion seller verification.
            </p>
          </div>

          <form
            className="marketplace-facebook-search"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            <label className="marketplace-search-label" htmlFor="marketplace-search-input">
              Search marketplace
            </label>
            <div className="marketplace-facebook-search__field">
              <MarketplaceIcon name="search" size={19} />
              <input
                id="marketplace-search-input"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Search Marketplace"
                aria-label="Search Marketplace"
              />
            </div>
            <button type="submit" className="marketplace-primary-btn">
              <span className="marketplace-btn__icon" aria-hidden="true">
                <MarketplaceIcon name="arrowRight" size={15} />
              </span>
              Search
            </button>
          </form>

          <div className="marketplace-facebook-nav">
            {sidebarNav.map((item) =>
              item.path ? (
                <Link key={item.id} className="marketplace-facebook-nav__item" to={item.path}>
                  <span className="marketplace-facebook-nav__icon" aria-hidden="true">
                    <MarketplaceIcon name={item.icon} size={19} />
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
                  className="marketplace-facebook-nav__item is-active"
                  onClick={resetFilters}
                >
                  <span className="marketplace-facebook-nav__icon" aria-hidden="true">
                    <MarketplaceIcon name={item.icon} size={19} />
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              )
            )}
          </div>

          <div className="marketplace-facebook-sidebar__cta marketplace-seller-invite">
            <span className="marketplace-seller-invite__icon" aria-hidden="true">
              <MarketplaceIcon name="store" size={21} />
            </span>
            <div>
              <strong>Ready to start selling?</strong>
              <p>Set up a verified storefront and publish your first listing.</p>
            </div>
            <Link className="marketplace-primary-btn" to="/marketplace/register">
              <span className="marketplace-btn__icon" aria-hidden="true">
                <MarketplaceIcon name="plus" size={15} />
              </span>
              Seller tools
            </Link>
            <Link className="marketplace-seller-invite__link" to="/marketplace/register">
              Seller registration
              <MarketplaceIcon name="arrowRight" size={15} />
            </Link>
          </div>

          <section className="marketplace-facebook-sidebar__card">
            <div className="marketplace-facebook-sidebar__card-head">
              <strong>
                <MarketplaceIcon name="mapPin" size={17} />
                Shopping near
              </strong>
              <span>{locationLabel}</span>
            </div>
            <p className="marketplace-muted">
              Use state and city filters to find products that are easier to collect or deliver.
            </p>
          </section>

          <section className="marketplace-facebook-sidebar__card">
            <div className="marketplace-facebook-sidebar__card-head">
              <strong>
                <MarketplaceIcon name="grid" size={17} />
                Categories
              </strong>
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
            <div className="marketplace-facebook-banner__content">
              <span className="marketplace-section__eyebrow">
                <MarketplaceIcon name="sparkles" size={14} />
                {hasActiveFilters ? "Filtered picks" : "Today's picks"}
              </span>
              <h2 className="marketplace-section__title">
                {hasActiveFilters ? "Marketplace matches for your current filters" : "Today's picks"}
              </h2>
              <p className="marketplace-section__copy">
                Explore trusted products and location-aware listings from sellers who have completed Tengacion&apos;s marketplace checks.
              </p>
              <div className="marketplace-facebook-banner__actions">
                <a className="marketplace-primary-btn" href="#marketplace-products">
                  Explore listings
                  <MarketplaceIcon name="arrowRight" size={17} />
                </a>
                <Link className="marketplace-ghost-btn" to="/marketplace/register">
                  Start selling
                </Link>
              </div>
            </div>

            <div className="marketplace-facebook-banner__meta">
              <article>
                <span className="marketplace-facebook-banner__meta-icon" aria-hidden="true">
                  <MarketplaceIcon name="package" size={19} />
                </span>
                <strong>{Number(totals.totalProducts || 0).toLocaleString()}</strong>
                <span>Live listings</span>
              </article>
              <article>
                <span className="marketplace-facebook-banner__meta-icon" aria-hidden="true">
                  <MarketplaceIcon name="badgeCheck" size={19} />
                </span>
                <strong>{Number(totals.totalSellers || 0).toLocaleString()}</strong>
                <span>Approved sellers</span>
              </article>
              <article>
                <span className="marketplace-facebook-banner__meta-icon" aria-hidden="true">
                  <MarketplaceIcon name="mapPin" size={19} />
                </span>
                <strong className="marketplace-facebook-banner__location">{locationLabel}</strong>
                <span>Current area</span>
              </article>
            </div>
          </section>

          <section className="marketplace-shell-card marketplace-facebook-filters">
            <div className="marketplace-section__head">
              <div className="marketplace-facebook-filters__heading">
                <span className="marketplace-filter-heading__icon" aria-hidden="true">
                  <MarketplaceIcon name="sliders" size={19} />
                </span>
                <div>
                  <span className="marketplace-section__eyebrow">Refine feed</span>
                  <h3>Find the right product, closer to you</h3>
                </div>
              </div>
              {activeFilterCount ? (
                <span className="marketplace-active-filter-count">{activeFilterCount} active</span>
              ) : (
                <span className="marketplace-filter-hint">All listings</span>
              )}
            </div>

            <div className="marketplace-filter-grid marketplace-filter-grid--marketplace-home">
              <div className="marketplace-filter">
                <label htmlFor="marketplace-filter-category">Category</label>
                <div className="marketplace-filter__control">
                  <MarketplaceIcon name="grid" size={17} />
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
              </div>

              <div className="marketplace-filter">
                <label htmlFor="marketplace-filter-state">State</label>
                <div className="marketplace-filter__control">
                  <MarketplaceIcon name="mapPin" size={17} />
                  <input
                    id="marketplace-filter-state"
                    value={filters.state}
                    onChange={(event) => updateFilter("state", event.target.value)}
                    placeholder="Lagos"
                  />
                </div>
              </div>

              <div className="marketplace-filter">
                <label htmlFor="marketplace-filter-city">City</label>
                <div className="marketplace-filter__control">
                  <MarketplaceIcon name="mapPin" size={17} />
                  <input
                    id="marketplace-filter-city"
                    value={filters.city}
                    onChange={(event) => updateFilter("city", event.target.value)}
                    placeholder="Ikeja"
                  />
                </div>
              </div>

              <div className="marketplace-filter">
                <label htmlFor="marketplace-filter-delivery">Delivery</label>
                <div className="marketplace-filter__control">
                  <MarketplaceIcon name="truck" size={17} />
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

              <div className="marketplace-filter">
                <label htmlFor="marketplace-filter-sort">Sort</label>
                <div className="marketplace-filter__control">
                  <MarketplaceIcon name="sliders" size={17} />
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
            </div>

            <div className="marketplace-inline-actions marketplace-facebook-filters__actions">
              <button type="button" className="marketplace-primary-btn" onClick={applyFilters}>
                <span className="marketplace-btn__icon" aria-hidden="true">
                  <MarketplaceIcon name="sliders" size={15} />
                </span>
                Apply filters
              </button>
              <button type="button" className="marketplace-ghost-btn" onClick={resetFilters}>
                <span className="marketplace-btn__icon" aria-hidden="true">
                  <MarketplaceIcon name="x" size={14} />
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
                  <MarketplaceIcon name="arrowRight" size={15} />
                </span>
                Try again
              </button>
            </div>
          ) : null}

          {loading ? (
            <div className="marketplace-loading-state">
              <span className="marketplace-loading-state__spinner" aria-hidden="true" />
              <strong>Loading marketplace...</strong>
              <span>Gathering fresh listings from approved sellers.</span>
            </div>
          ) : null}

          {!loading ? (
            <>
              <section
                id="marketplace-products"
                className="marketplace-panel marketplace-facebook-section marketplace-facebook-section--products"
              >
                <div className="marketplace-section__head">
                  <div>
                    <span className="marketplace-section__eyebrow">Main feed</span>
                    <h2 className="marketplace-section__title">
                      {hasActiveFilters ? "Matching listings" : "Today's picks"}
                    </h2>
                    <p className="marketplace-section__copy">
                      {hasActiveFilters
                        ? "These listings match your current search, category, and delivery filters."
                        : "Fresh, approved listings from Tengacion sellers—easy to browse and simple to compare."}
                    </p>
                  </div>
                  <span className="marketplace-result-count">
                    {highlightedProducts.length} {highlightedProducts.length === 1 ? "result" : "results"}
                  </span>
                </div>

                <ProductGrid
                  products={highlightedProducts}
                  emptyTitle="No products matched those filters"
                  emptyCopy="Try a broader search, switch location, or remove a delivery filter."
                />
              </section>

              <div className="marketplace-facebook-highlight-grid">
                <section className="marketplace-shell-card marketplace-facebook-trust">
                  <div className="marketplace-section__head">
                    <div>
                      <span className="marketplace-section__eyebrow">
                        <MarketplaceIcon name="shieldCheck" size={14} /> Seller access
                      </span>
                      <h3>Built for verified storefronts</h3>
                    </div>
                  </div>

                  <div className="marketplace-summary-grid marketplace-summary-grid--compact">
                    <article className="marketplace-summary-card">
                      <span className="marketplace-summary-card__icon" aria-hidden="true">
                        <MarketplaceIcon name="package" size={19} />
                      </span>
                      <div>
                        <strong>{Number(totals.totalProducts || 0).toLocaleString()}</strong>
                        <span>Live products</span>
                      </div>
                    </article>
                    <article className="marketplace-summary-card">
                      <span className="marketplace-summary-card__icon" aria-hidden="true">
                        <MarketplaceIcon name="mapPin" size={19} />
                      </span>
                      <div>
                        <strong>{Number(totals.totalStates || 0).toLocaleString()}</strong>
                        <span>States represented</span>
                      </div>
                    </article>
                    <article className="marketplace-summary-card">
                      <span className="marketplace-summary-card__icon" aria-hidden="true">
                        <MarketplaceIcon name="badgeCheck" size={19} />
                      </span>
                      <div>
                        <strong>CAC</strong>
                        <span>Registration required</span>
                      </div>
                    </article>
                  </div>

                  <p className="marketplace-muted">
                    Sellers provide payout, contact, address, and CAC details linked to their Tengacion account before publishing.
                  </p>

                  <div className="marketplace-cta-row">
                    <Link className="marketplace-primary-btn" to="/marketplace/register">
                      <span className="marketplace-btn__icon" aria-hidden="true">
                        <MarketplaceIcon name="plus" size={15} />
                      </span>
                      Register as seller
                    </Link>
                    <Link className="marketplace-ghost-btn" to="/marketplace/orders">
                      View buying activity
                      <MarketplaceIcon name="arrowRight" size={16} />
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
                            className="marketplace-link marketplace-facebook-seller-row__link"
                            to={`/marketplace/store/${encodeURIComponent(seller.slug || seller._id)}`}
                          >
                            Open
                            <MarketplaceIcon name="arrowRight" size={15} />
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

              {featuredProducts.length ? (
                <section className="marketplace-panel marketplace-facebook-section">
                  <div className="marketplace-section__head">
                    <div>
                      <span className="marketplace-section__eyebrow">Featured</span>
                      <h2 className="marketplace-section__title">Featured products</h2>
                    </div>
                  </div>
                  <ProductGrid
                    products={featuredProducts}
                    emptyTitle="Featured products are coming soon"
                    emptyCopy="Fresh marketplace listings will show up here as sellers publish them."
                  />
                </section>
              ) : null}

              {latestProducts.length ? (
                <section className="marketplace-panel marketplace-facebook-section">
                  <div className="marketplace-section__head">
                    <div>
                      <span className="marketplace-section__eyebrow">Fresh listings</span>
                      <h2 className="marketplace-section__title">Latest arrivals</h2>
                    </div>
                  </div>
                  <ProductGrid
                    products={latestProducts}
                    emptyTitle="New listings will appear here soon"
                    emptyCopy="Approved sellers can start filling this feed after onboarding."
                  />
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </QuickAccessLayout>
  );
}
