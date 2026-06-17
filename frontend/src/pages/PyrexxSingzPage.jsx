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
const ARTIST_PROFILE = {
  genre: "Afro-Gospel / Inspirational Afrobeat / Conscious Music",
  location: "Nigeria",
  label: "Pyrexx Recordz / Pyrexx Studios",
  legalName: "Stephen Daniel Kurah",
  officialCreatorLink: "https://tengacion.com/creator/pyrexx_singz",
  email: "bakomamman@gmail.com",
  phone: "+2348061201090",
};

const SHORT_BIO = [
  "Pyrexx_Singz is a Nigerian inspirational artist, songwriter, music producer, and creative entrepreneur whose music blends heartfelt gospel expression, Afrobeat rhythm, and socially conscious storytelling. Known for songs such as \"Send Some Water\" and \"Every Drop Has A Sound,\" Pyrexx_Singz creates music that speaks to hope, faith, humanity, struggle, gratitude, and transformation.",
  "His sound is emotional, message-driven, and deeply connected to real-life experiences. Through his music, Pyrexx_Singz aims to inspire listeners, encourage positive change, and use art as a voice for healing, reflection, and spiritual strength.",
];

const PROFESSIONAL_BIO = [
  `Pyrexx_Singz is the stage name of Nigerian artist, songwriter, producer, and creative visionary ${ARTIST_PROFILE.legalName}. His music carries a strong blend of Afro-Gospel, inspirational Afrobeat, conscious songwriting, and emotional storytelling, creating a sound that is both spiritual and socially aware.`,
  "As an artist, Pyrexx_Singz focuses on songs that speak beyond entertainment. His music explores themes of faith, perseverance, gratitude, compassion, social reality, and hope. With records like \"Send Some Water\" and \"Every Drop Has A Sound,\" he positions himself as a voice for people who are searching for meaning, encouragement, and strength in everyday life.",
  "His creative journey is deeply rooted in purpose. Beyond singing, Pyrexx_Singz is involved in music production, storytelling, education, technology, and creative development. This gives his artistry a wider vision: to build music that not only sounds good, but also carries a message that can touch communities, inspire young people, and promote positive values.",
  "Operating under the creative identity of Pyrexx Recordz and Pyrexx Studios, Pyrexx_Singz continues to develop a catalog of music that reflects his passion for humanity, faith, and African creativity. His work is also connected to Tengacion, a growing creator platform where fans can discover his music, books, podcasts, updates, and creative projects.",
  "With a voice driven by sincerity and a message rooted in purpose, Pyrexx_Singz is building a brand that stands for inspiration, faith, creativity, and impact.",
];

const NAV_ITEMS = [
  { href: "#home", label: "home" },
  { href: "#bio", label: "bio" },
  { href: "#booking", label: "booking" },
  { href: "#music", label: "music" },
  { href: "#links", label: "links" },
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

const ARTIST_LINKS = [
  {
    label: "Apple Music",
    detail: "Stream the official Pyrexx_Singz artist catalog on Apple Music.",
    href: "https://music.apple.com/us/artist/pyrexx-singz/1837473632",
    type: "streaming",
  },
  {
    label: "Official Artist Website",
    detail: "Visit the official Tengacion artist website for music, media, and booking.",
    href: "https://tengacion.com/pyrexx_singz",
    type: "website",
  },
  {
    label: "Tengacion Creator Profile",
    detail: "Follow the official Tengacion creator profile for music, books, podcasts, and updates.",
    href: ARTIST_PROFILE.officialCreatorLink,
    type: "tengacion",
  },
  {
    label: "Facebook Artist Page",
    detail: "Follow the Pyrexx Symphony artist page for updates and fan moments.",
    href: "https://web.facebook.com/pyrexxsymphony/?_rdc=1&_rdr#",
    type: "social",
  },
  {
    label: "Spotify Account",
    detail: "Open the Spotify artist account connected to Pyrexx_Singz.",
    href: "https://artists.spotify.com/c/artist/0oPAGns3NQSZO0gTTVoYdM/profile/overview",
    type: "streaming",
  },
  {
    label: "Amazon.com",
    detail: "Listen to Pyrexx_Singz releases on Amazon Music.",
    href: "https://music.amazon.com/artists/B0FPFN1HH7/pyrexx_singz",
    type: "streaming",
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
    "Official public website for Pyrexx_Singz, a Nigerian Afro-Gospel, inspirational Afrobeat, and conscious music artist creating songs of faith, hope, humanity, healing, and positive change.";
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
        alternateName: ARTIST_PROFILE.legalName,
        image: resolveSeoImage(HERO_IMAGE),
        jobTitle: "Music artist",
        homeLocation: ARTIST_PROFILE.location,
        brand: ARTIST_PROFILE.label,
        email: ARTIST_PROFILE.email,
        telephone: ARTIST_PROFILE.phone,
        sameAs: ARTIST_LINKS.map((link) => link.href),
        description:
          "Nigerian inspirational artist, songwriter, music producer, and creative entrepreneur whose music blends heartfelt gospel expression, Afrobeat rhythm, conscious songwriting, and emotional storytelling.",
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
              FAITH.
              <br />
              AFROBEAT.
              <br />
              IMPACT.
            </h1>
            <p className="pyrexx-hero__genre">{ARTIST_PROFILE.genre}</p>
            <div className="pyrexx-hero__actions">
              <a href="#music">Listen Now</a>
              <a href="#links">Official Links</a>
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
          <h2>Pyrexx_Singz turns faith, humanity, and struggle into conscious Afrobeat.</h2>
          {SHORT_BIO.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <img
          className="pyrexx-section__portrait"
          src="/assets/pyrexx-singz-portrait-blue-suit.jpg"
          alt="Pyrexx_Singz smiling in a blue suit"
          loading="lazy"
        />
      </section>

      <section className="pyrexx-section pyrexx-section--profile" aria-label="Pyrexx_Singz artist details">
        <dl className="pyrexx-profile-facts">
          <div>
            <dt>Artist name</dt>
            <dd>{ARTIST_NAME}</dd>
          </div>
          <div>
            <dt>Genre</dt>
            <dd>{ARTIST_PROFILE.genre}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{ARTIST_PROFILE.location}</dd>
          </div>
          <div>
            <dt>Official Tengacion Artist Link</dt>
            <dd>
              <a href={ARTIST_PROFILE.officialCreatorLink} target="_blank" rel="noreferrer">
                {ARTIST_PROFILE.officialCreatorLink}
              </a>
            </dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${ARTIST_PROFILE.email}`}>{ARTIST_PROFILE.email}</a>
            </dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${ARTIST_PROFILE.phone}`}>{ARTIST_PROFILE.phone}</a>
            </dd>
          </div>
          <div>
            <dt>Label / Brand</dt>
            <dd>{ARTIST_PROFILE.label}</dd>
          </div>
        </dl>
        <div className="pyrexx-profile-story">
          <p className="pyrexx-kicker">professional bio</p>
          <h2>A message-driven sound rooted in purpose.</h2>
          {PROFESSIONAL_BIO.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section className="pyrexx-section pyrexx-section--split" id="booking">
        <div>
          <p className="pyrexx-kicker">booking</p>
          <h2>Available for live sets, private events, collaborations, and media appearances.</h2>
        </div>
        <div className="pyrexx-booking">
          <a href={`mailto:${ARTIST_PROFILE.email}?subject=Pyrexx_Singz%20booking%20request`}>
            Email Pyrexx
          </a>
          <a href={`tel:${ARTIST_PROFILE.phone}`}>
            Call Pyrexx
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

      <section className="pyrexx-section pyrexx-section--links" id="links">
        <div className="pyrexx-section__head">
          <p className="pyrexx-kicker">official links</p>
          <h2>Find Pyrexx_Singz across music platforms and social channels.</h2>
        </div>
        <div className="pyrexx-links">
          {ARTIST_LINKS.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
              <span>{link.type}</span>
              <strong>{link.label}</strong>
              <small>{link.detail}</small>
            </a>
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
