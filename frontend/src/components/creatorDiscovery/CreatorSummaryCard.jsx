import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { createCheckout, resolveImage, toggleFollowCreator } from "../../api";
import { useCreatorPlayer } from "../../context/CreatorPlayerContext";
import ShareActions from "../creator/media/ShareActions";
import { formatCurrency } from "../creator/creatorConfig";
import { formatRelativeTime } from "../../features/news/utils/newsUi";

import "./creatorDiscovery.css";

const getCreatorInitial = (value = "") => String(value || "T").trim().slice(0, 1).toUpperCase();

export default function CreatorSummaryCard({ item }) {
  const navigate = useNavigate();
  const { openPreview } = useCreatorPlayer();
  const [followBusy, setFollowBusy] = useState(false);
  const [following, setFollowing] = useState(Boolean(item?.viewerFollowing));
  const [buyBusy, setBuyBusy] = useState(false);

  useEffect(() => {
    setFollowing(Boolean(item?.viewerFollowing));
  }, [item?.viewerFollowing, item?.id]);

  const categoryLabel = useMemo(
    () => String(item?.summaryLabel || item?.creatorCategory || "Creator").trim(),
    [item?.creatorCategory, item?.summaryLabel]
  );

  if (!item) {
    return null;
  }

  const handlePreview = () => {
    if (!item?.canPreview) {
      toast.error("Preview unavailable for this release.");
      return;
    }
    openPreview({
      ...item,
      initialSourceMode: "preview",
      mediaType: item.mediaType || "audio",
    });
  };

  const handleBuy = async () => {
    if (!item?.purchaseItemId || !item?.purchaseItemType) {
      toast.error("Purchase details are unavailable.");
      return;
    }

    try {
      setBuyBusy(true);
      const checkout = await createCheckout({
        itemType: item.purchaseItemType,
        itemId: item.purchaseItemId,
        currencyMode: "NG",
      });
      if (checkout?.checkoutUrl) {
        window.open(checkout.checkoutUrl, "_blank", "noopener,noreferrer");
        return;
      }
      throw new Error("Checkout unavailable");
    } catch (err) {
      toast.error(err?.message || "Could not start checkout.");
    } finally {
      setBuyBusy(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!item?.creatorId) {
      return;
    }

    try {
      setFollowBusy(true);
      const response = await toggleFollowCreator(item.creatorId);
      setFollowing(Boolean(response?.following));
      toast.success(response?.following ? "Creator followed." : "Creator unfollowed.");
    } catch (err) {
      toast.error(err?.message || "Could not update follow state.");
    } finally {
      setFollowBusy(false);
    }
  };

  return (
    <article className="creator-summary-card">
      <div className="creator-summary-card__media">
        {item?.coverImage ? (
          <img src={resolveImage(item.coverImage) || item.coverImage} alt={item?.title || "Creator release"} />
        ) : (
          <div className="creator-summary-card__media creator-summary-card__media--fallback">
            <span>{getCreatorInitial(item?.title || item?.creatorName)}</span>
          </div>
        )}
        <span className="creator-summary-card__badge">{categoryLabel}</span>
      </div>

      <div className="creator-summary-card__body">
        <div className="creator-summary-card__top">
          <div className="creator-summary-card__creator">
            <div className="creator-summary-card__avatar">
              {item?.creatorAvatar ? (
                <img src={resolveImage(item.creatorAvatar) || item.creatorAvatar} alt={item?.creatorName || "Creator"} />
              ) : (
                <span>{getCreatorInitial(item?.creatorName)}</span>
              )}
            </div>
            <div className="creator-summary-card__creator-copy">
              <strong>{item?.creatorName || "Creator"}</strong>
              <span>@{item?.creatorUsername || "creator"}</span>
            </div>
          </div>
          <span className="creator-summary-card__category">
            {item?.creatorTypeLabels?.join(" / ") || categoryLabel}
          </span>
        </div>

        <div>
          <h3 className="creator-summary-card__title">{item?.title || "Untitled release"}</h3>
          <p className="creator-summary-card__summary">{item?.summary || "Fresh creator content on Tengacion."}</p>
        </div>

        <div className="creator-summary-card__meta">
          {item?.timestampLabel || item?.createdAt ? (
            <span>{item?.timestampLabel || formatRelativeTime(item?.createdAt)}</span>
          ) : null}
          <span>{item?.price > 0 ? formatCurrency(item.price) : "Free"}</span>
          {item?.viewerSubscribed ? <span>Subscribed</span> : null}
          {item?.viewerFollowing ? <span>Following</span> : null}
        </div>

        <div className="creator-summary-card__actions">
          <button
            type="button"
            className="creator-summary-card__action creator-summary-card__action--accent"
            onClick={handlePreview}
            disabled={!item?.canPreview}
          >
            Preview
          </button>
          {item?.canBuy ? (
            <button
              type="button"
              className="creator-summary-card__action"
              onClick={handleBuy}
              disabled={buyBusy}
            >
              {buyBusy ? "Opening..." : item?.buyLabel || "Buy"}
            </button>
          ) : null}
          {item?.canSubscribe ? (
            <button
              type="button"
              className="creator-summary-card__action"
              onClick={() => navigate(item?.subscribeRoute || `/creators/${item.creatorId}/subscribe`)}
            >
              {item?.viewerSubscribed ? "Subscribed" : "Subscribe"}
            </button>
          ) : null}
          <button
            type="button"
            className="creator-summary-card__action"
            onClick={handleToggleFollow}
            disabled={followBusy}
          >
            {followBusy ? "Updating..." : following ? "Following" : "Follow"}
          </button>
          <button
            type="button"
            className="creator-summary-card__action"
            onClick={() => navigate(item?.creatorRoute || `/creator/${item.creatorId}`)}
          >
            Visit Creator
          </button>
          <ShareActions
            className="creator-summary-card__action"
            title={item?.title || item?.creatorName || "Creator release"}
            text={item?.summary || "Explore this Tengacion release."}
            url={`${window.location.origin}${item?.creatorRoute || `/creator/${item.creatorId}`}`}
          />
        </div>
      </div>
    </article>
  );
}
