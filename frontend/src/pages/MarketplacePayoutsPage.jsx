import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import QuickAccessLayout from "../components/QuickAccessLayout";
import PayoutSummaryCards from "../components/marketplace/PayoutSummaryCards";
import OrderStatusBadge from "../components/marketplace/OrderStatusBadge";
import { useAuth } from "../context/AuthContext";
import { fetchMarketplacePayoutHistory } from "../services/marketplacePayoutService";

import "../components/marketplace/marketplace.css";

export default function MarketplacePayoutsPage() {
  const { user } = useAuth();
  const [payload, setPayload] = useState({ payouts: [], summary: {} });
  const [loading, setLoading] = useState(true);

  const loadPayouts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchMarketplacePayoutHistory();
      setPayload(response || { payouts: [], summary: {} });
    } catch (err) {
      toast.error(err?.message || "Could not load payout history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  return (
    <QuickAccessLayout
      user={user}
      title="Marketplace Payouts"
      subtitle="Review marketplace sales totals, fees retained by Tengacion, and every payout record tied to a paid order."
      showAppSidebar={false}
      showRightRail={false}
      showHero={false}
      shellClassName="quick-access-shell--marketplace"
      mainClassName="quick-access-main--marketplace"
    >
      <div className="marketplace-page">
        <PayoutSummaryCards summary={payload.summary || {}} />

        {loading ? <div className="marketplace-loading-state">Loading payout history...</div> : null}

        {!loading ? (
          <section className="marketplace-panel">
            <div className="marketplace-section__head">
              <div>
                <span className="marketplace-section__eyebrow">Payout history</span>
                <h2 className="marketplace-section__title">Every seller settlement record</h2>
              </div>
              <button type="button" className="marketplace-secondary-btn" onClick={loadPayouts}>
                Refresh
              </button>
            </div>

            {(payload.payouts || []).length ? (
              <div className="marketplace-order-grid">
                {(payload.payouts || []).map((entry) => (
                  <article key={entry._id} className="marketplace-payout-row">
                    <div className="marketplace-payout-row__top">
                      <strong>{entry.orderReference || "Marketplace order"}</strong>
                      <OrderStatusBadge value={entry.payoutStatus} />
                    </div>
                    <div className="marketplace-summary-grid">
                      <div className="marketplace-summary-card">
                        <strong>₦{Number(entry.grossAmount || 0).toLocaleString()}</strong>
                        <span>Gross amount</span>
                      </div>
                      <div className="marketplace-summary-card">
                        <strong>₦{Number(entry.platformFee || 0).toLocaleString()}</strong>
                        <span>Platform fee</span>
                      </div>
                      <div className="marketplace-summary-card">
                        <strong>₦{Number(entry.netAmount || 0).toLocaleString()}</strong>
                        <span>Net receivable</span>
                      </div>
                    </div>
                    <div className="marketplace-muted">
                      {entry.payoutReference ? `Payout reference: ${entry.payoutReference}` : "Awaiting payout reference"} • {new Date(entry.createdAt || "").toLocaleString()}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="marketplace-empty-state">
                <strong>No payout records yet</strong>
                <p>Payout history will populate automatically after paid marketplace orders settle.</p>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </QuickAccessLayout>
  );
}
