import OrderStatusBadge from "../marketplace/OrderStatusBadge";

export default function MarketplaceProductModerationTable({
  products = [],
  onHide,
  onDelete,
}) {
  if (!products.length) {
    return <div className="marketplace-empty-state">No marketplace products matched this admin view.</div>;
  }

  return (
    <div className="marketplace-admin-table">
      <table className="marketplace-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Store</th>
            <th>Price</th>
            <th>Location</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product._id}>
              <td>{product.title}</td>
              <td>{product.seller?.storeName || "-"}</td>
              <td>₦{Number(product.price || 0).toLocaleString()}</td>
              <td>{product.location?.label || "-"}</td>
              <td>
                <div className="marketplace-pill-row">
                  <OrderStatusBadge value={product.isPublished ? "published" : "draft"} />
                  <OrderStatusBadge value={product.moderationStatus} />
                </div>
              </td>
              <td>
                <div className="marketplace-admin-table-actions">
                  <button type="button" className="marketplace-secondary-btn" onClick={() => onHide?.(product)}>
                    Hide
                  </button>
                  <button type="button" className="marketplace-ghost-btn" onClick={() => onDelete?.(product)}>
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
