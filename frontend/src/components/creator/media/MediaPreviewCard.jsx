import ShareActions from "./ShareActions";

const formatPrice = (value = 0) =>
  Number(value || 0) <= 0 ? "Free" : `NGN ${Number(value || 0).toLocaleString()}`;

export default function MediaPreviewCard({
  item,
  creatorId,
  onPreview,
  onStream,
  onDownload,
  onBuy,
}) {
  if (!item) {
    return null;
  }

  return (
    <article className={`creator-public-card creator-public-card--${item.mediaType || "audio"}`}>
      <div className="creator-public-card__media">
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
          <h3>{item.title}</h3>
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
            {item.mediaType === "document" ? "Read" : "Stream"}
          </button>
        ) : null}
        {item.canDownload ? (
          <button type="button" className="creator-ghost-btn" onClick={() => onDownload(item)}>
            Download
          </button>
        ) : item.canBuy ? (
          <button type="button" className="creator-primary-btn" onClick={() => onBuy(item)}>
            Buy
          </button>
        ) : null}
        <ShareActions
          className="creator-ghost-btn"
          title={item.title}
          text="Listen, read, or watch this creator release on Tengacion."
          url={`${window.location.origin}/creators/${creatorId}`}
        />
      </div>
    </article>
  );
}
