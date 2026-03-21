import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

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
  return "Stream all";
};

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
}) {
  const navigate = useNavigate();
  const data = useMemo(
    () => previewData || buildCreatorFanPageData({ creatorProfile, dashboard }),
    [creatorProfile, dashboard, previewData]
  );
  const [activeTab, setActiveTab] = useState(
    resolveCreatorFanPageTabKey("music")
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setActiveTab(resolveCreatorFanPageTabKey("music"));
  }, [data.creatorName]);

  useEffect(() => {
    setActiveIndex(0);
    setIsPlaying(false);
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

  const openPath = (path = "", options = undefined) => {
    if (!path) {
      return;
    }
    navigate(path, options);
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

  const movePlayer = (direction = 1) => {
    if (!queue.length) {
      return;
    }
    setActiveIndex((current) => {
      const total = queue.length;
      return (current + direction + total) % total;
    });
    setIsPlaying(true);
  };

  return (
    <section className="creator-fan-page" aria-label="Fan Page View">
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

        <div className="creator-fan-page__search">Search Fan Page View</div>

        <div className="creator-fan-page__top-actions">
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
          <FanPageImage
            src={data.avatarUrl}
            alt={data.creatorName}
            initials={initials}
            className="creator-fan-page__image--avatar"
          />
        </div>
      </header>

      <div className="creator-fan-page__layout">
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
              onClick={() => openPublic(activeSection?.featured)}
            >
              Follow
            </button>
            <button
              type="button"
              className="creator-fan-page__button creator-fan-page__button--accent"
              onClick={() => openPublic(activeSection?.featured)}
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
                onClick={() => openPublic(activeSection?.featured)}
              >
                Follow
              </button>
              <button
                type="button"
                className="creator-fan-page__button creator-fan-page__button--light"
                onClick={() => openPublic(activeSection?.featured)}
              >
                Donate
              </button>
              <button
                type="button"
                className="creator-fan-page__button creator-fan-page__button--light"
                onClick={() => openPublic(activeSection?.featured)}
              >
                Subscribe
              </button>
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

              <article className="creator-fan-page__feature-release">
                <FanPageImage
                  src={currentItem?.imageUrl}
                  alt={currentItem?.title || activeSection?.label}
                  initials={initials}
                  className="creator-fan-page__image--release"
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
                    Preview
                  </button>
                  <button
                    type="button"
                    className="creator-fan-page__button creator-fan-page__button--accent"
                    onClick={() => openDetails()}
                  >
                    Open details
                  </button>
                  <button
                    type="button"
                    className="creator-fan-page__button creator-fan-page__button--ghost"
                    onClick={() => openPath(activeSection?.uploadPath)}
                  >
                    Open studio
                  </button>
                </div>
              </article>

              <div className="creator-fan-page__release-list">
                {queue.slice(0, 3).map((release, index) => (
                  <article key={release.id || `${release.title}-${index}`} className="creator-fan-page__release-row">
                    <span className="creator-fan-page__release-index">{index + 1}.</span>
                    <FanPageImage
                      src={release.imageUrl}
                      alt={release.title}
                      initials={initials}
                      className="creator-fan-page__image--row"
                    />
                    <div className="creator-fan-page__release-copy">
                      <strong>{release.title}</strong>
                      <span>{release.subtitle || data.creatorName}</span>
                    </div>
                    <small>{release.statusLabel}</small>
                    <small>{release.secondaryLine || release.duration || ""}</small>
                    <button
                      type="button"
                      className="creator-fan-page__button creator-fan-page__button--icon"
                      onClick={() => {
                        setActiveIndex(index);
                        setIsPlaying(true);
                      }}
                    >
                      Play
                    </button>
                  </article>
                ))}
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
        </main>

        <aside className="creator-fan-page__rail">
          <section className="creator-fan-page__support-card">
            <span>Unlock Exclusive Content</span>
            <h3>{formatCurrency(data.supportPrice)}/month</h3>
            <p>{data.supporterCopy}</p>
            <button
              type="button"
              className="creator-fan-page__button creator-fan-page__button--accent"
              onClick={() => openPublic(activeSection?.featured)}
            >
              Subscribe for {formatCurrency(data.supportPrice)}/month
            </button>
          </section>

          <section className="creator-fan-page__rail-card">
            <div className="creator-fan-page__panel-head">
              <div>
                <span>Platforms</span>
                <h3>Listen on YouTube / Spotify</h3>
              </div>
            </div>
            <div className="creator-fan-page__rail-actions">
              {data.platforms.map((platform) => (
                <button
                  key={platform.label}
                  type="button"
                  className={`creator-fan-page__platform-button creator-fan-page__platform-button--${platform.tone}`}
                  onClick={() => openPath(platform.path)}
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
                onClick={() => openPublic(data.book)}
              >
                Buy Now
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
        </aside>
      </div>

      <footer className="creator-fan-page__player">
        <div className="creator-fan-page__player-track">
          <FanPageImage
            src={currentItem?.imageUrl || data.music.coverUrl}
            alt={currentItem?.title || data.music.title}
            initials={initials}
            className="creator-fan-page__image--player"
          />
          <div>
            <strong>{currentItem?.title || data.music.title}</strong>
            <span>{currentItem?.subtitle || data.music.subtitle}</span>
          </div>
        </div>

        <div className="creator-fan-page__player-controls" aria-hidden="true">
          <button
            type="button"
            className="creator-fan-page__button creator-fan-page__button--icon"
            onClick={() => movePlayer(-1)}
          >
            Back
          </button>
          <button
            type="button"
            className="creator-fan-page__button creator-fan-page__button--accent"
            onClick={() => setIsPlaying((current) => !current)}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            className="creator-fan-page__button creator-fan-page__button--icon"
            onClick={() => movePlayer(1)}
          >
            Next
          </button>
        </div>

        <div className="creator-fan-page__player-meta">
          <span>{currentItem?.statusLabel || data.music.queueCount}</span>
          <span>{currentItem?.secondaryLine || currentItem?.duration || ""}</span>
          <span>{currentItem?.metricLabel ? `${currentItem.metricValue || 0} ${currentItem.metricLabel}` : "Ready"}</span>
          <strong>{formatCurrency(currentItem?.price || 0)}</strong>
        </div>
      </footer>
    </section>
  );
}
