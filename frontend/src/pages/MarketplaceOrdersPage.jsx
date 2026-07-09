import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import QuickAccessLayout from "../components/QuickAccessLayout";
import { useAuth } from "../context/AuthContext";
import MarketplaceBuyerOrdersPage from "./MarketplaceBuyerOrdersPage";
import MarketplaceSellerOrdersPage from "./MarketplaceSellerOrdersPage";
import {
  fetchBuyerMarketplaceOrders,
  fetchSellerMarketplaceOrders,
  confirmMarketplaceOrderDelivery,
  updateMarketplaceOrderStatus,
  verifyMarketplacePayment,
} from "../services/marketplaceOrderService";
import { fetchMyMarketplaceSellerProfile } from "../services/marketplaceSellerService";

import "../components/marketplace/marketplace.css";

export default function MarketplaceOrdersPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [buyerOrders, setBuyerOrders] = useState([]);
  const [sellerOrders, setSellerOrders] = useState([]);
  const [sellerReady, setSellerReady] = useState(false);
  const [activeTab, setActiveTab] = useState("buyer");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [checkoutNotice, setCheckoutNotice] = useState(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [buyerPayload, sellerProfile] = await Promise.all([
        fetchBuyerMarketplaceOrders(),
        fetchMyMarketplaceSellerProfile().catch(() => ({ seller: null })),
      ]);

      setBuyerOrders(buyerPayload?.orders || []);
      const isApprovedSeller = sellerProfile?.seller?.status === "approved";
      setSellerReady(isApprovedSeller);

      if (isApprovedSeller) {
        const sellerPayload = await fetchSellerMarketplaceOrders();
        setSellerOrders(sellerPayload?.orders || []);
      } else {
        setSellerOrders([]);
      }
    } catch (err) {
      toast.error(err?.message || "Could not load marketplace orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reference = params.get("reference") || params.get("trxref") || "";
    if (!reference) {
      return;
    }

    let active = true;
    const verify = async () => {
      try {
        const result = await verifyMarketplacePayment(reference);
        if (!active) {
          return;
        }
        setCheckoutNotice({
          tone: result?.success ? "success" : "warn",
          title: result?.success ? "Marketplace payment verified" : "Payment still pending",
          message: result?.message || "Order status has been refreshed.",
          reference,
        });
        if (result?.success) {
          toast.success("Marketplace payment verified.");
        } else {
          toast("Payment is not complete yet. Order status has been refreshed.");
        }
        await loadOrders();
        navigate("/marketplace/orders", { replace: true });
      } catch (err) {
        if (!active) {
          return;
        }
        setCheckoutNotice({
          tone: "error",
          title: "Could not verify marketplace payment",
          message: err?.message || "Retry verification before starting another checkout.",
          reference,
        });
        toast.error(err?.message || "Could not verify marketplace payment yet.");
      }
    };

    verify();
    return () => {
      active = false;
    };
  }, [loadOrders, location.search, navigate]);

  const tabs = useMemo(
    () => [
      { id: "buyer", label: "Buyer orders" },
      ...(sellerReady ? [{ id: "seller", label: "Seller orders" }] : []),
    ],
    [sellerReady]
  );

  const retryMarketplaceReference = useCallback(
    async (reference) => {
      try {
        const result = await verifyMarketplacePayment(reference);
        setCheckoutNotice({
          tone: result?.success ? "success" : "warn",
          title: result?.success ? "Payment verified" : "Payment still pending",
          message: result?.message || "Order status refreshed.",
          reference,
        });
        await loadOrders();
      } catch (err) {
        setCheckoutNotice({
          tone: "error",
          title: "Could not verify payment",
          message: err?.message || "Retry verification later or contact support.",
          reference,
        });
      }
    },
    [loadOrders]
  );

  return (
    <QuickAccessLayout
      user={user}
      title="Marketplace Orders"
      subtitle="Track every marketplace purchase, payment status, and seller-side fulfillment update in one place."
      showAppSidebar={false}
      showRightRail={false}
      showHero={false}
      shellClassName="quick-access-shell--marketplace"
      mainClassName="quick-access-main--marketplace"
    >
      <div className="marketplace-page">
        <section className="marketplace-panel">
          <div className="marketplace-inline-actions">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? "marketplace-primary-btn" : "marketplace-ghost-btn"}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
            <button type="button" className="marketplace-secondary-btn" onClick={loadOrders}>
              Refresh
            </button>
          </div>
        </section>

        {checkoutNotice ? (
          <section className={`marketplace-payment-notice marketplace-payment-notice--${checkoutNotice.tone}`}>
            <strong>{checkoutNotice.title}</strong>
            <span>{checkoutNotice.message}</span>
            {checkoutNotice.reference ? <small>Reference: {checkoutNotice.reference}</small> : null}
          </section>
        ) : null}

        {activeTab === "buyer" ? (
          <MarketplaceBuyerOrdersPage
            orders={buyerOrders}
            loading={loading}
            onRetryVerify={retryMarketplaceReference}
            onConfirmDelivery={async (order) => {
              setUpdatingId(order._id);
              try {
                await confirmMarketplaceOrderDelivery(order._id, {
                  receivedHealthy: true,
                });
                toast.success("Delivery confirmed. Seller payout is now eligible.");
                await loadOrders();
              } catch (err) {
                toast.error(err?.message || "Could not confirm delivery.");
              } finally {
                setUpdatingId("");
              }
            }}
            confirmingId={updatingId}
          />
        ) : (
          <MarketplaceSellerOrdersPage
            orders={sellerOrders}
            loading={loading}
            updatingId={updatingId}
            onUpdateStatus={async (order, status) => {
              setUpdatingId(order._id);
              try {
                await updateMarketplaceOrderStatus(order._id, { status });
                toast.success("Seller order status updated.");
                await loadOrders();
              } catch (err) {
                toast.error(err?.message || "Could not update order status.");
              } finally {
                setUpdatingId("");
              }
            }}
          />
        )}
      </div>
    </QuickAccessLayout>
  );
}
