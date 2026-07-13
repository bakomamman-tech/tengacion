import { Link } from "react-router-dom";

import { resolveImage } from "../../api";
import MarketplaceIcon from "./MarketplaceIcon";
import OrderStatusBadge from "./OrderStatusBadge";

export default function ProductCard({
  product,
  manageView = false,
  onEdit,
  onPublishToggle,
  onDelete,
}) {
  const image = resolveImage(product?.primaryImage?.url || product?.primaryImage?.secureUrl || "");
  const isPublished = Boolean(product?.isPublished);
  const createdAtMs = Date.parse(product?.createdAt || "");
  const isFreshListing = Number.isFinite(createdAtMs) && Date.now() - createdAtMs < 1000 * 60 * 60 * 48;
  const sellerName = product?.seller?.storeName || "Marketplace seller";
  const sellerApproved = Boolean(product?.seller?.approvedBadge);
  const stockCount = Number(product?.stock || 0);
  const locationLabel = product?.location?.label || product?.state || "Location set by seller";

  return (
    <article className="marketplace-product-card">
      <Link
        className="marketplace-product-card__image"
        to={`/marketplace/product/${encodeURIComponent(product?.slug || product?._id || "")}`}
        aria-label={`Open ${product?.title || "marketplace product"}`}
      >
        {isFreshListing ? <span className="marketplace-product-card__flag">Just listed</span> : null}
        {image ? (
          <img src={image} alt={product?.title || "Marketplace product"} />
        ) : (
          <span className="marketplace-product-card__placeholder">
            <MarketplaceIcon name="package" size={32} />
            <small>Product photo coming soon</small>
          </span>
        )}
      </Link>

      <div className="marketplace-product-card__body">
        <div className="marketplace-card-meta">
          <span className="marketplace-category-pill">{product?.category || "General"}</span>
          <span className="marketplace-product-card__location">
            <MarketplaceIcon name="mapPin" size={14} />
            {locationLabel}
          </span>
        </div>

        <div className="marketplace-product-card__heading">
          <h3>{product?.title || "Untitled listing"}</h3>
          <p className="marketplace-muted marketplace-product-card__seller">
            <span>{sellerName}</span>
            {sellerApproved ? (
              <span className="marketplace-product-card__verified" title="Approved seller">
                <MarketplaceIcon name="badgeCheck" size={15} />
                <span className="marketplace-visually-hidden">Approved seller</span>
              </span>
            ) : null}
          </p>
        </div>

        <div className="marketplace-product-card__price-row">
          <div className="marketplace-product-card__price">
            NGN {Number(product?.price || 0).toLocaleString()}
          </div>
          <span className="marketplace-product-card__condition">{product?.condition || "new"}</span>
        </div>

        <div className="marketplace-product-card__trust" aria-label="Marketplace trust signals">
          {sellerApproved ? (
            <span>
              <MarketplaceIcon name="shieldCheck" size={14} /> Approved Seller
            </span>
          ) : null}
          <span>
            <MarketplaceIcon name="package" size={14} /> Trusted Item
          </span>
          <span>
            {stockCount > 0 ? `${stockCount.toLocaleString()} in stock` : "Stock check needed"}
          </span>
        </div>

        <div className="marketplace-pill-row">
          {(product?.deliveryOptions || []).map((option) => (
            <span key={option} className="marketplace-delivery-pill">
              <MarketplaceIcon name="truck" size={13} />
              {String(option).replace(/_/g, " ")}
            </span>
          ))}
        </div>

        {manageView ? (
          <>
            <div className="marketplace-card-meta">
              <OrderStatusBadge value={isPublished ? "published" : "draft"} />
              <span>{Number(product?.stock || 0)} in stock</span>
            </div>
            <div className="marketplace-inline-actions">
              <button type="button" className="marketplace-secondary-btn" onClick={() => onEdit?.(product)}>
                <span className="marketplace-btn__icon" aria-hidden="true">
                  +
                </span>
                Edit
              </button>
              <button
                type="button"
                className="marketplace-ghost-btn"
                onClick={() => onPublishToggle?.(product)}
              >
                <span className="marketplace-btn__icon" aria-hidden="true">
                  &gt;
                </span>
                {isPublished ? "Unpublish" : "Publish"}
              </button>
              <button type="button" className="marketplace-ghost-btn" onClick={() => onDelete?.(product)}>
                <span className="marketplace-btn__icon" aria-hidden="true">
                  x
                </span>
                Delete
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="marketplace-product-card__buyer-note">
              <MarketplaceIcon name="shieldCheck" size={15} />
              <span>Protected marketplace purchase</span>
            </div>
            <div className="marketplace-card-meta marketplace-product-card__footer">
              <span>Clear delivery terms</span>
              <Link
                className="marketplace-link"
                to={`/marketplace/product/${encodeURIComponent(product?.slug || product?._id || "")}`}
              >
                Open product
                <MarketplaceIcon name="arrowRight" size={15} />
              </Link>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
