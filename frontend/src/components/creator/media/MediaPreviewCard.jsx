import { Link } from "react-router-dom";

import ShareActions from "./ShareActions";
import {
  resolveOwnedPurchaseLabel,
  resolvePurchaseCtaLabel,
  normalizePurchaseType,
} from "../../../utils/purchaseUx";

const formatPrice = (value = 0) =>
  Number(value || 0) <= 0 ? "Free" : `NGN ${Number(value || 0).toLocaleString()}`;

export default function MediaPreviewCard({
  item,
  creatorId,
  creatorRoute = "",
  featured = false,
  onPreview,
  onStream,
  onDownload,
  onBuy,
  purchaseBusyKey = "",
}) {
  if (!item) {
    return null;
  }

  const normalizedType = normalizePurchaseType(item.itemType || item.productType || item.mediaType);
  const itemKey = `${normalizedType || "item"}:${item.id || ""}`;
  const isBuyBusy = purchaseBusyKey === itemKey;
  const purchaseType = normalizedType;
  const ownedActionLabel = resolveOwnedPurchaseLabel(item);
  const buyLabel = resolvePurchaseCtaLabel(item, { busy: isBuyBusy });
  const detailRoute = item.route || creatorRoute || `/creators/${creatorId}`;

  return (
    <article
      className={`creator-public-card creator-public-card--${item.mediaType || "audio"}${
        featured ? " creator-public-card--featured" : ""
      }`}
    >
      <div className={`creator-public-card__media${featured ? " creator-public-card__media--featured" : ""}`}>
        {item.coverUrl ? (
          <img src={item.coverUrl} alt={item.title} />
        ) : (
          <div className="creator-public-card__fallback" aria-hidden="true">
            {item.title?.slice(0, 1) || "T"}
          </div>
        )}
        <span className="creator-public-card__badge">{item.itemType === "podcast" ? "Podcast" : item.itemType}</span>
      </div>

      <div className="creator-public-card__body">
        <div>
          <h3>
            <Link to={detailRoute} className="creator-public-card__title-link">
              {item.title}
            </Link>
          </h3>
          {item.subtitle ? <p>{item.subtitle}</p> : null}
        </div>
        <strong>{formatPrice(item.price)}</strong>
      </div>

      <div className="creator-public-card__actions">
        {item.canPreview ? (
          <button type="button" className="creator-ghost-btn" onClick={() => onPreview(item)}>
            Preview
          </button>
        ) : null}
        {item.canStream ? (
          <button type="button" className="creator-secondary-btn" onClick={() => onStream(item)}>
            {ownedActionLabel}
          </button>
        ) : null}
        {item.canDownload ? (
          <button type="button" className="creator-ghost-btn" onClick={() => onDownload(item)}>
            {purchaseType === "album" ? "Download bundle" : ownedActionLabel}
          </button>
        ) : item.canBuy ? (
          <button type="button" className="creator-primary-btn" onClick={() => onBuy(item)} disabled={isBuyBusy}>
            {buyLabel}
          </button>
        ) : null}
        <Link to={detailRoute} className="creator-ghost-btn">
          Open page
        </Link>
        <ShareActions
          className="creator-ghost-btn"
          title={item.title}
          text="Listen, read, or watch this creator release on Tengacion."
          url={`${window.location.origin}${detailRoute}`}
        />
      </div>
    </article>
  );
}
