import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import QuickAccessLayout from "../components/QuickAccessLayout";
import ProductGrid from "../components/marketplace/ProductGrid";
import OrderStatusBadge from "../components/marketplace/OrderStatusBadge";
import { useAuth } from "../context/AuthContext";
import { initializeMarketplacePayment } from "../services/marketplaceOrderService";
import { fetchMarketplaceProductDetail } from "../services/marketplaceService";

import "../components/marketplace/marketplace.css";

export default function MarketplaceProductDetailsPage() {
  const { user } = useAuth();
  const { idOrSlug } = useParams();
  const [payload, setPayload] = useState({ product: null, relatedProducts: [] });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [deliveryMethod, setDeliveryMethod] = useState("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const loadProduct = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchMarketplaceProductDetail(idOrSlug);
      setPayload(response || { product: null, relatedProducts: [] });
      const firstDeliveryOption = response?.product?.deliveryOptions?.[0] || "pickup";
      setDeliveryMethod(firstDeliveryOption);
      setSelectedIndex(0);
    } catch (err) {
      toast.error(err?.message || "Could not load this product.");
    } finally {
      setLoading(false);
    }
  }, [idOrSlug]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  const product = payload.product;
  const images = product?.images || [];
  const selectedImage = images[selectedIndex] || images[0] || null;

  const handleBuyNow = async () => {
    if (!product) {
      return;
    }
    if (deliveryMethod !== "pickup" && (!deliveryAddress.trim() || !deliveryPhone.trim())) {
      toast.error("Delivery address and contact phone are required for delivery orders.");
      return;
    }

    setProcessing(true);
    try {
      const response = await initializeMarketplacePayment({
        productId: product._id,
        quantity,
        deliveryMethod,
        deliveryAddress,
        deliveryContactPhone: deliveryPhone,
        returnUrl:
          typeof window !== "undefined"
            ? `${window.location.origin}/marketplace/orders`
            : "/marketplace/orders",
      });

      if (response?.authorizationUrl && typeof window !== "undefined") {
        window.location.assign(response.authorizationUrl);
        return;
      }

      throw new Error("Paystack checkout URL was not returned.");
    } catch (err) {
      toast.error(err?.message || "Could not initialize marketplace payment.");
    } finally {
      setProcessing(false);
    }
  };

  const priceLabel = useMemo(
    () => `₦${Number(product?.price || 0).toLocaleString()}`,
    [product?.price]
  );

  return (
    <QuickAccessLayout
      user={user}
      title="Marketplace Product"
      subtitle="Review item details, choose delivery, and complete payment through Tengacion's Paystack checkout."
    >
      <div className="marketplace-page">
        {loading ? <div className="marketplace-loading-state">Loading product details...</div> : null}
        {!loading && product ? (
          <>
            <section className="marketplace-product-layout">
              <div className="marketplace-product-main">
                <div className="marketplace-gallery">
                  {selectedImage ? <img src={selectedImage.url || selectedImage.secureUrl} alt={product.title} /> : null}
                </div>
                {images.length > 1 ? (
                  <div className="marketplace-thumb-strip">
                    {images.map((image, index) => (
                      <button
                        key={image.publicId || image.url || index}
                        type="button"
                        onClick={() => setSelectedIndex(index)}
                      >
                        <img src={image.url || image.secureUrl} alt="" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <aside className="marketplace-product-main">
                <span className="marketplace-section__eyebrow">{product.category}</span>
                <h1>{product.title}</h1>
                <div className="marketplace-price">{priceLabel}</div>
                <p className="marketplace-muted">Service charge included in price</p>

                <div className="marketplace-pill-row">
                  <OrderStatusBadge value={product.condition} />
                  <span className="marketplace-status-pill">{product.location?.label || "Location set by seller"}</span>
                  <span className="marketplace-status-pill">{Number(product.stock || 0)} in stock</span>
                </div>

                <div className="marketplace-card-stack">
                  <strong>Delivery available</strong>
                  <div className="marketplace-pill-row">
                    {(product.deliveryOptions || []).map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`marketplace-delivery-pill${
                          deliveryMethod === option ? " marketplace-status-pill--success" : ""
                        }`}
                        onClick={() => setDeliveryMethod(option)}
                      >
                        {String(option).replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>

                  <div className="marketplace-filter">
                    <label htmlFor="marketplace-quantity">Quantity</label>
                    <input
                      id="marketplace-quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(event) => setQuantity(Math.max(1, Number(event.target.value || 1)))}
                    />
                  </div>

                  {deliveryMethod !== "pickup" ? (
                    <>
                      <div className="marketplace-form-field">
                        <label htmlFor="marketplace-delivery-address">Delivery address</label>
                        <textarea
                          id="marketplace-delivery-address"
                          rows={3}
                          value={deliveryAddress}
                          onChange={(event) => setDeliveryAddress(event.target.value)}
                        />
                      </div>
                      <div className="marketplace-form-field">
                        <label htmlFor="marketplace-delivery-phone">Delivery contact phone</label>
                        <input
                          id="marketplace-delivery-phone"
                          value={deliveryPhone}
                          onChange={(event) => setDeliveryPhone(event.target.value)}
                        />
                      </div>
                    </>
                  ) : null}

                  <button
                    type="button"
                    className="marketplace-primary-btn"
                    disabled={processing || Number(product.stock || 0) < 1}
                    onClick={handleBuyNow}
                  >
                    {processing ? "Opening Paystack..." : "Buy now"}
                  </button>
                </div>

                <div className="marketplace-card-stack">
                  <strong>Seller</strong>
                  <span>{product.seller?.storeName || "Marketplace seller"}</span>
                  <span className="marketplace-muted">{product.seller?.location?.label || "Nigeria"}</span>
                  <Link className="marketplace-link" to={`/marketplace/store/${encodeURIComponent(product.seller?.slug || product.seller?._id || "")}`}>
                    Open store
                  </Link>
                </div>
              </aside>
            </section>

            <section className="marketplace-panel">
              <div className="marketplace-section__head">
                <div>
                  <span className="marketplace-section__eyebrow">Description</span>
                  <h2 className="marketplace-section__title">What buyers should know</h2>
                </div>
              </div>
              <p className="marketplace-section__copy">{product.description}</p>
            </section>

            <section className="marketplace-panel">
              <div className="marketplace-section__head">
                <div>
                  <span className="marketplace-section__eyebrow">Related products</span>
                  <h2 className="marketplace-section__title">More listings you may like</h2>
                </div>
              </div>
              <ProductGrid
                products={payload.relatedProducts || []}
                emptyTitle="No related products yet"
                emptyCopy="More listings from other marketplace sellers will appear here."
              />
            </section>
          </>
        ) : null}
      </div>
    </QuickAccessLayout>
  );
}
