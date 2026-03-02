import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  createCheckout,
  getCreatorHub,
  getDownloadUrl,
  getStreamUrl,
  getMyEntitlementsForCreator,
  getProfile,
  getContinueListening,
  toggleFollowCreator,
} from "../api";
import { useCreatorPlayer } from "../context/CreatorPlayerContext";
import CreatorHubLayout from "../components/creatorHub/CreatorHubLayout";
import CreatorHubHomeSections from "../components/creatorHub/CreatorHubHomeSections";
import MiniPlayer from "../components/creatorHub/MiniPlayer";
import QueueDrawer from "../components/creatorHub/QueueDrawer";
import styles from "../components/creatorHub/CreatorHub.module.css";

const CURRENCY_KEY = "creator_hub_currency_mode";

const getTabFromPath = (pathname = "") => {
  if (pathname.endsWith("/music")) return "music";
  if (pathname.endsWith("/albums")) return "albums";
  if (pathname.endsWith("/podcasts")) return "podcasts";
  if (pathname.endsWith("/books")) return "books";
  if (pathname.endsWith("/comedy")) return "comedy";
  if (pathname.endsWith("/store")) return "store";
  return "home";
};

const mapPlayable = (entry, creator) => ({
  id: entry.id,
  title: entry.title,
  coverUrl: entry.coverUrl,
  creatorName: creator?.displayName || "Creator",
  type: entry.kind === "podcast" ? "podcast" : "song",
  streamUrl: entry.streamUrl,
  durationSec: entry.durationSec,
  creatorId: creator?.id,
  lockedPreview: !entry.isFree && !entry.canDownload,
  previewLimitSec: 45,
});

export default function CreatorHubPage() {
  const { creatorId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hub, setHub] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [currencyMode, setCurrencyMode] = useState(() => {
    try {
      const stored = localStorage.getItem(CURRENCY_KEY);
      return stored === "GLOBAL" ? "GLOBAL" : "NG";
    } catch {
      return "NG";
    }
  });
  const [entitlements, setEntitlements] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const activeTab = getTabFromPath(location.pathname);

  const {
    currentItem,
    queue,
    currentIndex,
    queueOpen,
    isPlaying,
    position,
    duration,
    volume,
    unlockRequired,
    setUnlockRequired,
    setVolume,
    setQueueOpen,
    playItem,
    playByIndex,
    playNext,
    playPrev,
    togglePlay,
    seekTo,
    moveQueueItem,
    removeQueueItem,
    setQueue,
  } = useCreatorPlayer();

  const loadHub = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [hubPayload, mePayload, continueItems, entitlementPayload] = await Promise.all([
        getCreatorHub(creatorId),
        getProfile().catch(() => null),
        getContinueListening(creatorId).catch(() => []),
        getMyEntitlementsForCreator(creatorId).catch(() => ({ entitlements: [] })),
      ]);

      const nextHub = {
        ...hubPayload,
        sections: {
          ...(hubPayload?.sections || {}),
          continueListening:
            Array.isArray(continueItems) && continueItems.length
              ? continueItems.map((item) => ({
                  ...item,
                  itemId: item.itemId,
                  type: item.type,
                }))
              : hubPayload?.sections?.continueListening || [],
        },
      };

      setHub(nextHub);
      setViewer(mePayload || null);
      setEntitlements(entitlementPayload?.entitlements || []);

      const viewerId = String(mePayload?._id || mePayload?.id || "");
      const creatorUserId = String(nextHub?.creator?.userId || "");
      const followerIds = Array.isArray(mePayload?.following)
        ? mePayload.following.map((id) => String(id))
        : [];
      setIsFollowing(followerIds.includes(creatorUserId));

      if (viewerId && viewerId === creatorUserId) {
        setIsFollowing(false);
      }
    } catch (err) {
      setError(err.message || "Failed to load creator hub");
    } finally {
      setLoading(false);
    }
  }, [creatorId]);

  useEffect(() => {
    loadHub();
  }, [loadHub]);

  const isOwner = useMemo(() => {
    const viewerId = String(viewer?._id || viewer?.id || "");
    const creatorUserId = String(hub?.creator?.userId || "");
    return Boolean(viewerId && creatorUserId && viewerId === creatorUserId);
  }, [hub?.creator?.userId, viewer?._id, viewer?.id]);

  const sectionItems = useMemo(() => {
    const sections = hub?.sections || {};
    if (activeTab === "music") return sections.allMusic || [];
    if (activeTab === "albums") return sections.allAlbums || [];
    if (activeTab === "podcasts") return sections.allPodcasts || [];
    if (activeTab === "books") return sections.allBooks || [];
    if (activeTab === "comedy") return sections.allComedy || [];
    if (activeTab === "store") {
      const paidMusic = (sections.allMusic || []).filter((item) => !item.isFree);
      const paidAlbums = (sections.allAlbums || []).filter((item) => !item.isFree);
      const paidBooks = (sections.allBooks || []).filter((item) => item.purchaseRequired);
      const paidComedy = (sections.allComedy || []).filter((item) => !item.isFree);
      return [...paidMusic, ...paidAlbums, ...paidBooks, ...paidComedy];
    }
    return [];
  }, [activeTab, hub?.sections]);

  const filteredSectionItems = useMemo(() => {
    const query = String(searchTerm || "").trim().toLowerCase();
    if (!query) return sectionItems;
    return sectionItems.filter((entry) =>
      String(entry?.title || "").toLowerCase().includes(query)
    );
  }, [searchTerm, sectionItems]);

  const handleCurrencyMode = (mode) => {
    const next = mode === "GLOBAL" ? "GLOBAL" : "NG";
    setCurrencyMode(next);
    try {
      localStorage.setItem(CURRENCY_KEY, next);
    } catch {
      // ignore
    }
  };

  const hydrateStream = async (item) => {
    const itemType = item?.type === "podcast"
      ? "podcast"
      : item?.type === "video"
        ? "video"
        : "song";
    if (!item?.id) return item;
    try {
      const streamPayload = await getStreamUrl(itemType, item.id);
      if (streamPayload?.streamUrl) {
        return {
          ...item,
          streamUrl: streamPayload.streamUrl,
          lockedPreview: Boolean(streamPayload.previewOnly),
        };
      }
    } catch {
      // Non-fatal: fallback to stream URL from creator payload.
    }
    return item;
  };

  const handlePlay = async (item, queueItems = null) => {
    const hydratedItem = await hydrateStream(item);
    if (queueItems) {
      const hydratedQueue = await Promise.all(queueItems.map((entry) => hydrateStream(entry)));
      await playItem(hydratedItem, hydratedQueue);
      return;
    }
    await playItem(hydratedItem);
  };

  const openCheckout = async (itemType, itemId) => {
    try {
      const checkout = await createCheckout({ itemType, itemId, currencyMode });
      if (checkout?.checkoutUrl) {
        window.open(checkout.checkoutUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      alert(err.message || "Unable to create checkout");
    }
  };

  const openDownload = async (itemType, itemId) => {
    try {
      const payload = await getDownloadUrl(itemType, itemId);
      if (payload?.downloadUrl) {
        window.open(payload.downloadUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      alert(err.message || "Download unavailable");
    }
  };

  const handleItemMenu = (item) => {
    const url = `${window.location.origin}/creators/${creatorId}`;
    const choice = window.prompt("Action: share | copy | report", "copy");
    if (!choice) return;
    const action = choice.trim().toLowerCase();
    if (action === "share") {
      if (navigator.share) {
        navigator.share({ title: item.title || "Tengacion", url }).catch(() => null);
      } else {
        navigator.clipboard?.writeText(url).catch(() => null);
      }
      return;
    }
    if (action === "copy") {
      navigator.clipboard?.writeText(url).catch(() => null);
      return;
    }
    if (action === "report") {
      alert("Report sent.");
    }
  };

  const handleFollowToggle = async () => {
    if (!viewer?._id && !viewer?.id) {
      navigate("/login");
      return;
    }

    try {
      const payload = await toggleFollowCreator(creatorId);
      setIsFollowing(Boolean(payload?.following));
      setHub((prev) =>
        prev
          ? {
              ...prev,
              creator: {
                ...prev.creator,
                followersCount: Number(payload?.followersCount ?? prev.creator.followersCount ?? 0),
              },
            }
          : prev
      );
    } catch (err) {
      alert(err.message || "Follow action failed");
    }
  };

  const handleUnlockCurrent = () => {
    if (!currentItem?.id) return;
    const type = currentItem.type === "podcast" ? "podcast" : currentItem.type === "video" ? "video" : "song";
    openCheckout(type, currentItem.id);
    setUnlockRequired(false);
  };

  const runFlow = useCallback(() => {
    const sections = hub?.sections || {};
    const source = activeTab === "podcasts" ? sections.allPodcasts : sections.allMusic || [];
    const flowQueue = source
      .map((entry) => mapPlayable(entry, hub?.creator))
      .filter((item) => item.streamUrl);
    if (flowQueue.length) {
      setQueue(flowQueue);
      playItem(flowQueue[0], flowQueue);
    }
  }, [activeTab, hub?.creator, hub?.sections, playItem, setQueue]);

  if (loading) {
    return (
      <div className={styles.hubPage}>
        <div className={styles.sectionCard}>Loading Creator Hub...</div>
      </div>
    );
  }

  if (error || !hub?.creator) {
    return (
      <div className={styles.hubPage}>
        <div className={styles.sectionCard}>{error || "Creator hub unavailable"}</div>
      </div>
    );
  }

  const creator = hub.creator;

  return (
    <>
      <CreatorHubLayout
        creator={creator}
        creatorId={creatorId}
        activeTab={activeTab}
        isOwner={isOwner}
        isFollowing={isFollowing}
        onToggleFollow={handleFollowToggle}
        currencyMode={currencyMode}
        onCurrencyMode={handleCurrencyMode}
      >
        {activeTab === "home" ? (
          <CreatorHubHomeSections
            sections={hub.sections || {}}
            creator={creator}
            currencyMode={currencyMode}
            onPlay={handlePlay}
            onViewTab={(tab) => navigate(`/creators/${creatorId}/${tab}`)}
            onCheckout={openCheckout}
            onDownload={(book) => openDownload("ebook", book.id)}
            onMenu={handleItemMenu}
          />
        ) : (
          <div className={styles.mainGrid}>
            <article className={styles.sectionCard}>
              <div className={styles.sectionHead}>
                <h3>{activeTab.toUpperCase()}</h3>
                <span className={styles.mutedText}>{filteredSectionItems.length} items</span>
              </div>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search tracks, albums, books..."
                className={styles.searchInput}
              />
              {filteredSectionItems.length ? (
                filteredSectionItems.map((entry) => {
                  const isBook = activeTab === "books" || (activeTab === "store" && entry.purchaseRequired !== undefined);
                  const isAlbum = activeTab === "albums" || (activeTab === "store" && entry.itemType === "album");
                  const isVideo = activeTab === "comedy" && !Object.prototype.hasOwnProperty.call(entry, "kind");
                  return (
                    <div key={entry.id} className={styles.trackRow}>
                      <img className={styles.trackCover} src={entry.coverUrl || "/avatar.png"} alt={entry.title} />
                      <div>
                        <span className={styles.trackName}>{entry.title}</span>
                        <span className={styles.trackCreator}>
                          {isAlbum
                            ? `${Number(entry.totalTracks || 0)} songs`
                            : isBook
                              ? "eBook"
                              : isVideo
                                ? "Comedy Video"
                                : activeTab === "podcasts"
                                  ? "Podcast"
                                  : "Track"}
                        </span>
                        {(Number(entry.playCount || entry.playsCount || 0) > 0 || Number(entry.purchaseCount || 0) > 0) ? (
                          <span className={styles.trackCreator}>
                            {Number(entry.playCount || entry.playsCount || 0).toLocaleString()} plays • {Number(entry.purchaseCount || 0).toLocaleString()} sales
                          </span>
                        ) : null}
                      </div>
                      {isAlbum ? (
                        <button
                          type="button"
                          className={styles.ctaBtn}
                          onClick={() => navigate(`/albums/${entry.id}`)}
                        >
                          Open album
                        </button>
                      ) : isBook ? (
                        <button type="button" className={styles.ctaBtn} onClick={() => openDownload("ebook", entry.id)}>Download</button>
                      ) : (
                        <button
                          type="button"
                          className={styles.playBtn}
                          onClick={() =>
                            handlePlay({
                              id: entry.id,
                              title: entry.title,
                              coverUrl: entry.coverUrl,
                              creatorName: creator.displayName,
                              type: activeTab === "podcasts" ? "podcast" : isVideo ? "video" : "song",
                              streamUrl: entry.streamUrl,
                              durationSec: entry.durationSec,
                              creatorId: creator.id,
                              lockedPreview: !entry.isFree && !entry.canDownload,
                              previewLimitSec: 45,
                            })
                          }
                        >
                          Play
                        </button>
                      )}
                      {!entry.isFree && (entry.purchaseRequired || !entry.canDownload) ? (
                        <button
                          type="button"
                          className={styles.buyBtn}
                          onClick={() =>
                            openCheckout(
                              isAlbum ? "album" : isBook ? "ebook" : activeTab === "podcasts" ? "podcast" : isVideo ? "video" : "song",
                              entry.id
                            )
                          }
                        >
                          Buy
                        </button>
                      ) : null}
                      <button type="button" className={styles.menuBtn} onClick={() => handleItemMenu(entry)}>...</button>
                    </div>
                  );
                })
              ) : (
                <p className={styles.mutedText}>No content in this tab yet.</p>
              )}
            </article>
            <article className={styles.sectionCard}>
              <div className={styles.sectionHead}><h4>Store & Entitlements</h4></div>
              <p className={styles.mutedText}>Supported providers:</p>
              <ul>
                {(hub?.commerce?.supportedPaymentOptions?.[currencyMode] || []).map((provider) => (
                  <li key={provider}>{provider}</li>
                ))}
              </ul>
              <p className={styles.mutedText} style={{ marginTop: "0.8rem" }}>
                Purchased items for this creator: {entitlements.length}
              </p>
            </article>
          </div>
        )}
      </CreatorHubLayout>

      <MiniPlayer
        currentItem={currentItem}
        isPlaying={isPlaying}
        position={position}
        duration={duration}
        volume={volume}
        unlockRequired={unlockRequired}
        onTogglePlay={togglePlay}
        onPrev={playPrev}
        onNext={playNext}
        onSeek={seekTo}
        onVolume={setVolume}
        onToggleQueue={() => setQueueOpen((prev) => !prev)}
        onFlow={runFlow}
        onUnlock={handleUnlockCurrent}
      />

      <QueueDrawer
        open={queueOpen}
        queue={queue}
        currentIndex={currentIndex}
        onClose={() => setQueueOpen(false)}
        onPlay={playByIndex}
        onMove={moveQueueItem}
        onRemove={removeQueueItem}
      />
    </>
  );
}
