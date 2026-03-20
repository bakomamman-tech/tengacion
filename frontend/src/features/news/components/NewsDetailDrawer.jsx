import { useEffect, useState } from "react";

import { getNewsCluster, getNewsStory } from "../api/newsApi";
import NewsPublisherBadge from "./NewsPublisherBadge";
import NewsSourceChip from "./NewsSourceChip";

export default function NewsDetailDrawer({ card, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!open || !card) {
      setPayload(null);
      setError("");
      setLoading(false);
      return undefined;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const next =
          card?.cardType === "cluster" && card?.clusterId
            ? await getNewsCluster(card.clusterId)
            : await getNewsStory(card?.storyId || card?.representativeStory?.id || card?.id);
        if (!cancelled) {
          setPayload(next);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to load news detail");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [card, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const story =
    payload?.stories?.[0] || payload?.representativeStory || payload || card?.representativeStory || null;
  const source = story?.source || card?.representativeStory?.source || null;

  return (
    <div className="news-drawer-backdrop" onMouseDown={onClose}>
      <aside
        className="news-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="News detail"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="news-drawer-head">
          <div>
            <div className="news-drawer-meta">
              {source ? <NewsSourceChip source={source} /> : null}
              {source ? <NewsPublisherBadge tier={source.publisherTier} /> : null}
            </div>
            <h2>{story?.title || card?.title || "News detail"}</h2>
          </div>
          <button type="button" className="news-drawer-close" onClick={onClose}>
            Close
          </button>
        </div>

        {loading ? (
          <div className="news-drawer-body">
            <p>Loading story...</p>
          </div>
        ) : error ? (
          <div className="news-drawer-body">
            <p>{error}</p>
          </div>
        ) : (
          <div className="news-drawer-body">
            {story?.media?.url ? (
              <img
                className="news-drawer-image"
                src={story.media.url}
                alt={story.media.altText || story.title || "News"}
              />
            ) : null}
            {story?.summaryText ? <p className="news-drawer-summary">{story.summaryText}</p> : null}
            {story?.display?.canRenderFullText && story?.bodyHtml ? (
              <div
                className="news-drawer-richtext"
                dangerouslySetInnerHTML={{ __html: story.bodyHtml }}
              />
            ) : (
              <div className="news-drawer-linkout-note">
                <p>
                  Tengacion is showing the available summary and attribution for this article.
                </p>
              </div>
            )}
            {payload?.stories?.length > 1 ? (
              <div className="news-drawer-coverage-list">
                <strong>More coverage in this cluster</strong>
                <ul>
                  {payload.stories.map((entry) => (
                    <li key={entry.id}>
                      <a href={entry.canonicalUrl} target="_blank" rel="noreferrer">
                        {entry.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {story?.canonicalUrl ? (
              <a
                className="news-drawer-linkout"
                href={story.canonicalUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open on publisher site
              </a>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}
