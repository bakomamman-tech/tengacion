import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import QuickAccessLayout from "../components/QuickAccessLayout";
import PayoutSummaryCards from "../components/marketplace/PayoutSummaryCards";
import ProductForm from "../components/marketplace/ProductForm";
import ProductGrid from "../components/marketplace/ProductGrid";
import SellerStatusBanner from "../components/marketplace/SellerStatusBanner";
import { useAuth } from "../context/AuthContext";
import MarketplaceSellerOrdersPage from "./MarketplaceSellerOrdersPage";
import {
  createMarketplaceListing,
  deleteMarketplaceListing,
  fetchMyMarketplaceProducts,
  publishMarketplaceListing,
  unpublishMarketplaceListing,
  updateMarketplaceListing,
} from "../services/marketplaceService";
import { fetchMarketplacePayoutHistory } from "../services/marketplacePayoutService";
import {
  fetchSellerMarketplaceOrders,
  updateMarketplaceOrderStatus,
} from "../services/marketplaceOrderService";
import { fetchMyMarketplaceSellerProfile } from "../services/marketplaceSellerService";

import "../components/marketplace/marketplace.css";

export default function MarketplaceSellerDashboardPage() {
  const { user } = useAuth();
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payoutSummary, setPayoutSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const sellerPayload = await fetchMyMarketplaceSellerProfile();
      setSeller(sellerPayload?.seller || null);

      if (sellerPayload?.seller?.status === "approved") {
        const [productPayload, orderPayload, payoutPayload] = await Promise.all([
          fetchMyMarketplaceProducts(),
          fetchSellerMarketplaceOrders(),
          fetchMarketplacePayoutHistory(),
        ]);
        setProducts(productPayload?.products || []);
        setOrders(orderPayload?.orders || []);
        setPayoutSummary(payoutPayload?.summary || {});
      } else {
        setProducts([]);
        setOrders([]);
        setPayoutSummary({});
      }
    } catch (err) {
      toast.error(err?.message || "Could not load seller dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const saveProduct = async (formPayload) => {
    setSubmitting(true);
    try {
      if (editingProduct?._id) {
        await updateMarketplaceListing(editingProduct._id, formPayload);
        toast.success("Marketplace listing updated.");
      } else {
        await createMarketplaceListing(formPayload);
        toast.success("Marketplace listing created.");
      }
      setEditingProduct(null);
      setShowForm(false);
      await loadDashboard();
    } catch (err) {
      toast.error(err?.details?.[0] || err?.message || "Could not save listing.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <QuickAccessLayout
      user={user}
      title="Marketplace Dashboard"
      subtitle="Manage your storefront, publish listings, review orders, and follow your payout history from one seller workspace."
    >
      <div className="marketplace-page">
        {loading ? <div className="marketplace-loading-state">Loading marketplace dashboard...</div> : null}

        {!loading && !seller ? (
          <div className="marketplace-empty-state">
            <strong>You are not a marketplace seller yet</strong>
            <p>Complete seller onboarding first so Tengacion can review and approve your storefront.</p>
            <Link className="marketplace-primary-btn" to="/marketplace/register">
              Start seller registration
            </Link>
          </div>
        ) : null}

        {!loading && seller ? <SellerStatusBanner seller={seller} /> : null}

        {!loading && seller?.status !== "approved" ? (
          <section className="marketplace-panel">
            <div className="marketplace-section__head">
              <div>
                <span className="marketplace-section__eyebrow">Next step</span>
                <h2 className="marketplace-section__title">Finish seller approval first</h2>
                <p className="marketplace-section__copy">
                  Listings, order management, and payout history unlock after Tengacion approves your seller profile.
                </p>
              </div>
              <Link className="marketplace-primary-btn" to="/marketplace/register">
                Open seller form
              </Link>
            </div>
          </section>
        ) : null}

        {!loading && seller?.status === "approved" ? (
          <>
            <PayoutSummaryCards summary={payoutSummary} />

            <section className="marketplace-panel">
              <div className="marketplace-section__head">
                <div>
                  <span className="marketplace-section__eyebrow">Listings</span>
                  <h2 className="marketplace-section__title">Store inventory</h2>
                  <p className="marketplace-section__copy">
                    Add products, update stock, and publish or unpublish your marketplace feed.
                  </p>
                </div>
                <button
                  type="button"
                  className="marketplace-primary-btn"
                  onClick={() => {
                    setEditingProduct(null);
                    setShowForm((current) => !current);
                  }}
                >
                  {showForm ? "Close form" : "Add product"}
                </button>
              </div>

              {showForm || editingProduct ? (
                <ProductForm
                  initialProduct={editingProduct}
                  submitting={submitting}
                  onSubmit={saveProduct}
                  onCancel={() => {
                    setEditingProduct(null);
                    setShowForm(false);
                  }}
                />
              ) : null}

              <ProductGrid
                products={products}
                manageView
                emptyTitle="No seller listings yet"
                emptyCopy="Create your first product to start building your marketplace storefront."
                onEdit={(product) => {
                  setEditingProduct(product);
                  setShowForm(true);
                }}
                onPublishToggle={async (product) => {
                  try {
                    if (product.isPublished) {
                      await unpublishMarketplaceListing(product._id);
                      toast.success("Listing unpublished.");
                    } else {
                      await publishMarketplaceListing(product._id);
                      toast.success("Listing published.");
                    }
                    await loadDashboard();
                  } catch (err) {
                    toast.error(err?.details?.[0] || err?.message || "Could not change publish state.");
                  }
                }}
                onDelete={async (product) => {
                  if (!window.confirm(`Remove ${product.title} from your marketplace listings?`)) {
                    return;
                  }
                  try {
                    await deleteMarketplaceListing(product._id);
                    toast.success("Listing removed.");
                    await loadDashboard();
                  } catch (err) {
                    toast.error(err?.message || "Could not remove listing.");
                  }
                }}
              />
            </section>

            <section className="marketplace-panel">
              <div className="marketplace-section__head">
                <div>
                  <span className="marketplace-section__eyebrow">Orders</span>
                  <h2 className="marketplace-section__title">Recent seller orders</h2>
                </div>
                <Link className="marketplace-secondary-btn" to="/marketplace/orders">
                  Open full orders page
                </Link>
              </div>
              <MarketplaceSellerOrdersPage
                orders={orders}
                updatingId={updatingOrderId}
                onUpdateStatus={async (order, status) => {
                  setUpdatingOrderId(order._id);
                  try {
                    await updateMarketplaceOrderStatus(order._id, { status });
                    toast.success("Order status updated.");
                    await loadDashboard();
                  } catch (err) {
                    toast.error(err?.message || "Could not update seller order.");
                  } finally {
                    setUpdatingOrderId("");
                  }
                }}
              />
            </section>
          </>
        ) : null}
      </div>
    </QuickAccessLayout>
  );
}
