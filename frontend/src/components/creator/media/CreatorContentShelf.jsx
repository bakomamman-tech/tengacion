import MediaPreviewCard from "./MediaPreviewCard";

export default function CreatorContentShelf({
  title,
  subtitle,
  items = [],
  creatorId,
  emptyMessage,
  onPreview,
  onStream,
  onDownload,
  onBuy,
  purchaseBusyKey = "",
}) {
  return (
    <section className="creator-public-shelf">
      <div className="creator-public-shelf__head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>

      {items.length ? (
        <div className="creator-public-shelf__grid">
          {items.map((item) => (
            <MediaPreviewCard
              key={`${item.itemType}-${item.id}`}
              item={item}
              creatorId={creatorId}
              onPreview={onPreview}
              onStream={onStream}
              onDownload={onDownload}
              onBuy={onBuy}
              purchaseBusyKey={purchaseBusyKey}
            />
          ))}
        </div>
      ) : (
        <div className="creator-public-empty">{emptyMessage}</div>
      )}
    </section>
  );
}
