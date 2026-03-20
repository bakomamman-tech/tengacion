import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import Navbar from "../../../Navbar";
import Sidebar from "../../../Sidebar";
import RightQuickNav from "../../../components/RightQuickNav";
import NewsClusterCard from "../components/NewsClusterCard";
import NewsDetailDrawer from "../components/NewsDetailDrawer";
import NewsFeedTabs from "../components/NewsFeedTabs";
import NewsCardSkeleton from "../components/NewsCardSkeleton";
import NewsStoryCard from "../components/NewsStoryCard";
import { useNewsFeed } from "../hooks/useNewsFeed";
import { useNewsPreferences } from "../hooks/useNewsPreferences";

const renderCard = (card, handlers) =>
  card?.cardType === "cluster" ? (
    <NewsClusterCard key={card.id} card={card} {...handlers} />
  ) : (
    <NewsStoryCard key={card.id} card={card} {...handlers} />
  );

export default function NewsHubPage({ user }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const activeTab = params.get("tab") || "for-you";
  const [selectedCard, setSelectedCard] = useState(null);
  const feed = useNewsFeed({ tab: activeTab, limit: 18 });
  const preferences = useNewsPreferences();

  const handlers = useMemo(
    () => ({
      onOpen: (card) => setSelectedCard(card),
      onHide: (payload) => preferences.hideItem(payload),
      onFollowSource: (sourceSlug) => preferences.followSource({ sourceSlug, follow: true }),
      onTrack: preferences.track,
      onReport: async (payload) => {
        const reason = window.prompt("Tell us what looks wrong about this news item.", "Possible issue with this story");
        if (reason) {
          await preferences.reportIssue({ ...payload, reason });
        }
      },
    }),
    [preferences]
  );

  return (
    <>
      <Navbar user={user} onLogout={() => navigate("/")} />
      <div className="app-shell">
        <aside className="sidebar">
          <Sidebar
            user={user}
            openChat={() => navigate("/home", { state: { openMessenger: true } })}
            openProfile={() => navigate(`/profile/${user?.username}`)}
          />
        </aside>

        <main className="feed">
          <section className="card news-hero-panel">
            <div>
              <span className="news-eyebrow">Tengacion News</span>
              <h1>Trusted news for your social feed</h1>
              <p>
                Follow local developments, Nigeria-wide coverage, and international stories with source attribution built in.
              </p>
            </div>
            <NewsFeedTabs
              activeTab={activeTab}
              onChange={(nextTab) => setParams({ tab: nextTab })}
            />
          </section>

          <section className="news-feed-grid">
            {feed.loading ? (
              <>
                <NewsCardSkeleton />
                <NewsCardSkeleton />
                <NewsCardSkeleton />
              </>
            ) : feed.error ? (
              <article className="card news-empty-state">
                <h3>Could not load Tengacion News</h3>
                <p>{feed.error}</p>
                <button type="button" className="news-action-button primary" onClick={() => feed.refresh()}>
                  Try again
                </button>
              </article>
            ) : (
              (feed.cards || []).map((card) => renderCard(card, handlers))
            )}
          </section>

          {!feed.loading && feed.hasMore ? (
            <div className="news-load-more-row">
              <button
                type="button"
                className="news-action-button primary"
                onClick={() => feed.loadMore()}
                disabled={feed.loadingMore}
              >
                {feed.loadingMore ? "Loading..." : "Load more news"}
              </button>
            </div>
          ) : null}
        </main>

        <aside className="home-right-rail">
          <RightQuickNav />
        </aside>
      </div>

      <NewsDetailDrawer card={selectedCard} open={Boolean(selectedCard)} onClose={() => setSelectedCard(null)} />
    </>
  );
}
