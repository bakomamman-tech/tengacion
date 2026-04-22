import ShareActions from "./ShareActions";
import { buildCreatorPublicPath } from "../../../lib/publicRoutes";

const normalizeExternalUrl = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  if (
    /^(www\.|open\.spotify\.com|spotify\.com|youtube\.com|www\.youtube\.com|m\.youtube\.com|youtu\.be)/i.test(
      normalized
    )
  ) {
    return `https://${normalized}`;
  }
  return normalized;
};

const resolveLinkUrl = (links = [], label = "") =>
  normalizeExternalUrl(
    String(
      (Array.isArray(links)
        ? links.find((entry) =>
            String(entry?.label || "").trim().toLowerCase().includes(String(label || "").trim().toLowerCase())
          )
        : null)?.url || ""
    ).trim()
  );

const formatCreatorTypeLabel = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "bookpublishing") {
    return "Books";
  }
  if (normalized === "podcast") {
    return "Podcasts";
  }
  if (normalized === "music") {
    return "Music";
  }
  return "";
};

export default function CreatorHero({
  creator,
  stats,
  isOwner = false,
  isFollowing = false,
  onFollow,
  onSubscribe,
  onOpenStudio,
  subscriptionLabel = "Subscribe",
}) {
  if (!creator) {
    return null;
  }

  const creatorLinks = Array.isArray(creator.links) ? creator.links : [];
  const creatorPublicPath = buildCreatorPublicPath({
    creatorId: creator.id,
    username: creator.username,
  });
  const creatorSignals = [
    ...(Array.isArray(creator.creatorTypes)
      ? creator.creatorTypes.map((entry) => formatCreatorTypeLabel(entry)).filter(Boolean)
      : []),
    creator.location || "",
  ].filter(Boolean);
  const streamLinks = [
    {
      label: "Stream on Spotify",
      tone: "spotify",
      href: resolveLinkUrl(creatorLinks, "spotify"),
    },
    {
      label: "Stream on Youtube",
      tone: "youtube",
      href: resolveLinkUrl(creatorLinks, "youtube"),
    },
  ].filter((entry) => Boolean(entry.href));

  return (
    <section
      className="creator-public-hero"
      style={{
        "--creator-public-banner": creator.bannerUrl ? `url(${creator.bannerUrl})` : "none",
      }}
    >
      <div className="creator-public-hero__veil" />
      <div className="creator-public-hero__content">
        <div className="creator-public-hero__identity">
          <div className="creator-public-hero__avatar">
            {creator.avatarUrl ? <img src={creator.avatarUrl} alt={creator.displayName} /> : <span>{creator.displayName?.slice(0, 1) || "T"}</span>}
          </div>
          <div>
            <p className="creator-public-hero__eyebrow">Tengacion Creator Studio</p>
            <h1>{creator.displayName}</h1>
            <p className="creator-public-hero__tagline">{creator.tagline || creator.bio || "A premium creator hub on Tengacion."}</p>
            {creatorSignals.length ? (
              <div className="creator-public-hero__meta">
                {creatorSignals.map((entry) => (
                  <span key={entry}>{entry}</span>
                ))}
              </div>
            ) : null}
            <div className="creator-public-hero__meta">
              <span>{Number(stats?.followersCount || 0).toLocaleString()} followers</span>
              <span>{Number(stats?.totalPlays || 0).toLocaleString()} plays</span>
              <span>{Number(stats?.totalSales || 0).toLocaleString()} sales</span>
            </div>
          </div>
        </div>

        <div className="creator-public-hero__action-stack">
          <div className="creator-public-hero__actions">
            {isOwner ? (
              <button type="button" className="creator-primary-btn" onClick={onOpenStudio}>
                Open Creator Studio
              </button>
            ) : (
              <>
                <button type="button" className="creator-primary-btn" onClick={onFollow}>
                  {isFollowing ? "Following" : "Follow creator"}
                </button>
                <button type="button" className="creator-secondary-btn" onClick={onSubscribe}>
                  {subscriptionLabel}
                </button>
              </>
            )}
            <ShareActions
              className="creator-secondary-btn"
              title={creator.displayName}
              text="Visit this Tengacion creator page."
              url={`${window.location.origin}${creatorPublicPath}`}
            />
          </div>

          {streamLinks.length ? (
            <div className="creator-public-hero__stream-links" aria-label="Streaming links">
              {streamLinks.map((entry) => (
                <a
                  key={entry.label}
                  className={`creator-public-hero__stream-link creator-public-hero__stream-link--${entry.tone}`}
                  href={entry.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {entry.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
