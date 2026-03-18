import { Link } from "react-router-dom";

import { resolveImage } from "../../api";
import {
  formatCreatorLaneLabel,
  formatCurrency,
  normalizeCreatorLaneKeys,
} from "./creatorConfig";

const pickPrimaryItem = (items = []) =>
  Array.isArray(items) && items.length ? items[0] : null;

const padNumber = (value) => String(value || 0).padStart(2, "0");

const formatFollowerCount = (value = 0) =>
  Number(value || 0).toLocaleString("en-US");

const formatDuration = (seconds = 0) => {
  const totalSeconds = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${padNumber(remainingSeconds)}`;
};

const fallbackImage = (source = "") => resolveImage(source || "") || "";

const buildReleaseRows = ({ entries = [], creatorName, fallbackImageUrl }) => {
  const fallbackRows = [
    {
      title: "Lost in Thought",
      subtitle: creatorName,
      listens: 482,
      duration: "2:30",
      imageUrl: fallbackImageUrl,
    },
    {
      title: "Rainy Night",
      subtitle: creatorName,
      listens: 482,
      duration: "3:32",
      imageUrl: fallbackImageUrl,
    },
    {
      title: "Endless Dream",
      subtitle: creatorName,
      listens: 482,
      duration: "2:35",
      imageUrl: fallbackImageUrl,
    },
  ];

  const mappedEntries = entries.map((entry, index) => ({
    title: entry?.title || fallbackRows[index]?.title || `Release ${index + 1}`,
    subtitle: entry?.artistName || entry?.authorName || creatorName,
    listens: Number(entry?.streams || entry?.plays || entry?.listens || fallbackRows[index]?.listens || 482),
    duration:
      entry?.durationSec
        ? formatDuration(entry.durationSec)
        : fallbackRows[index]?.duration || "3:12",
    imageUrl:
      fallbackImage(entry?.coverImageUrl) ||
      fallbackImage(entry?.thumbnailUrl) ||
      fallbackRows[index]?.imageUrl ||
      fallbackImageUrl,
  }));

  return [...mappedEntries, ...fallbackRows.slice(mappedEntries.length)].slice(0, 3);
};

const buildMockPreviewData = ({ creatorProfile, dashboard }) => {
  const creatorName =
    creatorProfile?.displayName ||
    creatorProfile?.fullName ||
    "Stephen Daniel Kurah";
  const creatorLanes = normalizeCreatorLaneKeys(creatorProfile?.creatorTypes)
    .map((entry) => formatCreatorLaneLabel(entry))
    .filter(Boolean);
  const musicContent = dashboard?.content?.music || {};
  const bookContent = dashboard?.content?.books || {};
  const podcastContent = dashboard?.content?.podcasts || {};
  const trackEntries = [
    ...(Array.isArray(musicContent.tracks) ? musicContent.tracks : []),
    ...(Array.isArray(musicContent.albums) ? musicContent.albums : []),
  ];
  const videoEntries = Array.isArray(musicContent.videos) ? musicContent.videos : [];
  const bookEntries = Array.isArray(bookContent.items) ? bookContent.items : [];
  const podcastEntries = Array.isArray(podcastContent.episodes)
    ? podcastContent.episodes
    : [];

  const primaryTrack = pickPrimaryItem(trackEntries);
  const primaryBook = pickPrimaryItem(bookEntries);
  const primaryPodcast = pickPrimaryItem(podcastEntries);
  const primaryVideo = pickPrimaryItem(videoEntries);

  const avatarUrl =
    fallbackImage(creatorProfile?.user?.avatar) ||
    fallbackImage(creatorProfile?.coverImageUrl) ||
    fallbackImage(primaryTrack?.coverImageUrl) ||
    "";
  const heroUrl =
    fallbackImage(creatorProfile?.coverImageUrl) ||
    fallbackImage(primaryTrack?.coverImageUrl) ||
    fallbackImage(primaryVideo?.thumbnailUrl) ||
    avatarUrl;

  const featuredMusicTitle = primaryTrack?.title || "Living in the Moment";
  const featuredMusicPrice = Number(primaryTrack?.price ?? 500);
  const featuredMusicImage =
    fallbackImage(primaryTrack?.coverImageUrl) || heroUrl || avatarUrl;

  return {
    creatorName,
    avatarUrl,
    heroUrl,
    followers: Number(
      creatorProfile?.user?.followersCount ||
        creatorProfile?.followersCount ||
        1532
    ),
    tagline:
      creatorProfile?.bio ||
      "A premium fan page where supporters can stream, preview, buy, and unlock every drop in one place.",
    lanes: creatorLanes.length
      ? creatorLanes
      : ["Music", "Podcasts", "Book Publishing"],
    supportPrice: Number(creatorProfile?.subscriptionPrice ?? 500),
    tabs: ["Overview", "Music", "Books", "Podcasts", "Videos"],
    sidebarLinks: ["Overview", "Music", "Books", "Podcasts", "Videos", "Downloads"],
    stats: [
      {
        label: "Tracks",
        value:
          dashboard?.categories?.music?.uploads ||
          trackEntries.length ||
          12,
      },
      {
        label: "Books",
        value:
          dashboard?.categories?.bookPublishing?.uploads ||
          bookEntries.length ||
          2,
      },
      {
        label: "Episodes",
        value:
          dashboard?.categories?.podcast?.uploads ||
          podcastEntries.length ||
          5,
      },
      {
        label: "Videos",
        value: videoEntries.length || 3,
      },
    ],
    music: {
      title: featuredMusicTitle,
      subtitle: primaryTrack?.artistName || creatorName,
      releaseType:
        primaryTrack?.releaseType ||
        primaryTrack?.contentType ||
        "Single",
      genre:
        primaryTrack?.genre ||
        creatorProfile?.genres?.[0] ||
        "Afrobeat",
      duration:
        primaryTrack?.durationSec
          ? formatDuration(primaryTrack.durationSec)
          : "3:58",
      price: featuredMusicPrice,
      coverUrl: featuredMusicImage,
      queueCount: "1.201",
      listeners: 201,
    },
    popularReleases: buildReleaseRows({
      entries: trackEntries,
      creatorName,
      fallbackImageUrl: featuredMusicImage,
    }),
    book: {
      title: primaryBook?.title || "Untitled book",
      author: primaryBook?.authorName || creatorName,
      imprint: primaryBook?.genre || "Attobeat",
      price: Number(primaryBook?.price ?? 2500),
      coverUrl:
        fallbackImage(primaryBook?.coverImageUrl) ||
        fallbackImage(primaryBook?.thumbnailUrl) ||
        heroUrl ||
        avatarUrl,
    },
    podcast: {
      title: primaryPodcast?.title || "Studio Notes: The Long Game",
      series:
        primaryPodcast?.podcastSeries ||
        creatorProfile?.podcastsProfile?.seriesTitle ||
        "Creator Sessions",
      summary:
        primaryPodcast?.description ||
        "Listen to premium conversations, behind-the-scenes notes, and featured audio drops.",
      coverUrl:
        fallbackImage(primaryPodcast?.coverImageUrl) ||
        heroUrl ||
        avatarUrl,
      duration:
        primaryPodcast?.durationSec
          ? formatDuration(primaryPodcast.durationSec)
          : "41:08",
    },
    video: {
      title: primaryVideo?.title || "Golden Hour Session",
      channel: creatorName,
      summary:
        primaryVideo?.description ||
        "Watch premium live sessions, visual stories, and YouTube-ready drops from the creator studio.",
      thumbnailUrl:
        fallbackImage(primaryVideo?.thumbnailUrl) ||
        fallbackImage(primaryVideo?.coverImageUrl) ||
        heroUrl ||
        avatarUrl,
    },
    platforms: [
      { label: "Play on YouTube", tone: "dark" },
      { label: "Play on Spotify", tone: "green" },
    ],
    supporterCopy:
      "Supporters unlock exclusive drops, premium downloads, and direct support access from the public page.",
    rewardsCopy: "Weekly rewards land here for top supporters and subscribers.",
  };
};

function getInitials(label = "") {
  return String(label || "Creator")
    .split(/\s+/)
    .slice(0, 2)
    .map((entry) => entry[0] || "")
    .join("")
    .toUpperCase();
}

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
  const data = previewData || buildMockPreviewData({ creatorProfile, dashboard });
  const initials = getInitials(data.creatorName);
  const heroStyle = data.heroUrl
    ? {
        backgroundImage: `linear-gradient(135deg, rgba(19, 24, 20, 0.88), rgba(35, 41, 33, 0.72)), url("${data.heroUrl}")`,
      }
    : undefined;

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
          <button type="button" className="creator-fan-page__top-pill">
            Inbox
          </button>
          <button type="button" className="creator-fan-page__top-pill">
            Alerts
          </button>
          <button type="button" className="creator-fan-page__top-pill">
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
            <button type="button" className="creator-fan-page__button creator-fan-page__button--light">
              Follow
            </button>
            <button type="button" className="creator-fan-page__button creator-fan-page__button--accent">
              Donate
            </button>
          </div>

          <nav className="creator-fan-page__sidebar-nav" aria-label="Fan page sections">
            {data.sidebarLinks.map((item, index) => (
              <button
                key={item}
                type="button"
                className={`creator-fan-page__nav-link${index === 0 ? " is-active" : ""}`}
              >
                {item}
              </button>
            ))}
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
              {formatFollowerCount(data.followers)} followers
              {data.lanes.length ? ` / ${data.lanes.join(" / ")}` : ""}
            </p>

            <div className="creator-fan-page__button-row">
              <button type="button" className="creator-fan-page__button creator-fan-page__button--accent">
                Follow
              </button>
              <button type="button" className="creator-fan-page__button creator-fan-page__button--light">
                Donate
              </button>
              <button type="button" className="creator-fan-page__button creator-fan-page__button--light">
                Subscribe
              </button>
            </div>

            <div className="creator-fan-page__tabs" role="tablist" aria-label="Fan page tabs">
              {data.tabs.map((tab, index) => (
                <button
                  key={tab}
                  type="button"
                  className={`creator-fan-page__tab${index === 1 ? " is-active" : ""}`}
                  role="tab"
                  aria-selected={index === 1}
                >
                  {tab}
                </button>
              ))}
            </div>
          </section>

          <div className="creator-fan-page__content-grid">
            <section className="creator-fan-page__panel creator-fan-page__panel--releases">
              <div className="creator-fan-page__panel-head">
                <div>
                  <span>Music</span>
                  <h3>Popular Releases</h3>
                </div>
                <button type="button" className="creator-fan-page__button creator-fan-page__button--ghost">
                  Stream all
                </button>
              </div>

              <article className="creator-fan-page__feature-release">
                <FanPageImage
                  src={data.music.coverUrl}
                  alt={data.music.title}
                  initials={initials}
                  className="creator-fan-page__image--release"
                />

                <div className="creator-fan-page__feature-copy">
                  <span className="creator-fan-page__pill">
                    {String(data.music.releaseType || "Single").toUpperCase()}
                  </span>
                  <h4>{data.music.title}</h4>
                  <p>{data.music.subtitle}</p>

                  <div className="creator-fan-page__meta-row">
                    <span>{data.music.genre}</span>
                    <span>{data.music.duration}</span>
                    <span>{formatCurrency(data.music.price)}</span>
                  </div>
                </div>

                <div className="creator-fan-page__feature-actions">
                  <button type="button" className="creator-fan-page__button creator-fan-page__button--light">
                    Preview
                  </button>
                  <button type="button" className="creator-fan-page__button creator-fan-page__button--accent">
                    Buy
                  </button>
                  <button type="button" className="creator-fan-page__button creator-fan-page__button--ghost">
                    Download
                  </button>
                </div>
              </article>

              <div className="creator-fan-page__release-list">
                {data.popularReleases.map((release, index) => (
                  <article key={`${release.title}-${index}`} className="creator-fan-page__release-row">
                    <span className="creator-fan-page__release-index">{index + 1}.</span>
                    <FanPageImage
                      src={release.imageUrl}
                      alt={release.title}
                      initials={initials}
                      className="creator-fan-page__image--row"
                    />
                    <div className="creator-fan-page__release-copy">
                      <strong>{release.title}</strong>
                      <span>{release.subtitle}</span>
                    </div>
                    <small>{release.listens} saves</small>
                    <small>{release.duration}</small>
                    <button type="button" className="creator-fan-page__button creator-fan-page__button--icon">
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
                <button type="button" className="creator-fan-page__button creator-fan-page__button--ghost">
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
                  <small>{data.podcast.duration}</small>
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
                <button type="button" className="creator-fan-page__button creator-fan-page__button--ghost">
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
                  <small>YouTube premiere ready</small>
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
            <button type="button" className="creator-fan-page__button creator-fan-page__button--accent">
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
              <button type="button" className="creator-fan-page__button creator-fan-page__button--accent">
                Buy Now
              </button>
              <button type="button" className="creator-fan-page__button creator-fan-page__button--light">
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
            src={data.music.coverUrl}
            alt={data.music.title}
            initials={initials}
            className="creator-fan-page__image--player"
          />
          <div>
            <strong>{data.music.title}</strong>
            <span>{data.music.subtitle}</span>
          </div>
        </div>

        <div className="creator-fan-page__player-controls" aria-hidden="true">
          <button type="button" className="creator-fan-page__button creator-fan-page__button--icon">
            Back
          </button>
          <button type="button" className="creator-fan-page__button creator-fan-page__button--accent">
            Play
          </button>
          <button type="button" className="creator-fan-page__button creator-fan-page__button--icon">
            Next
          </button>
        </div>

        <div className="creator-fan-page__player-meta">
          <span>{data.music.queueCount}</span>
          <span>{data.music.duration}</span>
          <span>Download</span>
          <strong>{formatCurrency(data.music.price)}</strong>
        </div>
      </footer>
    </section>
  );
}
