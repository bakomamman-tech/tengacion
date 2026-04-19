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

  return (
    <article className="marketplace-product-card">
      <Link
        className="marketplace-product-card__image"
        to={`/marketplace/product/${encodeURIComponent(product?.slug || product?._id || "")}`}
      >
        {image ? <img src={image} alt={product?.title || "Marketplace product"} /> : null}
      </Link>

      <div className="marketplace-product-card__body">
        <div className="marketplace-card-meta">
          <span className="marketplace-category-pill">{product?.category || "General"}</span>
          <span>{product?.location?.label || product?.state || "Location set by seller"}</span>
        </div>

        <div>
          <h3>{product?.title || "Untitled listing"}</h3>
          <p className="marketplace-muted">
            {product?.seller?.storeName || "Marketplace seller"}
          </p>
        </div>

        <div className="marketplace-product-card__price">
          ₦{Number(product?.price || 0).toLocaleString()}
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
                Edit
              </button>
              <button
                type="button"
                className="marketplace-ghost-btn"
                onClick={() => onPublishToggle?.(product)}
              >
                {isPublished ? "Unpublish" : "Publish"}
              </button>
              <button type="button" className="marketplace-ghost-btn" onClick={() => onDelete?.(product)}>
                Delete
              </button>
            </div>
          </>
        ) : (
          <div className="marketplace-card-meta">
            <span>{product?.condition || "new"}</span>
            <Link className="marketplace-link" to={`/marketplace/product/${encodeURIComponent(product?.slug || product?._id || "")}`}>
              Open product
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
