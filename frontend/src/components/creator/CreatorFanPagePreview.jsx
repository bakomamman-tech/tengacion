import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import CreatorAudioPreviewPlayer from "./CreatorAudioPreviewPlayer";
import CreatorVideoPreviewPlayer from "./CreatorVideoPreviewPlayer";
import { formatCurrency } from "./creatorConfig";
import {
  buildCreatorFanPageData,
  formatCreatorFanPageFollowerCount,
  getCreatorFanPageInitials,
  resolveCreatorFanPageTabKey,
} from "./creatorFanPageData";

const getSectionActionLabel = (sectionKey = "") => {
  if (sectionKey === "books") {
    return "Read library";
  }
  if (sectionKey === "podcasts") {
    return "Listen";
  }
  if (sectionKey === "videos") {
    return "Watch";
  }
  if (sectionKey === "posts") {
    return "Read updates";
  }
  if (sectionKey === "store") {
    return "Shop";
  }
  return "Stream all";
};

const isBookItem = (item = {}) =>
  String(item?.itemType || "").trim().toLowerCase() === "book";

const getItemType = (item = {}) =>
  String(item?.itemType || item?.productType || item?.mediaType || "").trim().toLowerCase();

const isPostItem = (item = {}) => getItemType(item) === "post";

const isProductItem = (item = {}) => getItemType(item) === "product";

const isAudioItem = (item = {}) =>
  ["track", "album", "podcast"].includes(getItemType(item)) && Boolean(item?.isPlayableAudio);

const getPreviewActionLabel = (item = {}) =>
  isBookItem(item) || isPostItem(item) || isProductItem(item)
    ? item?.primaryActionLabel || "Open"
    : "Preview";

const getDetailsActionLabel = (item = {}) =>
  isBookItem(item) ? item?.detailActionLabel || "Open book" : "Open details";

const getReleaseQueueActionLabel = ({ item, isActive, isPlaying }) => {
  if (isBookItem(item)) {
    return "Read";
  }
  if (isPostItem(item)) {
    return "Open";
  }
  if (isProductItem(item)) {
    return "Shop";
  }

  return isActive && isPlaying ? "Playing" : "Play";
};

const isExternalUrl = (value = "") => /^(https?:\/\/|spotify:)/i.test(String(value || "").trim());

function FanPageImage({
  src,
  alt,
  initials,
  className = "",
}) {
  return (
    <div className={`creator-fan-page__image ${className}`.trim()}>
      {src ? <img src={src} alt={alt} /> : <span>{initials}</span>}
    </div>
  );
}

export default function CreatorFanPagePreview({
  creatorProfile,
  dashboard,
  previewData,
  dashboardPath = "/creator/dashboard",
  mode = "workspace",
  initialTab = "music",
  followBusy = false,
  purchaseBusyKey = "",
  onFollow,
  onSupport,
  onSubscribe,
  onMessage,
  onComment,
  onPurchase,
  onDownload,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const user = auth?.user || null;
  const data = useMemo(
    () => previewData || buildCreatorFanPageData({ creatorProfile, dashboard }),
    [creatorProfile, dashboard, previewData]
  );
  const isPublicMode = mode === "public";
  const isLoggedIn = Boolean(user?._id || user?.id);
  const [activeTab, setActiveTab] = useState(
    resolveCreatorFanPageTabKey(initialTab)
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayRequest, setAutoplayRequest] = useState(0);
  const [authPrompt, setAuthPrompt] = useState(null);

  useEffect(() => {
    setActiveTab(resolveCreatorFanPageTabKey(initialTab));
  }, [data.creatorName, initialTab]);

  useEffect(() => {
    setActiveIndex(0);
    setIsPlaying(false);
    setAutoplayRequest(0);
  }, [activeTab]);

  const initials = getCreatorFanPageInitials(data.creatorName);
  const heroStyle = data.heroUrl
    ? {
        backgroundImage: `linear-gradient(135deg, rgba(19, 24, 20, 0.88), rgba(35, 41, 33, 0.72)), url("${data.heroUrl}")`,
      }
    : undefined;

  const activeSection = data.sections?.[activeTab] || data.sections?.music;
  const queue = activeSection?.items?.length
    ? activeSection.items
    : [activeSection?.featured].filter(Boolean);
  const currentItem = queue[activeIndex] || activeSection?.featured;
  const isVideoTab = activeTab === "videos";
  const isBookTab = activeTab === "books" || isBookItem(currentItem);
  const currentItemType = getItemType(currentItem);
  const isAudioSurface =
    ["track", "album", "podcast"].includes(currentItemType) ||
    (
      ["overview", "music", "podcasts"].includes(activeTab) &&
      !isVideoTab &&
      !isBookItem(currentItem) &&
      !isPostItem(currentItem) &&
      !isProductItem(currentItem)
    );

  const openPath = (path = "", options = undefined) => {
    if (!path) {
      return;
    }
    if (isExternalUrl(path)) {
      window.open(path, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(path, options);
  };

  const returnTo = `${location.pathname}${location.search}`;
  const loginPath = `/login?returnTo=${encodeURIComponent(returnTo || "/")}`;
  const registerPath = `/register?returnTo=${encodeURIComponent(returnTo || "/")}`;

  const requestSignIn = (action = "continue") => {
    setAuthPrompt({
      action,
      title: `Sign in to ${action}`,
      message:
        "You can explore this creator page without an account. Sign in when you want to interact, buy, subscribe, message, or comment.",
    });
  };

  const runProtectedAction = (action, callback) => {
    if (isPublicMode && !isLoggedIn) {
      requestSignIn(action);
      return;
    }
    callback?.();
  };

  const openPreview = (item = currentItem) => {
    openPath(item?.previewPath || item?.detailPath || activeSection?.uploadPath);
  };

  const openDetails = (item = currentItem) => {
    openPath(item?.detailPath || item?.publicPath || activeSection?.uploadPath);
  };

  const openPublic = (item = currentItem) => {
    openPath(item?.publicPath || activeSection?.publicPath || activeSection?.uploadPath);
  };

  const openSubscribe = () => {
    if (!data.creatorId) {
      return;
    }
    openPath(data.creator?.subscribePath || `/creators/${data.creatorId}/subscribe`);
  };

  const handleFollow = () => {
    if (isPublicMode) {
      runProtectedAction("follow this creator", () => onFollow?.());
      return;
    }
    openPublic(activeSection?.featured);
  };

  const handleSupport = () => {
    if (isPublicMode) {
      runProtectedAction("support this creator", () => onSupport?.() || onSubscribe?.() || openSubscribe());
      return;
    }
    openPublic(activeSection?.featured);
  };

  const handleSubscribe = () => {
    if (isPublicMode) {
      runProtectedAction("subscribe", () => onSubscribe?.() || openSubscribe());
      return;
    }
    openSubscribe();
  };

  const handleMessage = () => {
    runProtectedAction("message this creator", () => onMessage?.() || openPath("/messages"));
  };

  const handleComment = (item = currentItem) => {
    runProtectedAction("comment on this creator page", () => onComment?.(item) || openDetails(item));
  };

  const handlePurchase = (item = currentItem) => {
    if (!item) {
      return;
    }
    runProtectedAction("purchase this creator drop", () => onPurchase?.(item) || openDetails(item));
  };

  const handleDownload = (item = currentItem) => {
    if (!item) {
      return;
    }
    runProtectedAction("download this creator drop", () => onDownload?.(item) || openDetails(item));
  };

  const handlePrimaryItemAction = (item = currentItem) => {
    if (isProductItem(item) || (Number(item?.price || 0) > 0 && item?.canBuy)) {
      handlePurchase(item);
      return;
    }
    if (isPostItem(item)) {
      handleComment(item);
      return;
    }
    openDetails(item);
  };

  const selectQueueItem = (index, autoplay = true) => {
    setActiveIndex(index);
    setIsPlaying(false);
    if (autoplay) {
      setAutoplayRequest((current) => current + 1);
    }
  };

  const movePlayer = (direction = 1, autoplay = true) => {
    if (!queue.length) {
      return;
    }

    setActiveIndex((current) => {
      const total = queue.length;
      return (current + direction + total) % total;
    });
    setIsPlaying(false);
    if (autoplay) {
      setAutoplayRequest((current) => current + 1);
    }
  };

  const renderStandardContent = () => (
    <div className="creator-fan-page__content-grid">
      <section className="creator-fan-page__panel creator-fan-page__panel--releases">
        <div className="creator-fan-page__panel-head">
          <div>
            <span>{activeSection?.label || "Music"}</span>
            <h3>{activeSection?.title || "Popular Releases"}</h3>
          </div>
          <button
            type="button"
            className="creator-fan-page__button creator-fan-page__button--ghost"
            onClick={() => openPublic()}
          >
            {getSectionActionLabel(activeSection?.key)}
          </button>
        </div>

        <article
          className={`creator-fan-page__feature-release${
            isBookItem(currentItem) ? " creator-fan-page__feature-release--book" : ""
          }`}
        >
          <FanPageImage
            src={currentItem?.imageUrl}
            alt={currentItem?.title || activeSection?.label}
            initials={initials}
            className={`creator-fan-page__image--release${
              isBookItem(currentItem) ? " creator-fan-page__image--book-release" : ""
            }`}
          />

          <div className="creator-fan-page__feature-copy">
            <span className="creator-fan-page__pill">
              {String(currentItem?.releaseType || activeSection?.label || "Release").toUpperCase()}
            </span>
            <h4>{currentItem?.title || activeSection?.label}</h4>
            <p>{currentItem?.subtitle || data.creatorName}</p>

            <div className="creator-fan-page__meta-row">
              {currentItem?.genre ? <span>{currentItem.genre}</span> : null}
              {currentItem?.secondaryLine ? <span>{currentItem.secondaryLine}</span> : null}
              {Number(currentItem?.price || 0) > 0 ? (
                <span>{formatCurrency(currentItem.price)}</span>
              ) : null}
            </div>
          </div>

          <div className="creator-fan-page__feature-actions">
            <button
              type="button"
              className="creator-fan-page__button creator-fan-page__button--light"
              onClick={() => openPreview()}
            >
              {getPreviewActionLabel(currentItem)}
            </button>
            <button
              type="button"
              className="creator-fan-page__button creator-fan-page__button--accent"
              onClick={() => handlePrimaryItemAction()}
            >
              {getDetailsActionLabel(currentItem)}
            </button>
            {isPublicMode ? (
              currentItem?.canDownload ? (
                <button
                  type="button"
                  className="creator-fan-page__button creator-fan-page__button--ghost"
                  onClick={() => handleDownload(currentItem)}
                >
                  Download
                </button>
              ) : null
            ) : (
              <button
                type="button"
                className="creator-fan-page__button creator-fan-page__button--ghost"
                onClick={() => openPath(activeSection?.uploadPath)}
              >
                Open studio
              </button>
            )}
          </div>
        </article>

        <div className="creator-fan-page__release-list">
          {queue.slice(0, 3).map((release, index) => {
            const releaseIsBook = isBookItem(release);
            const isActive = index === activeIndex;
            const actionLabel = getReleaseQueueActionLabel({
              item: release,
              isActive,
              isPlaying,
            });

            return (
              <article
                key={release.id || `${release.title}-${index}`}
                className={`creator-fan-page__release-row${
                  releaseIsBook ? " creator-fan-page__release-row--book" : ""
                }`}
              >
                <span className="creator-fan-page__release-index">{index + 1}.</span>
                <FanPageImage
                  src={release.imageUrl}
                  alt={release.title}
                  initials={initials}
                  className={`creator-fan-page__image--row${
                    releaseIsBook ? " creator-fan-page__image--book-row" : ""
                  }`}
                />
                <div className="creator-fan-page__release-copy">
                  <strong className="creator-fan-page__release-title">{release.title}</strong>
                  <span className="creator-fan-page__release-artist">{release.subtitle || data.creatorName}</span>
                </div>
                <button
                  type="button"
                  className="creator-fan-page__button creator-fan-page__button--icon"
                  aria-label={releaseIsBook ? `${actionLabel} ${release.title}` : undefined}
                  onClick={() => {
                    if (isPostItem(release)) {
                      handleComment(release);
                      return;
                    }
                    if (isProductItem(release)) {
                      handlePurchase(release);
                      return;
                    }
                    selectQueueItem(index, isAudioItem(release));
                  }}
                >
                  {actionLabel}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="creator-fan-page__panel">
        <div className="creator-fan-page__panel-head">
          <div>
            <span>Podcasts</span>
            <h3>Featured Episode</h3>
          </div>
          <button
            type="button"
            className="creator-fan-page__button creator-fan-page__button--ghost"
            onClick={() => openPublic(data.podcast)}
          >
            Listen
          </button>
        </div>

        <article className="creator-fan-page__spotlight-card">
          <FanPageImage
            src={data.podcast.coverUrl}
            alt={data.podcast.title}
            initials={initials}
            className="creator-fan-page__image--spotlight"
          />
          <div>
            <h4>{data.podcast.title}</h4>
            <p>{data.podcast.series}</p>
            <small>{data.podcast.secondaryLine || data.podcast.duration}</small>
          </div>
          <p>{data.podcast.summary}</p>
        </article>
      </section>

      <section className="creator-fan-page__panel">
        <div className="creator-fan-page__panel-head">
          <div>
            <span>Videos</span>
            <h3>Featured Visual</h3>
          </div>
          <button
            type="button"
            className="creator-fan-page__button creator-fan-page__button--ghost"
            onClick={() => openPublic(data.video)}
          >
            Watch
          </button>
        </div>

        <article className="creator-fan-page__spotlight-card">
          <FanPageImage
            src={data.video.thumbnailUrl}
            alt={data.video.title}
            initials={initials}
            className="creator-fan-page__image--spotlight"
          />
          <div>
            <h4>{data.video.title}</h4>
            <p>{data.video.channel}</p>
            <small>{data.video.secondaryLine || "YouTube premiere ready"}</small>
          </div>
          <p>{data.video.summary}</p>
        </article>
      </section>
    </div>
  );

  const renderVideoContent = () => (
    <div className="creator-fan-page__content-grid creator-fan-page__content-grid--video">
      <section className="creator-fan-page__panel creator-fan-page__panel--video-library">
        <div className="creator-fan-page__panel-head">
          <div>
            <span>{activeSection?.label || "Videos"}</span>
            <h3>Video Library</h3>
          </div>
          <div className="creator-fan-page__feature-actions">
            <button
              type="button"
              className="creator-fan-page__button creator-fan-page__button--ghost"
              onClick={() => openPublic()}
            >
              Watch on public page
            </button>
            {isPublicMode ? null : (
              <button
                type="button"
                className="creator-fan-page__button creator-fan-page__button--light"
                onClick={() => openPath(activeSection?.uploadPath)}
              >
                Open studio
              </button>
            )}
          </div>
        </div>

        <article className="creator-fan-page__feature-release creator-fan-page__feature-release--video">
          <FanPageImage
            src={currentItem?.imageUrl}
            alt={currentItem?.title || activeSection?.label}
            initials={initials}
            className="creator-fan-page__image--release"
          />

          <div className="creator-fan-page__feature-copy">
            <span className="creator-fan-page__pill">
              {String(currentItem?.releaseType || activeSection?.label || "Video").toUpperCase()}
            </span>
            <h4>{currentItem?.title || activeSection?.label}</h4>
            <p>{currentItem?.description || activeSection?.description}</p>

            <div className="creator-fan-page__meta-row">
              <span>{currentItem?.subtitle || data.creatorName}</span>
              {currentItem?.secondaryLine ? <span>{currentItem.secondaryLine}</span> : null}
              {Number(currentItem?.price || 0) > 0 ? (
                <span>{formatCurrency(currentItem.price)}</span>
              ) : null}
            </div>
          </div>

          <div className="creator-fan-page__feature-actions">
            <button
              type="button"
              className="creator-fan-page__button creator-fan-page__button--accent"
              onClick={() => setAutoplayRequest((current) => current + 1)}
            >
              Play in player
            </button>
            <button
              type="button"
              className="creator-fan-page__button creator-fan-page__button--light"
              onClick={() => handlePrimaryItemAction()}
            >
              {currentItem?.canBuy ? "Purchase" : "Open details"}
            </button>
            <button
              type="button"
              className="creator-fan-page__button creator-fan-page__button--ghost"
              onClick={() => openPreview()}
            >
              Open preview
            </button>
          </div>
        </article>

        <div className="creator-fan-page__video-library" aria-label="Uploaded videos">
          {queue.map((video, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={video.id || `${video.title}-${index}`}
                type="button"
                className={`creator-fan-page__video-row${isActive ? " is-active" : ""}`}
                aria-pressed={isActive}
                aria-label={`Select ${video.title}`}
                onClick={() => selectQueueItem(index)}
              >
                <span className="creator-fan-page__video-row-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <FanPageImage
                  src={video.imageUrl}
                  alt={video.title}
                  initials={initials}
                  className="creator-fan-page__image--video-row"
                />
                <div className="creator-fan-page__video-row-copy">
                  <strong>{video.title}</strong>
                  <span>{video.subtitle || data.creatorName}</span>
                  <small>{video.description || activeSection?.description}</small>
                </div>
                <div className="creator-fan-page__video-row-meta">
                  <span>{video.statusLabel}</span>
                  <strong>{video.secondaryLine || video.duration || "Video release"}</strong>
                </div>
                <span className="creator-fan-page__video-row-state">
                  {isActive && isPlaying ? "Playing" : isActive ? "Selected" : "Watch"}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );

  const renderPostsContent = () => (
    <div className="creator-fan-page__content-grid creator-fan-page__content-grid--video">
      <section className="creator-fan-page__panel creator-fan-page__panel--video-library">
        <div className="creator-fan-page__panel-head">
          <div>
            <span>Public Posts</span>
            <h3>Creator Updates</h3>
          </div>
          <button
            type="button"
            className="creator-fan-page__button creator-fan-page__button--ghost"
            onClick={() => openPublic()}
          >
            Read all
          </button>
        </div>

        <div className="creator-fan-page__post-list">
          {queue.map((post, index) => (
            <article
              key={post.id || `${post.title}-${index}`}
              className="creator-fan-page__post-card"
            >
              {post.imageUrl ? (
                <FanPageImage
                  src={post.imageUrl}
                  alt={post.title}
                  initials={initials}
                  className="creator-fan-page__image--post"
                />
              ) : null}
              <div className="creator-fan-page__post-copy">
                <span className="creator-fan-page__pill">PUBLIC POST</span>
                <h4>{post.title}</h4>
                <p>{post.description}</p>
                <div className="creator-fan-page__meta-row">
                  <span>{post.commentsCount || 0} comments</span>
                  <span>{post.reactionsCount || 0} reactions</span>
                  <span>{post.shareCount || 0} shares</span>
                </div>
              </div>
              <div className="creator-fan-page__feature-actions">
                <button
                  type="button"
                  className="creator-fan-page__button creator-fan-page__button--light"
                  onClick={() => openDetails(post)}
                >
                  Open post
                </button>
                <button
                  type="button"
                  className="creator-fan-page__button creator-fan-page__button--accent"
                  onClick={() => handleComment(post)}
                >
                  Comment
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );

  const renderStoreContent = () => (
    <div className="creator-fan-page__content-grid creator-fan-page__content-grid--video">
      <section className="creator-fan-page__panel creator-fan-page__panel--video-library">
        <div className="creator-fan-page__panel-head">
          <div>
            <span>Marketplace</span>
            <h3>Products by {data.creatorName}</h3>
          </div>
          <button
            type="button"
            className="creator-fan-page__button creator-fan-page__button--ghost"
            onClick={() => openPath(data.marketplaceStorePath || "/marketplace")}
          >
            Visit store
          </button>
        </div>

        <div className="creator-fan-page__product-grid">
          {queue.map((product, index) => {
            const productKey = `${getItemType(product) || "product"}:${product.id || ""}`;
            const isBusy = purchaseBusyKey === productKey;
            return (
              <article
                key={product.id || `${product.title}-${index}`}
                className="creator-fan-page__product-card"
              >
                <FanPageImage
                  src={product.imageUrl}
                  alt={product.title}
                  initials={initials}
                  className="creator-fan-page__image--product"
                />
                <div className="creator-fan-page__book-copy">
                  <span className="creator-fan-page__pill">PRODUCT</span>
                  <h4>{product.title}</h4>
                  <p>{product.description}</p>
                  <small>{product.secondaryLine}</small>
                  <strong>{formatCurrency(product.price)}</strong>
                </div>
                <div className="creator-fan-page__feature-actions">
                  <button
                    type="button"
                    className="creator-fan-page__button creator-fan-page__button--light"
                    onClick={() => openDetails(product)}
                  >
                    View product
                  </button>
                  <button
                    type="button"
                    className="creator-fan-page__button creator-fan-page__button--accent"
                    onClick={() => handlePurchase(product)}
                    disabled={isBusy}
                  >
                    {isBusy ? "Opening..." : "Purchase"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );

  const renderActiveContent = () => {
    if (isVideoTab) {
      return renderVideoContent();
    }
    if (activeTab === "posts") {
      return renderPostsContent();
    }
    if (activeTab === "store") {
      return renderStoreContent();
    }
    return renderStandardContent();
  };

  const renderStandardRail = () => (
    <>
      <section className="creator-fan-page__support-card">
        <span>Unlock Exclusive Content</span>
        <h3>{formatCurrency(data.supportPrice)}/month</h3>
        <p>{data.supporterCopy}</p>
        {Array.isArray(data.subscriptionBenefits) && data.subscriptionBenefits.length ? (
          <div className="creator-fan-page__support-benefits">
            {data.subscriptionBenefits.slice(0, 4).map((benefit) => (
              <small key={benefit}>{benefit}</small>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="creator-fan-page__button creator-fan-page__button--accent"
          onClick={handleSubscribe}
        >
          {data.subscription?.isSubscribed
            ? "Membership active"
            : `Subscribe for ${formatCurrency(data.supportPrice)}/month`}
        </button>
      </section>

      <section className="creator-fan-page__rail-card">
        <div className="creator-fan-page__panel-head">
          <div>
            <span>Platforms</span>
            <h3>Stream on Spotify / Youtube</h3>
          </div>
        </div>
        <div className="creator-fan-page__rail-actions">
          {data.platforms.map((platform) => (
            <button
              key={platform.label}
              type="button"
              className={`creator-fan-page__platform-button creator-fan-page__platform-button--${platform.tone}`}
              onClick={() => openPath(platform.url || platform.path)}
            >
              {platform.label}
            </button>
          ))}
        </div>
      </section>

      <section className="creator-fan-page__rail-card creator-fan-page__book-card">
        <div className="creator-fan-page__panel-head">
          <div>
            <span>Books</span>
            <h3>Books by {data.creatorName}</h3>
          </div>
        </div>

        <article className="creator-fan-page__book-row">
          <FanPageImage
            src={data.book.coverUrl}
            alt={data.book.title}
            initials={initials}
            className="creator-fan-page__image--book"
          />
          <div className="creator-fan-page__book-copy">
            <h4>{data.book.title}</h4>
            <p>{data.book.author}</p>
            <small>{data.book.imprint}</small>
            <strong>{formatCurrency(data.book.price)}</strong>
          </div>
        </article>

        <div className="creator-fan-page__button-row">
          <button
            type="button"
            className="creator-fan-page__button creator-fan-page__button--accent"
            onClick={() => handlePurchase(data.book)}
          >
            {data.book?.canAccessFull ? "Open Book" : "Buy Now"}
          </button>
          <button
            type="button"
            className="creator-fan-page__button creator-fan-page__button--light"
            onClick={() => openPreview(data.book)}
          >
            Preview
          </button>
        </div>
      </section>

      <section className="creator-fan-page__rail-card">
        <h3>Rewards for supporters</h3>
        <p>{data.rewardsCopy}</p>
      </section>
    </>
  );

  return (
    <section
      className={`creator-fan-page${isVideoTab ? " creator-fan-page--video" : ""}`}
      aria-label="Fan Page View"
    >
      <header className="creator-fan-page__topbar">
        <div className="creator-fan-page__brand">
          <span className="creator-fan-page__brand-mark" aria-hidden="true">
            T
          </span>
          <div>
            <strong>Tengacion</strong>
            <small>Fan Page View</small>
          </div>
        </div>

        <div className="creator-fan-page__search">
          {isPublicMode ? "Search this creator page" : "Search Fan Page View"}
        </div>

        <div className="creator-fan-page__top-actions">
          {isPublicMode ? (
            <>
              <Link className="creator-fan-page__workspace-link" to="/creators">
                Explore creators
              </Link>
              {isLoggedIn ? (
                <Link className="creator-fan-page__top-pill" to="/home">
                  Home
                </Link>
              ) : (
                <Link className="creator-fan-page__top-pill" to={loginPath}>
                  Sign in
                </Link>
              )}
              <button
                type="button"
                className="creator-fan-page__top-pill"
                onClick={handleMessage}
              >
                Message
              </button>
            </>
          ) : (
            <>
              <Link className="creator-fan-page__workspace-link" to={dashboardPath}>
                Back to dashboard
              </Link>
              <button
                type="button"
                className="creator-fan-page__top-pill"
                onClick={() => openPath("/home", { state: { openMessenger: true } })}
              >
                Inbox
              </button>
              <button
                type="button"
                className="creator-fan-page__top-pill"
                onClick={() => openPath("/notifications")}
              >
                Alerts
              </button>
              <button
                type="button"
                className="creator-fan-page__top-pill"
                onClick={() => openPath("/settings/security")}
              >
                Settings
              </button>
            </>
          )}
          <FanPageImage
            src={data.avatarUrl}
            alt={data.creatorName}
            initials={initials}
            className="creator-fan-page__image--avatar"
          />
        </div>
      </header>

      <div className={`creator-fan-page__layout${isVideoTab ? " creator-fan-page__layout--video" : ""}`}>
        <aside className="creator-fan-page__sidebar">
          <FanPageImage
            src={data.avatarUrl}
            alt={data.creatorName}
            initials={initials}
            className="creator-fan-page__image--profile"
          />

          <div className="creator-fan-page__sidebar-copy">
            <h1>{data.creatorName}</h1>
            <p>{data.tagline}</p>
          </div>

          <div className="creator-fan-page__button-row">
            <button
              type="button"
              className="creator-fan-page__button creator-fan-page__button--light"
              onClick={handleFollow}
              disabled={followBusy}
            >
              {data.viewer?.isFollowing ? "Following" : followBusy ? "Following..." : "Follow"}
            </button>
            <button
              type="button"
              className="creator-fan-page__button creator-fan-page__button--accent"
              onClick={handleSupport}
            >
              Donate
            </button>
          </div>

          <nav className="creator-fan-page__sidebar-nav" aria-label="Fan page sections">
            {data.sidebarLinks.map((item) => {
              const isActive = item.key === activeTab;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`creator-fan-page__nav-link${isActive ? " is-active" : ""}`}
                  onClick={() => setActiveTab(item.key)}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="creator-fan-page__stats-grid">
            {data.stats.map((item) => (
              <div key={item.label} className="creator-fan-page__stat-card">
                <small>{item.label}</small>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </aside>

        <main className="creator-fan-page__main">
          <section className="creator-fan-page__hero" style={heroStyle}>
            <span className="creator-fan-page__eyebrow">Public Fan Experience</span>
            <h2>{data.creatorName}</h2>
            <p>
              {formatCreatorFanPageFollowerCount(data.followers)} followers
              {data.lanes.length ? ` / ${data.lanes.join(" / ")}` : ""}
            </p>

            <div className="creator-fan-page__button-row">
              <button
                type="button"
                className="creator-fan-page__button creator-fan-page__button--accent"
                onClick={handleFollow}
                disabled={followBusy}
              >
                {data.viewer?.isFollowing ? "Following" : followBusy ? "Following..." : "Follow"}
              </button>
              <button
                type="button"
                className="creator-fan-page__button creator-fan-page__button--light"
                onClick={handleSupport}
              >
                Donate
              </button>
              <button
                type="button"
                className="creator-fan-page__button creator-fan-page__button--light"
                onClick={handleSubscribe}
              >
                {data.subscription?.isSubscribed ? "Subscribed" : "Subscribe"}
              </button>
              {isPublicMode ? (
                <button
                  type="button"
                  className="creator-fan-page__button creator-fan-page__button--light"
                  onClick={handleMessage}
                >
                  Message
                </button>
              ) : null}
            </div>

            <div className="creator-fan-page__tabs" role="tablist" aria-label="Fan page tabs">
              {data.tabs.map((tab) => {
                const isActive = tab.key === activeTab;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    className={`creator-fan-page__tab${isActive ? " is-active" : ""}`}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </section>

          {renderActiveContent()}
        </main>

        <aside className={`creator-fan-page__rail${isVideoTab ? " creator-fan-page__rail--video" : ""}`}>
          {isVideoTab ? (
            <CreatorVideoPreviewPlayer
              item={currentItem || data.video}
              creatorName={data.creatorName}
              queueLength={queue.length}
              queueIndex={activeIndex}
              onPrevious={() => movePlayer(-1)}
              onNext={() => movePlayer(1)}
              onPlayingChange={setIsPlaying}
              autoplayRequest={autoplayRequest}
            />
          ) : (
            renderStandardRail()
          )}
        </aside>
      </div>

      {isVideoTab || isBookTab || !isAudioSurface ? null : (
        <footer className="creator-fan-page__player">
          <CreatorAudioPreviewPlayer
            item={currentItem || data.music}
            creatorName={data.creatorName}
            creatorUserId={
              data.creatorUserId || creatorProfile?.user?._id || creatorProfile?.user?.id || ""
            }
            queueLength={queue.length}
            queueIndex={activeIndex}
            onPrevious={() => movePlayer(-1)}
            onNext={() => movePlayer(1)}
            onPlayingChange={setIsPlaying}
            autoplayRequest={autoplayRequest}
            variant="public"
            onBuyFullTrack={handlePurchase}
            onDownload={handleDownload}
          />
        </footer>
      )}

      {authPrompt ? (
        <div className="creator-fan-page__auth-backdrop" role="presentation">
          <section
            className="creator-fan-page__auth-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="creator-fan-page-auth-title"
          >
            <span>Sign in required</span>
            <h3 id="creator-fan-page-auth-title">{authPrompt.title}</h3>
            <p>{authPrompt.message}</p>
            <div className="creator-fan-page__button-row">
              <Link
                className="creator-fan-page__button creator-fan-page__button--accent"
                to={loginPath}
              >
                Sign in
              </Link>
              <Link
                className="creator-fan-page__button creator-fan-page__button--light"
                to={registerPath}
              >
                Create account
              </Link>
              <button
                type="button"
                className="creator-fan-page__button creator-fan-page__button--ghost"
                onClick={() => setAuthPrompt(null)}
              >
                Keep browsing
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
