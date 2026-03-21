import { Link } from "react-router-dom";

import NewsSourceChip from "./NewsSourceChip";

const formatTopic = (topic = "") => String(topic || "").replace(/-/g, " ");

export default function NewsHighlightsStrip({ highlights, meta }) {
  const topics = Array.isArray(highlights?.topics) ? highlights.topics : [];
  const trustedSources = Array.isArray(highlights?.trustedSources)
    ? highlights.trustedSources
    : [];

  return (
    <section className="news-highlights-panel card" aria-label="News highlights">
      <div className="news-highlights-header">
        <div>
          <span className="news-highlights-kicker">Around this desk</span>
          <h2>{meta?.title || "Trusted highlights"}</h2>
        </div>
        {meta?.locationLabel ? (
          <span className="news-location-pill">For {meta.locationLabel}</span>
        ) : null}
      </div>

      <div className="news-highlight-block">
        <div className="news-highlight-label-row">
          <h3>Trending topics</h3>
          <span>Balanced for relevance and trust</span>
        </div>
        <div className="news-topic-strip" role="list">
          {topics.length ? (
            topics.map((topic) => (
              <Link
                key={topic.slug}
                to={`/news/topic/${topic.slug}`}
                className={`news-topic-link ${topic.isFollowed ? "followed" : ""}`}
              >
                <span className="news-topic-link-title">{topic.displayName || formatTopic(topic.slug)}</span>
                <span className="news-topic-link-meta">
                  {topic.articleCount || 0} stor{Number(topic.articleCount || 0) === 1 ? "y" : "ies"}
                </span>
              </Link>
            ))
          ) : (
            <p className="news-highlights-empty">Topic highlights will appear as fresh coverage arrives.</p>
          )}
        </div>
      </div>

      <div className="news-highlight-block">
        <div className="news-highlight-label-row">
          <h3>Trusted sources</h3>
          <span>Clear attribution on every card</span>
        </div>
        <div className="news-trusted-strip" role="list">
          {trustedSources.length ? (
            trustedSources.map((source) => (
              <NewsSourceChip key={source.slug} source={source} compact />
            ))
          ) : (
            <p className="news-highlights-empty">Trusted sources will show here once the catalog is connected.</p>
          )}
        </div>
      </div>
    </section>
  );
}
