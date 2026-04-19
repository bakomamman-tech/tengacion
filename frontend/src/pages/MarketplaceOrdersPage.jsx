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
        await verifyMarketplacePayment(reference);
        if (!active) {
          return;
        }
        toast.success("Marketplace payment verified.");
        await loadOrders();
        navigate("/marketplace/orders", { replace: true });
      } catch (err) {
        if (!active) {
          return;
        }
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

  return (
    <QuickAccessLayout
      user={user}
      title="Marketplace Orders"
      subtitle="Track every marketplace purchase, payment status, and seller-side fulfillment update in one place."
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

        {activeTab === "buyer" ? (
          <MarketplaceBuyerOrdersPage orders={buyerOrders} loading={loading} />
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
