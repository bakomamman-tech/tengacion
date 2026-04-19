import OrderStatusBadge from "../components/marketplace/OrderStatusBadge";

export default function MarketplaceBuyerOrdersPage({ orders = [], loading = false }) {
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
            {order.storeSnapshot?.storeName || "Marketplace seller"} • {order.deliveryMethod?.replace(/_/g, " ")}
          </div>
          <div className="marketplace-muted">
            Reference: {order.paymentReference || "Pending"} • {new Date(order.createdAt || "").toLocaleString()}
          </div>
        </article>
      ))}
    </div>
  );
}
