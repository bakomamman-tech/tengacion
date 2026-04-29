import { Link } from "react-router-dom";

import { resolveImage } from "../../api";
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
  const locationLabel = product?.location?.label || product?.state || "Location set by seller";

  return (
    <article className="marketplace-product-card">
      <Link
        className="marketplace-product-card__image"
        to={`/marketplace/product/${encodeURIComponent(product?.slug || product?._id || "")}`}
      >
        {isFreshListing ? <span className="marketplace-product-card__flag">Just listed</span> : null}
        {image ? <img src={image} alt={product?.title || "Marketplace product"} /> : null}
      </Link>

      <div className="marketplace-product-card__body">
        <div className="marketplace-card-meta">
          <span className="marketplace-category-pill">{product?.category || "General"}</span>
          <span>{locationLabel}</span>
        </div>

        <div>
          <h3>{product?.title || "Untitled listing"}</h3>
          <p className="marketplace-muted marketplace-product-card__seller">{sellerName}</p>
        </div>

        <div className="marketplace-product-card__price">
          NGN {Number(product?.price || 0).toLocaleString()}
        </div>

        <div className="marketplace-pill-row">
          {(product?.deliveryOptions || []).map((option) => (
            <span key={option} className="marketplace-delivery-pill">
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
          <div className="marketplace-card-meta marketplace-product-card__footer">
            <span>{product?.condition || "new"}</span>
            <Link
              className="marketplace-link"
              to={`/marketplace/product/${encodeURIComponent(product?.slug || product?._id || "")}`}
            >
              Open product
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
