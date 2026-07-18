import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { resolveImage } from "../../api";

const MAX_PEOPLE_PER_CAROUSEL = 12;
const EDGE_TOLERANCE_PX = 4;

const cleanUsername = (value = "") => String(value || "").trim().replace(/^@+/, "");

const fallbackAvatar = (name = "User") =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    String(name || "User").trim() || "User"
  )}&size=320&background=E3EFE7&color=1B5838`;

const selectPeopleForCarousel = (people = [], blockIndex = 0) => {
  const seenIds = new Set();
  const candidates = (Array.isArray(people) ? people : []).filter((person) => {
    const personId = String(person?._id || person?.id || "").trim();
    const username = cleanUsername(person?.username);
    if (!personId || !username || seenIds.has(personId)) {
      return false;
    }
    seenIds.add(personId);
    return true;
  });

  if (candidates.length <= MAX_PEOPLE_PER_CAROUSEL) {
    return candidates;
  }

  const start =
    (Math.max(0, Number(blockIndex) || 0) * MAX_PEOPLE_PER_CAROUSEL) % candidates.length;
  return Array.from(
    { length: MAX_PEOPLE_PER_CAROUSEL },
    (_, index) => candidates[(start + index) % candidates.length]
  );
};

const getMutualFriendCopy = (value) => {
  const total = Math.max(0, Number(value) || 0);
  return `${total} mutual friend${total === 1 ? "" : "s"}`;
};

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.2 11.1a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4ZM2.4 20.1c.35-4.1 2.45-6.3 5.8-6.3s5.45 2.2 5.8 6.3M16.15 11.2a3.05 3.05 0 1 0 0-6.1M15.7 14.05c3.25-.55 5.4 1.45 5.8 5.25" />
    </svg>
  );
}

function AddFriendIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7.1 8.9a3.55 3.55 0 1 0 0-7.1 3.55 3.55 0 0 0 0 7.1ZM1.1 17.95c.35-3.25 2.55-5.3 6-5.3 1.2 0 2.25.25 3.1.75M14.8 10.8v7M11.3 14.3h7" />
    </svg>
  );
}

function CarouselArrow({ direction }) {
  const isPrevious = direction === "previous";
  return (
    <svg className="feed-carousel-arrow-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={isPrevious ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"} />
    </svg>
  );
}

export default function InFeedPeopleCarousel({
  people = [],
  blockIndex = 0,
  pendingIds = new Set(),
  onAdd,
  onDismiss,
}) {
  const trackRef = useRef(null);
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const carouselPeople = useMemo(
    () => selectPeopleForCarousel(people, blockIndex),
    [blockIndex, people]
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
  }, [carouselPeople.length, syncControls]);

  const move = (direction) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const distance = Math.max(260, track.clientWidth * 0.78);
    const left = direction === "previous" ? -distance : distance;
    const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
      ? "auto"
      : "smooth";

    if (typeof track.scrollBy === "function") {
      track.scrollBy({ left, behavior });
    } else {
      track.scrollLeft += left;
      syncControls();
    }
  };

  if (!carouselPeople.length) {
    return null;
  }

  return (
    <section className="card in-feed-people" aria-label="People you may know">
      <header className="in-feed-people-head">
        <div className="in-feed-people-heading">
          <span className="in-feed-people-mark" aria-hidden="true">
            <PeopleIcon />
          </span>
          <div>
            <h2>People You May Know</h2>
            <p>Find familiar faces and grow your Tengacion circle</p>
          </div>
        </div>
        <Link className="in-feed-people-see-all" to="/find-friends">
          See all
        </Link>
      </header>

      <div className="in-feed-people-window">
        <button
          type="button"
          className="in-feed-people-control in-feed-people-control--previous"
          aria-label="Show previous people"
          disabled={!canScrollPrevious}
          onClick={() => move("previous")}
        >
          <CarouselArrow direction="previous" />
        </button>

        <div
          ref={trackRef}
          className="in-feed-people-track"
          data-testid="in-feed-people-track"
          tabIndex={0}
          aria-label="Browse people you may know horizontally"
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
          {carouselPeople.map((person) => {
            const personId = String(person._id || person.id);
            const username = cleanUsername(person.username);
            const displayName = String(person.name || username || "Tengacion member").trim();
            const isPending = Boolean(
              pendingIds?.has?.(person._id) ||
                pendingIds?.has?.(person.id) ||
                pendingIds?.has?.(personId)
            );
            const avatar =
              resolveImage(person.avatar || person.profilePic || "") || fallbackAvatar(displayName);

            return (
              <article className="in-feed-people-card" key={personId}>
                <Link
                  className="in-feed-people-profile"
                  to={`/profile/${encodeURIComponent(username)}`}
                  aria-label={`View ${displayName}'s profile`}
                >
                  <span className="in-feed-people-avatar">
                    <img src={avatar} alt="" loading="lazy" draggable="false" />
                  </span>
                  <span className="in-feed-people-copy">
                    <strong>{displayName}</strong>
                    <span>{getMutualFriendCopy(person.mutualFriendsCount)}</span>
                  </span>
                </Link>

                {typeof onDismiss === "function" ? (
                  <button
                    type="button"
                    className="in-feed-people-dismiss"
                    aria-label={`Dismiss ${displayName}`}
                    onClick={() => onDismiss(person)}
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="m5 5 10 10M15 5 5 15" />
                    </svg>
                  </button>
                ) : null}

                <button
                  type="button"
                  className="in-feed-people-add"
                  disabled={isPending || typeof onAdd !== "function"}
                  aria-busy={isPending}
                  onClick={() => onAdd?.(person)}
                >
                  {isPending ? (
                    <>
                      <span className="in-feed-people-spinner" aria-hidden="true" />
                      <span>Sending…</span>
                    </>
                  ) : (
                    <>
                      <AddFriendIcon />
                      <span>Add friend</span>
                    </>
                  )}
                </button>
              </article>
            );
          })}
        </div>

        <button
          type="button"
          className="in-feed-people-control in-feed-people-control--next"
          aria-label="Show next people"
          disabled={!canScrollNext}
          onClick={() => move("next")}
        >
          <CarouselArrow direction="next" />
        </button>
      </div>
    </section>
  );
}
