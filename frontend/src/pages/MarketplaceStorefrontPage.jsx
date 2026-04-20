import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";

import QuickAccessLayout from "../components/QuickAccessLayout";
import ProductGrid from "../components/marketplace/ProductGrid";
import StoreHeader from "../components/marketplace/StoreHeader";
import { useAuth } from "../context/AuthContext";
import {
  fetchMarketplaceStoreProducts,
  fetchMarketplaceStorefront,
} from "../services/marketplaceService";

import "../components/marketplace/marketplace.css";

export default function MarketplaceStorefrontPage() {
  const { user } = useAuth();
  const { idOrSlug } = useParams();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadStore = useCallback(async () => {
    setLoading(true);
    try {
      const [storePayload, productsPayload] = await Promise.all([
        fetchMarketplaceStorefront(idOrSlug),
        fetchMarketplaceStoreProducts(idOrSlug),
      ]);
      setStore(storePayload?.seller || null);
      setProducts(productsPayload?.products || []);
    } catch (err) {
      toast.error(err?.message || "Could not load this storefront.");
    } finally {
      setLoading(false);
    }
  }, [idOrSlug]);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  return (
    <QuickAccessLayout
      user={user}
      title="Marketplace Store"
      subtitle="Visit approved Tengacion storefronts and browse every live product in one place."
      showAppSidebar={false}
      showRightRail={false}
      showHero={false}
      shellClassName="quick-access-shell--marketplace"
      mainClassName="quick-access-main--marketplace"
    >
      <div className="marketplace-page">
        {loading ? <div className="marketplace-loading-state">Loading storefront...</div> : null}
        {!loading && store ? <StoreHeader seller={store} /> : null}
        {!loading ? (
          <section className="marketplace-panel">
            <div className="marketplace-section__head">
              <div>
                <span className="marketplace-section__eyebrow">Storefront feed</span>
                <h2 className="marketplace-section__title">Live listings from this store</h2>
              </div>
            </div>
            <ProductGrid
              products={products}
              emptyTitle="This seller has no live listings yet"
              emptyCopy="Check back after the seller publishes products to their storefront."
            />
          </section>
        ) : null}
      </div>
    </QuickAccessLayout>
  );
}
