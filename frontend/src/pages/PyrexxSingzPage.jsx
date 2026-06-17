import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import SeoHead from "../components/seo/SeoHead";
import {
  buildBreadcrumbJsonLd,
  buildCanonicalUrl,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  resolveSeoImage,
} from "../lib/seo";

import "./pyrexx-singz.css";

const ARTIST_NAME = "Pyrexx_Singz";
const CANONICAL_PATH = "/pyrexx-singz";
const HERO_IMAGE = "/assets/pyrexx-singz-stage-hero.png";
const COVER_IMAGE = "/assets/pyrexx-singz-portrait-denim.jpg";

const NAV_ITEMS = [
  { href: "#home", label: "home" },
  { href: "#bio", label: "bio" },
  { href: "#booking", label: "booking" },
  { href: "#music", label: "music" },
  { href: "#tour", label: "tour" },
  { href: "#events", label: "events" },
  { href: "#media", label: "media" },
  { href: "#app", label: "app" },
  { href: "#press", label: "press" },
];

const GALLERY = [
  {
    src: "/assets/pyrexx-singz-portrait-denim.jpg",
    alt: "Pyrexx_Singz wearing a dark denim jacket and sunglasses",
  },
  {
    src: "/assets/pyrexx-singz-portrait-blue-suit.jpg",
    alt: "Pyrexx_Singz in a blue suit and bow tie",
  },
  {
    src: "/assets/pyrexx-singz-portrait-black-suit.jpg",
    alt: "Pyrexx_Singz in a black suit and sunglasses",
  },
  {
    src: "/assets/pyrexx-singz-portrait-yellow.jpg",
    alt: "Pyrexx_Singz in a yellow shirt with jewelry",
  },
  {
    src: "/assets/pyrexx-singz-portrait-gold.png",
    alt: "Pyrexx_Singz seated in a blue jacket and sunglasses",
  },
  {
    src: "/assets/pyrexx-singz-portrait-formal.jpg",
    alt: "Pyrexx_Singz smiling in a formal vest",
  },
];

const TRACKS = [
  {
    id: "tashi-mu-je",
    title: "Tashi Mu Je",
    duration: 179,
    tag: "Featured",
    src: "/assets/audio/pyrexx-singz/pyrex-tashi-mu-je.mp3",
  },
  {
    id: "yarinya",
    title: "Yarinya",
    duration: 137,
    tag: "Afro-fusion",
    src: "/assets/audio/pyrexx-singz/pyrexx-sing-yarinya.mp3",
  },
  {
    id: "hold-me-pray",
    title: "Hold Me & Pray",
    duration: 158,
    tag: "Prayer anthem",
    src: "/assets/audio/pyrexx-singz/pyrexx-singz-hold-me-pray.mp3",
  },
  {
    id: "mamas-love",
    title: "Mama's Love",
    duration: 166,
    tag: "Soul dedication",
    src: "/assets/audio/pyrexx-singz/pyrexx-singz-mamas-love.mp3",
  },
];

const SHOWS = [
  { label: "Club sets", detail: "High-energy Afrobeats and Afro-fusion appearances" },
  { label: "Private events", detail: "Premium performances for curated rooms and celebrations" },
  { label: "Listening sessions", detail: "Intimate playback nights, media drops, and fan moments" },
];

function formatDuration(seconds) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function ArtistLogo() {
  return (
    <a className="pyrexx-logo" href="#home" aria-label="Pyrexx_Singz home">
      <span className="pyrexx-logo__mark">P</span>
      <span>
        <strong>PYREXX</strong>
        <small>SINGZ</small>
      </span>
    </a>
  );
}

function PlayerBar({
  activeTrackIndex,
  currentTime,
  duration,
  isPlaying,
  onNext,
  onPrevious,
  onTogglePlayback,
  track,
}) {
  const playbackDuration = duration || track.duration;
  const progress = playbackDuration > 0 ? Math.min(100, (currentTime / playbackDuration) * 100) : 0;
  const playbackAction = isPlaying ? "Pause" : "Play";

  return (
    <aside className="pyrexx-player" aria-label="Featured Pyrexx_Singz playback">
      <div className="pyrexx-player__language">
        <span>Track</span>
        <strong>{String(activeTrackIndex + 1).padStart(2, "0")}</strong>
      </div>

      <div className="pyrexx-player__track">
        <img src={COVER_IMAGE} alt="" />
        <div>
          <strong>{track.title}</strong>
          <span>{ARTIST_NAME}</span>
        </div>
      </div>

      <div className="pyrexx-player__controls">
        <button type="button" className="pyrexx-player__skip pyrexx-player__skip--back" onClick={onPrevious} aria-label="Previous track" />
        <button
          type="button"
          className={`pyrexx-player__play${isPlaying ? " is-playing" : ""}`}
          onClick={onTogglePlayback}
          aria-label={`${playbackAction} ${track.title}`}
        >
          <span />
        </button>
        <button type="button" className="pyrexx-player__skip pyrexx-player__skip--next" onClick={onNext} aria-label="Next track" />
      </div>

      <div className="pyrexx-player__timeline">
        <div className="pyrexx-player__meta">
          <span>{track.title}</span>
          <strong>
            {formatDuration(currentTime)} / {formatDuration(playbackDuration)}
          </strong>
        </div>
        <div className="pyrexx-player__bar">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <a className="pyrexx-player__cta" href="#music">
        Music
      </a>
    </aside>
  );
}

export default function PyrexxSingzPage() {
  const audioRef = useRef(null);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(TRACKS[0].duration);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeTrack = TRACKS[activeTrackIndex];
  const pageDescription =
    "Official public website for Pyrexx_Singz on Tengacion. Listen to Tashi Mu Je, Yarinya, Hold Me & Pray, Mama's Love, and discover booking details, media photos, and artist updates.";
  const structuredData = [
    buildWebSiteJsonLd(),
    buildOrganizationJsonLd(),
    buildBreadcrumbJsonLd([
      { name: "Tengacion", url: "/" },
      { name: ARTIST_NAME, url: CANONICAL_PATH },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      name: `${ARTIST_NAME} official website`,
      url: buildCanonicalUrl(CANONICAL_PATH),
      description: pageDescription,
      mainEntity: {
        "@type": "Person",
        name: ARTIST_NAME,
        image: resolveSeoImage(HERO_IMAGE),
        jobTitle: "Music artist",
        description:
          "Afro-fusion and R&B artist presenting vocals, live appearances, media, and booking updates.",
      },
    },
  ];

  useEffect(() => {
    setCurrentTime(0);
    setDuration(activeTrack.duration);
  }, [activeTrack]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (!isPlaying) {
      audio.pause();
      return;
    }

    const playPromise = audio.play();

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => setIsPlaying(false));
    }
  }, [activeTrackIndex, isPlaying]);

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;

    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration);
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;

    setCurrentTime(audio?.currentTime || 0);
  };

  const handleNextTrack = () => {
    setActiveTrackIndex((currentIndex) => (currentIndex + 1) % TRACKS.length);
    setIsPlaying(true);
  };

  const handlePreviousTrack = () => {
    setActiveTrackIndex((currentIndex) => (currentIndex - 1 + TRACKS.length) % TRACKS.length);
    setIsPlaying(true);
  };

  const handleTrackSelect = (trackIndex) => {
    if (trackIndex === activeTrackIndex) {
      setIsPlaying((currentValue) => !currentValue);
      return;
    }

    setActiveTrackIndex(trackIndex);
    setIsPlaying(true);
  };

  return (
    <main className="pyrexx-site" id="home">
      <SeoHead
        title={`${ARTIST_NAME} | Official Artist Website`}
        description={pageDescription}
        canonical={CANONICAL_PATH}
        ogType="profile"
        ogImage={HERO_IMAGE}
        ogImageAlt="Pyrexx_Singz artist portrait"
        twitterImage={HERO_IMAGE}
        twitterImageAlt="Pyrexx_Singz artist portrait"
        structuredData={structuredData}
      />

      <section className="pyrexx-hero" aria-label={`${ARTIST_NAME} official artist website`}>
        <nav className="pyrexx-nav" aria-label="Pyrexx_Singz website navigation">
          <ArtistLogo />
          <div className="pyrexx-nav__links">
            {NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href} className={item.href === "#home" ? "is-active" : ""}>
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="pyrexx-hero__stage">
          <div className="pyrexx-hero__copy">
            <p className="pyrexx-kicker">Official Tengacion artist page</p>
            <h1>
              RAW VOCALS.
              <br />
              STREET SOUL.
              <br />
              UNFORGETTABLE.
            </h1>
            <p className="pyrexx-hero__genre">Afrobeats | Afro-fusion | R&B</p>
            <div className="pyrexx-hero__actions">
              <a href="#music">Listen Now</a>
              <a href="#booking">Book Pyrexx</a>
            </div>
          </div>

          <figure className="pyrexx-hero__media">
            <img src={HERO_IMAGE} alt="Pyrexx_Singz holding a gold microphone on stage" />
          </figure>
        </div>
      </section>

      <PlayerBar
        activeTrackIndex={activeTrackIndex}
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onNext={handleNextTrack}
        onPrevious={handlePreviousTrack}
        onTogglePlayback={() => setIsPlaying((currentValue) => !currentValue)}
        track={activeTrack}
      />

      <audio
        ref={audioRef}
        src={activeTrack.src}
        preload="metadata"
        onEnded={handleNextTrack}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
      />

      <section className="pyrexx-section pyrexx-section--bio" id="bio">
        <div className="pyrexx-section__copy">
          <p className="pyrexx-kicker">bio</p>
          <h2>Pyrexx_Singz moves between polish and pressure.</h2>
          <p>
            A sharp vocal presence with a clean visual identity, Pyrexx_Singz blends Afrobeats,
            Afro-fusion, R&B feeling, and a streetwise performance style built for stages, videos,
            and close-up fan moments.
          </p>
        </div>
        <img
          className="pyrexx-section__portrait"
          src="/assets/pyrexx-singz-portrait-blue-suit.jpg"
          alt="Pyrexx_Singz smiling in a blue suit"
          loading="lazy"
        />
      </section>

      <section className="pyrexx-section pyrexx-section--split" id="booking">
        <div>
          <p className="pyrexx-kicker">booking</p>
          <h2>Available for live sets, private events, collaborations, and media appearances.</h2>
        </div>
        <div className="pyrexx-booking">
          <a href="mailto:bookings@tengacion.com?subject=Pyrexx_Singz%20booking%20request">
            Send Booking Request
          </a>
          <Link to="/contact">Contact Tengacion</Link>
        </div>
      </section>

      <section className="pyrexx-section pyrexx-section--music" id="music">
        <div className="pyrexx-section__head">
          <p className="pyrexx-kicker">music</p>
          <h2>Featured playback</h2>
        </div>
        <div className="pyrexx-music">
          {TRACKS.map((track, index) => (
            <article
              key={track.id}
              className={`${index === activeTrackIndex ? "is-featured" : ""}${index === activeTrackIndex && isPlaying ? " is-playing" : ""}`}
            >
              <button
                type="button"
                className={`pyrexx-music__play${index === activeTrackIndex && isPlaying ? " is-playing" : ""}`}
                onClick={() => handleTrackSelect(index)}
                aria-label={`${index === activeTrackIndex && isPlaying ? "Pause" : "Play"} ${track.title}`}
              >
                <span />
              </button>
              <span className="pyrexx-music__index">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{track.title}</strong>
                <small>{track.tag}</small>
              </div>
              <em>{formatDuration(track.duration)}</em>
            </article>
          ))}
        </div>
      </section>

      <section className="pyrexx-section pyrexx-section--events" id="tour">
        <div className="pyrexx-section__head">
          <p className="pyrexx-kicker">tour | events</p>
          <h2>Built for rooms that want energy, style, and live vocal presence.</h2>
        </div>
        <div className="pyrexx-events">
          {SHOWS.map((show) => (
            <article key={show.label}>
              <span>Booking now</span>
              <strong>{show.label}</strong>
              <p>{show.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pyrexx-section pyrexx-section--media" id="media">
        <div className="pyrexx-section__head">
          <p className="pyrexx-kicker">media</p>
          <h2>Photo archive</h2>
        </div>
        <div className="pyrexx-gallery">
          {GALLERY.map((photo) => (
            <figure key={photo.src}>
              <img src={photo.src} alt={photo.alt} loading="lazy" />
            </figure>
          ))}
        </div>
      </section>

      <section className="pyrexx-section pyrexx-section--app" id="app">
        <div>
          <p className="pyrexx-kicker">app</p>
          <h2>Follow Pyrexx_Singz on Tengacion.</h2>
          <p>
            Join Tengacion to keep up with new drops, fan updates, creator releases, and public
            artist moments as they go live.
          </p>
        </div>
        <Link to="/register">Join Tengacion</Link>
      </section>

      <section className="pyrexx-section pyrexx-section--press" id="press">
        <div>
          <p className="pyrexx-kicker">press</p>
          <h2>Press kit ready.</h2>
          <p>
            Use this page as the public home for press photos, booking inquiries, media references,
            and Pyrexx_Singz profile links.
          </p>
        </div>
        <img
          src="/assets/pyrexx-singz-portrait-black-suit.jpg"
          alt="Pyrexx_Singz press portrait in a black suit"
          loading="lazy"
        />
      </section>
    </main>
  );
}
