import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import QuickAccessLayout from "../components/QuickAccessLayout";
import PayoutSummaryCards from "../components/marketplace/PayoutSummaryCards";
import OrderStatusBadge from "../components/marketplace/OrderStatusBadge";
import { useAuth } from "../context/AuthContext";
import {
  fetchMarketplacePayoutHistory,
  withdrawMarketplacePayout,
} from "../services/marketplacePayoutService";
import { getWithdrawalProviderIssue } from "../utils/withdrawalErrors";

import "../components/marketplace/marketplace.css";

const formatNaira = (value = 0) => `NGN ${Number(value || 0).toLocaleString()}`;

export default function MarketplacePayoutsPage() {
  const { user } = useAuth();
  const [payload, setPayload] = useState({
    payouts: [],
    withdrawals: [],
    summary: {},
    withdrawalSummary: {},
  });
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [providerIssue, setProviderIssue] = useState(null);

  const withdrawalSummary = payload.withdrawalSummary || {};
  const summary = {
    ...(payload.summary || {}),
    ...withdrawalSummary,
  };
  const withdrawableAmount = Number(withdrawalSummary.withdrawableAmount || 0);
  const reserveAmount = Number(withdrawalSummary.reserveAmount || 1000);

  const loadPayouts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchMarketplacePayoutHistory();
      setPayload(response || { payouts: [], withdrawals: [], summary: {}, withdrawalSummary: {} });
    } catch (err) {
      toast.error(err?.message || "Could not load payout history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  const handleWithdraw = async (event) => {
    event.preventDefault();
    const requestedAmount = Number(amount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      toast.error("Enter a withdrawal amount.");
      return;
    }

    setWithdrawing(true);
    try {
      const response = await withdrawMarketplacePayout({
        amount: requestedAmount,
        currency: "NGN",
      });
      setAmount("");
      const issue = getWithdrawalProviderIssue(response);
      setProviderIssue(issue);
      toast.success(
        response?.withdrawal?.status === "succeeded"
          ? "Withdrawal sent."
          : response?.withdrawal?.status === "provider_setup_required"
            ? "Withdrawal queued for finance retry."
            : "Withdrawal started."
      );
      await loadPayouts();
    } catch (err) {
      const issue = getWithdrawalProviderIssue(err);
      setProviderIssue(issue);
      toast.error(issue?.message || err?.message || "Could not start withdrawal.");
      await loadPayouts();
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <QuickAccessLayout
      user={user}
      title="Marketplace Payouts"
      subtitle="Withdraw buyer-confirmed marketplace earnings while undelivered or damaged orders stay held."
      showAppSidebar={false}
      showRightRail={false}
      showHero={false}
      shellClassName="quick-access-shell--marketplace"
      mainClassName="quick-access-main--marketplace"
    >
      <div className="marketplace-page">
        <PayoutSummaryCards summary={summary} />

        {loading ? <div className="marketplace-loading-state">Loading payout history...</div> : null}

        {!loading ? (
          <section className="marketplace-panel">
            <div className="marketplace-section__head">
              <div>
                <span className="marketplace-section__eyebrow">Withdrawals</span>
                <h2 className="marketplace-section__title">Seller payout wallet</h2>
              </div>
              <button type="button" className="marketplace-secondary-btn" onClick={loadPayouts}>
                Refresh
              </button>
            </div>

            {providerIssue ? (
              <section className="marketplace-payment-notice marketplace-payment-notice--warn" role="alert">
                <strong>{providerIssue.title}</strong>
                <span>{providerIssue.message}</span>
                {providerIssue.action ? <small>{providerIssue.action}</small> : null}
              </section>
            ) : null}

            <form className="marketplace-seller-form" onSubmit={handleWithdraw}>
              <div className="marketplace-form-grid">
                <label>
                  <span>Withdrawal amount</span>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="1000"
                    disabled={withdrawing || withdrawableAmount <= 0}
                  />
                </label>
                <div className="marketplace-summary-card">
                  <strong>{formatNaira(withdrawableAmount)}</strong>
                  <span>Available after reserve</span>
                </div>
                <div className="marketplace-summary-card">
                  <strong>{formatNaira(reserveAmount)}</strong>
                  <span>Required balance left behind</span>
                </div>
              </div>
              <div className="marketplace-form-actions">
                <small className="marketplace-muted">
                  Only buyer-confirmed, healthy delivered orders are available for withdrawal.
                </small>
                <button
                  type="submit"
                  className="marketplace-primary-btn"
                  disabled={withdrawing || withdrawableAmount <= 0}
                >
                  {withdrawing ? "Withdrawing..." : "Withdraw now"}
                </button>
              </div>
            </form>

            {(payload.withdrawals || []).length ? (
              <div className="marketplace-order-grid">
                {(payload.withdrawals || []).map((entry) => (
                  <article key={entry.id} className="marketplace-payout-row">
                    <div className="marketplace-payout-row__top">
                      <strong>{formatNaira(entry.amount || 0)}</strong>
                      <OrderStatusBadge value={entry.status} />
                    </div>
                    <div className="marketplace-muted">
                      {entry.reference || "Withdrawal"} {entry.providerTransferCode ? `- ${entry.providerTransferCode}` : ""} - {new Date(entry.requestedAt || "").toLocaleString()}
                    </div>
                    {entry.failureReason ? <div className="marketplace-muted">{entry.failureReason}</div> : null}
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {!loading ? (
          <section className="marketplace-panel">
            <div className="marketplace-section__head">
              <div>
                <span className="marketplace-section__eyebrow">Payout history</span>
                <h2 className="marketplace-section__title">Buyer-confirmation eligibility</h2>
              </div>
            </div>

            {(payload.payouts || []).length ? (
              <div className="marketplace-order-grid">
                {(payload.payouts || []).map((entry) => (
                  <article key={entry._id} className="marketplace-payout-row">
                    <div className="marketplace-payout-row__top">
                      <strong>{entry.orderReference || "Marketplace order"}</strong>
                      <OrderStatusBadge value={entry.payoutEligible ? "completed" : entry.orderStatus || entry.payoutStatus} />
                    </div>
                    <div className="marketplace-summary-grid">
                      <div className="marketplace-summary-card">
                        <strong>{formatNaira(entry.grossAmount || 0)}</strong>
                        <span>Gross amount</span>
                      </div>
                      <div className="marketplace-summary-card">
                        <strong>{formatNaira(entry.platformFee || 0)}</strong>
                        <span>Platform fee</span>
                      </div>
                      <div className="marketplace-summary-card">
                        <strong>{formatNaira(entry.netAmount || 0)}</strong>
                        <span>Net receivable</span>
                      </div>
                    </div>
                    <div className="marketplace-muted">
                      {entry.payoutEligible
                        ? "Buyer confirmed healthy delivery"
                        : "Held until buyer confirms healthy delivery"} - {new Date(entry.createdAt || "").toLocaleString()}
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
