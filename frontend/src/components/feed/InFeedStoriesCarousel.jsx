import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import StoryCard from "../../stories/StoryCard";
import "../../stories/stories.css";

const MAX_STORIES_PER_CAROUSEL = 12;
const EDGE_TOLERANCE_PX = 4;

const selectStoryGroupsForCarousel = (groups = [], blockIndex = 0) => {
  const candidates = (Array.isArray(groups) ? groups : []).filter(
    (group) => group?.latestStory && Array.isArray(group?.stories) && group.stories.length > 0
  );

  if (candidates.length <= MAX_STORIES_PER_CAROUSEL) {
    return candidates;
  }

  const start =
    (Math.max(0, Number(blockIndex) || 0) * MAX_STORIES_PER_CAROUSEL) %
    candidates.length;

  return Array.from(
    { length: MAX_STORIES_PER_CAROUSEL },
    (_, index) => candidates[(start + index) % candidates.length]
  );
};

function StoriesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.8A2.8 2.8 0 0 1 6.8 3h3.4A2.8 2.8 0 0 1 13 5.8v12.4a2.8 2.8 0 0 1-2.8 2.8H6.8A2.8 2.8 0 0 1 4 18.2V5.8Zm9.7 1.4A2.7 2.7 0 0 1 16.4 4h.8A2.8 2.8 0 0 1 20 6.8v10.4a2.8 2.8 0 0 1-2.8 2.8h-.8a2.7 2.7 0 0 1-2.7-3V7.2Z" />
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

export default function InFeedStoriesCarousel({
  groups = [],
  blockIndex = 0,
  onDeleted,
  onSeen,
}) {
  const trackRef = useRef(null);
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const carouselGroups = useMemo(
    () => selectStoryGroupsForCarousel(groups, blockIndex),
    [blockIndex, groups]
  );

  const syncControls = useCallback(() => {
    const track = trackRef.current;
    if (!track) {
      setCanScrollPrevious(false);
      setCanScrollNext(false);
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
  }, [carouselGroups.length, syncControls]);

  const move = (direction) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const distance = Math.max(260, track.clientWidth * 0.78);
    const left = direction === "previous" ? -distance : distance;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (typeof track.scrollBy === "function") {
      track.scrollBy({ left, behavior: reducedMotion ? "auto" : "smooth" });
    } else {
      track.scrollLeft += left;
      syncControls();
    }
  };

  if (!carouselGroups.length) {
    return null;
  }

  return (
    <section className="card in-feed-stories" aria-label="Stories">
      <header className="in-feed-stories-head">
        <span className="in-feed-stories-mark" aria-hidden="true">
          <StoriesIcon />
        </span>
        <h2>Stories</h2>
      </header>

      <div className="in-feed-stories-window">
        <button
          type="button"
          className="in-feed-stories-control in-feed-stories-control--previous"
          aria-label="Show previous stories"
          disabled={!canScrollPrevious}
          onClick={() => move("previous")}
        >
          <CarouselArrow direction="previous" />
        </button>

        <div
          ref={trackRef}
          className="in-feed-stories-track"
          data-testid="in-feed-stories-track"
          tabIndex={0}
          aria-label="Browse stories horizontally"
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
          {carouselGroups.map((group, groupIndex) => (
            <StoryCard
              key={group.ownerId || group.latestStory?._id || group.latestStory?.id}
              story={group.latestStory}
              stories={group.stories}
              storyGroups={carouselGroups}
              groupIndex={groupIndex}
              hasUnseen={group.hasUnseen}
              isOwner={group.isOwner}
              onDeleted={onDeleted}
              onSeen={onSeen}
              videoPreload="none"
            />
          ))}
        </div>

        <button
          type="button"
          className="in-feed-stories-control in-feed-stories-control--next"
          aria-label="Show next stories"
          disabled={!canScrollNext}
          onClick={() => move("next")}
        >
          <CarouselArrow direction="next" />
        </button>
      </div>
    </section>
  );
}
