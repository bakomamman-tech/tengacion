import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { createCheckout, getCreatorHub, getProfile, getStreamUrl, resolveImage, toggleFollowCreator } from "../api";
import "./creator-redesign.css";

const NAV_ITEMS = ["Home", "Music", "Videos", "Save", "Tip", "Buy", "More"];

const money = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const getLinkByLabel = (links, label) =>
  (Array.isArray(links) ? links : []).find((entry) =>
    String(entry?.label || "").toLowerCase().includes(String(label || "").toLowerCase())
  )?.url || "";

export default function CreatorHubPage() {
  const { creatorId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hub, setHub] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeNav, setActiveNav] = useState("Home");

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const path = String(location.pathname || "").toLowerCase();
    if (path.endsWith("/music")) setActiveNav("Music");
    else if (path.endsWith("/videos")) setActiveNav("Videos");
    else if (path.endsWith("/buy") || path.endsWith("/store")) setActiveNav("Buy");
    else setActiveNav("Home");
  }, [location.pathname]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [hubData, me] = await Promise.all([getCreatorHub(creatorId), getProfile().catch(() => null)]);
        if (!alive) return;
        setHub(hubData);
        setViewer(me || null);
        const creatorUserId = String(hubData?.creator?.userId || "");
        const following = Array.isArray(me?.following) ? me.following.map((id) => String(id)) : [];
        setIsFollowing(Boolean(creatorUserId && following.includes(creatorUserId)));
      } catch (err) {
        if (!alive) return;
        setError(err.message || "Failed to load creator page.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [creatorId]);

  const creator = hub?.creator || null;

  const singles = useMemo(
    () => (Array.isArray(hub?.tracks) ? hub.tracks : []).filter((entry) => String(entry.kind || "music") === "music"),
    [hub?.tracks]
  );

  const podcasts = useMemo(
    () => Array.isArray(hub?.podcasts) ? hub.podcasts : [],
    [hub?.podcasts]
  );

  const albums = useMemo(() => (Array.isArray(hub?.albums) ? hub.albums : []), [hub?.albums]);
  const books = useMemo(() => (Array.isArray(hub?.books) ? hub.books : []), [hub?.books]);
  const videos = useMemo(() => (Array.isArray(hub?.videos) ? hub.videos : []), [hub?.videos]);

  const playlist = useMemo(
    () => [
      ...singles.map((entry) => ({
        id: entry.id,
        itemType: "song",
        title: entry.title,
        creatorName: creator?.displayName || "Creator",
        coverUrl: entry.coverUrl,
        streamUrl: entry.streamUrl,
        isFree: entry.isFree,
      })),
      ...podcasts.map((entry) => ({
        id: entry.id,
        itemType: "podcast",
        title: entry.title,
        creatorName: creator?.displayName || "Creator",
        coverUrl: entry.coverUrl,
        streamUrl: entry.streamUrl,
        isFree: entry.isFree,
      })),
    ],
    [creator?.displayName, podcasts, singles]
  );

  const current = currentIndex >= 0 ? queue[currentIndex] : null;

  const playQueueItem = async (item, index, fullQueue = playlist) => {
    if (!item?.id) return;
    try {
      const streamPayload = await getStreamUrl(item.itemType, item.id).catch(() => null);
      const nextItem = {
        ...item,
        streamUrl: streamPayload?.streamUrl || item.streamUrl || "",
      };
      if (!nextItem.streamUrl) {
        throw new Error("Preview unavailable.");
      }
      setQueue(fullQueue);
      setCurrentIndex(index);
      if (audioRef.current) {
        audioRef.current.src = nextItem.streamUrl;
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      alert(err.message || "Playback unavailable right now.");
    }
  };

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (!current && playlist.length) {
      await playQueueItem(playlist[0], 0, playlist);
      return;
    }
    if (audioRef.current.paused) {
      await audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const playNext = async () => {
    if (!queue.length) return;
    const next = (currentIndex + 1) % queue.length;
    await playQueueItem(queue[next], next, queue);
  };

  const playPrev = async () => {
    if (!queue.length) return;
    const prev = (currentIndex - 1 + queue.length) % queue.length;
    await playQueueItem(queue[prev], prev, queue);
  };

  const handleBuy = async (itemType, itemId) => {
    try {
      const checkout = await createCheckout({ itemType, itemId, currencyMode: "NG" });
      if (checkout?.checkoutUrl) {
        window.open(checkout.checkoutUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      alert(err.message || "Checkout unavailable.");
    }
  };

  const handleFollow = async () => {
    if (!viewer?._id && !viewer?.id) {
      navigate("/");
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
      alert(err.message || "Could not follow creator.");
    }
  };

  const youtubeUrl = getLinkByLabel(creator?.links, "youtube");
  const spotifyUrl = getLinkByLabel(creator?.links, "spotify");

  if (loading) {
    return <div className="cpub-page"><div className="cpub-empty">Loading creator page...</div></div>;
  }

  if (error || !creator) {
    return <div className="cpub-page"><div className="cpub-empty">{error || "Creator page unavailable."}</div></div>;
  }

  const creatorCover = resolveImage(creator.bannerUrl) || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1600&q=80";
  const creatorAvatar = resolveImage(creator.avatarUrl) || "/avatar.png";

  return (
    <div className="cpub-page">
      <section className="cpub-hero" style={{ backgroundImage: `linear-gradient(130deg, rgba(6,50,29,0.72), rgba(10,82,54,0.62)), url(${creatorCover})` }}>
        <div className="cpub-hero-media">
          <img className="cpub-main-image" src={creatorCover} alt={creator.displayName} />
          <img className="cpub-avatar" src={creatorAvatar} alt={creator.displayName} />
        </div>
        <div className="cpub-hero-copy">
          <h1>
            {creator.displayName}
            {creator.verified ? <span className="verify">Verified</span> : null}
          </h1>
          <p className="meta">{(Array.isArray(creator.genres) ? creator.genres : []).join(" | ") || "Afrobeat | Author | Comedian"}</p>
          <p className="stats">
            {(creator.followersCount || 0).toLocaleString()} followers • {(creator.monthlyListeners || 0).toLocaleString()} supporters
          </p>
          <p className="bio">{creator.bio || "Welcome to my official creator page on Tengacion."}</p>
          <div className="actions">
            <button type="button" className="primary" onClick={() => (singles[0] ? playQueueItem({
              id: singles[0].id,
              itemType: "song",
              title: singles[0].title,
              creatorName: creator.displayName,
              coverUrl: singles[0].coverUrl,
              streamUrl: singles[0].streamUrl,
              isFree: singles[0].isFree,
            }, 0, playlist) : null)}>
              Stream Latest Single
            </button>
            <button type="button" className="ghost" onClick={handleFollow}>{isFollowing ? "Following" : "Follow"}</button>
          </div>
        </div>
      </section>

      <nav className="cpub-sticky-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item}
            type="button"
            className={activeNav === item ? "active" : ""}
            onClick={() => setActiveNav(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="cpub-layout">
        <main className="cpub-main-col">
          <section className="cpub-card">
            <h2>Spotlight</h2>
            {singles[0] ? (
              <div className="spotlight">
                <img src={resolveImage(singles[0].coverUrl) || "/avatar.png"} alt={singles[0].title} />
                <div>
                  <h3>{singles[0].title}</h3>
                  <p>New Hit Single Out Now!</p>
                  <button type="button" className="primary" onClick={() => playQueueItem({
                    id: singles[0].id,
                    itemType: "song",
                    title: singles[0].title,
                    creatorName: creator.displayName,
                    coverUrl: singles[0].coverUrl,
                    streamUrl: singles[0].streamUrl,
                    isFree: singles[0].isFree,
                  }, 0, playlist)}>
                    {singles[0].isFree ? "Listen Preview" : "Unlock Full Song"}
                  </button>
                </div>
              </div>
            ) : <p className="empty">No singles uploaded yet.</p>}
          </section>

          <section className="cpub-card">
            <h2>Top Singles</h2>
            {singles.length ? singles.map((item, index) => (
              <article key={item.id} className="single-row">
                <img src={resolveImage(item.coverUrl) || "/avatar.png"} alt={item.title} />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.isFree ? "Preview available" : "Premium single"}</p>
                </div>
                <span>{money(item.priceNGN || 0)}</span>
                <button type="button" className="ghost" onClick={() => playQueueItem({
                  id: item.id,
                  itemType: "song",
                  title: item.title,
                  creatorName: creator.displayName,
                  coverUrl: item.coverUrl,
                  streamUrl: item.streamUrl,
                  isFree: item.isFree,
                }, index, playlist)}>{item.isFree ? "Listen Preview" : "Unlock"}</button>
                {!item.isFree ? <button type="button" className="primary" onClick={() => handleBuy("song", item.id)}>Buy Now</button> : null}
              </article>
            )) : <p className="empty">No singles uploaded yet.</p>}
          </section>

          <section className="cpub-card">
            <h2>Albums</h2>
            {albums.length ? (
              <div className="tile-grid">
                {albums.map((album) => (
                  <article key={album.id} className="tile">
                    <img src={resolveImage(album.coverUrl) || "/avatar.png"} alt={album.title} />
                    <strong>{album.title}</strong>
                    <p>{money(album.priceNGN || 0)} • {Number(album.totalTracks || 0)} tracks</p>
                    <div className="tile-actions">
                      <button type="button" className="ghost" onClick={() => navigate(`/albums/${album.id}`)}>Preview</button>
                      <button type="button" className="primary" onClick={() => handleBuy("album", album.id)}>Buy</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="empty">No albums uploaded yet.</p>}
          </section>

          <section className="cpub-card">
            <h2>Books</h2>
            {books.length ? (
              <div className="tile-grid">
                {books.map((book) => (
                  <article key={book.id} className="tile">
                    <img src={resolveImage(book.coverUrl) || "/avatar.png"} alt={book.title} />
                    <strong>{book.title}</strong>
                    <p>{money(book.priceNGN || 0)}</p>
                    <div className="tile-actions">
                      <a className="ghost" href={book.previewPdfUrl || "#"} target="_blank" rel="noreferrer">Read Sample</a>
                      {!book.isFreePreview ? <button type="button" className="primary" onClick={() => handleBuy("ebook", book.id)}>Buy Book</button> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="empty">No books uploaded yet.</p>}
          </section>

          <section className="cpub-card">
            <h2>Videos</h2>
            {videos.length ? (
              <div className="tile-grid">
                {videos.map((video) => (
                  <article key={video.id} className="tile">
                    <img src={resolveImage(video.coverUrl) || "/avatar.png"} alt={video.title} />
                    <strong>{video.title}</strong>
                    <p>{money(video.priceNGN || 0)}</p>
                    <div className="tile-actions">
                      <a className="ghost" href={video.previewUrl || video.streamUrl || "#"} target="_blank" rel="noreferrer">Watch Preview</a>
                      {!video.isFree ? <button type="button" className="primary" onClick={() => handleBuy("video", video.id)}>Unlock Video</button> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="empty">No videos uploaded yet.</p>}
          </section>

          <section className="cpub-card">
            <h2>Podcasts</h2>
            {podcasts.length ? podcasts.map((podcast) => (
              <article key={podcast.id} className="single-row">
                <img src={resolveImage(podcast.coverUrl) || "/avatar.png"} alt={podcast.title} />
                <div>
                  <strong>{podcast.title}</strong>
                  <p>{podcast.podcastSeries || "Podcast episode"} • {podcast.isFree ? "Free" : "Paid"}</p>
                </div>
                <span>{money(podcast.priceNGN || 0)}</span>
                <button type="button" className="ghost" onClick={() => playQueueItem({
                  id: podcast.id,
                  itemType: "podcast",
                  title: podcast.title,
                  creatorName: creator.displayName,
                  coverUrl: podcast.coverUrl,
                  streamUrl: podcast.streamUrl,
                  isFree: podcast.isFree,
                }, playlist.findIndex((item) => item.id === podcast.id), playlist)}>
                  {podcast.isFree ? "Play Episode" : "Listen Preview"}
                </button>
                {!podcast.isFree ? <button type="button" className="primary" onClick={() => handleBuy("podcast", podcast.id)}>Unlock</button> : null}
              </article>
            )) : <p className="empty">No podcasts uploaded yet.</p>}
          </section>

          <section className="cpub-card">
            <h2>You May Also Like</h2>
            <div className="tile-grid">
              {["Ayo Vibes", "Mina Stories", "Tobi Rhythm"].map((name) => (
                <article key={name} className="tile related">
                  <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=320&q=80" alt={name} />
                  <strong>{name}</strong>
                  <button type="button" className="ghost">View Creator</button>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className="cpub-right-col">
          <section className="cpub-card">
            <h3>Official Artist Links</h3>
            <div className="link-buttons">
              <a href={youtubeUrl || "https://youtube.com"} target="_blank" rel="noreferrer">Visit YouTube</a>
              <a href={spotifyUrl || "https://spotify.com"} target="_blank" rel="noreferrer">Visit Spotify</a>
            </div>
          </section>

          <section className="cpub-card">
            <h3>Creator Spotlight Bio</h3>
            <p>{creator.bio || "No bio provided yet."}</p>
          </section>
        </aside>
      </div>

      <div className="cpub-mini-player">
        <audio
          ref={audioRef}
          onTimeUpdate={() => {
            const node = audioRef.current;
            if (!node) return;
            setProgress(Number(node.currentTime || 0));
            setDuration(Number(node.duration || 0));
          }}
          onEnded={playNext}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        <div className="track-meta">
          <img src={resolveImage(current?.coverUrl) || "/avatar.png"} alt="Now playing" />
          <div>
            <strong>{current?.title || "Nothing playing"}</strong>
            <p>{current?.creatorName || creator.displayName}</p>
          </div>
        </div>
        <div className="controls">
          <button type="button" onClick={playPrev}>Prev</button>
          <button type="button" onClick={togglePlay}>{isPlaying ? "Pause" : "Play"}</button>
          <button type="button" onClick={playNext}>Next</button>
        </div>
        <div className="progress-area">
          <input
            type="range"
            min="0"
            max={Math.max(1, duration || 0)}
            value={Math.min(progress, duration || 0)}
            onChange={(event) => {
              const next = Number(event.target.value || 0);
              if (audioRef.current) {
                audioRef.current.currentTime = next;
              }
              setProgress(next);
            }}
          />
          <span>{Math.floor(progress)}s / {Math.floor(duration || 0)}s</span>
        </div>
        {current && !current.isFree ? (
          <button type="button" className="unlock" onClick={() => handleBuy(current.itemType, current.id)}>Unlock / Buy</button>
        ) : null}
      </div>
    </div>
  );
}
