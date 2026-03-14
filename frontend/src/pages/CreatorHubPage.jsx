import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  createCheckout,
  getCreatorHub,
  getProfile,
  getStreamUrl,
  resolveImage,
  toggleFollowCreator,
} from "../api";
import "./creator-redesign.css";

const NAV_ITEMS = [
  { label: "Home", type: "section" },
  { label: "Music", type: "route", route: "music" },
  { label: "Videos", type: "section" },
  { label: "Save", type: "action" },
  { label: "Tip", type: "action" },
  { label: "Buy", type: "action" },
  { label: "More", type: "action" },
];

const CREATOR_SHARE_RATE = 0.4;
const PLATFORM_SHARE_RATE = 0.6;
const money = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const getLinkByLabel = (links, label) =>
  (Array.isArray(links) ? links : []).find((entry) =>
    String(entry?.label || "").toLowerCase().includes(String(label || "").toLowerCase())
  )?.url || "";

const fallbackCards = [
  {
    name: "Kwame Beats",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=640&q=80",
  },
  {
    name: "Nyasha Reads",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=640&q=80",
  },
  {
    name: "DJ Malik",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=640&q=80",
  },
  {
    name: "Adama Kole",
    image: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=640&q=80",
  },
];

function makePlayable(entry, creatorName, itemType) {
  return {
    id: entry.id,
    itemType,
    title: entry.title,
    creatorName,
    coverUrl: entry.coverUrl,
    streamUrl: entry.streamUrl,
    isFree: entry.isFree,
    priceNGN: entry.priceNGN || 0,
  };
}

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
    if (path.endsWith("/music")) {
      setActiveNav("Music");
    } else {
      setActiveNav("Home");
    }
  }, [location.pathname]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [hubData, me] = await Promise.all([getCreatorHub(creatorId), getProfile().catch(() => null)]);
        if (!alive) {
          return;
        }
        setHub(hubData);
        setViewer(me || null);
        const creatorUserId = String(hubData?.creator?.userId || "");
        const following = Array.isArray(me?.following) ? me.following.map((id) => String(id)) : [];
        setIsFollowing(Boolean(creatorUserId && following.includes(creatorUserId)));
      } catch (err) {
        if (alive) {
          setError(err.message || "Failed to load creator page.");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
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
  const podcasts = useMemo(() => (Array.isArray(hub?.podcasts) ? hub.podcasts : []), [hub?.podcasts]);
  const albums = useMemo(() => (Array.isArray(hub?.albums) ? hub.albums : []), [hub?.albums]);
  const books = useMemo(() => (Array.isArray(hub?.books) ? hub.books : []), [hub?.books]);
  const videos = useMemo(() => (Array.isArray(hub?.videos) ? hub.videos : []), [hub?.videos]);

  const playlist = useMemo(() => {
    const creatorName = creator?.displayName || "Creator";
    return [
      ...singles.map((entry) => makePlayable(entry, creatorName, "song")),
      ...podcasts.map((entry) => makePlayable(entry, creatorName, "podcast")),
    ];
  }, [creator?.displayName, podcasts, singles]);

  const current = currentIndex >= 0 ? queue[currentIndex] : null;

  const playQueueItem = async (item, index, fullQueue = playlist) => {
    if (!item?.id) {
      return;
    }
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
      toast.error(err.message || "Playback unavailable right now.");
    }
  };

  const togglePlay = async () => {
    if (!audioRef.current) {
      return;
    }
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
    if (!queue.length) {
      return;
    }
    const next = (currentIndex + 1) % queue.length;
    await playQueueItem(queue[next], next, queue);
  };

  const playPrev = async () => {
    if (!queue.length) {
      return;
    }
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
      toast.error(err.message || "Checkout unavailable.");
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
      toast.error(err.message || "Could not follow creator.");
    }
  };

  if (loading) {
    return <div className="cpub-page"><div className="cpub-empty">Loading creator page...</div></div>;
  }

  if (error || !creator) {
    return <div className="cpub-page"><div className="cpub-empty">{error || "Creator page unavailable."}</div></div>;
  }

  const creatorCover =
    resolveImage(creator.bannerUrl) ||
    "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1800&q=80";
  const creatorAvatar = resolveImage(creator.avatarUrl) || "/avatar.png";
  const youtubeUrl = getLinkByLabel(creator.links, "youtube");
  const spotifyUrl = getLinkByLabel(creator.links, "spotify");
  const spotlightTrack = singles[0] || null;
  const merchAlbum = albums[0] || null;
  const merchBook = books[0] || null;
  const merchVideo = videos[0] || null;
  const headerIcons = ["Chat", "Mix", "Search"];
  const grossCreatorRevenue = Number(hub?.stats?.revenueNGN || 0);
  const creatorRevenueShare = grossCreatorRevenue * CREATOR_SHARE_RATE;
  const platformRevenueShare = grossCreatorRevenue * PLATFORM_SHARE_RATE;

  return (
    <div className="cpub-page cpub-page-exact">
      <header className="cpub-topbar">
        <div className="cpub-brand">
          <span className="cpub-brand-mark">T</span>
          <span>Tengacion</span>
        </div>
        <div className="cpub-top-icons">
          {headerIcons.map((label) => (
            <button key={label} type="button" aria-label={label} className="cpub-top-icon">
              {label.slice(0, 1)}
            </button>
          ))}
        </div>
      </header>

      <section
        className="cpub-hero cpub-hero-full"
        style={{ backgroundImage: `linear-gradient(90deg, rgba(10, 54, 31, 0.35), rgba(177, 209, 147, 0.16)), url(${creatorCover})` }}
      >
        <div className="cpub-hero-face-wrap">
          <img className="cpub-main-image" src={creatorCover} alt={creator.displayName} />
          <img className="cpub-avatar cpub-avatar-large" src={creatorAvatar} alt={creator.displayName} />
        </div>
        <div className="cpub-hero-copy cpub-hero-copy-exact">
          <h1>
            {creator.displayName}
            {creator.verified ? <span className="verify">V</span> : null}
          </h1>
          <p className="meta">{(Array.isArray(creator.genres) ? creator.genres : []).join(" | ") || "Afrobeat | Author | Comedian"}</p>
          <p className="stats">
            {(creator.followersCount || 0).toLocaleString()} Followers | {(creator.monthlyListeners || 0).toLocaleString()} Supporters
          </p>
          <p className="bio">{creator.bio || "Music and stories from the heart of Africa."}</p>
          <div className="actions">
            <button
              type="button"
              className="primary"
              onClick={() => {
                if (spotlightTrack) {
                  playQueueItem(makePlayable(spotlightTrack, creator.displayName, "song"), 0, playlist);
                }
              }}
            >
              Stream Latest Single
            </button>
            <button type="button" className="ghost" onClick={handleFollow}>
              {isFollowing ? "Following" : "Follow"}
            </button>
          </div>
        </div>
      </section>

      <nav className="cpub-sticky-nav cpub-sticky-nav-exact">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            className={activeNav === item.label ? "active" : ""}
            onClick={() => {
              setActiveNav(item.label);
              if (item.route) {
                navigate(`/creators/${creatorId}/${item.route}`);
              }
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="cpub-layout cpub-layout-exact">
        <main className="cpub-main-col">
          <section className="cpub-card cpub-card-hero-section">
            <div className="cpub-section-head">
              <h2>Spotlight</h2>
              <div className="cpub-dots"><span /><span /><span className="active" /></div>
            </div>
            {spotlightTrack ? (
              <div className="spotlight spotlight-exact">
                <img src={resolveImage(spotlightTrack.coverUrl) || creatorAvatar} alt={spotlightTrack.title} />
                <div>
                  <h3>{spotlightTrack.title}</h3>
                  <p>New Hit Single Out Now!</p>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => playQueueItem(makePlayable(spotlightTrack, creator.displayName, "song"), 0, playlist)}
                  >
                    {spotlightTrack.isFree ? "Listen Preview" : `Unlock Full Song ${money(spotlightTrack.priceNGN || 0)}`}
                  </button>
                </div>
              </div>
            ) : <p className="empty">No singles uploaded yet.</p>}
          </section>

          <section className="cpub-card">
            <div className="cpub-section-head">
              <h2>Top Singles</h2>
              <button type="button" className="cpub-view-all">View All</button>
            </div>
            {singles.length ? singles.map((item, index) => (
              <article key={item.id} className="single-row single-row-exact">
                <img src={resolveImage(item.coverUrl) || creatorAvatar} alt={item.title} />
                <div>
                  <strong>{item.title}</strong>
                  <p>Play Now {money(item.priceNGN || 0)}</p>
                </div>
                <span>{money(item.priceNGN || 0)}</span>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => playQueueItem(makePlayable(item, creator.displayName, "song"), index, playlist)}
                >
                  {item.isFree ? "Listen Preview" : index % 3 === 0 ? "Buy Now" : "Unlock"}
                </button>
              </article>
            )) : <p className="empty">No singles uploaded yet.</p>}
          </section>

          <section className="cpub-card">
            <div className="cpub-section-head">
              <h2>Merch & Offers</h2>
              <a className="cpub-spotify-chip" href={spotifyUrl || "https://spotify.com"} target="_blank" rel="noreferrer">
                Listen on Spotify
              </a>
            </div>
            <div className="cpub-offers-grid">
              <article className="cpub-offer-card">
                <img src={resolveImage(merchAlbum?.coverUrl) || creatorAvatar} alt="Album bundle" />
                <div>
                  <strong>{merchAlbum?.title || "Album Bundle"}</strong>
                  <p>Play Preview</p>
                </div>
                <button type="button" className="primary" onClick={() => merchAlbum && handleBuy("album", merchAlbum.id)}>
                  {money(merchAlbum?.priceNGN || 2799)}
                </button>
              </article>
              <article className="cpub-offer-card">
                <img src={resolveImage(merchBook?.coverUrl || merchVideo?.coverUrl) || creatorAvatar} alt="Signed book" />
                <div>
                  <strong>{merchBook?.title || "Signed Book"}</strong>
                  <p>Play Now</p>
                </div>
                <button type="button" className="primary" onClick={() => merchBook && handleBuy("ebook", merchBook.id)}>
                  {money(merchBook?.priceNGN || 1969)}
                </button>
              </article>
            </div>
          </section>

          <section className="cpub-card">
            <h2>Albums</h2>
            {albums.length ? (
              <div className="tile-grid tile-grid-wide">
                {albums.map((album) => (
                  <article key={album.id} className="tile">
                    <img src={resolveImage(album.coverUrl) || creatorAvatar} alt={album.title} />
                    <strong>{album.title}</strong>
                    <p>{money(album.priceNGN || 0)} | {Number(album.totalTracks || 0)} tracks</p>
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
            <h2>External Links</h2>
            <div className="link-buttons cpub-link-buttons-exact">
              <a href={youtubeUrl || "https://youtube.com"} target="_blank" rel="noreferrer">Visit YouTube</a>
              <a href={spotifyUrl || "https://spotify.com"} target="_blank" rel="noreferrer">Visit Spotify</a>
            </div>
          </section>

          <section className="cpub-card">
            <h2>You May Also Like</h2>
            <div className="cpub-related-grid">
              {fallbackCards.map((card) => (
                <article key={card.name} className="cpub-related-card">
                  <img src={card.image} alt={card.name} />
                  <span>{card.name}</span>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className="cpub-right-col">
          <section className="cpub-side-rail-card">
            <h3>Earnings</h3>
            <p className="cpub-side-muted">Current week</p>
            <strong className="cpub-side-total">{money(creatorRevenueShare)}</strong>
            <div className="cpub-side-chart" aria-hidden="true">
              <span style={{ height: "20%" }} />
              <span style={{ height: "16%" }} />
              <span style={{ height: "23%" }} />
              <span style={{ height: "21%" }} />
              <span style={{ height: "37%" }} />
              <span style={{ height: "34%" }} />
              <span style={{ height: "44%" }} />
              <span style={{ height: "66%" }} />
              <span style={{ height: "64%" }} />
            </div>
            <ul className="cpub-side-list">
              <li><span>Music Sales</span><b>{money(creatorRevenueShare * 0.17)}</b></li>
              <li><span>Store Sales</span><b>{money(creatorRevenueShare * 0.2)}</b></li>
              <li><span>Video Unlocks</span><b>{money(creatorRevenueShare * 0.12)}</b></li>
              <li><span>Podcast Streams</span><b>{money(creatorRevenueShare * 0.11)}</b></li>
              <li><span>Tips</span><b>{money(creatorRevenueShare * 0.06)}</b></li>
            </ul>
            <button type="button" className="cpub-rail-btn">Withdraw Earnings</button>
          </section>

          <section className="cpub-side-rail-card">
            <div className="cpub-section-head compact">
              <h3>Payout Account</h3>
              <span className="cpub-soft-dot" />
            </div>
            <div className="cpub-payout-user">
              <div className="cpub-payout-avatar">{creator.displayName.slice(0, 1).toUpperCase()}</div>
              <div>
                <strong>{creator.displayName}</strong>
                <p>GTBank - 0441****8925</p>
              </div>
            </div>
            <div className="cpub-payout-split">
              <span>40% Creator</span>
              <b>{money(creatorRevenueShare)}</b>
            </div>
            <div className="cpub-payout-split">
              <span>60% Tengacion</span>
              <b>{money(platformRevenueShare)}</b>
            </div>
            <button type="button" className="cpub-rail-btn">Manage Accounts</button>
            <button type="button" className="cpub-rail-btn light">Add Account</button>
          </section>
        </aside>
      </div>

      <div className="cpub-mini-player cpub-mini-player-exact">
        <audio
          ref={audioRef}
          onTimeUpdate={() => {
            const node = audioRef.current;
            if (!node) {
              return;
            }
            setProgress(Number(node.currentTime || 0));
            setDuration(Number(node.duration || 0));
          }}
          onEnded={playNext}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        <div className="track-meta">
          <img src={resolveImage(current?.coverUrl) || creatorAvatar} alt="Now playing" />
          <div>
            <strong>{current?.title || spotlightTrack?.title || "Nothing playing"}</strong>
            <p>{current?.creatorName || creator.displayName}</p>
          </div>
        </div>
        <div className="progress-area progress-area-exact">
          <span>{Math.floor(progress)}:{String(Math.floor(progress % 60)).padStart(2, "0")}</span>
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
        </div>
        <div className="controls">
          <button type="button" onClick={playPrev}>B</button>
          <button type="button" onClick={togglePlay}>{isPlaying ? "II" : "P"}</button>
          <button type="button" onClick={playNext}>N</button>
        </div>
        <button
          type="button"
          className="unlock"
          onClick={() => current && !current.isFree && handleBuy(current.itemType, current.id)}
        >
          Unlock {money(current?.priceNGN || spotlightTrack?.priceNGN || 499)}
        </button>
      </div>
    </div>
  );
}
