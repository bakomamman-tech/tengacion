import OrderStatusBadge from "../marketplace/OrderStatusBadge";

export default function MarketplaceSellerReviewTable({
  sellers = [],
  onApprove,
  onReject,
  onSuspend,
}) {
  if (!sellers.length) {
    return <div className="marketplace-empty-state">No marketplace sellers matched this admin view.</div>;
  }

  return (
    <div className="marketplace-admin-table">
      <table className="marketplace-table">
        <thead>
          <tr>
            <th>Store</th>
            <th>Owner</th>
            <th>Location</th>
            <th>Status</th>
            <th>CAC</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sellers.map((seller) => (
            <tr key={seller._id}>
              <td>{seller.storeName}</td>
              <td>{seller.fullName}</td>
              <td>{seller.location?.label || "-"}</td>
              <td><OrderStatusBadge value={seller.status} /></td>
              <td>
                {seller.cacCertificate?.secureUrl ? (
                  <a className="marketplace-link" href={seller.cacCertificate.secureUrl} target="_blank" rel="noreferrer">
                    View CAC
                  </a>
                ) : "Missing"}
              </td>
              <td>
                <div className="marketplace-admin-table-actions">
                  <button type="button" className="marketplace-primary-btn" onClick={() => onApprove?.(seller)}>
                    Approve
                  </button>
                  <button type="button" className="marketplace-secondary-btn" onClick={() => onReject?.(seller)}>
                    Reject
                  </button>
                  <button type="button" className="marketplace-ghost-btn" onClick={() => onSuspend?.(seller)}>
                    Suspend
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
