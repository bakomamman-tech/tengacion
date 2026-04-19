import OrderStatusBadge from "../marketplace/OrderStatusBadge";

export default function MarketplaceOrderSummaryTable({ orders = [] }) {
  if (!orders.length) {
    return <div className="marketplace-empty-state">No marketplace orders matched this admin view.</div>;
  }

  return (
    <div className="marketplace-admin-table">
      <table className="marketplace-table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Product</th>
            <th>Store</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Order</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order._id}>
              <td>{order.paymentReference || "-"}</td>
              <td>{order.productSnapshot?.title || "-"}</td>
              <td>{order.storeSnapshot?.storeName || "-"}</td>
              <td>₦{Number(order.totalPrice || 0).toLocaleString()}</td>
              <td><OrderStatusBadge value={order.paymentStatus} /></td>
              <td><OrderStatusBadge value={order.orderStatus} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
