import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import QuickAccessLayout from "../components/QuickAccessLayout";
import MarketplaceFilters from "../components/marketplace/MarketplaceFilters";
import MarketplaceHero from "../components/marketplace/MarketplaceHero";
import ProductGrid from "../components/marketplace/ProductGrid";
import { useAuth } from "../context/AuthContext";
import { fetchMarketplaceHome } from "../services/marketplaceService";

import "../components/marketplace/marketplace.css";

const defaultFilters = {
  search: "",
  category: "",
  state: "",
  city: "",
  deliveryOption: "",
  sort: "latest",
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

  return (
    <QuickAccessLayout
      user={user}
      title="Marketplace"
      subtitle="Browse trusted products, meet approved sellers, and pay through Tengacion's built-in checkout."
    >
      <div className="marketplace-page">
        <MarketplaceHero
          totalProducts={totals.totalProducts}
          totalSellers={totals.totalSellers}
          totalStates={totals.totalStates}
        />

        <MarketplaceFilters
          filters={filters}
          categories={payload.categories || []}
          onFiltersChange={setFilters}
          onSearchSubmit={() => loadMarketplace(filters)}
          onReset={() => {
            setFilters(defaultFilters);
            loadMarketplace(defaultFilters);
          }}
        />

        {error ? (
          <div className="marketplace-error-state">
            <strong>Marketplace unavailable</strong>
            <p>{error}</p>
            <button type="button" className="marketplace-primary-btn" onClick={() => loadMarketplace(filters)}>
              Try again
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="marketplace-loading-state">Loading marketplace...</div>
        ) : null}

        {!loading ? (
          <>
            <section className="marketplace-panel">
              <div className="marketplace-section__head">
                <div>
                  <span className="marketplace-section__eyebrow">Search results</span>
                  <h2 className="marketplace-section__title">Latest marketplace matches</h2>
                  <p className="marketplace-section__copy">
                    Filter by category, location, or delivery style to find the right listing fast.
                  </p>
                </div>
              </div>

              <ProductGrid
                products={payload.products || []}
                emptyTitle="No products matched those filters"
                emptyCopy="Try a broader search, switch location, or remove a delivery filter."
              />
            </section>

            <section className="marketplace-panel">
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

            <section className="marketplace-panel">
              <div className="marketplace-section__head">
                <div>
                  <span className="marketplace-section__eyebrow">Trending sellers</span>
                  <h2 className="marketplace-section__title">Stores worth checking first</h2>
                </div>
              </div>
              {(payload.trendingSellers || []).length ? (
                <div className="marketplace-summary-grid">
                  {(payload.trendingSellers || []).map((seller) => (
                    <article key={seller._id} className="marketplace-summary-card">
                      <strong>{seller.storeName}</strong>
                      <span>{seller.location?.label || "Nigeria"}</span>
                      <span>{Number(seller.productCount || 0)} listings</span>
                      <Link className="marketplace-link" to={`/marketplace/store/${encodeURIComponent(seller.slug || seller._id)}`}>
                        Open storefront
                      </Link>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="marketplace-empty-state">
                  <strong>Trending sellers will appear here</strong>
                  <p>Once approved storefronts publish products, this area will spotlight them.</p>
                </div>
              )}
            </section>

            <section className="marketplace-panel">
              <div className="marketplace-section__head">
                <div>
                  <span className="marketplace-section__eyebrow">Latest arrivals</span>
                  <h2 className="marketplace-section__title">Freshly published listings</h2>
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
    </QuickAccessLayout>
  );
}
