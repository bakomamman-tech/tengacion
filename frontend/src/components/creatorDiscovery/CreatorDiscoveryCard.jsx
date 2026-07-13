import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { resolveImage, toggleFollowCreator } from "../../api";
import { formatCurrency } from "../creator/creatorConfig";
import { useAuth } from "../../context/AuthContext";
import { buildCreatorPublicPath, buildCreatorSubscribePath } from "../../lib/publicRoutes";
import CreatorDiscoveryIcon from "./CreatorDiscoveryIcon";

import "./creatorDiscovery.css";

const getInitial = (value = "") => String(value || "T").trim().slice(0, 1).toUpperCase();

export default function CreatorDiscoveryCard({ item }) {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const user = auth?.user ?? null;
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
  const trustBadges = Array.isArray(item?.trustBadges)
    ? item.trustBadges.filter(Boolean)
    : [
        ...(item?.isVerified ? ["Verified Creator"] : []),
        ...(item?.status === "active" ? ["Active Profile"] : []),
      ];
  const visibleTrustBadges = trustBadges.filter(
    (badge) => !(item?.isVerified && String(badge).toLowerCase() === "verified creator")
  );
  const creatorRoute = String(item?.creatorRoute || "").trim() || buildCreatorPublicPath({
    creatorId: item?.creatorId,
    username: item?.username,
  });
  const requireViewer = () => {
    if (user?._id || user?.id) {
      return true;
    }
    const returnTo = `${location.pathname}${location.search}`;
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    return false;
  };

  const handlePrimaryAction = async () => {
    if (canSubscribe) {
      if (isSubscribed) {
        return;
      }
      if (!requireViewer()) {
        return;
      }
      navigate(item?.subscribeRoute || buildCreatorSubscribePath(item?.creatorId));
      return;
    }

    if (!item?.creatorId) {
      return;
    }
    if (!requireViewer()) {
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
      <Link
        to={creatorRoute}
        className="creator-discovery-card__media"
        aria-label={`Visit ${item?.name || "creator"}'s page${item?.isVerified ? " (verified creator)" : ""}`}
      >
        {item?.banner || item?.avatar ? (
          <img
            src={resolveImage(item.banner || item.avatar) || item.banner || item.avatar}
            alt=""
          />
        ) : (
          <span className="creator-discovery-card__media-fallback" aria-hidden="true">
            {getInitial(item?.name)}
          </span>
        )}
        <span className="creator-discovery-card__badge">{categoryLabel}</span>
        {item?.isVerified ? (
          <span className="creator-discovery-card__verified">
            <CreatorDiscoveryIcon name="badgeCheck" size={15} />
            Verified
          </span>
        ) : null}
      </Link>

      <div className="creator-discovery-card__body">
        <div className="creator-discovery-card__top">
          <div className="creator-discovery-card__creator">
            <div className="creator-discovery-card__avatar">
              {item?.avatar ? (
                <img src={resolveImage(item.avatar) || item.avatar} alt="" />
              ) : (
                <span aria-hidden="true">{getInitial(item?.name)}</span>
              )}
            </div>
            <div className="creator-discovery-card__creator-copy">
              <h3 className="creator-discovery-card__title">
                <Link to={creatorRoute}>{item?.name || "Creator"}</Link>
              </h3>
              <span>@{item?.username || "creator"}</span>
            </div>
          </div>
          <span className="creator-discovery-card__category">
            {item?.categoryLabels?.join(" · ") || categoryLabel}
          </span>
        </div>

        <p className="creator-discovery-card__bio">{item?.bio || "A creator on Tengacion."}</p>

        <div className="creator-discovery-card__meta-list">
          <span>
            <CreatorDiscoveryIcon name="users" size={15} />
            {Number(item?.followerCount || 0).toLocaleString()} followers
          </span>
          <span>
            <CreatorDiscoveryIcon name="layers" size={15} />
            {Number(item?.contentCount || 0).toLocaleString()} releases
          </span>
          {item?.locationLabel ? (
            <span>
              <CreatorDiscoveryIcon name="mapPin" size={15} />
              {item.locationLabel}
            </span>
          ) : null}
          <span>
            <CreatorDiscoveryIcon name="wallet" size={15} />
            {item?.subscriptionPrice > 0 ? formatCurrency(item.subscriptionPrice) : "Free to follow"}
          </span>
          {item?.latestContentAt ? (
            <span>
              <CreatorDiscoveryIcon name="clock" size={15} />
              Updated recently
            </span>
          ) : null}
        </div>

        {visibleTrustBadges.length ? (
          <div className="creator-discovery-card__trust" aria-label={`${item?.name || "Creator"} trust signals`}>
            {visibleTrustBadges.slice(0, 3).map((badge) => (
              <span key={badge}>
                <CreatorDiscoveryIcon name="check" size={14} />
                {badge}
              </span>
            ))}
          </div>
        ) : null}

        <div className="creator-discovery-card__actions">
          <Link
            to={creatorRoute}
            className="creator-discovery-card__action creator-discovery-card__action--accent"
          >
            Visit Page
            <CreatorDiscoveryIcon name="arrowUpRight" size={16} />
          </Link>
          <button
            type="button"
            className="creator-discovery-card__action"
            onClick={handlePrimaryAction}
            disabled={busy || isSubscribed}
          >
            <CreatorDiscoveryIcon name={following || isSubscribed ? "check" : "userPlus"} size={16} />
            {busy ? "Working..." : isSubscribed ? "Subscribed" : canSubscribe ? "Subscribe" : following ? "Following" : "Follow"}
          </button>
        </div>
      </div>
    </article>
  );
}
