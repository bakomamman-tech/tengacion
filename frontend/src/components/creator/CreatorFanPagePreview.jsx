import { resolveImage } from "../../api";
import {
  formatCreatorLaneLabel,
  formatCurrency,
  normalizeCreatorLaneKeys,
} from "./creatorConfig";

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=320&q=80";

const fallbackImage = (source = "") => resolveImage(source || "") || "";

const formatFollowerCount = (value = 0) => Number(value || 0).toLocaleString("en-US");

const pickPrimaryItem = (items = []) =>
  Array.isArray(items) && items.length ? items[0] : null;

const buildMockPreviewData = ({ creatorProfile, dashboard }) => {
  const creatorName =
    creatorProfile?.displayName || creatorProfile?.fullName || "Creator";
  const avatarUrl =
    fallbackImage(creatorProfile?.user?.avatar)
    || fallbackImage(creatorProfile?.coverImageUrl)
    || DEFAULT_AVATAR;
  const creatorLanes = normalizeCreatorLaneKeys(creatorProfile?.creatorTypes)
    .map((entry) => formatCreatorLaneLabel(entry))
    .filter(Boolean);
  const musicEntry =
    pickPrimaryItem(dashboard?.content?.music?.tracks)
    || pickPrimaryItem(dashboard?.content?.music?.albums);
  const bookEntry = pickPrimaryItem(dashboard?.content?.books?.items);
  const podcastEntry = pickPrimaryItem(dashboard?.content?.podcasts?.episodes);
  const videoEntry = pickPrimaryItem(dashboard?.content?.music?.videos);

  return {
    creatorName,
    avatarUrl,
    followers: Number(
      creatorProfile?.user?.followersCount
      || creatorProfile?.followersCount
      || 1532
    ),
    lanes: creatorLanes,
    supportPrice: 500,
    tabs: ["Overview", "Music", "Books", "Podcasts", "Videos"],
    music: {
      title: musicEntry?.title || "Living in the Moment",
      subtitle:
        musicEntry?.artistName
        || creatorName,
      genre:
        musicEntry?.genre
        || creatorProfile?.genres?.[0]
        || "Afro Soul",
      price: Number(musicEntry?.price ?? 500),
      coverUrl:
        fallbackImage(musicEntry?.coverImageUrl)
        || fallbackImage(creatorProfile?.coverImageUrl)
        || DEFAULT_AVATAR,
      previewLabel: "Preview",
      platformLabels: ["Spotify", "YouTube"],
    },
    book: {
      title: bookEntry?.title || "Untitled book",
      author: bookEntry?.authorName || creatorName,
      price: Number(bookEntry?.price ?? 2500),
      coverUrl:
        fallbackImage(bookEntry?.coverImageUrl)
        || fallbackImage(creatorProfile?.coverImageUrl)
        || DEFAULT_AVATAR,
      cta: "Buy / Preview",
    },
    podcast: {
      title: podcastEntry?.title || "Studio Notes: The Long Game",
      series:
        podcastEntry?.podcastSeries
        || creatorProfile?.podcastsProfile?.seriesTitle
        || "Creator Sessions",
      artUrl:
        fallbackImage(podcastEntry?.coverImageUrl)
        || fallbackImage(creatorProfile?.coverImageUrl)
        || DEFAULT_AVATAR,
      cta: "Listen now",
    },
    video: {
      title: videoEntry?.title || "Golden Hour Session",
      channel: creatorName,
      thumbnailUrl:
        fallbackImage(videoEntry?.coverImageUrl)
        || fallbackImage(creatorProfile?.coverImageUrl)
        || DEFAULT_AVATAR,
      cta: "Watch on YouTube",
    },
  };
};

function PreviewImage({ src, alt, initials, variant = "default" }) {
  if (src) {
    return (
      <div className={`creator-fan-preview__image creator-fan-preview__image--${variant}`}>
        <img src={src} alt={alt} />
      </div>
    );
  }

  return (
    <div className={`creator-fan-preview__image creator-fan-preview__image--${variant}`}>
      <span>{initials}</span>
    </div>
  );
}

export default function CreatorFanPagePreview({
  creatorProfile,
  dashboard,
  previewData,
}) {
  const data = previewData || buildMockPreviewData({ creatorProfile, dashboard });
  const initials = String(data.creatorName || "C")
    .split(/\s+/)
    .slice(0, 2)
    .map((entry) => entry[0] || "")
    .join("")
    .toUpperCase();

  return (
    <section className="creator-fan-preview" aria-label="Fan Page View">
      <div className="creator-fan-preview__chrome">
        <span className="creator-fan-preview__chip">Fan Page View</span>
        <div className="creator-fan-preview__chrome-lights" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="creator-fan-preview__hero">
        <PreviewImage
          src={data.avatarUrl}
          alt={data.creatorName}
          initials={initials}
          variant="hero"
        />

        <div className="creator-fan-preview__hero-copy">
          <span className="creator-fan-preview__eyebrow">Public preview</span>
          <strong>{data.creatorName}</strong>
          <p>
            {formatFollowerCount(data.followers)} followers
            {data.lanes.length ? ` • ${data.lanes.join(" • ")}` : ""}
          </p>

          <div className="creator-fan-preview__hero-actions">
            <button type="button" className="creator-fan-preview__primary-action">
              Follow
            </button>
            <button type="button" className="creator-fan-preview__secondary-action">
              Donate
            </button>
            <button type="button" className="creator-fan-preview__secondary-action">
              Subscribe
            </button>
          </div>
        </div>
      </div>

      <div className="creator-fan-preview__tabs" role="tablist" aria-label="Fan page sections">
        {data.tabs.map((tab, index) => (
          <button
            key={tab}
            type="button"
            className={`creator-fan-preview__tab${index === 0 ? " is-active" : ""}`}
            role="tab"
            aria-selected={index === 0}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="creator-fan-preview__grid">
        <article className="creator-fan-preview__music-card">
          <div className="creator-fan-preview__section-head">
            <div>
              <span>Music</span>
              <strong>Featured release</strong>
            </div>
            <button type="button" className="creator-fan-preview__play-pill">
              Play
            </button>
          </div>

          <div className="creator-fan-preview__feature-row">
            <PreviewImage
              src={data.music.coverUrl}
              alt={data.music.title}
              initials={initials}
              variant="tile"
            />

            <div className="creator-fan-preview__feature-copy">
              <strong>{data.music.title}</strong>
              <p>{data.music.subtitle}</p>

              <div className="creator-fan-preview__meta-row">
                <span>{data.music.genre}</span>
                <span>{formatCurrency(data.music.price)}</span>
                <span>Download enabled</span>
              </div>

              <div className="creator-fan-preview__action-row">
                <button type="button" className="creator-fan-preview__pill">
                  {data.music.previewLabel}
                </button>
                <button type="button" className="creator-fan-preview__pill">
                  Buy
                </button>
                <button type="button" className="creator-fan-preview__pill">
                  Download
                </button>
              </div>

              <div className="creator-fan-preview__platform-row">
                {data.music.platformLabels.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="creator-fan-preview__platform-pill"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="creator-fan-preview__trackline">
            <span />
            <span />
            <span />
          </div>
        </article>

        <article className="creator-fan-preview__support-card">
          <span>Supporters Club</span>
          <strong>{formatCurrency(data.supportPrice)}/month</strong>
          <p>
            Fans unlock exclusive drops, premium downloads, and direct support
            access from the public page.
          </p>
          <button type="button" className="creator-fan-preview__support-action">
            Support / Donate
          </button>
        </article>

        <article className="creator-fan-preview__mini-card creator-fan-preview__mini-card--book">
          <div className="creator-fan-preview__mini-head">
            <span>Books</span>
            <button type="button">Preview</button>
          </div>
          <div className="creator-fan-preview__mini-body">
            <PreviewImage
              src={data.book.coverUrl}
              alt={data.book.title}
              initials={initials}
              variant="mini"
            />
            <div>
              <strong>{data.book.title}</strong>
              <p>{data.book.author}</p>
              <small>{formatCurrency(data.book.price)} • {data.book.cta}</small>
            </div>
          </div>
        </article>

        <article className="creator-fan-preview__mini-card creator-fan-preview__mini-card--podcast">
          <div className="creator-fan-preview__mini-head">
            <span>Podcasts</span>
            <button type="button">Listen</button>
          </div>
          <div className="creator-fan-preview__mini-body">
            <PreviewImage
              src={data.podcast.artUrl}
              alt={data.podcast.title}
              initials={initials}
              variant="mini"
            />
            <div>
              <strong>{data.podcast.title}</strong>
              <p>{data.podcast.series}</p>
              <small>{data.podcast.cta}</small>
            </div>
          </div>
        </article>

        <article className="creator-fan-preview__mini-card creator-fan-preview__mini-card--video">
          <div className="creator-fan-preview__mini-head">
            <span>Videos</span>
            <button type="button">YouTube</button>
          </div>
          <div className="creator-fan-preview__mini-body">
            <PreviewImage
              src={data.video.thumbnailUrl}
              alt={data.video.title}
              initials={initials}
              variant="mini"
            />
            <div>
              <strong>{data.video.title}</strong>
              <p>{data.video.channel}</p>
              <small>{data.video.cta}</small>
            </div>
          </div>
        </article>
      </div>

      <div className="creator-fan-preview__player">
        <div className="creator-fan-preview__player-track">
          <strong>{data.music.title}</strong>
          <span>{data.music.subtitle}</span>
        </div>

        <div className="creator-fan-preview__player-controls" aria-hidden="true">
          <button type="button">◀</button>
          <button type="button" className="is-active">
            ▶
          </button>
          <button type="button">▶</button>
        </div>

        <div className="creator-fan-preview__player-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    </section>
  );
}
