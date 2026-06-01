import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { updateBookWithUploadProgress } from "../../api";
import CreatorAudioPreviewPlayer from "./CreatorAudioPreviewPlayer";
import { formatCurrency } from "./creatorConfig";
import {
  buildCreatorFanPageData,
  formatCreatorFanPageFollowerCount,
  getCreatorFanPageInitials,
  resolveCreatorFanPageTabKey,
} from "./creatorFanPageData";

const BOOK_VERSION_ACCEPT = ".pdf,.epub,.mobi,.txt";
const BOOK_VERSION_EXTENSIONS = new Set(["pdf", "epub", "mobi", "txt"]);

const inferBookVersionFormat = (file = {}) => {
  const name = String(file?.name || "");
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex + 1).toLowerCase() : "";
};

const resolveBookPublishMode = (item = {}) => {
  const status = String(item?.publishedStatus || item?.status || "")
    .trim()
    .toLowerCase();
  return status === "draft" ? "draft" : "published";
};

function FanPreviewImage({
  src,
  alt,
  initials,
  className = "",
}) {
  return (
    <div className={`creator-fan-preview__image ${className}`.trim()}>
      {src ? <img src={src} alt={alt} /> : <span>{initials}</span>}
    </div>
  );
}

const isBookPreviewItem = (item = {}) =>
  String(item?.itemType || "").trim().toLowerCase() === "book";

const getQueueActionLabel = ({ item, isActive, isPlaying }) => {
  if (isBookPreviewItem(item)) {
    return isActive ? "Selected" : "View";
  }

  return isActive && isPlaying ? "Playing" : "Play";
};

function CreatorBookWorkspacePanel({
  item,
  creatorName,
  initials,
  queueLength,
  queueIndex,
  onPrevious,
  onNext,
  onPreview,
  onDetails,
  onStudio,
  onEditedVersionUploaded,
}) {
  const fileInputRef = useRef(null);
  const [isVersionUploading, setIsVersionUploading] = useState(false);
  const [versionProgress, setVersionProgress] = useState(0);
  const title = item?.title || "Untitled book";
  const author = item?.subtitle || creatorName || "Creator";
  const status = item?.statusLabel || "Workspace preview";
  const details = item?.secondaryLine || item?.genre || "Digital book";
  const priceLabel = Number(item?.price || 0) > 0 ? formatCurrency(item.price) : "Free";
  const disableBookNavigation = queueLength <= 1;
  const canUploadEditedVersion = Boolean(item?.id);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const chooseEditedVersionFile = () => {
    if (!canUploadEditedVersion || isVersionUploading) {
      return;
    }
    fileInputRef.current?.click();
  };

  const uploadEditedVersion = async (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      return;
    }

    const fileFormat = inferBookVersionFormat(file);
    if (!BOOK_VERSION_EXTENSIONS.has(fileFormat)) {
      toast.error("Upload a PDF, EPUB, MOBI, or TXT file");
      resetFileInput();
      return;
    }

    try {
      setIsVersionUploading(true);
      setVersionProgress(0);

      const formData = new FormData();
      formData.append("content", file);
      formData.append("fileFormat", fileFormat);
      formData.append("publishedStatus", resolveBookPublishMode(item));

      const updated = await updateBookWithUploadProgress(item.id, formData, {
        onProgress: setVersionProgress,
      });
      await Promise.resolve(onEditedVersionUploaded?.(updated)).catch(() => null);
      toast.success(
        updated?.publishedStatus === "under_review"
          ? "Edited version uploaded for review"
          : "Edited version uploaded"
      );
    } catch (err) {
      toast.error(err?.message || "Could not upload the edited version");
    } finally {
      setIsVersionUploading(false);
      setVersionProgress(0);
      resetFileInput();
    }
  };

  return (
    <article className="creator-fan-preview__book-reader" aria-label="Book reader preview">
      <div className="creator-fan-preview__book-reader-main">
        <FanPreviewImage
          src={item?.imageUrl}
          alt={title}
          initials={initials}
          className="creator-fan-preview__book-cover"
        />

        <div className="creator-fan-preview__book-copy">
          <span className="creator-fan-preview__book-badge">Reader preview</span>
          <strong>{title}</strong>
          <span>{author}</span>

          <div className="creator-fan-preview__book-meta-grid">
            <div>
              <small>Status</small>
              <b>{status}</b>
            </div>
            <div>
              <small>Details</small>
              <b>{details}</b>
            </div>
            <div>
              <small>Price</small>
              <b>{priceLabel}</b>
            </div>
          </div>
        </div>
      </div>

      <p className="creator-fan-preview__book-description">
        {item?.description || "A reader-facing book release from your publishing workspace."}
      </p>

      <div className="creator-fan-preview__book-actions">
        <button
          type="button"
          className="creator-fan-preview__primary-action"
          onClick={onPreview}
        >
          {item?.primaryActionLabel || "Read preview"}
        </button>
        <button
          type="button"
          className="creator-fan-preview__secondary-action"
          onClick={onDetails}
        >
          {item?.detailActionLabel || "Open book"}
        </button>
        <button
          type="button"
          className="creator-fan-preview__secondary-action"
          onClick={onStudio}
        >
          Open studio
        </button>
        {canUploadEditedVersion ? (
          <>
            <button
              type="button"
              className="creator-fan-preview__secondary-action"
              onClick={chooseEditedVersionFile}
              disabled={isVersionUploading}
            >
              {isVersionUploading ? `Uploading ${versionProgress}%` : "Upload Edited Version"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={BOOK_VERSION_ACCEPT}
              onChange={uploadEditedVersion}
              style={{ display: "none" }}
              aria-hidden="true"
              tabIndex={-1}
            />
          </>
        ) : null}
      </div>

      {isVersionUploading ? (
        <div className="creator-fan-preview__book-version-status" role="status" aria-live="polite">
          <span style={{ width: `${versionProgress}%` }} />
          <small>Replacing the uploaded book file...</small>
        </div>
      ) : null}

      <div className="creator-fan-preview__book-navigation">
        <span>
          Book {Math.min(queueIndex + 1, Math.max(queueLength, 1))} of {Math.max(queueLength, 1)}
        </span>
        <div>
          <button
            type="button"
            className="creator-fan-preview__secondary-action"
            onClick={onPrevious}
            disabled={disableBookNavigation}
          >
            Previous book
          </button>
          <button
            type="button"
            className="creator-fan-preview__secondary-action"
            onClick={onNext}
            disabled={disableBookNavigation}
          >
            Next book
          </button>
        </div>
      </div>
    </article>
  );
}

export default function CreatorFanPageWorkspacePreview({
  creatorProfile,
  dashboard,
  currentCategoryKey = "music",
  onBookVersionUploaded,
}) {
  const navigate = useNavigate();
  const data = useMemo(
    () => buildCreatorFanPageData({ creatorProfile, dashboard }),
    [creatorProfile, dashboard]
  );
  const defaultTab = useMemo(
    () => resolveCreatorFanPageTabKey(currentCategoryKey),
    [currentCategoryKey]
  );
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayRequest, setAutoplayRequest] = useState(0);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    setActiveIndex(0);
    setIsPlaying(false);
    setAutoplayRequest(0);
  }, [activeTab]);

  const initials = getCreatorFanPageInitials(data.creatorName);
  const activeSection = data.sections[activeTab] || data.sections.music;
  const queue = activeSection.items.length
    ? activeSection.items
    : [activeSection.featured];
  const currentItem = queue[activeIndex] || activeSection.featured;
  const currentItemIsBook = isBookPreviewItem(currentItem);
  const progressWidth = `${Math.max(
    18,
    Math.round(((activeIndex + 1) / Math.max(queue.length, 1)) * 100)
  )}%`;

  const openPath = (path = "", options = undefined) => {
    if (!path) {
      return;
    }
    navigate(path, options);
  };

  const openPreview = (item = currentItem) => {
    openPath(item?.previewPath || item?.detailPath || activeSection.uploadPath);
  };

  const openDetails = (item = currentItem) => {
    openPath(item?.detailPath || item?.publicPath || activeSection.uploadPath);
  };

  const openPublic = (item = currentItem) => {
    openPath(item?.publicPath || activeSection.publicPath || activeSection.uploadPath);
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

  const selectQueueItem = (item, index) => {
    setActiveIndex(index);
    setIsPlaying(false);

    if (!isBookPreviewItem(item)) {
      setAutoplayRequest((current) => current + 1);
    }
  };

  return (
    <section className="creator-panel card creator-fan-preview" aria-label="Fan Page View">
      <div className="creator-fan-preview__chrome">
        <span className="creator-fan-preview__chip">Fan Page View</span>
        <div className="creator-fan-preview__chrome-lights" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="creator-fan-preview__hero">
        <FanPreviewImage
          src={data.avatarUrl}
          alt={data.creatorName}
          initials={initials}
          className="creator-fan-preview__image--hero"
        />
        <div className="creator-fan-preview__hero-copy">
          <span className="creator-fan-preview__eyebrow">Public creator preview</span>
          <strong>{data.creatorName}</strong>
          <p>
            {formatCreatorFanPageFollowerCount(data.followers)} followers
            {data.lanes.length ? ` / ${data.lanes.join(" / ")}` : ""}
          </p>
          <p>{data.tagline}</p>
        </div>
      </div>

      <div className="creator-fan-preview__hero-actions">
        <button
          type="button"
          className="creator-fan-preview__primary-action"
          onClick={() => openPath("/creator/fan-page-view")}
        >
          Open full fan page view
        </button>
        <button
          type="button"
          className="creator-fan-preview__secondary-action"
          onClick={() => openPublic()}
        >
          Open public page
        </button>
      </div>

      <div className="creator-fan-preview__tabs" role="tablist" aria-label="Fan page sections">
        {data.tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              className={`creator-fan-preview__tab${isActive ? " is-active" : ""}`}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="creator-fan-preview__grid">
        <article
          className={`creator-fan-preview__music-card${
            currentItemIsBook ? " creator-fan-preview__music-card--books" : ""
          }`}
        >
          <div className="creator-fan-preview__section-head">
            <div className="creator-fan-preview__section-copy">
              <span className="creator-fan-preview__section-label">{activeSection.label}</span>
              <strong className="creator-fan-preview__section-title">{activeSection.title}</strong>
            </div>
            <button
              type="button"
              className="creator-fan-preview__secondary-action"
              onClick={() => openPublic()}
            >
              Open public page
            </button>
          </div>

          <div className="creator-fan-preview__feature-row">
            <FanPreviewImage
              src={currentItem?.imageUrl}
              alt={currentItem?.title || activeSection.label}
              initials={initials}
              className={`creator-fan-preview__image--tile${
                currentItemIsBook ? " creator-fan-preview__image--book-tile" : ""
              }`}
            />
            <div className="creator-fan-preview__feature-copy">
              <span className="creator-fan-preview__pill">
                {String(currentItem?.releaseType || activeSection.label).toUpperCase()}
              </span>
              <strong>{currentItem?.title || activeSection.label}</strong>
              <p>{currentItem?.description || activeSection.description}</p>
              <div className="creator-fan-preview__meta-row">
                <span>{currentItem?.subtitle || data.creatorName}</span>
                {currentItem?.secondaryLine ? <span>{currentItem.secondaryLine}</span> : null}
                {Number(currentItem?.price || 0) > 0 ? (
                  <span>{formatCurrency(currentItem.price)}</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="creator-fan-preview__action-row">
            <button
              type="button"
              className="creator-fan-preview__primary-action"
              onClick={() => openPreview()}
            >
              {currentItem?.primaryActionLabel || "Open preview"}
            </button>
            <button
              type="button"
              className="creator-fan-preview__secondary-action"
              onClick={() => openDetails()}
            >
              {currentItem?.detailActionLabel || "Open details"}
            </button>
            <button
              type="button"
              className="creator-fan-preview__secondary-action"
              onClick={() => openPath(activeSection.uploadPath)}
            >
              Open studio
            </button>
          </div>

          <div className="creator-fan-preview__queue">
            {queue.slice(0, 3).map((item, index) => {
              const isActive = index === activeIndex;
              const actionLabel = getQueueActionLabel({ item, isActive, isPlaying });

              return (
                <div
                  key={item.id || `${item.title}-${index}`}
                  className={`creator-fan-preview__queue-row${
                    isBookPreviewItem(item) ? " creator-fan-preview__queue-row--book" : ""
                  }`}
                >
                  <button
                    type="button"
                    className={`creator-fan-preview__play-pill${isActive ? " is-active" : ""}`}
                    aria-label={
                      isBookPreviewItem(item) ? `${actionLabel} ${item.title}` : undefined
                    }
                    onClick={() => selectQueueItem(item, index)}
                  >
                    {actionLabel}
                  </button>
                  <div className="creator-fan-preview__queue-copy">
                    <strong>{item.title}</strong>
                    <span>{item.subtitle || data.creatorName}</span>
                  </div>
                  <div className="creator-fan-preview__queue-meta">
                    <small>{item.statusLabel}</small>
                    <button
                      type="button"
                      className="creator-fan-preview__mini-action"
                      onClick={() => openDetails(item)}
                    >
                      Open
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <section className="creator-fan-preview__support-card">
          <span>Workspace shortcuts</span>
          <strong>Upload and restore the public view</strong>
          <p>
            Music, podcast, and book uploads already feed this preview. Jump into
            any studio, publish, then reopen the live fan page.
          </p>
          <div className="creator-fan-preview__workspace-actions">
            {data.quickActions.map((action) => (
              <button
                key={action.key}
                type="button"
                className="creator-fan-preview__secondary-action"
                onClick={() => openPath(action.path)}
              >
                {action.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="creator-fan-preview__support-action"
            onClick={() => openPath("/creator/fan-page-view")}
          >
            Open full fan page view
          </button>
        </section>

        {["music", "books", "podcasts"].map((tabKey) => {
          const section = data.sections[tabKey];
          const sectionItem = section?.featured;
          const isCurrent = tabKey === activeTab;
          const modifier =
            tabKey === "books"
              ? " creator-fan-preview__mini-card--book"
              : tabKey === "podcasts"
                ? " creator-fan-preview__mini-card--podcast"
                : " creator-fan-preview__mini-card--video";

          return (
            <article
              key={tabKey}
              className={`creator-fan-preview__mini-card${modifier}`}
            >
              <div className="creator-fan-preview__mini-head">
                <div>
                  <span>{section?.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(tabKey);
                    setActiveIndex(0);
                  }}
                >
                  {isCurrent ? "Active" : "Open"}
                </button>
              </div>
              <div className="creator-fan-preview__mini-body">
                <FanPreviewImage
                  src={sectionItem?.imageUrl}
                  alt={sectionItem?.title || section?.label}
                  initials={initials}
                  className="creator-fan-preview__image--mini"
                />
                <div>
                  <strong>{sectionItem?.title || section?.label}</strong>
                  <p>{sectionItem?.subtitle || data.creatorName}</p>
                  <small>{sectionItem?.statusLabel}</small>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {currentItemIsBook ? (
        <CreatorBookWorkspacePanel
          item={currentItem}
          creatorName={data.creatorName}
          initials={initials}
          queueLength={queue.length}
          queueIndex={activeIndex}
          onPrevious={() => movePlayer(-1, false)}
          onNext={() => movePlayer(1, false)}
          onPreview={() => openPreview()}
          onDetails={() => openDetails()}
          onStudio={() => openPath(activeSection.uploadPath)}
          onEditedVersionUploaded={onBookVersionUploaded}
        />
      ) : (
        <div className="creator-fan-preview__player">
          <CreatorAudioPreviewPlayer
            item={currentItem}
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
            variant="workspace"
          />

          <div>
            <div className="creator-fan-preview__player-progress">
              <span style={{ width: progressWidth }} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
