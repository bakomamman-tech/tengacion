import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getPublicActivity } from "../api";
import SeoHead from "../components/seo/SeoHead";
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from "../lib/seo";

import "./public-activity.css";

const PAGE_TITLE = "Public Social Activity | Tengacion";
const PAGE_DESCRIPTION =
  "See recent public creator updates, social posts, reactions, comments, and activity signals across Tengacion.";
const ACTIVITY_LIMIT = 12;

const formatCount = (value = 0) => Number(value || 0).toLocaleString();

const formatDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const truncateText = (value = "", maxLength = 220) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
};

const getAuthorName = (post = {}) =>
  post.name || post.user?.name || post.username || post.user?.username || "Tengacion member";

const getAuthorUsername = (post = {}) => post.username || post.user?.username || "";

const getPostKind = (post = {}) => {
  const type = String(post.type || "post").trim().toLowerCase();
  if (type === "reel") {
    return "Reel";
  }
  if (type === "video") {
    return "Video";
  }
  if (type === "image") {
    return "Photo";
  }
  if (type === "poll") {
    return "Poll";
  }
  if (type === "quiz") {
    return "Quiz";
  }
  return "Post";
};

const getPreviewImage = (post = {}) => {
  if (post.sensitiveContent || post.reviewRequired) {
    return "";
  }

  return (
    post.image ||
    post.video?.thumbnailUrl ||
    post.media?.find((entry) => entry?.url)?.url ||
    ""
  );
};

const ActivitySkeleton = () => (
  <article className="public-activity-card public-activity-card--loading">
    <div className="public-activity-card__avatar" />
    <div className="public-activity-card__body">
      <span />
      <strong />
      <p />
      <small />
    </div>
  </article>
);

export default function PublicActivityPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadActivity = async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await getPublicActivity({ limit: ACTIVITY_LIMIT });
        if (!isMounted) {
          return;
        }
        setItems(Array.isArray(payload) ? payload : []);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(err?.message || "Could not load public activity.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadActivity();
    return () => {
      isMounted = false;
    };
  }, []);

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, post) => ({
          posts: acc.posts + 1,
          reactions: acc.reactions + Number(post.likesCount || post.likes || 0),
          comments: acc.comments + Number(post.commentsCount || 0),
          shares: acc.shares + Number(post.shareCount || 0),
        }),
        { posts: 0, reactions: 0, comments: 0, shares: 0 }
      ),
    [items]
  );

  return (
    <main className="public-activity">
      <SeoHead
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        canonical="/activity"
        robots="index,follow"
        ogType="website"
        structuredData={[
          buildWebSiteJsonLd(),
          buildOrganizationJsonLd(),
          buildBreadcrumbJsonLd([
            { name: "Tengacion", url: "/" },
            { name: "Public activity", url: "/activity" },
          ]),
        ]}
      />

      <section className="public-activity__hero">
        <nav className="public-activity__nav" aria-label="Public Tengacion navigation">
          <Link className="public-activity__brand" to="/" aria-label="Tengacion home">
            <img src="/tengacion_logo_128.png" alt="" />
            <span>Tengacion</span>
          </Link>
          <div className="public-activity__nav-actions">
            <Link to="/creators">Creators</Link>
            <Link to="/music">Music</Link>
            <Link to="/marketplace">Marketplace</Link>
            <Link to="/login">Log in</Link>
          </div>
        </nav>

        <div className="public-activity__hero-inner">
          <p className="public-activity__eyebrow">Public social activity</p>
          <h1>Recent public posts from the Tengacion community</h1>
          <p>
            Browse approved public updates, reactions, comments, and shares from creators and
            members without opening the private feed.
          </p>
          <div className="public-activity__actions">
            <Link className="public-activity__button public-activity__button--primary" to="/register">
              Join Tengacion
            </Link>
            <Link className="public-activity__button" to="/creators">
              Browse creators
            </Link>
          </div>
        </div>
      </section>

      <section className="public-activity__summary" aria-label="Public activity summary">
        <div>
          <strong>{formatCount(totals.posts)}</strong>
          <span>Public posts</span>
        </div>
        <div>
          <strong>{formatCount(totals.reactions)}</strong>
          <span>Reactions</span>
        </div>
        <div>
          <strong>{formatCount(totals.comments)}</strong>
          <span>Comments</span>
        </div>
        <div>
          <strong>{formatCount(totals.shares)}</strong>
          <span>Shares</span>
        </div>
      </section>

      <section className="public-activity__feed" aria-labelledby="public-activity-feed-title">
        <div className="public-activity__section-head">
          <p className="public-activity__eyebrow">Live public surface</p>
          <h2 id="public-activity-feed-title">Community updates visitors can see</h2>
          <p>
            Only public, approved posts are shown here. Private, friends-only, blocked, and
            review-required posts stay out of this page.
          </p>
        </div>

        {loading ? (
          <div className="public-activity__grid" aria-busy="true">
            <ActivitySkeleton />
            <ActivitySkeleton />
            <ActivitySkeleton />
          </div>
        ) : error ? (
          <div className="public-activity__empty" role="status">
            <strong>Public activity could not load</strong>
            <p>{error}</p>
          </div>
        ) : items.length ? (
          <div className="public-activity__grid">
            {items.map((post) => {
              const previewImage = getPreviewImage(post);
              const username = getAuthorUsername(post);
              return (
                <article
                  key={post._id}
                  id={`post-${post._id}`}
                  className="public-activity-card"
                >
                  <div className="public-activity-card__top">
                    <div className="public-activity-card__avatar" aria-hidden="true">
                      {getAuthorName(post).slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <strong>{getAuthorName(post)}</strong>
                      <span>{username ? `@${username}` : getPostKind(post)}</span>
                    </div>
                  </div>

                  {previewImage ? (
                    <img
                      className="public-activity-card__media"
                      src={previewImage}
                      alt=""
                      loading="lazy"
                    />
                  ) : null}

                  <p>{truncateText(post.text || `${getAuthorName(post)} shared a ${getPostKind(post).toLowerCase()}.`)}</p>

                  <div className="public-activity-card__meta">
                    <span>{getPostKind(post)}</span>
                    <span>{formatDate(post.createdAt)}</span>
                  </div>

                  <div className="public-activity-card__stats" aria-label="Post activity">
                    <span>{formatCount(post.likesCount || post.likes)} reactions</span>
                    <span>{formatCount(post.commentsCount)} comments</span>
                    <span>{formatCount(post.shareCount)} shares</span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="public-activity__empty">
            <strong>Public activity is just getting started</strong>
            <p>
              Approved public posts, creator updates, comments, reactions, and shares will appear
              here as the Tengacion community grows.
            </p>
            <Link className="public-activity__button public-activity__button--primary" to="/creators">
              Find creators
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
