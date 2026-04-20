import { Link } from "react-router-dom";

export default function MarketplaceHero({
  totalProducts = 0,
  totalSellers = 0,
  totalStates = 0,
}) {
  return (
    <section className="marketplace-hero marketplace-shell-card">
      <span className="marketplace-hero__eyebrow">Marketplace</span>
      <div className="marketplace-hero__grid">
        <div className="marketplace-hero__copy">
          <h2>Buy with confidence. Sell with a premium storefront.</h2>
          <p>
            Discover trusted sellers, browse by location and delivery style, and pay
            exactly the listed price with Tengacion&apos;s marketplace checkout.
          </p>

          <div className="marketplace-cta-row">
            <Link className="marketplace-primary-btn" to="/marketplace/register">
              Seller registration
            </Link>
            <Link className="marketplace-secondary-btn" to="/marketplace/orders">
              View Orders
            </Link>
          </div>

          <div className="marketplace-hero__stats">
            <div className="marketplace-kpi">
              <strong>{Number(totalProducts || 0).toLocaleString()}</strong>
              <span>Live products</span>
            </div>
            <div className="marketplace-kpi">
              <strong>{Number(totalSellers || 0).toLocaleString()}</strong>
              <span>Approved sellers</span>
            </div>
            <div className="marketplace-kpi">
              <strong>{Number(totalStates || 0).toLocaleString()}</strong>
              <span>Locations represented</span>
            </div>
          </div>
        </div>

        <div className="marketplace-hero__feature">
          <span className="marketplace-hero__feature-badge">Service charge included</span>
          <h3>Buyers see one clean price. Sellers get transparent settlement.</h3>
          <p>
            Tengacion retains a flat NGN 300 inside each successful purchase while the
            seller receives the remainder. No surprise fee gets added at checkout.
          </p>
          <div className="marketplace-summary-grid">
            <div className="marketplace-summary-card">
              <strong>NGN 5,000</strong>
              <span>Buyer pays listed price</span>
            </div>
            <div className="marketplace-summary-card">
              <strong>NGN 4,700</strong>
              <span>Seller receivable after platform fee</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
