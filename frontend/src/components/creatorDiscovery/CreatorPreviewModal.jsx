import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { createCheckout, resolveImage, toggleFollowCreator } from "../../api";
import CreatorAudioPreviewPlayer from "../creator/CreatorAudioPreviewPlayer";
import { formatCurrency } from "../creator/creatorConfig";
import ShareActions from "../creator/media/ShareActions";

import "./creatorDiscovery.css";

const formatTimestamp = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
};

export default function CreatorPreviewModal({ open = false, item = null, onClose }) {
  const navigate = useNavigate();
  const [followBusy, setFollowBusy] = useState(false);
  const [buyBusy, setBuyBusy] = useState(false);

  const canRender = Boolean(open && item);
  const creatorRoute = String(item?.creatorRoute || "").trim();
  const subscribeRoute = String(item?.subscribeRoute || "").trim();
  const isBook = String(item?.itemType || "").toLowerCase() === "book";
  const isAudio = !isBook && ["audio", "track", "podcast", "album", ""].includes(
    String(item?.mediaType || "").toLowerCase()
  );
  const previewSrc = String(item?.previewUrl || item?.previewAudioUrl || "").trim();
  const fallbackSource = String(item?.audioUrl || "").trim();
  const playerItem = useMemo(
    () => ({
      id: item?.contentId || item?.id || item?.title || "",
      itemType: String(item?.itemType || item?.feedItemType || "track").toLowerCase(),
      title: item?.title || "Preview",
      subtitle: item?.creatorName || "Creator",
      coverUrl: item?.coverImage || item?.creatorAvatar || "",
      imageUrl: item?.coverImage || item?.creatorAvatar || "",
      audioUrl: fallbackSource,
      previewAudioUrl: previewSrc || fallbackSource,
      previewStartSec: Number(item?.previewStartSec || 0),
      previewLimitSec: Number(item?.previewLimitSec || 30),
      durationSec: Number(item?.durationSec || 0),
      price: Number(item?.price || 0),
      statusLabel: "Preview player",
      isPlayableAudio: true,
      lockedPreview: Boolean(previewSrc || fallbackSource),
      initialSourceMode: "preview",
      secondaryLine: item?.summaryLabel || item?.creatorCategory || "Preview",
    }),
    [fallbackSource, item, previewSrc]
  );

  useEffect(() => {
    if (!canRender) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [canRender, onClose]);

  if (!canRender || typeof document === "undefined") {
    return null;
  }

  const handleBuy = async () => {
    const itemType = String(item?.purchaseItemType || item?.itemType || "").trim().toLowerCase();
    const itemId = String(item?.purchaseItemId || item?.contentId || item?.id || "").trim();
    if (!itemType || !itemId) {
      toast.error("Purchase details are unavailable.");
      return;
    }

    try {
      setBuyBusy(true);
      const checkout = await createCheckout({
        itemType,
        itemId,
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

  const handleFollow = async () => {
    if (!item?.creatorId) {
      return;
    }

    try {
      setFollowBusy(true);
      const response = await toggleFollowCreator(item.creatorId);
      toast.success(response?.following ? "Creator followed." : "Creator unfollowed.");
    } catch (err) {
      toast.error(err?.message || "Could not update follow state.");
    } finally {
      setFollowBusy(false);
    }
  };

  const openSubscribe = () => {
    if (subscribeRoute) {
      navigate(subscribeRoute);
    }
  };

  const openCreator = () => {
    if (creatorRoute) {
      navigate(creatorRoute);
    }
  };

  const renderBookPreview = () => (
    <div className="creator-preview-modal__book">
      <div className="creator-preview-modal__hero-art">
        {item?.coverImage ? (
          <img src={resolveImage(item.coverImage) || item.coverImage} alt={item?.title || "Book preview"} />
        ) : (
          <span>{String(item?.title || "B").slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div className="creator-preview-modal__chips">
        <span>{item?.creatorCategory || "Books"}</span>
        <span>{formatTimestamp(item?.createdAt)}</span>
        <span>{item?.price > 0 ? formatCurrency(item.price) : "Free preview"}</span>
      </div>
      <div className="creator-preview-modal__excerpt">
        {item?.previewExcerptText || item?.summary || "This book preview opens a reader-friendly excerpt here."}
      </div>
      <div className="creator-preview-modal__book-actions">
        {previewSrc ? (
          <button
            type="button"
            className="creator-preview-modal__action creator-preview-modal__action--accent"
            onClick={() => window.open(previewSrc, "_blank", "noopener,noreferrer")}
          >
            Open preview
          </button>
        ) : null}
        {item?.canBuy ? (
          <button
            type="button"
            className="creator-preview-modal__action"
            onClick={handleBuy}
            disabled={buyBusy}
          >
            {buyBusy ? "Opening..." : "Buy"}
          </button>
        ) : null}
        {subscribeRoute ? (
          <button
            type="button"
            className="creator-preview-modal__action"
            onClick={openSubscribe}
          >
            {item?.viewerSubscribed ? "Subscribed" : "Subscribe"}
          </button>
        ) : null}
        <button type="button" className="creator-preview-modal__action" onClick={openCreator}>
          Visit Creator
        </button>
      </div>
    </div>
  );

  const renderAudioPreview = () => (
    <div className="creator-preview-modal__player">
      <div className="creator-preview-modal__audio-shell">
        <CreatorAudioPreviewPlayer
          key={playerItem.id}
          item={playerItem}
          creatorName={item?.creatorName || "Creator"}
          variant="preview"
          initialSourceMode={playerItem.initialSourceMode}
        />
      </div>
    </div>
  );

  const body = (
    <div className="creator-preview-modal creator-discovery-theme" role="presentation">
      <div className="creator-preview-modal__backdrop" onMouseDown={onClose} />
      <div
        className="creator-preview-modal__shell"
        role="dialog"
        aria-modal="true"
        aria-label="Creator preview"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="creator-preview-modal__head">
          <div>
            <strong>{item?.summaryLabel || item?.creatorCategory || "Creator Preview"}</strong>
            <h3>{item?.title || "Preview"}</h3>
            <p>{item?.creatorName || "Creator"}</p>
          </div>
          <button type="button" className="creator-preview-modal__close" onClick={onClose} aria-label="Close preview">
            <span className="icon-glyph-center">X</span>
          </button>
        </div>

        <div className="creator-preview-modal__body">
          <div className="creator-preview-modal__art">
            <div className="creator-preview-modal__hero-art">
              {item?.coverImage ? (
                <img
                  src={resolveImage(item.coverImage) || item.coverImage}
                  alt={item?.title || "Preview"}
                />
              ) : (
                <span>{String(item?.creatorName || "T").slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="creator-preview-modal__meta">
              <span>{item?.creatorCategory || "Music"}</span>
              {item?.timestampLabel ? <span>{item.timestampLabel}</span> : null}
              {item?.price > 0 ? <span>{formatCurrency(item.price)}</span> : <span>Free</span>}
            </div>
            <p>{item?.summary || item?.description || item?.bio || "A premium creator release."}</p>
            <div className="creator-preview-modal__actions">
              {item?.canBuy ? (
                <button
                  type="button"
                  className="creator-preview-modal__action creator-preview-modal__action--accent"
                  onClick={handleBuy}
                  disabled={buyBusy}
                >
                  {buyBusy ? "Opening..." : item?.buyLabel || "Buy"}
                </button>
              ) : null}
              {subscribeRoute ? (
                <button
                  type="button"
                  className="creator-preview-modal__action"
                  onClick={openSubscribe}
                >
                  {item?.viewerSubscribed ? "Subscribed" : item?.subscribeLabel || "Subscribe"}
                </button>
              ) : null}
              <button type="button" className="creator-preview-modal__action" onClick={openCreator}>
                Visit Creator
              </button>
              <ShareActions
                className="creator-preview-modal__action"
                title={item?.title || item?.creatorName || "Creator release"}
                text={item?.summary || "Explore this Tengacion release."}
                url={`${window.location.origin}${creatorRoute || "/home"}`}
              />
            </div>
            {item?.canFollow ? (
              <button
                type="button"
                className="creator-preview-modal__action"
                onClick={handleFollow}
                disabled={followBusy}
              >
                {followBusy ? "Updating..." : item?.followLabel || "Follow"}
              </button>
            ) : null}
          </div>

          {isBook ? renderBookPreview() : isAudio ? renderAudioPreview() : renderBookPreview()}
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
