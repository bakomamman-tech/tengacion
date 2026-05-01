import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import AdminShell from "../components/AdminShell";
import MarketplaceOrderSummaryTable from "../components/admin/MarketplaceOrderSummaryTable";
import MarketplaceProductModerationTable from "../components/admin/MarketplaceProductModerationTable";
import MarketplaceSellerReviewTable from "../components/admin/MarketplaceSellerReviewTable";
import { apiRequest, API_BASE } from "../api";

import "./admin-analytics.css";
import "../components/marketplace/marketplace.css";

const adminRequest = (path, options = {}) => apiRequest(`${API_BASE}${path}`, options);

const isStepUpRequired = (err) => err?.details?.code === "STEP_UP_REQUIRED";

const getAdminMutationError = (err, action, fallback) => {
  if (isStepUpRequired(err)) {
    return `Confirm your admin session with your authenticator code before ${action}.`;
  }

  return err?.message || fallback;
};

export default function AdminMarketplacePage({ user }) {
  const [payload, setPayload] = useState({
    sellers: { sellers: [] },
    products: { products: [], summary: {} },
    orders: { orders: [], summary: {} },
    payouts: { payouts: [], summary: {} },
  });
  const [loading, setLoading] = useState(true);

  const loadMarketplaceAdmin = useCallback(async () => {
    setLoading(true);
    try {
      const [sellers, products, orders, payouts] = await Promise.all([
        adminRequest("/admin/marketplace/sellers"),
        adminRequest("/admin/marketplace/products"),
        adminRequest("/admin/marketplace/orders"),
        adminRequest("/admin/marketplace/payouts"),
      ]);
      setPayload({ sellers, products, orders, payouts });
    } catch (err) {
      toast.error(err?.message || "Could not load marketplace admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarketplaceAdmin();
  }, [loadMarketplaceAdmin]);

  const patchAdmin = async (path, body = {}) =>
    adminRequest(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });

  const deleteAdmin = async (path) =>
    adminRequest(path, {
      method: "DELETE",
    });

  return (
    <AdminShell
      title="Marketplace"
      subtitle="Review seller applications, moderate marketplace listings, audit orders, and monitor payout accounting from one admin surface."
      user={user}
      actions={
        <button type="button" className="adminx-btn" onClick={loadMarketplaceAdmin}>
          Refresh
        </button>
      }
    >
      {loading ? <div className="adminx-loading">Loading marketplace admin data...</div> : null}

      {!loading ? (
        <div className="marketplace-admin-grid">
          <section className="marketplace-admin-panel">
            <div className="marketplace-section__head">
              <div>
                <span className="marketplace-section__eyebrow">Overview</span>
                <h2 className="marketplace-section__title">Marketplace health</h2>
              </div>
            </div>
            <div className="marketplace-summary-grid">
              <article className="marketplace-summary-card">
                <strong>{Number(payload.sellers?.total || payload.sellers?.sellers?.length || 0).toLocaleString()}</strong>
                <span>Seller applications</span>
              </article>
              <article className="marketplace-summary-card">
                <strong>{Number(payload.products?.summary?.totalProducts || 0).toLocaleString()}</strong>
                <span>Marketplace products</span>
              </article>
              <article className="marketplace-summary-card">
                <strong>₦{Number(payload.orders?.summary?.grossVolume || 0).toLocaleString()}</strong>
                <span>Gross marketplace volume</span>
              </article>
              <article className="marketplace-summary-card">
                <strong>₦{Number(payload.payouts?.summary?.totalFees || 0).toLocaleString()}</strong>
                <span>Total platform fees</span>
              </article>
            </div>
          </section>

          <section className="marketplace-admin-panel">
            <div className="marketplace-section__head">
              <div>
                <span className="marketplace-section__eyebrow">Seller review</span>
                <h2 className="marketplace-section__title">Seller applications</h2>
              </div>
            </div>
            <MarketplaceSellerReviewTable
              sellers={payload.sellers?.sellers || []}
              onApprove={async (seller) => {
                try {
                  await patchAdmin(`/admin/marketplace/sellers/${seller._id}/approve`);
                  toast.success("Seller approved.");
                  await loadMarketplaceAdmin();
                } catch (err) {
                  toast.error(getAdminMutationError(err, "approving this seller", "Could not approve seller."));
                }
              }}
              onReject={async (seller) => {
                const reason = window.prompt(`Why are you rejecting ${seller.storeName}?`, seller.rejectionReason || "");
                if (!reason) {
                  return;
                }
                try {
                  await patchAdmin(`/admin/marketplace/sellers/${seller._id}/reject`, { reason });
                  toast.success("Seller rejected.");
                  await loadMarketplaceAdmin();
                } catch (err) {
                  toast.error(getAdminMutationError(err, "rejecting this seller", "Could not reject seller."));
                }
              }}
              onSuspend={async (seller) => {
                const reason = window.prompt(`Why are you suspending ${seller.storeName}?`, seller.rejectionReason || "");
                if (!reason) {
                  return;
                }
                try {
                  await patchAdmin(`/admin/marketplace/sellers/${seller._id}/suspend`, { reason });
                  toast.success("Seller suspended.");
                  await loadMarketplaceAdmin();
                } catch (err) {
                  toast.error(getAdminMutationError(err, "suspending this seller", "Could not suspend seller."));
                }
              }}
            />
          </section>

          <section className="marketplace-admin-panel">
            <div className="marketplace-section__head">
              <div>
                <span className="marketplace-section__eyebrow">Moderation</span>
                <h2 className="marketplace-section__title">Marketplace products</h2>
              </div>
            </div>
            <MarketplaceProductModerationTable
              products={payload.products?.products || []}
              onHide={async (product) => {
                try {
                  await patchAdmin(`/admin/marketplace/products/${product._id}/hide`);
                  toast.success("Product hidden.");
                  await loadMarketplaceAdmin();
                } catch (err) {
                  toast.error(getAdminMutationError(err, "hiding this product", "Could not hide product."));
                }
              }}
              onDelete={async (product) => {
                if (!window.confirm(`Remove ${product.title} from the marketplace?`)) {
                  return;
                }
                try {
                  await deleteAdmin(`/admin/marketplace/products/${product._id}`);
                  toast.success("Product removed.");
                  await loadMarketplaceAdmin();
                } catch (err) {
                  toast.error(getAdminMutationError(err, "removing this product", "Could not remove product."));
                }
              }}
            />
          </section>

          <section className="marketplace-admin-panel">
            <div className="marketplace-section__head">
              <div>
                <span className="marketplace-section__eyebrow">Orders</span>
                <h2 className="marketplace-section__title">Marketplace orders</h2>
              </div>
            </div>
            <MarketplaceOrderSummaryTable orders={payload.orders?.orders || []} />
          </section>

          <section className="marketplace-admin-panel">
            <div className="marketplace-section__head">
              <div>
                <span className="marketplace-section__eyebrow">Payout ledger</span>
                <h2 className="marketplace-section__title">Marketplace payout history</h2>
              </div>
            </div>

            {(payload.payouts?.payouts || []).length ? (
              <table className="marketplace-table">
                <thead>
                  <tr>
                    <th>Store</th>
                    <th>Order</th>
                    <th>Gross</th>
                    <th>Fee</th>
                    <th>Net</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(payload.payouts?.payouts || []).map((entry) => (
                    <tr key={entry._id}>
                      <td>{entry.seller?.storeName || "-"}</td>
                      <td>{entry.orderReference || "-"}</td>
                      <td>₦{Number(entry.grossAmount || 0).toLocaleString()}</td>
                      <td>₦{Number(entry.platformFee || 0).toLocaleString()}</td>
                      <td>₦{Number(entry.netAmount || 0).toLocaleString()}</td>
                      <td>{entry.payoutStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="marketplace-empty-state">
                No payout records have been created for marketplace orders yet.
              </div>
            )}
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}
