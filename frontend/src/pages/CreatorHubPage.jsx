import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import {
  createCheckout,
  getDownloadUrl,
  getPublicCreatorProfile,
  getStreamUrl,
  resolveImage,
  toggleFollowCreator,
} from "../api";
import CreatorHero from "../components/creator/media/CreatorHero";
import CreatorContentShelf from "../components/creator/media/CreatorContentShelf";
import { useAuth } from "../context/AuthContext";
import useEntitlementSocket from "../hooks/useEntitlementSocket";
import "./creator-public.css";

const PUBLIC_TABS = [
  { key: "home", label: "Home", suffix: "" },
  { key: "music", label: "Music", suffix: "/music" },
  { key: "albums", label: "Albums", suffix: "/albums" },
  { key: "podcasts", label: "Podcasts", suffix: "/podcasts" },
  { key: "books", label: "Books", suffix: "/books" },
];

const formatMoney = (value = 0) =>
  Number(value || 0) <= 0 ? "Free" : `NGN ${Number(value || 0).toLocaleString()}`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const resolveTab = (pathname = "") => {
  const lowerPath = String(pathname || "").toLowerCase();
  const match = PUBLIC_TABS.find((tab) => tab.suffix && lowerPath.endsWith(tab.suffix));
  return match?.key || "home";
};

const normalizePreviewPayload = ({
  item,
  src,
  mode = "preview",
  streamPayload = null,
}) => {
  const defaultPreviewLimitSec =
    item.itemType === "track" || item.itemType === "podcast" ? 30 : 0;
  const previewStartSec = Math.max(
    0,
    Number(streamPayload?.previewStartSec ?? item.previewStartSec ?? 0)
  );
  const previewLimitSec = Math.max(
    0,
    Number(
      streamPayload?.previewLimitSec ??
        item.previewLimitSec ??
        defaultPreviewLimitSec
    )
  );
  const previewOnly =
    Boolean(streamPayload?.previewOnly) ||
    Boolean(
      mode === "stream"
        && item.mediaType === "audio"
        && !item.canAccessFull
        && previewLimitSec > 0
    );

  return {
    id: item.id,
    kind: item.mediaType,
    title: item.title,
    subtitle: item.subtitle || "",
    artwork: item.coverUrl || "",
    src,
    mode,
    durationSec: Number(item.durationSec || 0),
    previewStartSec,
    previewLimitSec,
    enforcePreviewWindow:
      item.mediaType === "audio"
      && previewLimitSec > 0
      && (mode === "preview" || previewOnly),
  };
};

function CreatorPublicAudioPreview({ preview }) {
  const audioRef = useRef(null);

  const resolvePreviewEnd = (audio) => {
    const previewEndSec =
      Number(preview?.previewStartSec || 0) +
      Number(preview?.previewLimitSec || 0);

    return Math.min(
      Number(audio?.duration || previewEndSec || 0) || previewEndSec,
      previewEndSec
    );
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.pause();
  }, [preview?.id, preview?.src, preview?.mode]);

  const handleLoadedMetadata = (event) => {
    if (!preview?.enforcePreviewWindow) {
      return;
    }

    const boundedStart = clamp(
      Number(preview.previewStartSec || 0),
      0,
      Number(event.currentTarget.duration || preview.previewStartSec || 0)
        || Number(preview.previewStartSec || 0)
    );
    event.currentTarget.currentTime = boundedStart;
  };

  const handleTimeUpdate = (event) => {
    if (!preview?.enforcePreviewWindow) {
      return;
    }

    const boundedEnd = resolvePreviewEnd(event.currentTarget);

    if (event.currentTarget.currentTime >= boundedEnd) {
      event.currentTarget.pause();
      event.currentTarget.currentTime = boundedEnd;
    }
  };

  const handleSeeking = (event) => {
    if (!preview?.enforcePreviewWindow) {
      return;
    }

    const boundedEnd = resolvePreviewEnd(event.currentTarget);
    const previewStartSec = Number(preview.previewStartSec || 0);

    if (event.currentTarget.currentTime < previewStartSec) {
      event.currentTarget.currentTime = previewStartSec;
      return;
    }

    if (event.currentTarget.currentTime > boundedEnd) {
      event.currentTarget.currentTime = boundedEnd;
    }
  };

  const handlePlay = (event) => {
    if (!preview?.enforcePreviewWindow) {
      return;
    }

    const previewStartSec = Number(preview.previewStartSec || 0);
    const boundedEnd = resolvePreviewEnd(event.currentTarget);

    if (
      event.currentTarget.currentTime < previewStartSec
      || event.currentTarget.currentTime >= Math.max(boundedEnd - 0.1, previewStartSec)
    ) {
      event.currentTarget.currentTime = previewStartSec;
    }
  };

  return (
    <div className="creator-public-preview__audio">
      <img
        src={resolveImage(preview?.artwork) || "/avatar.png"}
        alt={preview?.title}
      />
      <div className="creator-public-preview__audio-copy">
        <audio
          ref={audioRef}
          className="creator-public-preview__player"
          controls
          src={preview?.src}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onSeeking={handleSeeking}
          onTimeUpdate={handleTimeUpdate}
        />
        <small>
          {preview?.enforcePreviewWindow
            ? preview?.previewStartSec > 0
              ? "This sample jumps to the selected chorus and stops after 30 seconds."
              : "This sample stops after 30 seconds."
            : "Full playback is available for this release."}
        </small>
      </div>
    </div>
  );
}

export default function CreatorHubPage() {
  const { creatorId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [activePreview, setActivePreview] = useState(null);
  const [followBusy, setFollowBusy] = useState(false);

  const activeTab = useMemo(() => resolveTab(location.pathname), [location.pathname]);
  const requestedPreviewId = useMemo(() => new URLSearchParams(location.search).get("previewItem") || "", [location.search]);
  const isLoggedIn = Boolean(user?._id || user?.id);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getPublicCreatorProfile(creatorId);
        if (!cancelled) {
          setPayload(response || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to load this creator page.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  const creator = payload?.creator || null;
  const music = payload?.music || { tracks: [], albums: [], videos: [] };
  const podcasts = payload?.podcasts || { series: {}, episodes: [] };
  const books = Array.isArray(payload?.books) ? payload.books : [];
  const featured = payload?.featured || null;
  const viewer = payload?.viewer || {};
  const subscription = payload?.subscription || {};

  const requireViewer = () => {
    if (isLoggedIn) {
      return true;
    }
    const returnTo = `${location.pathname}${location.search}`;
    navigate(`/?returnTo=${encodeURIComponent(returnTo)}`);
    return false;
  };

  const refreshPublicProfile = useCallback(async () => {
    const nextPayload = await getPublicCreatorProfile(creatorId);
    setPayload(nextPayload || null);
    return nextPayload;
  }, [creatorId]);

  const handleEntitlementGranted = useCallback(
    async (event = {}) => {
      if (String(event.creatorId || "") !== String(creatorId || "")) {
        return;
      }

      try {
        await refreshPublicProfile();
        toast.success("Purchase unlocked. Your creator library is up to date.");
      } catch {
        // Keep the current view stable if refresh fails.
      }
    },
    [creatorId, refreshPublicProfile]
  );

  useEntitlementSocket({
    enabled: isLoggedIn,
    onEntitlement: handleEntitlementGranted,
  });

  const handleFollow = async () => {
    if (!creator?.id || !requireViewer()) {
      return;
    }
    try {
      setFollowBusy(true);
      const response = await toggleFollowCreator(creator.id);
      setPayload((current) =>
        current
          ? {
              ...current,
              viewer: {
                ...(current.viewer || {}),
                isFollowing: Boolean(response?.following),
              },
              creator: {
                ...(current.creator || {}),
                followersCount: Number(response?.followersCount ?? current.creator?.followersCount ?? 0),
              },
              stats: {
                ...(current.stats || {}),
                followersCount: Number(response?.followersCount ?? current.stats?.followersCount ?? 0),
              },
            }
          : current
      );
    } catch (err) {
      toast.error(err?.message || "Could not follow this creator right now.");
    } finally {
      setFollowBusy(false);
    }
  };

  const handleSubscribe = () => {
    if (!creator?.id || !requireViewer()) {
      return;
    }
    navigate(`/creators/${creator.id}/subscribe`);
  };

  const handleBuy = async (item) => {
    if (!item?.id || !requireViewer()) {
      return;
    }
    try {
      const checkout = await createCheckout({
        itemType: item.itemType,
        itemId: item.id,
        currencyMode: "NG",
      });
      if (checkout?.checkoutUrl) {
        window.open(checkout.checkoutUrl, "_blank", "noopener,noreferrer");
        toast.success("Checkout opened. This page will unlock automatically once payment confirms.");
      } else {
        throw new Error("Checkout unavailable");
      }
    } catch (err) {
      toast.error(err?.message || "Could not start checkout.");
    }
  };

  const handlePreview = async (item) => {
    if (!item) {
      return;
    }

    if (item.mediaType === "document") {
      const previewUrl = item.previewUrl || item.streamUrl || item.route;
      if (previewUrl) {
        window.open(previewUrl, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Preview unavailable for this book.");
      }
      return;
    }

    const source = item.previewUrl || item.streamUrl;
    if (!source) {
      toast.error("Preview unavailable for this release.");
      return;
    }

    setActivePreview(
      normalizePreviewPayload({ item, src: source, mode: "preview" })
    );
  };

  const handleStream = async (item) => {
    if (!item) {
      return;
    }

    if (item.mediaType === "document") {
      const targetUrl = item.streamUrl;
      if (targetUrl) {
        window.open(targetUrl, "_blank", "noopener,noreferrer");
        return;
      }
    }

    try {
      const streamPayload = await getStreamUrl(item.itemType, item.id);
      const streamUrl = streamPayload?.streamUrl || item.streamUrl || item.previewUrl || "";
      if (!streamUrl) {
        if (item.canBuy) {
          await handleBuy(item);
          return;
        }
        throw new Error("Stream unavailable for this release.");
      }
      setActivePreview(
        normalizePreviewPayload({
          item,
          src: streamUrl,
          mode: "stream",
          streamPayload,
        })
      );
    } catch (err) {
      toast.error(err?.message || "Could not start playback.");
    }
  };

  const handleDownload = async (item) => {
    if (!item) {
      return;
    }

    if (item.downloadUrl) {
      window.open(item.downloadUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (item.canBuy) {
      await handleBuy(item);
      return;
    }

    if (item.route) {
      navigate(item.route);
      return;
    }

    if (!requireViewer()) {
      return;
    }

    try {
      const downloadPayload = await getDownloadUrl(item.itemType, item.id);
      if (!downloadPayload?.downloadUrl) {
        throw new Error("Download unavailable");
      }
      window.open(downloadPayload.downloadUrl, "_blank", "noopener,noreferrer");
      await refreshPublicProfile().catch(() => null);
    } catch (err) {
      toast.error(err?.message || "Could not prepare download.");
    }
  };

  const featuredItem = featured?.item || null;

  useEffect(() => {
    if (!requestedPreviewId) {
      return;
    }

    const allItems = [
      ...(music.tracks || []),
      ...(music.albums || []),
      ...(music.videos || []),
      ...(podcasts.episodes || []),
      ...(books || []),
    ];
    const targetItem = allItems.find((entry) => String(entry?.id || "") === String(requestedPreviewId || ""));
    if (!targetItem) {
      return;
    }

    const sourceUrl =
      targetItem.streamUrl ||
      targetItem.previewUrl ||
      targetItem.downloadUrl ||
      targetItem.route ||
      "";

    if (!sourceUrl) {
      return;
    }

    setActivePreview(
      normalizePreviewPayload({
        item: targetItem,
        src: sourceUrl,
        mode: targetItem.canStream ? "stream" : "preview",
      })
    );
  }, [books, music.albums, music.tracks, music.videos, podcasts.episodes, requestedPreviewId]);

  if (loading) {
    return (
      <div className="creator-public-page">
        <div className="creator-public-status">Loading creator studio...</div>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="creator-public-page">
        <div className="creator-public-status creator-public-status--error">
          {error || "Creator page unavailable."}
        </div>
      </div>
    );
  }

  const renderHome = () => (
    <>
      <CreatorContentShelf
        title="Top Singles"
        subtitle="Fresh tracks ready to preview, stream, download, or buy."
        creatorId={creator.id}
        items={music.tracks}
        emptyMessage="No music has been published yet."
        onPreview={handlePreview}
        onStream={handleStream}
        onDownload={handleDownload}
        onBuy={handleBuy}
      />
      <CreatorContentShelf
        title="Albums & EPs"
        subtitle="Premium bundles presented like collectible drops."
        creatorId={creator.id}
        items={music.albums}
        emptyMessage="No albums or EPs have been published yet."
        onPreview={handlePreview}
        onStream={handleStream}
        onDownload={handleDownload}
        onBuy={handleBuy}
      />
      <CreatorContentShelf
        title="Video Premieres"
        subtitle="Music visuals, teasers, and video releases."
        creatorId={creator.id}
        items={music.videos}
        emptyMessage="No videos have been published yet."
        onPreview={handlePreview}
        onStream={handleStream}
        onDownload={handleDownload}
        onBuy={handleBuy}
      />
      <section className="creator-public-series">
        <div className="creator-public-series__copy">
          <p className="creator-public-series__eyebrow">Podcast Series</p>
          <h2>{podcasts.series?.seriesTitle || podcasts.series?.podcastName || "Podcast Studio"}</h2>
          <p>{podcasts.series?.description || podcasts.series?.themeOrTopic || "Episodes, commentary, and long-form spoken-word releases."}</p>
        </div>
        <div className="creator-public-series__meta">
          <span>{podcasts.series?.hostName || creator.displayName}</span>
          <strong>{Number(podcasts.series?.totalEpisodes || 0)} episodes</strong>
        </div>
      </section>
      <CreatorContentShelf
        title="Podcast Episodes"
        subtitle="Series episodes and spoken-word releases."
        creatorId={creator.id}
        items={podcasts.episodes}
        emptyMessage="No podcast episodes have been published yet."
        onPreview={handlePreview}
        onStream={handleStream}
        onDownload={handleDownload}
        onBuy={handleBuy}
      />
      <CreatorContentShelf
        title="Book Publishing"
        subtitle="Beautiful covers, previews, downloads, and premium reading releases."
        creatorId={creator.id}
        items={books}
        emptyMessage="No books have been published yet."
        onPreview={handlePreview}
        onStream={handleStream}
        onDownload={handleDownload}
        onBuy={handleBuy}
      />
    </>
  );

  const renderTabContent = () => {
    if (activeTab === "music") {
      return (
        <>
          <CreatorContentShelf
            title="Singles"
            subtitle="Tracks available now."
            creatorId={creator.id}
            items={music.tracks}
            emptyMessage="No singles published yet."
            onPreview={handlePreview}
            onStream={handleStream}
            onDownload={handleDownload}
            onBuy={handleBuy}
          />
          <CreatorContentShelf
            title="Video releases"
            subtitle="Music videos and preview clips."
            creatorId={creator.id}
            items={music.videos}
            emptyMessage="No videos published yet."
            onPreview={handlePreview}
            onStream={handleStream}
            onDownload={handleDownload}
            onBuy={handleBuy}
          />
        </>
      );
    }

    if (activeTab === "albums") {
      return (
        <CreatorContentShelf
          title="Albums & EPs"
          subtitle="Full projects and collectible releases."
          creatorId={creator.id}
          items={music.albums}
          emptyMessage="No albums or EPs published yet."
          onPreview={handlePreview}
          onStream={handleStream}
          onDownload={handleDownload}
          onBuy={handleBuy}
        />
      );
    }

    if (activeTab === "podcasts") {
      return (
        <>
          <section className="creator-public-series">
            <div className="creator-public-series__copy">
              <p className="creator-public-series__eyebrow">Series Profile</p>
              <h2>{podcasts.series?.seriesTitle || podcasts.series?.podcastName || "Podcast"}</h2>
              <p>{podcasts.series?.description || podcasts.series?.themeOrTopic || "Podcast episodes published on Tengacion."}</p>
            </div>
            <div className="creator-public-series__meta">
              <span>{podcasts.series?.hostName || creator.displayName}</span>
              <strong>{Number(podcasts.series?.totalEpisodes || 0)} episodes</strong>
            </div>
          </section>
          <CreatorContentShelf
            title="Episodes"
            subtitle="Preview, stream, download, or unlock."
            creatorId={creator.id}
            items={podcasts.episodes}
            emptyMessage="No episodes published yet."
            onPreview={handlePreview}
            onStream={handleStream}
            onDownload={handleDownload}
            onBuy={handleBuy}
          />
        </>
      );
    }

    if (activeTab === "books") {
      return (
        <CreatorContentShelf
          title="Published books"
          subtitle="Books, manuscripts, and digital releases."
          creatorId={creator.id}
          items={books}
          emptyMessage="No books published yet."
          onPreview={handlePreview}
          onStream={handleStream}
          onDownload={handleDownload}
          onBuy={handleBuy}
        />
      );
    }

    return renderHome();
  };

  return (
    <div className="creator-public-page">
      <CreatorHero
        creator={{
          ...creator,
          bannerUrl: resolveImage(creator.bannerUrl),
          avatarUrl: resolveImage(creator.avatarUrl),
        }}
        stats={payload?.stats}
        isOwner={Boolean(viewer.isOwner)}
        isFollowing={Boolean(viewer.isFollowing)}
        onFollow={followBusy ? () => null : handleFollow}
        onSubscribe={handleSubscribe}
        onOpenStudio={() => navigate("/creator/dashboard")}
        subscriptionLabel={
          subscription?.isSubscribed
            ? "Membership active"
            : `Subscribe for ${formatMoney(subscription?.price || creator?.subscriptionPrice || 2000)}/month`
        }
      />

      <nav className="creator-public-tabs" aria-label="Creator content navigation">
        {PUBLIC_TABS.map((tab) => (
          <Link
            key={tab.key}
            to={`/creators/${creator.id}${tab.suffix}`}
            className={`creator-public-tab${activeTab === tab.key ? " is-active" : ""}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="creator-public-layout">
        <main className="creator-public-main">
          <section className="creator-public-featured">
            <div className="creator-public-featured__copy">
              <p className="creator-public-featured__eyebrow">{featured?.headline || "Featured release"}</p>
              <h2>{featuredItem?.title || "New work arriving soon"}</h2>
              <p>{featuredItem?.description || creator.bio || "Stream the latest creator release and explore the full studio."}</p>
              <div className="creator-public-featured__actions">
                {featuredItem ? (
                  <>
                    {featuredItem.canPreview ? (
                      <button type="button" className="creator-secondary-btn" onClick={() => handlePreview(featuredItem)}>
                        Preview
                      </button>
                    ) : null}
                    {featuredItem.canStream ? (
                      <button type="button" className="creator-primary-btn" onClick={() => handleStream(featuredItem)}>
                        {featuredItem.mediaType === "document" ? "Read now" : "Stream now"}
                      </button>
                    ) : null}
                    {featuredItem.canDownload ? (
                      <button type="button" className="creator-ghost-btn" onClick={() => handleDownload(featuredItem)}>
                        Download
                      </button>
                    ) : null}
                    {featuredItem.canBuy ? (
                      <button type="button" className="creator-ghost-btn" onClick={() => handleBuy(featuredItem)}>
                        Buy for {formatMoney(featuredItem.price)}
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            <div className="creator-public-preview">
              {activePreview?.src ? (
                <>
                  <div className="creator-public-preview__head">
                    <div>
                      <p>{activePreview.mode === "stream" ? "Now streaming" : "Previewing"}</p>
                      <strong>{activePreview.title}</strong>
                      {activePreview.subtitle ? <span>{activePreview.subtitle}</span> : null}
                    </div>
                  </div>
                  {activePreview.kind === "video" ? (
                    <video className="creator-public-preview__player" controls src={activePreview.src} poster={activePreview.artwork} />
                  ) : activePreview.kind === "audio" ? (
                    <CreatorPublicAudioPreview preview={activePreview} />
                  ) : (
                    <iframe className="creator-public-preview__frame" src={activePreview.src} title={activePreview.title} />
                  )}
                </>
              ) : featuredItem?.coverUrl ? (
                <div className="creator-public-preview__cover">
                  <img src={resolveImage(featuredItem.coverUrl)} alt={featuredItem.title} />
                </div>
              ) : (
                <div className="creator-public-preview__empty">
                  Choose a release to preview, stream, or read.
                </div>
              )}
            </div>
          </section>

          {renderTabContent()}
        </main>

        <aside className="creator-public-side">
          <section className="creator-public-panel creator-public-panel--subscribe">
            <h3>Unlock Exclusive Content</h3>
            <strong className="creator-public-panel__price">
              {formatMoney(subscription?.price || creator?.subscriptionPrice || 2000)}/month
            </strong>
            <p className="creator-public-panel__justified">
              {subscription?.description
                || "Supporters unlock endless streams, premium downloads, and direct support access from the creator page."}
            </p>
            {subscription?.isSubscribed ? (
              <div className="creator-public-panel__status">
                <strong>Membership active</strong>
                <span>Full creator streams and downloads are unlocked for your account.</span>
              </div>
            ) : (
              <button type="button" className="creator-primary-btn" onClick={handleSubscribe}>
                Subscribe now
              </button>
            )}
          </section>

          <section className="creator-public-panel">
            <h3>Creator Snapshot</h3>
            <div className="creator-public-side__list">
              <div>
                <span>Tracks</span>
                <strong>{payload?.stats?.totalTracks || 0}</strong>
              </div>
              <div>
                <span>Albums</span>
                <strong>{payload?.stats?.totalAlbums || 0}</strong>
              </div>
              <div>
                <span>Episodes</span>
                <strong>{payload?.stats?.totalEpisodes || 0}</strong>
              </div>
              <div>
                <span>Books</span>
                <strong>{payload?.stats?.totalBooks || 0}</strong>
              </div>
            </div>
          </section>

          <section className="creator-public-panel">
            <h3>Publishing Identity</h3>
            <p>{creator.bio || "A creator building across music, podcasts, and books on Tengacion."}</p>
            <div className="creator-public-tags">
              {(creator.genres || []).map((genre) => (
                <span key={genre}>{genre}</span>
              ))}
            </div>
          </section>

          <section className="creator-public-panel">
            <h3>Links</h3>
            <div className="creator-public-links">
              {(creator.links || []).length ? (
                creator.links.map((entry) => (
                  <a key={entry.url} href={entry.url} target="_blank" rel="noreferrer">
                    {entry.label || "Open link"}
                  </a>
                ))
              ) : (
                <span>No external links added yet.</span>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
