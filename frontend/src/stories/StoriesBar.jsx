import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getStories } from "../api";
import StoryCard from "./StoryCard";
import CreateStory from "./CreateStory";
import { groupStoriesByOwner, markStoriesSeen } from "./storyGroups";
import "./stories.css";

function StoryChevron({ direction }) {
  const isLeft = direction === "left";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={isLeft ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"} />
    </svg>
  );
}

export default function StoriesBar({
  user,
  openCreateSignal = 0,
  stories: controlledStories,
  loading: controlledLoading,
  onRefresh,
  onStoriesSeen,
}) {
  const isControlled = controlledStories !== undefined;
  const [localStories, setLocalStories] = useState([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const viewerId = user?._id?.toString() || "";
  const scrollerRef = useRef(null);
  const stories = useMemo(
    () =>
      isControlled
        ? Array.isArray(controlledStories)
          ? controlledStories
          : []
        : localStories,
    [controlledStories, isControlled, localStories]
  );
  const loading = isControlled ? Boolean(controlledLoading) : localLoading;

  const loadStories = useCallback(async () => {
    if (isControlled) {
      await onRefresh?.();
      return;
    }

    try {
      const data = await getStories();
      setLocalStories(Array.isArray(data) ? data : []);
    } catch {
      setLocalStories([]);
    } finally {
      setLocalLoading(false);
    }
  }, [isControlled, onRefresh]);

  const syncArrows = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const maxLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    setCanScrollLeft(node.scrollLeft > 4);
    setCanScrollRight(node.scrollLeft < maxLeft - 4);
  }, []);

  useEffect(() => {
    if (isControlled) {
      return undefined;
    }

    loadStories();

    const timer = window.setInterval(() => {
      loadStories();
    }, 30000);

    return () => window.clearInterval(timer);
  }, [isControlled, loadStories]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) {
      return undefined;
    }

    syncArrows();
    const onScroll = () => syncArrows();
    const onWheel = (event) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }
      node.scrollBy({ left: event.deltaY, behavior: "auto" });
    };

    node.addEventListener("scroll", onScroll);
    node.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("resize", onScroll);
    const resizeObserver =
      typeof ResizeObserver === "function" ? new ResizeObserver(onScroll) : null;
    resizeObserver?.observe(node);

    return () => {
      node.removeEventListener("scroll", onScroll);
      node.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onScroll);
      resizeObserver?.disconnect();
    };
  }, [syncArrows, stories.length, loading]);

  const scrollByPage = (direction = 1) => {
    const node = scrollerRef.current;
    if (!node) {
      return;
    }
    const distance = node.clientWidth * 0.7 * direction;
    node.scrollBy({ left: distance, behavior: "smooth" });
  };

  const groupedStories = useMemo(
    () => groupStoriesByOwner(stories, viewerId),
    [stories, viewerId]
  );

  const handleStoriesSeen = useCallback(
    (storyIds = []) => {
      if (!viewerId || !Array.isArray(storyIds) || storyIds.length === 0) {
        return;
      }

      if (!isControlled) {
        setLocalStories((current) => markStoriesSeen(current, storyIds, viewerId));
      }
      onStoriesSeen?.(storyIds);
    },
    [isControlled, onStoriesSeen, viewerId]
  );

  const handleStoryDeleted = useCallback(
    (storyId) => {
      const deletedId = String(storyId || "");
      if (!deletedId) {
        return;
      }

      if (!isControlled) {
        setLocalStories((current) =>
          current.filter((entry) => String(entry?._id || entry?.id || "") !== deletedId)
        );
      }
      void loadStories();
    },
    [isControlled, loadStories]
  );

  return (
    <div className="stories-shell">
      <CreateStory user={user} onCreated={loadStories} openSignal={openCreateSignal} />

      <div className="stories-carousel">
        <button
          type="button"
          className="stories-nav stories-nav-left"
          aria-label="Scroll stories left"
          title="Previous stories"
          disabled={!canScrollLeft}
          onClick={() => scrollByPage(-1)}
        >
          <StoryChevron direction="left" />
        </button>

        <div className="stories-bar" ref={scrollerRef}>
          {!loading &&
            groupedStories.map((entry, groupIndex) => (
              <StoryCard
                key={entry.ownerId}
                story={entry.latestStory}
                stories={entry.stories}
                storyGroups={groupedStories}
                groupIndex={groupIndex}
                hasUnseen={entry.hasUnseen}
                isOwner={entry.isOwner}
                onDeleted={handleStoryDeleted}
                onSeen={handleStoriesSeen}
                viewerId={viewerId}
              />
            ))}

          {loading && (
            <div className="story-card story-loading">
              <p>Loading...</p>
            </div>
          )}
        </div>

        <button
          type="button"
          className="stories-nav stories-nav-right"
          aria-label="Scroll stories right"
          title="Next stories"
          disabled={!canScrollRight}
          onClick={() => scrollByPage(1)}
        >
          <StoryChevron direction="right" />
        </button>
      </div>
    </div>
  );
}
