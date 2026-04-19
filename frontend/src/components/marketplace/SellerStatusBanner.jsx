import OrderStatusBadge from "./OrderStatusBadge";

const statusCopy = {
  draft: {
    title: "Complete your seller profile",
    copy: "Save your draft now, then submit when your details and CAC certificate are ready.",
  },
  pending_review: {
    title: "Seller verification pending",
    copy: "Your application is under review. We’ll unlock storefront publishing once the admin team approves it.",
  },
  approved: {
    title: "Approved Seller",
    copy: "Your storefront is live and you can manage listings, orders, and payout history from your dashboard.",
  },
  rejected: {
    title: "Application rejected",
    copy: "Update the highlighted details, attach the right CAC file if needed, and resubmit for review.",
  },
  suspended: {
    title: "Seller account suspended",
    copy: "Marketplace publishing is paused on this profile for now. Contact support or an admin to resolve it.",
  },
};

export default function SellerStatusBanner({ seller }) {
  const status = seller?.status || "draft";
  const content = statusCopy[status] || statusCopy.draft;

  return (
    <section className={`marketplace-status-banner marketplace-status-banner--${status}`}>
      <div className="marketplace-panel__head">
        <div>
          <h3>{content.title}</h3>
          <p className="marketplace-muted">{content.copy}</p>
        </div>
        <OrderStatusBadge value={status} />
      </div>
      {seller?.rejectionReason ? (
        <div className="marketplace-admin-note">
          <strong>Admin note:</strong> {seller.rejectionReason}
        </div>
      ) : null}
    </section>
  );
}
