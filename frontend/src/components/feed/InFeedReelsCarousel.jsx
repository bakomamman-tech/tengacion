import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  getReelAvatar,
  getReelAvatarFallback,
  getReelDisplayName,
  getReelPoster,
  getReelUsername,
  getReelVideoUrl,
} from "../../utils/reels";

const MAX_REELS_PER_CAROUSEL = 12;
const EDGE_TOLERANCE_PX = 4;
const VIDEO_PREVIEW_ROOT_MARGIN = "180px";

const clampCaption = (value = "") => String(value || "").trim() || "Watch this reel";

const getPreviewVideoUrl = (value = "") => {
  const url = String(value || "").trim();
  if (!url || url.includes("#")) {
    return url;
  }
  return `${url}#t=0.1`;
};

const selectReelsForCarousel = (reels = [], blockIndex = 0) => {
  const candidates = (Array.isArray(reels) ? reels : []).filter(
    (reel) => reel?._id && getReelVideoUrl(reel)
  );
  if (candidates.length <= MAX_REELS_PER_CAROUSEL) {
    return candidates;
  }

  const start = (Math.max(0, Number(blockIndex) || 0) * MAX_REELS_PER_CAROUSEL) % candidates.length;
  return Array.from(
    { length: MAX_REELS_PER_CAROUSEL },
    (_, index) => candidates[(start + index) % candidates.length]
  );
};

function ReelPlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.25 5.4v13.2L18.7 12 8.25 5.4Z" />
    </svg>
  );
}

function CarouselArrow({ direction }) {
  const isPrevious = direction === "previous";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={isPrevious ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"} />
    </svg>
  );
}

function ReelPreview({ posterUrl, videoUrl }) {
  const previewGateRef = useRef(null);
  const [failedPosterUrl, setFailedPosterUrl] = useState("");
  const [failedVideoUrl, setFailedVideoUrl] = useState("");
  const [shouldLoadVideo, setShouldLoadVideo] = useState(
    () => typeof IntersectionObserver !== "function"
  );
  const posterFailed = Boolean(posterUrl && failedPosterUrl === posterUrl);
  const videoFailed = Boolean(videoUrl && failedVideoUrl === videoUrl);

  useEffect(() => {
    if (
      shouldLoadVideo ||
      !videoUrl ||
      videoFailed ||
      (posterUrl && !posterFailed) ||
      typeof IntersectionObserver !== "function"
    ) {
      return undefined;
    }

    const previewGate = previewGateRef.current;
    if (!previewGate) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) {
          setShouldLoadVideo(true);
          observer.disconnect();
        }
      },
      { rootMargin: VIDEO_PREVIEW_ROOT_MARGIN, threshold: 0.01 }
    );
    observer.observe(previewGate);

    return () => observer.disconnect();
  }, [posterFailed, posterUrl, shouldLoadVideo, videoFailed, videoUrl]);

  if (posterUrl && !posterFailed) {
    return (
      <img
        className="in-feed-reel-preview"
        src={posterUrl}
        alt=""
        loading="lazy"
        draggable="false"
        onError={() => setFailedPosterUrl(posterUrl)}
      />
    );
  }

  if (videoUrl && !videoFailed && shouldLoadVideo) {
    return (
      <video
        className="in-feed-reel-preview"
        src={getPreviewVideoUrl(videoUrl)}
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
        onError={() => setFailedVideoUrl(videoUrl)}
      />
    );
  }

  return (
    <span
      ref={videoUrl && !videoFailed ? previewGateRef : null}
      className="in-feed-reel-preview-fallback"
      aria-hidden="true"
    />
  );
}

function ReelAuthorAvatar({ reel }) {
  const avatarFallback = getReelAvatarFallback(reel);
  const avatarUrl = getReelAvatar(reel);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState("");
  const src = avatarUrl === failedAvatarUrl ? avatarFallback : avatarUrl;

  return (
    <img
      className="in-feed-reel-avatar"
      src={src}
      alt=""
      loading="lazy"
      draggable="false"
      onError={() => {
        if (src !== avatarFallback) {
          setFailedAvatarUrl(avatarUrl);
        }
      }}
    />
  );
}

export default function InFeedReelsCarousel({ reels = [], blockIndex = 0 }) {
  const trackRef = useRef(null);
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);
  const carouselReels = useMemo(
    () => selectReelsForCarousel(reels, blockIndex),
    [blockIndex, reels]
  );

  const syncControls = useCallback(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    setCanScrollPrevious(track.scrollLeft > EDGE_TOLERANCE_PX);
    setCanScrollNext(
      maxScrollLeft > EDGE_TOLERANCE_PX &&
        track.scrollLeft < maxScrollLeft - EDGE_TOLERANCE_PX
    );
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) {
      return undefined;
    }

    syncControls();
    track.addEventListener("scroll", syncControls, { passive: true });
    window.addEventListener("resize", syncControls);

    const resizeObserver =
      typeof ResizeObserver === "function" ? new ResizeObserver(syncControls) : null;
    resizeObserver?.observe(track);

    return () => {
      track.removeEventListener("scroll", syncControls);
      window.removeEventListener("resize", syncControls);
      resizeObserver?.disconnect();
    };
  }, [carouselReels.length, syncControls]);

  const move = (direction) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const distance = Math.max(260, track.clientWidth * 0.78);
    const left = direction === "previous" ? -distance : distance;
    const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    if (typeof track.scrollBy === "function") {
      track.scrollBy({ left, behavior });
    } else {
      track.scrollLeft += left;
      syncControls();
    }
  };

  if (!carouselReels.length) {
    return null;
  }

  return (
    <section className="card in-feed-reels" aria-label="Tengacion reels">
      <header className="in-feed-reels-head">
        <div>
          <span className="in-feed-reels-mark" aria-hidden="true">
            <ReelPlayIcon />
          </span>
          <div>
            <h2>Reels</h2>
            <p>Fresh short videos from Tengacion</p>
          </div>
        </div>
        <Link className="in-feed-reels-see-all" to="/reels">
          See all
        </Link>
      </header>

      <div className="in-feed-reels-window">
        <button
          type="button"
          className="in-feed-reels-control in-feed-reels-control--previous"
          aria-label="Show previous reels"
          disabled={!canScrollPrevious}
          onClick={() => move("previous")}
        >
          <CarouselArrow direction="previous" />
        </button>

        <div
          ref={trackRef}
          className="in-feed-reels-track"
          data-testid="in-feed-reels-track"
          tabIndex={0}
          aria-label="Browse Tengacion reels horizontally"
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              move("previous");
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              move("next");
            }
          }}
        >
          {carouselReels.map((reel) => {
            const reelId = String(reel._id);
            const authorName = getReelDisplayName(reel);
            const username = getReelUsername(reel);
            const caption = clampCaption(reel?.text);
            const posterUrl = getReelPoster(reel);
            const videoUrl = getReelVideoUrl(reel);

            return (
              <Link
                key={reelId}
                className="in-feed-reel-card"
                to={`/reels?reel=${encodeURIComponent(reelId)}`}
                aria-label={`Watch ${caption} by ${authorName}`}
              >
                <span className="in-feed-reel-media">
                  <ReelPreview posterUrl={posterUrl} videoUrl={videoUrl} />
                  <span className="in-feed-reel-shade" aria-hidden="true" />
                  <span className="in-feed-reel-play" aria-hidden="true">
                    <ReelPlayIcon />
                  </span>
                  <span className="in-feed-reel-copy">
                    <strong>{caption}</strong>
                    <span>
                      <ReelAuthorAvatar reel={reel} />
                      <span>{username ? `@${username}` : authorName}</span>
                    </span>
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          className="in-feed-reels-control in-feed-reels-control--next"
          aria-label="Show next reels"
          disabled={!canScrollNext}
          onClick={() => move("next")}
        >
          <CarouselArrow direction="next" />
        </button>
      </div>
    </section>
  );
}
