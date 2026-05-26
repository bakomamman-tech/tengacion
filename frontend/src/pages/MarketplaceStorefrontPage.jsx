import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";

import QuickAccessLayout from "../components/QuickAccessLayout";
import ProductGrid from "../components/marketplace/ProductGrid";
import StoreHeader from "../components/marketplace/StoreHeader";
import SeoHead from "../components/seo/SeoHead";
import { useAuth } from "../context/AuthContext";
import {
  buildBreadcrumbJsonLd,
  buildCanonicalUrl,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  truncateDescription,
} from "../lib/seo";
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
  const storePath = store ? `/marketplace/store/${store.slug || store._id || idOrSlug}` : `/marketplace/store/${idOrSlug}`;
  const seoTitle = store?.storeName
    ? `${store.storeName} | Tengacion Marketplace Store`
    : "Marketplace Store | Tengacion";
  const seoDescription = truncateDescription(
    store?.about ||
      `Browse live marketplace listings from ${store?.storeName || "an approved Tengacion seller"}.`,
    180
  );
  const seoStructuredData = [
    buildWebSiteJsonLd(),
    buildOrganizationJsonLd(),
    buildBreadcrumbJsonLd([
      { name: "Tengacion", url: "/" },
      { name: "Marketplace", url: "/marketplace" },
      { name: store?.storeName || "Store", url: storePath },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "Store",
      name: store?.storeName || "Tengacion Marketplace Store",
      description: seoDescription,
      url: buildCanonicalUrl(storePath),
      address: store?.location?.label
        ? {
            "@type": "PostalAddress",
            addressLocality: store.location.city || undefined,
            addressRegion: store.location.state || undefined,
            addressCountry: "NG",
          }
        : undefined,
    },
    products.length
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${store?.storeName || "Store"} products`,
          itemListElement: products.slice(0, 8).map((product, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: product?.title || "Marketplace product",
            url: buildCanonicalUrl(`/marketplace/product/${product?.slug || product?._id || ""}`),
          })),
        }
      : null,
  ].filter(Boolean);

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
      <SeoHead
        title={seoTitle}
        description={seoDescription}
        canonical={storePath}
        robots={store ? "index,follow" : "noindex,follow"}
        structuredData={seoStructuredData}
      />
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
