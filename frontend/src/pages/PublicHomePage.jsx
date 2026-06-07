import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getCreatorDiscovery, getCreatorSummaryFeed, getPublicActivity, resolveImage } from "../api";
import SeoHead from "../components/seo/SeoHead";
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from "../lib/seo";
import { normalizePublicText, uniquePublicActivity } from "../utils/publicText";

import "./public-home.css";

const PAGE_TITLE = "Tengacion | Africa's Social Commerce & Creator Monetization Platform";
const PAGE_DESCRIPTION =
  "Create, connect, sell, stream, and earn on Tengacion, Africa's social commerce and creator monetization platform for creators, fans, buyers, and sellers.";
const HOME_RELEASE_LIMIT = 6;
const HOME_ACTIVITY_LIMIT = 6;
const HOME_CREATOR_LIMIT = 4;

const DISCOVERY_LINKS = [
  {
    path: "/creators",
    label: "Creators",
    description: "Find public profiles from music artists, authors, podcast hosts, and multi-format creators.",
  },
  {
    path: "/music",
    label: "Music",
    description: "Browse songs, albums, videos, and new creator releases from public Tengacion catalogs.",
  },
  {
    path: "/books",
    label: "Books",
    description: "Explore digital books, reading previews, and author pages from Tengacion creators.",
  },
  {
    path: "/podcasts",
    label: "Podcasts",
    description: "Listen to public episodes and spoken-word releases from creators across Africa.",
  },
  {
    path: "/marketplace",
    label: "Marketplace",
    description: "Browse approved seller storefronts, products, local pickup, and delivery-ready listings.",
  },
  {
    path: "/activity",
    label: "Activity",
    description: "See recent public posts, reactions, comments, and updates from Tengacion members.",
  },
];

const CONTENT_LINKS = [
  {
    path: "/about",
    label: "About Tengacion",
    description: "Understand the platform mission, public discovery model, and creator-first structure.",
  },
  {
    path: "/how-it-works",
    label: "How it works",
    description: "See how creator profiles, category pages, and release detail pages connect.",
  },
  {
    path: "/for-creators",
    label: "For creators",
    description: "Learn how music artists, authors, podcasters, and multi-format creators can present work.",
  },
  {
    path: "/safety",
    label: "Safety",
    description: "Review the trust, moderation, copyright, and reporting principles behind public discovery.",
  },
];

const TRUST_LINKS = [
  { path: "/about", label: "About" },
  { path: "/terms", label: "Terms" },
  { path: "/privacy", label: "Privacy" },
  { path: "/community-guidelines", label: "Guidelines" },
  { path: "/child-safety", label: "Child safety" },
  { path: "/refund-policy", label: "Refunds" },
  { path: "/copyright-policy", label: "Copyright" },
  { path: "/contact", label: "Contact" },
];

const PATHWAYS = [
  {
    path: "/music",
    label: "Discover Music",
    description: "Jump into public releases, albums, videos, and creator catalogs.",
  },
  {
    path: "/creators",
    label: "Find Creators",
    description: "Browse public profiles and follow the people building on Tengacion.",
  },
  {
    path: "/creator/register",
    label: "Join as Creator",
    description: "Set up your creator page and start preparing your first public release.",
  },
  {
    path: "/marketplace",
    label: "Explore Marketplace",
    description: "Discover seller storefronts, products, pickup, and delivery options.",
  },
];

const COMMERCE_PROOF = [
  {
    label: "Create and sell",
    description: "Creators can publish and sell music, books, podcasts, subscriptions, and digital releases.",
  },
  {
    label: "Pay securely",
    description: "Buyers use provider-backed checkout and receive access after a successful payment is verified.",
  },
  {
    label: "Earn and request payouts",
    description: "Successful creator purchases credit earnings, with eligible balances available for payout requests.",
  },
  {
    label: "List and fulfill orders",
    description: "Approved marketplace sellers can publish products, receive orders, and track settlement activity.",
  },
];

const TRUST_SIGNALS = [
  "Verified creator badges",
  "Approved seller checks",
  "Secured payment flow",
  "Refund and dispute policy",
  "Public reporting routes",
  "Copyright takedown process",
];

const AUDIENCE_BENEFITS = [
  {
    label: "Fans",
    description: "Follow creators, sample releases, join public activity, and return to one profile for the full catalog.",
  },
  {
    label: "Creators",
    description: "Publish music, books, podcasts, videos, and public updates with shareable pages and creator-first discovery.",
  },
  {
    label: "Sellers",
    description: "Open approved storefronts, list products with delivery terms, and build buyer confidence inside the marketplace.",
  },
  {
    label: "Communities",
    description: "Connect around African talent with safety routes, content rules, and reporting paths visible from the public web.",
  },
];

const formatCount = (value = 0) => Number(value || 0).toLocaleString();

const formatMoney = (value) => {
  const amount = Number(value || 0);
  if (!amount || amount <= 0) {
    return "Free preview";
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
};

const truncateText = (value = "", maxLength = 140) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
};

const getInitial = (value = "") => String(value || "T").trim().slice(0, 1).toUpperCase();

const getCreatorName = (item = {}) =>
  item.creatorName ||
  item.name ||
  item.creator?.name ||
  item.creator?.username ||
  item.creatorUsername ||
  "Tengacion creator";

const getReleaseLabel = (item = {}) =>
  item.summaryLabel ||
  item.categoryLabel ||
  item.kindLabel ||
  item.contentTypeLabel ||
  item.typeLabel ||
  "Creator release";

const getReleaseImage = (item = {}) =>
  resolveImage(
    item.coverImage ||
      item.coverUrl ||
      item.artworkUrl ||
      item.thumbnailUrl ||
      item.image ||
      item.creatorAvatar ||
      item.creator?.avatar ||
      ""
  );

const getReleaseRoute = (item = {}) => {
  if (item.route) {
    return item.route;
  }

  if (item.creatorRoute) {
    return item.creatorRoute;
  }

  const creatorId = item.creatorId || item.creator?._id || item.creator?.id;
  return creatorId ? `/creators/${encodeURIComponent(creatorId)}` : "/creators";
};

const getActivityAuthorName = (post = {}) =>
  post.name || post.user?.name || post.username || post.user?.username || "Tengacion member";

const getActivityKind = (post = {}) => {
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

const getActivityRoute = (post = {}) => (post._id ? `/activity#post-${post._id}` : "/activity");

const getCreatorAvatar = (creator = {}) => resolveImage(creator.avatar || creator.banner || "");

const getCreatorRoute = (creator = {}) =>
  creator.creatorRoute ||
  creator.route ||
  (creator.creatorId ? `/creators/${encodeURIComponent(creator.creatorId)}` : "/creators");

const ReleaseSkeleton = () => (
  <article className="public-home-release public-home-release--loading" aria-hidden="true">
    <div className="public-home-release__art" />
    <div className="public-home-release__body">
      <span />
      <strong />
      <p />
    </div>
  </article>
);

export default function PublicHomePage() {
  const [releaseItems, setReleaseItems] = useState([]);
  const [releaseTotal, setReleaseTotal] = useState(0);
  const [featuredCreators, setFeaturedCreators] = useState([]);
  const [activityItems, setActivityItems] = useState([]);
  const [loadingProof, setLoadingProof] = useState(true);
  const [proofError, setProofError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadPublicProof = async () => {
      setLoadingProof(true);
      setProofError("");

      try {
        const [feedResult, creatorResult, activityResult] = await Promise.allSettled([
          getCreatorSummaryFeed({
            category: "all",
            mode: "mixed",
            page: 1,
            limit: HOME_RELEASE_LIMIT,
          }),
          getCreatorDiscovery({
            category: "all",
            sort: "popular",
            page: 1,
            limit: HOME_CREATOR_LIMIT,
          }),
          getPublicActivity({ limit: HOME_ACTIVITY_LIMIT }),
        ]);

        if (!isMounted) {
          return;
        }

        const feedPayload = feedResult.status === "fulfilled" ? feedResult.value : null;
        const creatorPayload = creatorResult.status === "fulfilled" ? creatorResult.value : null;
        const activityPayload = activityResult.status === "fulfilled" ? activityResult.value : null;
        const failedLoads = [feedResult, creatorResult, activityResult].filter(
          (result) => result.status === "rejected"
        );
        const feedItems = Array.isArray(feedPayload?.items) ? feedPayload.items : [];
        setReleaseItems(feedItems);
        setReleaseTotal(Number(feedPayload?.total || feedItems.length || 0));
        setFeaturedCreators(Array.isArray(creatorPayload?.items) ? creatorPayload.items : []);
        setActivityItems(uniquePublicActivity(activityPayload));
        if (failedLoads.length) {
          setProofError("Some public content could not load right now.");
        }
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setProofError(err?.message || "Public content could not load right now.");
        setReleaseItems([]);
        setReleaseTotal(0);
        setFeaturedCreators([]);
        setActivityItems([]);
      } finally {
        if (isMounted) {
          setLoadingProof(false);
        }
      }
    };

    void loadPublicProof();

    return () => {
      isMounted = false;
    };
  }, []);

  const proofStats = useMemo(() => {
    const creatorKeys = new Set();
    featuredCreators.forEach((creator) => {
      const key = creator.creatorId || creator.id || creator.username || creator.name;
      if (key) {
        creatorKeys.add(String(key));
      }
    });
    releaseItems.forEach((item) => {
      const key = item.creatorId || item.creatorUsername || item.creatorRoute || getCreatorName(item);
      if (key) {
        creatorKeys.add(String(key));
      }
    });
    activityItems.forEach((post) => {
      const key = post.user?._id || post.user?.id || post.username || getActivityAuthorName(post);
      if (key) {
        creatorKeys.add(String(key));
      }
    });

    const activityTotals = activityItems.reduce(
      (acc, post) => ({
        reactions: acc.reactions + Number(post.likesCount || post.likes || 0),
        comments: acc.comments + Number(post.commentsCount || 0),
      }),
      { reactions: 0, comments: 0 }
    );

    return [
      {
        label: "Public releases",
        value: formatCount(Math.max(releaseTotal, releaseItems.length)),
        detail: releaseItems.length ? "Music, books, podcasts, and creator media" : "New releases publish here",
      },
      {
        label: "Creators featured",
        value: formatCount(creatorKeys.size),
        detail: creatorKeys.size ? "Public profiles across the platform" : "Profiles appear as creators publish",
      },
      {
        label: "Recent public posts",
        value: formatCount(activityItems.length),
        detail: "Approved community activity",
      },
      {
        label: "Engagement sampled",
        value: formatCount(activityTotals.reactions + activityTotals.comments),
        detail: "Reactions and comments from public posts",
      },
    ];
  }, [activityItems, featuredCreators, releaseItems, releaseTotal]);

  return (
    <main className="public-home">
      <SeoHead
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        canonical="/"
        robots="index,follow"
        ogType="website"
        structuredData={[
          buildWebSiteJsonLd(),
          buildOrganizationJsonLd(),
          buildBreadcrumbJsonLd([{ name: "Tengacion", url: "/" }]),
        ]}
      />

      <section className="public-home__hero">
        <nav className="public-home__nav" aria-label="Public Tengacion navigation">
          <Link className="public-home__brand" to="/" aria-label="Tengacion home">
            <img src="/tengacion_logo_128.png" alt="" />
            <span>Tengacion</span>
          </Link>
          <div className="public-home__nav-actions">
            <Link to="/about">About</Link>
            <Link to="/creators">Creators</Link>
            <Link to="/music">Music</Link>
            <Link to="/activity">Activity</Link>
            <Link to="/marketplace">Marketplace</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/login">Log in</Link>
          </div>
        </nav>

        <div className="public-home__hero-inner">
          <p className="public-home__eyebrow">Tengacion</p>
          <h1>Africa&apos;s social commerce and creator monetization platform.</h1>
          <p className="public-home__lede">
            One connected platform where African creators build audiences, sell their work,
            stream content, and turn community into sustainable earnings.
          </p>
          <p className="public-home__action-line" aria-label="Create, connect, sell, stream, and earn">
            <span>Create.</span>
            <span>Connect.</span>
            <span>Sell.</span>
            <span>Stream.</span>
            <span>Earn.</span>
          </p>
          <div className="public-home__actions">
            <Link className="public-home__button public-home__button--primary" to="/creator/register">
              Join as Creator
            </Link>
            <Link className="public-home__button" to="/marketplace">
              Explore Marketplace
            </Link>
            <Link className="public-home__button" to="/music">
              Discover Music
            </Link>
            <Link className="public-home__button" to="/marketplace/register">
              Sell on Tengacion
            </Link>
          </div>

          <div className="public-home__hero-proof" aria-label="Tengacion public proof points">
            <span>Verified creator profiles</span>
            <span>Creator earnings and payouts</span>
            <span>Approved seller marketplace</span>
            <span>Secure checkout</span>
          </div>
        </div>
      </section>

      <section className="public-home__proof" aria-label="Live Tengacion proof">
        {proofStats.map((stat) => (
          <div key={stat.label} className="public-home__proof-card">
            <strong>{loadingProof ? "..." : stat.value}</strong>
            <span>{stat.label}</span>
            <p>{stat.detail}</p>
          </div>
        ))}
      </section>

      <section className="public-home__section public-home__section--commerce" aria-labelledby="public-home-commerce-title">
        <div className="public-home__section-head public-home__section-head--split">
          <div>
            <p className="public-home__eyebrow">Monetization in plain sight</p>
            <h2 id="public-home-commerce-title">From discovery to payment, earnings, and fulfillment</h2>
            <p>
              Tengacion connects the public experience to real commerce flows for creators,
              buyers, and marketplace sellers.
            </p>
          </div>
          <Link className="public-home__section-link" to="/how-it-works">
            See how it works
          </Link>
        </div>

        <div className="public-home__commerce-grid">
          {COMMERCE_PROOF.map((entry, index) => (
            <article key={entry.label} className="public-home-commerce">
              <span aria-hidden="true">{index + 1}</span>
              <strong>{entry.label}</strong>
              <p>{entry.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-home__section" aria-labelledby="public-home-creators-title">
        <div className="public-home__section-head public-home__section-head--split">
          <div>
            <p className="public-home__eyebrow">Featured creators</p>
            <h2 id="public-home-creators-title">Meet creators building across formats</h2>
            <p>
              Discover musicians, authors, podcasters, educators, performers, and independent
              businesses through public profiles and active catalogs.
            </p>
          </div>
          <Link className="public-home__section-link" to="/creators">
            View creator directory
          </Link>
        </div>

        {loadingProof ? (
          <div className="public-home__creator-grid" aria-busy="true">
            {[0, 1, 2, 3].map((entry) => (
              <article key={entry} className="public-home-creator public-home-creator--loading">
                <span />
                <strong />
                <p />
              </article>
            ))}
          </div>
        ) : featuredCreators.length ? (
          <div className="public-home__creator-grid">
            {featuredCreators.map((creator) => {
              const avatar = getCreatorAvatar(creator);
              const badges = Array.isArray(creator.trustBadges) ? creator.trustBadges : [];
              return (
                <Link
                  key={creator.creatorId || creator.id || creator.username}
                  className="public-home-creator"
                  to={getCreatorRoute(creator)}
                >
                  <div className="public-home-creator__avatar" aria-hidden="true">
                    {avatar ? (
                      <img src={avatar} alt="" loading="lazy" />
                    ) : (
                      <span>{getInitial(creator.name || creator.username)}</span>
                    )}
                  </div>
                  <div className="public-home-creator__body">
                    <span>{creator.categoryLabels?.join(" / ") || creator.category || "Creator"}</span>
                    <strong>{creator.name || "Tengacion creator"}</strong>
                    <p>{truncateText(creator.bio || creator.tagline || "A creator on Tengacion.", 96)}</p>
                    <div className="public-home-creator__meta">
                      <small>{formatCount(creator.followerCount)} followers</small>
                      <small>{formatCount(creator.contentCount)} releases</small>
                    </div>
                    <div className="public-home-creator__badges">
                      {(badges.length ? badges : ["Public Profile"]).slice(0, 2).map((badge) => (
                        <em key={badge}>{badge}</em>
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="public-home__empty">
            <strong>Be among the first creators featured</strong>
            <p>
              Build a public profile, choose your creator categories, and publish work that fans
              can discover and support.
            </p>
            <Link className="public-home__inline-button" to="/creator/register">
              Set up a creator profile
            </Link>
          </div>
        )}
      </section>

      <section className="public-home__section public-home__section--live" aria-labelledby="public-home-live-title">
        <div className="public-home__section-head public-home__section-head--split">
          <div>
            <p className="public-home__eyebrow">Live public surface</p>
            <h2 id="public-home-live-title">See what is active right now</h2>
            <p>
              Browse current public releases and approved community updates from creators and
              members across the platform.
            </p>
          </div>
          <Link className="public-home__section-link" to="/activity">
            View all activity
          </Link>
        </div>

        {proofError ? (
          <div className="public-home__empty" role="status">
            <strong>Public proof could not load</strong>
            <p>{proofError}</p>
          </div>
        ) : null}

        <div className="public-home__live-layout">
          <div className="public-home__live-column">
            <div className="public-home__subhead">
              <h3>Featured public releases</h3>
              <Link to="/music">Browse music</Link>
            </div>

            {loadingProof ? (
              <div className="public-home__release-grid" aria-busy="true">
                <ReleaseSkeleton />
                <ReleaseSkeleton />
                <ReleaseSkeleton />
              </div>
            ) : releaseItems.length ? (
              <div className="public-home__release-grid">
                {releaseItems.map((item) => {
                  const image = getReleaseImage(item);
                  return (
                    <Link
                      key={item.id || item._id || `${item.title}-${getCreatorName(item)}`}
                      className="public-home-release"
                      to={getReleaseRoute(item)}
                    >
                      <div className="public-home-release__art" aria-hidden="true">
                        {image ? (
                          <img src={image} alt="" loading="lazy" />
                        ) : (
                          <span>{getCreatorName(item).slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="public-home-release__body">
                        <span>{getReleaseLabel(item)}</span>
                        <strong>{item.title || "Untitled creator release"}</strong>
                        <p>{getCreatorName(item)}</p>
                        <small>{formatMoney(item.price || item.amount || item.subscriptionPrice)}</small>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="public-home__empty">
                <strong>Public releases are ready for more content</strong>
                <p>
                  Music, books, podcasts, and videos will appear here as creators publish approved
                  public work.
                </p>
                <Link className="public-home__inline-button" to="/creator/register">
                  Upload your first release
                </Link>
              </div>
            )}
          </div>

          <aside className="public-home__activity-panel" aria-labelledby="public-home-activity-title">
            <div className="public-home__subhead">
              <h3 id="public-home-activity-title">Recent public activity</h3>
              <Link to="/activity">Open feed</Link>
            </div>

            {loadingProof ? (
              <div className="public-home__activity-list" aria-busy="true">
                {[0, 1, 2].map((entry) => (
                  <article key={entry} className="public-home-activity public-home-activity--loading">
                    <span />
                    <strong />
                    <p />
                  </article>
                ))}
              </div>
            ) : activityItems.length ? (
              <div className="public-home__activity-list">
                {activityItems.map((post) => (
                  <Link
                    key={post._id}
                    className="public-home-activity"
                    to={getActivityRoute(post)}
                  >
                    <span>{getActivityKind(post)}</span>
                    <strong>{getActivityAuthorName(post)}</strong>
                    <p>
                      {truncateText(
                        normalizePublicText(post.text) ||
                          `${getActivityAuthorName(post)} shared a ${getActivityKind(post).toLowerCase()}.`
                      )}
                    </p>
                    <small>
                      {formatCount(post.likesCount || post.likes)} reactions /{" "}
                      {formatCount(post.commentsCount)} comments
                    </small>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="public-home__empty public-home__empty--compact">
                <strong>Activity will appear as posts go public</strong>
                <p>Approved posts, reactions, and comments give visitors live proof of community.</p>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="public-home__section" aria-labelledby="public-home-path-title">
        <div className="public-home__section-head">
          <p className="public-home__eyebrow">Choose your path</p>
          <h2 id="public-home-path-title">Pick up where you are</h2>
          <p>
            Start with listening, creator discovery, your creator setup, or marketplace browsing.
          </p>
        </div>

        <div className="public-home__path-grid">
          {PATHWAYS.map((entry) => (
            <Link key={entry.path} className="public-home-path" to={entry.path}>
              <strong>{entry.label}</strong>
              <p>{entry.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="public-home__section" aria-labelledby="public-home-join-title">
        <div className="public-home__section-head">
          <p className="public-home__eyebrow">Why join Tengacion?</p>
          <h2 id="public-home-join-title">A platform for fans, creators, sellers, and communities</h2>
          <p>
            Tengacion works best when discovery, publishing, commerce, and public trust feel like
            one connected product.
          </p>
        </div>

        <div className="public-home__benefit-grid">
          {AUDIENCE_BENEFITS.map((entry) => (
            <article key={entry.label} className="public-home-benefit">
              <strong>{entry.label}</strong>
              <p>{entry.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-home__section" aria-labelledby="public-home-discovery-title">
        <div className="public-home__section-head">
          <p className="public-home__eyebrow">Public discovery</p>
          <h2 id="public-home-discovery-title">Explore the public catalog</h2>
          <p>
            Browse indexable creator pages and content categories that can be shared, discovered,
            and revisited without starting inside a private feed.
          </p>
        </div>

        <div className="public-home__grid">
          {DISCOVERY_LINKS.map((entry) => (
            <Link key={entry.path} className="public-home__tile" to={entry.path}>
              <span>{entry.label}</span>
              <p>{entry.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="public-home__section" aria-labelledby="public-home-learn-title">
        <div className="public-home__section-head">
          <p className="public-home__eyebrow">Platform guide</p>
          <h2 id="public-home-learn-title">Learn what Tengacion is built for</h2>
          <p>
            Public explainer pages help fans, creators, search engines, and social previews
            understand the platform beyond the private app experience.
          </p>
        </div>

        <div className="public-home__grid">
          {CONTENT_LINKS.map((entry) => (
            <Link key={entry.path} className="public-home__tile" to={entry.path}>
              <span>{entry.label}</span>
              <p>{entry.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="public-home__band" aria-label="Tengacion trust links">
        <div>
          <p className="public-home__eyebrow">Trust foundation</p>
          <h2>Payments, reporting, and platform rules are easy to reach</h2>
          <div className="public-home__trust-signals" aria-label="Trust signals">
            {TRUST_SIGNALS.map((signal) => (
              <span key={signal}>{signal}</span>
            ))}
          </div>
        </div>
        <div className="public-home__trust-links">
          {TRUST_LINKS.map((entry) => (
            <Link key={entry.path} to={entry.path}>
              {entry.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
