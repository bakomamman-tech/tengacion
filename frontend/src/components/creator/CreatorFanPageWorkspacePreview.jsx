import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import CreatorAudioPreviewPlayer from "./CreatorAudioPreviewPlayer";
import { formatCurrency } from "./creatorConfig";
import {
  buildCreatorFanPageData,
  formatCreatorFanPageFollowerCount,
  getCreatorFanPageInitials,
  resolveCreatorFanPageTabKey,
} from "./creatorFanPageData";

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

export default function CreatorFanPageWorkspacePreview({
  creatorProfile,
  dashboard,
  currentCategoryKey = "music",
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

  const movePlayer = (direction = 1) => {
    if (!queue.length) {
      return;
    }

    setActiveIndex((current) => {
      const total = queue.length;
      return (current + direction + total) % total;
    });
    setAutoplayRequest((current) => current + 1);
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
        <article className="creator-fan-preview__music-card">
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
              className="creator-fan-preview__image--tile"
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
            {queue.slice(0, 3).map((item, index) => (
              <div key={item.id || `${item.title}-${index}`} className="creator-fan-preview__queue-row">
                <button
                  type="button"
                  className={`creator-fan-preview__play-pill${index === activeIndex ? " is-active" : ""}`}
                  onClick={() => {
                    setActiveIndex(index);
                    setAutoplayRequest((current) => current + 1);
                  }}
                >
                  {index === activeIndex && isPlaying ? "Playing" : "Play"}
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
            ))}
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

      <div className="creator-fan-preview__player">
        <CreatorAudioPreviewPlayer
          item={currentItem}
          creatorName={data.creatorName}
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
    </section>
  );
}
