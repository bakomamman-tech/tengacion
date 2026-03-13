import { resolveImage } from "../../api";
import { fallbackAvatar } from "./postShareUtils";

export default function SuggestedShareTargets({
  title = "Suggested contacts",
  targets = [],
  loading = false,
  onSelect,
}) {
  if (!loading && (!Array.isArray(targets) || targets.length === 0)) {
    return null;
  }

  return (
    <section className="tg-share-section">
      <div className="tg-share-section-head">
        <div>
          <h3>{title}</h3>
          <p>Send in Messenger with one tap.</p>
        </div>
      </div>

      {loading ? (
        <div className="tg-share-target-row tg-share-target-row--loading">
          {Array.from({ length: 5 }).map((_, index) => (
            <span key={`target-skeleton-${index}`} className="tg-share-target-skeleton" />
          ))}
        </div>
      ) : (
        <div className="tg-share-target-row" role="list" aria-label={title}>
          {targets.map((target) => (
            <button
              key={target._id}
              type="button"
              className="tg-share-target-pill"
              onClick={() => onSelect?.(target)}
            >
              <img
                src={
                  resolveImage(target?.avatar || target?.profilePic || "") ||
                  fallbackAvatar(target?.name || target?.username)
                }
                alt={target?.name || target?.username || "Contact"}
              />
              <span>{target?.name || target?.username || "Friend"}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
