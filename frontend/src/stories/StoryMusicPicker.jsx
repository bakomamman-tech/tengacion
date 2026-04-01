import { useEffect, useMemo, useRef, useState } from "react";

import { getCreatorSummaryFeed, resolveImage } from "../api";
import Button from "../components/ui/Button";
import { formatCurrency } from "../components/creator/creatorConfig";
import {
  getStoryMusicSubtitle,
  isStoryMusicCandidate,
  normalizeStoryMusicSelection,
} from "./storyMusicUtils";

const FEED_LIMIT = 24;

const getSearchValue = (item = {}) =>
  [item?.title, item?.creatorName, item?.creatorUsername, item?.summary, item?.creatorCategory]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export default function StoryMusicPicker({ value = null, onSelect, onClear, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activePreviewId, setActivePreviewId] = useState("");
  const [previewNonce, setPreviewNonce] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const audioRef = useRef(null);

  useEffect(() => {
    let alive = true;

    const loadFeed = async () => {
      try {
        setLoading(true);
        setError("");
        const payload = await getCreatorSummaryFeed({
          category: "music",
          page: 1,
          limit: FEED_LIMIT,
          mode: "mixed",
        });
        if (!alive) {
          return;
        }
        const nextItems = Array.isArray(payload?.items)
          ? payload.items.filter((item) => isStoryMusicCandidate(item))
          : [];
        setItems(nextItems);
      } catch (loadError) {
        if (!alive) {
          return;
        }
        setError(loadError?.message || "Could not load Tengacion music.");
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    loadFeed();
    return () => {
      alive = false;
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
    };
  }, []);

  const selectedId = String(value?.itemId || value?.id || "").trim();

  const filteredItems = useMemo(() => {
    const normalized = String(query || "").trim().toLowerCase();
    const pool = Array.isArray(items) ? items : [];

    const sorted = [...pool].sort((left, right) => {
      if (String(left?.itemId || left?.id || "") === selectedId) {
        return -1;
      }
      if (String(right?.itemId || right?.id || "") === selectedId) {
        return 1;
      }
      return (
        new Date(right?.createdAt || right?.updatedAt || 0).getTime() -
        new Date(left?.createdAt || left?.updatedAt || 0).getTime()
      );
    });

    if (!normalized) {
      return sorted;
    }

    return sorted.filter((item) => getSearchValue(item).includes(normalized));
  }, [items, query, selectedId]);

  const activePreviewItem = useMemo(() => {
    if (!activePreviewId) {
      return null;
    }
    return (
      filteredItems.find((item) => String(item?.id || item?.contentId || "") === activePreviewId) ||
      null
    );
  }, [activePreviewId, filteredItems]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }

    if (!activePreviewItem?.previewUrl) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setPreviewPlaying(false);
      setPreviewError("");
      return undefined;
    }

    audio.pause();
    audio.src = activePreviewItem.previewUrl;
    audio.currentTime = 0;

    let cancelled = false;
    const start = async () => {
      try {
        await audio.play();
        if (!cancelled) {
          setPreviewPlaying(true);
          setPreviewError("");
        }
      } catch {
        if (!cancelled) {
          setPreviewPlaying(false);
          setPreviewError("Preview blocked by your browser. Tap play again.");
        }
      }
    };

    if (previewNonce > 0) {
      void start();
    } else {
      setPreviewPlaying(false);
    }

    return () => {
      cancelled = true;
    };
  }, [activePreviewItem, previewNonce]);

  const handlePreview = (item) => {
    const itemId = String(item?.id || item?.contentId || "");
    if (!itemId || !item?.previewUrl) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (activePreviewId === itemId && previewPlaying) {
      audio.pause();
      setPreviewPlaying(false);
      return;
    }

    setPreviewError("");
    setPreviewNonce((current) => current + 1);
    setActivePreviewId(itemId);
  };

  const handleSelect = (item) => {
    onSelect?.(normalizeStoryMusicSelection(item));
  };

  const selectedItem = selectedId
    ? items.find((item) => String(item?.id || item?.contentId || "") === selectedId) || null
    : null;

  return (
    <section className="story-music-picker" aria-label="Tengacion music directory">
      <audio
        ref={audioRef}
        hidden
        onEnded={() => setPreviewPlaying(false)}
        onPause={() => setPreviewPlaying(false)}
        onPlay={() => setPreviewPlaying(true)}
      />

      <div className="story-music-picker__head">
        <div>
          <span className="story-music-picker__eyebrow">Tengacion Soundtrack Shelf</span>
          <h4>Attach a 30-second creator preview to this story</h4>
          <p>
            Pick from music uploaded by Tengacion creators. Your story keeps the beat, and the
            clip stays short enough to feel like a sticker, not a takeover.
          </p>
        </div>
        <Button variant="icon" size="sm" iconOnly onClick={onClose} aria-label="Close soundtrack shelf">
          <span className="icon-glyph-center">X</span>
        </Button>
      </div>

      {selectedItem ? (
        <div className="story-music-picker__selected">
          <img
            src={resolveImage(selectedItem.coverImage) || selectedItem.coverImage}
            alt={selectedItem.title || "Selected soundtrack"}
          />
          <div>
            <span>Attached to story</span>
            <strong>{selectedItem.title}</strong>
            <small>{getStoryMusicSubtitle(selectedItem)}</small>
          </div>
          <div className="story-music-picker__selected-actions">
            <button type="button" onClick={() => setQuery(selectedItem.title || "")}>
              Search more
            </button>
            <button type="button" onClick={onClear}>
              Remove
            </button>
          </div>
        </div>
      ) : null}

      <label className="story-music-picker__search">
        <span>Search soundtrack</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search creator songs, albums, or artist names"
        />
      </label>

      {previewError ? <p className="story-music-picker__error">{previewError}</p> : null}

      {loading ? (
        <div className="story-music-picker__state">Loading creator music...</div>
      ) : error ? (
        <div className="story-music-picker__state story-music-picker__state--error">
          <strong>Could not load creator music</strong>
          <p>{error}</p>
        </div>
      ) : filteredItems.length ? (
        <div className="story-music-picker__grid">
          {filteredItems.map((item) => {
            const itemId = String(item?.id || item?.contentId || "");
            const isSelected = itemId && selectedId === itemId;
            const isPreviewing = itemId && activePreviewId === itemId && previewPlaying;

            return (
              <article
                key={itemId}
                className={`story-music-picker__card${isSelected ? " is-selected" : ""}`}
              >
                <div className="story-music-picker__card-art">
                  <img
                    src={resolveImage(item.coverImage) || item.coverImage}
                    alt={item.title || "Soundtrack"}
                  />
                  <span>{item.summaryLabel || "Music"}</span>
                </div>

                <div className="story-music-picker__card-copy">
                  <strong>{item.title}</strong>
                  <p>{item.creatorName || item.creatorUsername || "Tengacion creator"}</p>
                  <small>{getStoryMusicSubtitle(item)}</small>
                </div>

                <div className="story-music-picker__card-meta">
                  <span>30 sec preview</span>
                  <strong>{item.priceLabel || formatCurrency(item.price)}</strong>
                </div>

                <div className="story-music-picker__card-actions">
                  <button
                    type="button"
                    className="story-music-picker__preview-btn"
                    onClick={() => handlePreview(item)}
                    disabled={!item?.previewUrl}
                  >
                    {isPreviewing ? "Pause" : activePreviewId === itemId ? "Previewing" : "Preview"}
                  </button>
                  <button
                    type="button"
                    className="story-music-picker__select-btn"
                    onClick={() => handleSelect(item)}
                  >
                    {isSelected ? "Chosen" : "Use soundtrack"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="story-music-picker__state">
          <strong>No matching soundtrack found</strong>
          <p>Try a creator name or release title from Tengacion&apos;s music directory.</p>
        </div>
      )}
    </section>
  );
}
