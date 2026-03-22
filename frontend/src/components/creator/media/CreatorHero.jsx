import ShareActions from "./ShareActions";

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
            <div className="creator-public-hero__meta">
              <span>{Number(stats?.followersCount || 0).toLocaleString()} followers</span>
              <span>{Number(stats?.totalPlays || 0).toLocaleString()} plays</span>
              <span>{Number(stats?.totalSales || 0).toLocaleString()} sales</span>
            </div>
          </div>
        </div>

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
            url={`${window.location.origin}/creators/${creator.id}`}
          />
        </div>
      </div>
    </section>
  );
}
