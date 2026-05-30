import { Link } from "react-router-dom";

import ShareActions from "./ShareActions";
import {
  resolvePurchaseCtaLabel,
  resolveDownloadActionLabel,
  resolvePrimaryAccessLabel,
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
  onOpen,
  purchaseBusyKey = "",
}) {
  if (!item) {
    return null;
  }

  const normalizedType = normalizePurchaseType(item.itemType || item.productType || item.mediaType);
  const itemKey = `${normalizedType || "item"}:${item.id || ""}`;
  const isBuyBusy = purchaseBusyKey === itemKey;
  const streamActionLabel = resolvePrimaryAccessLabel(item);
  const downloadActionLabel = resolveDownloadActionLabel(item);
  const buyLabel = resolvePurchaseCtaLabel(item, { busy: isBuyBusy });
  const detailRoute = item.route || creatorRoute || `/creators/${creatorId}`;
  const showDownloadAction = Boolean(item.canDownload && downloadActionLabel !== streamActionLabel);

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
            <Link
              to={detailRoute}
              className="creator-public-card__title-link"
              onClick={() => onOpen?.(item)}
            >
              {item.title}
            </Link>
          </h3>
        {item.subtitle ? <p>{item.subtitle}</p> : null}
        {item.discoveryMeta?.reasonLabel ? (
          <span className="creator-public-card__reason">
            {item.discoveryMeta.reasonLabel}
          </span>
        ) : null}
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
            {streamActionLabel}
          </button>
        ) : null}
        {showDownloadAction ? (
          <button type="button" className="creator-ghost-btn" onClick={() => onDownload(item)}>
            {downloadActionLabel}
          </button>
        ) : item.canBuy ? (
          <button type="button" className="creator-primary-btn" onClick={() => onBuy(item)} disabled={isBuyBusy}>
            {buyLabel}
          </button>
        ) : null}
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
