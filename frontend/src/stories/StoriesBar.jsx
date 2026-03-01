import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getStories } from "../api";
import StoryCard from "./StoryCard";
import CreateStory from "./CreateStory";
import "./stories.css";

const getTimeValue = (value) => {
  const next = new Date(value || 0).getTime();
  return Number.isFinite(next) ? next : 0;
};

export default function StoriesBar({ user }) {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const viewerId = user?._id?.toString() || "";
  const scrollerRef = useRef(null);

  const loadStories = useCallback(async () => {
    try {
      const data = await getStories();
      setStories(Array.isArray(data) ? data : []);
    } catch {
      setStories([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
    loadStories();

    const timer = window.setInterval(() => {
      loadStories();
    }, 30000);

    return () => window.clearInterval(timer);
  }, [loadStories]);

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

    return () => {
      node.removeEventListener("scroll", onScroll);
      node.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onScroll);
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

  const groupedStories = useMemo(() => {
    const groups = new Map();

    (Array.isArray(stories) ? stories : []).forEach((entry) => {
      const ownerId = String(entry?.userId || entry?.username || entry?._id || "");
      if (!ownerId) {
        return;
      }

      if (!groups.has(ownerId)) {
        groups.set(ownerId, {
          ownerId,
          username: entry?.username || "User",
          avatar: entry?.avatar || "",
          stories: [],
        });
      }

      groups.get(ownerId).stories.push(entry);
    });

    return [...groups.values()]
      .map((group) => {
        const ordered = [...group.stories].sort(
          (a, b) => getTimeValue(b?.time) - getTimeValue(a?.time)
        );

        const hasUnseen = ordered.some((entry) => {
          if (typeof entry?.viewerSeen === "boolean") {
            return !entry.viewerSeen;
          }
          const seenBy = Array.isArray(entry?.seenBy) ? entry.seenBy.map(String) : [];
          return viewerId ? !seenBy.includes(viewerId) : false;
        });

        return {
          ...group,
          latestStory: ordered[0] || null,
          stories: ordered,
          hasUnseen,
          isOwner: Boolean(viewerId && group.ownerId === viewerId),
          latestTime: getTimeValue(ordered[0]?.time),
        };
      })
      .filter((group) => group.latestStory)
      .sort((a, b) => {
        if (a.isOwner !== b.isOwner) {
          return a.isOwner ? -1 : 1;
        }
        if (a.hasUnseen !== b.hasUnseen) {
          return a.hasUnseen ? -1 : 1;
        }
        return b.latestTime - a.latestTime;
      });
  }, [stories, viewerId]);

  const handleStoriesSeen = useCallback(
    (storyIds = []) => {
      if (!viewerId || !Array.isArray(storyIds) || storyIds.length === 0) {
        return;
      }

      const ids = new Set(storyIds.map(String));
      setStories((current) =>
        current.map((entry) => {
          if (!ids.has(String(entry?._id))) {
            return entry;
          }

          const seenBy = Array.isArray(entry?.seenBy)
            ? entry.seenBy.map(String)
            : [];
          if (seenBy.includes(viewerId)) {
            return entry;
          }

          return {
            ...entry,
            seenBy: [...seenBy, viewerId],
            viewerSeen: true,
          };
        })
      );
    },
    [viewerId]
  );

  return (
    <div className="stories-shell">
      {canScrollLeft && (
        <button
          type="button"
          className="stories-nav stories-nav-left"
          aria-label="Scroll stories left"
          onClick={() => scrollByPage(-1)}
        >
          {"<"}
        </button>
      )}

      <div className="stories-bar" ref={scrollerRef}>
        <CreateStory user={user} onCreated={loadStories} />

        {!loading &&
          groupedStories.map((entry) => (
            <StoryCard
              key={entry.ownerId}
              story={entry.latestStory}
              stories={entry.stories}
              hasUnseen={entry.hasUnseen}
              isOwner={entry.isOwner}
              onSeen={handleStoriesSeen}
            />
          ))}

        {loading && (
          <div className="story-card story-loading">
            <p>Loading...</p>
          </div>
        )}
      </div>

      {canScrollRight && (
        <button
          type="button"
          className="stories-nav stories-nav-right"
          aria-label="Scroll stories right"
          onClick={() => scrollByPage(1)}
        >
          {">"}
        </button>
      )}
    </div>
  );
}
