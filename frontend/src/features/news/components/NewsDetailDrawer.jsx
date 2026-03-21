import { useEffect, useState } from "react";

import { getNewsCluster, getNewsStory } from "../api/newsApi";
import { formatAbsoluteTime, formatTopicLabel } from "../utils/newsUi";
import NewsPublisherBadge from "./NewsPublisherBadge";
import NewsSourceChip from "./NewsSourceChip";

export default function NewsDetailDrawer({
  card,
  open,
  onClose,
  onToggleSave,
  onShare,
  activeTab = "for-you",
  saved = false,
  saving = false,
}) {
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
  const topicTags = Array.isArray(payload?.topicTags) && payload.topicTags.length
    ? payload.topicTags
    : story?.topicTags || [];

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
              {story?.articleType ? (
                <span className={`news-type-badge ${story.articleType}`}>{story.articleType}</span>
              ) : null}
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

            <div className="news-drawer-context-row">
              {story?.publishedAt ? (
                <time dateTime={story.publishedAt}>{formatAbsoluteTime(story.publishedAt)}</time>
              ) : null}
              {story?.authorByline ? <span>{story.authorByline}</span> : null}
              {topicTags.slice(0, 3).map((tag) => (
                <span key={tag} className="news-topic-chip">
                  {formatTopicLabel(tag)}
                </span>
              ))}
            </div>

            {story?.summaryText ? <p className="news-drawer-summary">{story.summaryText}</p> : null}

            {story?.display?.canRenderFullText && story?.bodyHtml ? (
              <div
                className="news-drawer-richtext"
                dangerouslySetInnerHTML={{ __html: story.bodyHtml }}
              />
            ) : (
              <div className="news-drawer-linkout-note">
                <p>
                  Tengacion is intentionally showing a legal-safe summary with source attribution and
                  a direct link to the publisher&apos;s original coverage.
                </p>
              </div>
            )}

            <div className="news-drawer-action-row">
              <button
                type="button"
                className={`news-action-button ${saved ? "saved" : ""}`}
                onClick={() =>
                  onToggleSave?.({
                    articleId: story?.id,
                    saved,
                    feedTab: activeTab,
                  })
                }
                disabled={saving}
              >
                {saving ? "Saving..." : saved ? "Saved" : "Save"}
              </button>
              <button
                type="button"
                className="news-action-button"
                onClick={() =>
                  onShare?.({
                    title: story?.title || "Tengacion News",
                    canonicalUrl: story?.canonicalUrl || "",
                  })
                }
              >
                Share
              </button>
              {story?.canonicalUrl ? (
                <a
                  className="news-drawer-linkout"
                  href={story.canonicalUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read original
                </a>
              ) : null}
            </div>

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
          </div>
        )}
      </aside>
    </div>
  );
}
