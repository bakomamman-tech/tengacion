import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { resolveImage, toggleFollowCreator } from "../../api";
import { formatCurrency } from "../creator/creatorConfig";

import "./creatorDiscovery.css";

const getInitial = (value = "") => String(value || "T").trim().slice(0, 1).toUpperCase();

export default function CreatorDiscoveryCard({ item }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [following, setFollowing] = useState(Boolean(item?.following));

  useEffect(() => {
    setFollowing(Boolean(item?.following));
  }, [item?.following, item?.id]);

  if (!item) {
    return null;
  }

  const categoryLabel = String(item?.category || item?.categoryLabels?.[0] || "Creator").trim();
  const canSubscribe = Boolean(item?.canSubscribe);
  const isSubscribed = Boolean(item?.subscribed);

  const handlePrimaryAction = async () => {
    if (canSubscribe) {
      if (isSubscribed) {
        return;
      }
      navigate(item?.subscribeRoute || `/creators/${item.creatorId}/subscribe`);
      return;
    }

    if (!item?.creatorId) {
      return;
    }

    try {
      setBusy(true);
      const response = await toggleFollowCreator(item.creatorId);
      setFollowing(Boolean(response?.following));
      toast.success(response?.following ? "Creator followed." : "Creator unfollowed.");
    } catch (err) {
      toast.error(err?.message || "Could not update follow state.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="creator-discovery-card">
      <div className="creator-discovery-card__media">
        {item?.banner || item?.avatar ? (
          <img
            src={resolveImage(item.banner || item.avatar) || item.banner || item.avatar}
            alt={item?.name || "Creator"}
          />
        ) : (
          <div className="creator-discovery-card__media creator-discovery-card__media--fallback">
            <span>{getInitial(item?.name)}</span>
          </div>
        )}
        <span className="creator-discovery-card__badge">{categoryLabel}</span>
      </div>

      <div className="creator-discovery-card__body">
        <div className="creator-discovery-card__top">
          <div className="creator-discovery-card__creator">
            <div className="creator-discovery-card__avatar">
              {item?.avatar ? (
                <img src={resolveImage(item.avatar) || item.avatar} alt={item?.name || "Creator"} />
              ) : (
                <span>{getInitial(item?.name)}</span>
              )}
            </div>
            <div className="creator-discovery-card__creator-copy">
              <strong>{item?.name || "Creator"}</strong>
              <span>@{item?.username || "creator"}</span>
            </div>
          </div>
          <span className="creator-discovery-card__category">
            {item?.categoryLabels?.join(" / ") || categoryLabel}
          </span>
        </div>

        <div>
          <h3 className="creator-discovery-card__title">{item?.name || "Creator"}</h3>
          <p className="creator-discovery-card__bio">{item?.bio || "A creator on Tengacion."}</p>
        </div>

        <div className="creator-discovery-card__meta-list">
          <span>{Number(item?.followerCount || 0).toLocaleString()} followers</span>
          <span>{Number(item?.contentCount || 0).toLocaleString()} releases</span>
          {item?.subscriptionPrice > 0 ? <span>{formatCurrency(item.subscriptionPrice)}</span> : <span>Free to follow</span>}
          {item?.latestContentAt ? <span>Updated recently</span> : null}
        </div>

        <div className="creator-discovery-card__actions">
          <button
            type="button"
            className="creator-discovery-card__action creator-discovery-card__action--accent"
            onClick={() => navigate(item?.creatorRoute || `/creator/${item.creatorId}`)}
          >
            Visit Page
          </button>
          <button
            type="button"
            className="creator-discovery-card__action"
            onClick={handlePrimaryAction}
            disabled={busy || isSubscribed}
          >
            {busy ? "Working..." : isSubscribed ? "Subscribed" : canSubscribe ? "Subscribe" : following ? "Following" : "Follow"}
          </button>
        </div>
      </div>
    </article>
  );
}
