import OrderStatusBadge from "../components/marketplace/OrderStatusBadge";

const sellerStatusSteps = ["processing", "shipped_or_ready", "delivered", "completed"];

export default function MarketplaceSellerOrdersPage({
  orders = [],
  loading = false,
  updatingId = "",
  onUpdateStatus,
}) {
  if (loading) {
    return <div className="marketplace-loading-state">Loading seller orders...</div>;
  }

  if (!orders.length) {
    return (
      <div className="marketplace-empty-state">
        <strong>No seller orders yet</strong>
        <p>Once buyers pay for your listings, their orders and delivery state will show up here.</p>
      </div>
    );
  }

  return (
    <div className="marketplace-order-grid">
      {orders.map((order) => (
        <article key={order._id} className="marketplace-order-card">
          <div className="marketplace-order-card__top">
            <strong>{order.productSnapshot?.title || "Marketplace order"}</strong>
            <span>₦{Number(order.totalPrice || 0).toLocaleString()}</span>
          </div>
          <div className="marketplace-pill-row">
            <OrderStatusBadge value={order.paymentStatus} />
            <OrderStatusBadge value={order.orderStatus} />
          </div>
          <div className="marketplace-muted">
            Buyer: {order.buyer?.name || order.buyer?.username || "Buyer"} • {order.deliveryMethod?.replace(/_/g, " ")}
          </div>
          <div className="marketplace-muted">
            Reference: {order.paymentReference || "Pending"} • {new Date(order.createdAt || "").toLocaleString()}
          </div>
          <div className="marketplace-inline-actions">
            {sellerStatusSteps.map((status) => (
              <button
                key={status}
                type="button"
                className="marketplace-ghost-btn"
                disabled={updatingId === order._id || order.orderStatus === status}
                onClick={() => onUpdateStatus?.(order, status)}
              >
                {updatingId === order._id ? "Saving..." : String(status).replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
