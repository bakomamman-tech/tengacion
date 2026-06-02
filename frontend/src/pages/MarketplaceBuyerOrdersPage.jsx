import OrderStatusBadge from "../components/marketplace/OrderStatusBadge";
import PaymentRecoveryNotice from "../components/payments/PaymentRecoveryNotice";

const formatMoney = (value = 0, currency = "NGN") =>
  `${String(currency || "NGN").toUpperCase()} ${Number(value || 0).toLocaleString()}`;

export default function MarketplaceBuyerOrdersPage({
  orders = [],
  loading = false,
  onRetryVerify,
}) {
  if (loading) {
    return <div className="marketplace-loading-state">Loading buyer orders...</div>;
  }

  if (!orders.length) {
    return (
      <div className="marketplace-empty-state">
        <strong>No marketplace orders yet</strong>
        <p>Your product purchases will appear here once you complete checkout.</p>
      </div>
    );
  }

  return (
    <div className="marketplace-order-grid">
      {orders.map((order) => {
        const paymentStatus = String(order.paymentStatus || "").toLowerCase();
        const canRetry = Boolean(order.paymentReference && typeof onRetryVerify === "function");

        return (
          <article key={order._id} className="marketplace-order-card">
            <div className="marketplace-order-card__top">
              <strong>{order.productSnapshot?.title || "Marketplace order"}</strong>
              <span>{formatMoney(order.totalPrice, order.currency)}</span>
            </div>
            <div className="marketplace-pill-row">
              <OrderStatusBadge value={order.paymentStatus} />
              <OrderStatusBadge value={order.orderStatus} />
            </div>
            <div className="marketplace-order-card__summary">
              <span>Buyer paid {formatMoney(order.totalPrice, order.currency)}</span>
              <span>Platform fee included: {formatMoney(order.platformFee, order.currency)}</span>
              <span>Seller receives {formatMoney(order.sellerReceivable, order.currency)}</span>
            </div>
            <div className="marketplace-muted">
              {order.storeSnapshot?.storeName || "Marketplace seller"} - {order.deliveryMethod?.replace(/_/g, " ")}
            </div>
            <div className="marketplace-muted">
              Reference: {order.paymentReference || "Pending"} - {new Date(order.createdAt || "").toLocaleString()}
            </div>
            {["pending", "initiated", "failed"].includes(paymentStatus) ? (
              <PaymentRecoveryNotice
                title={paymentStatus === "failed" ? "Payment failed" : "Payment pending"}
                message="Retry verification before starting another checkout. If money left your account, contact support with the reference."
                reference={order.paymentReference}
                onRetry={canRetry ? () => onRetryVerify(order.paymentReference) : undefined}
              />
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
