import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Navbar from "../../../Navbar";
import Sidebar from "../../../Sidebar";
import RightQuickNav from "../../../components/RightQuickNav";
import NewsClusterCard from "../components/NewsClusterCard";
import NewsDetailDrawer from "../components/NewsDetailDrawer";
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

export default function NewsTopicPage({ user }) {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [selectedCard, setSelectedCard] = useState(null);
  const feed = useNewsFeed({ topicSlug: slug, limit: 18 });
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
          <section className="card news-hero-panel topic">
            <span className="news-eyebrow">Topic desk</span>
            <h1>{String(slug || "topic").replace(/-/g, " ")}</h1>
            <p>Follow the latest coverage, background, and source-attributed reporting for this topic.</p>
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
                <h3>Could not load this topic</h3>
                <p>{feed.error}</p>
              </article>
            ) : (
              (feed.cards || []).map((card) => renderCard(card, handlers))
            )}
          </section>
        </main>
        <aside className="home-right-rail">
          <RightQuickNav />
        </aside>
      </div>
      <NewsDetailDrawer card={selectedCard} open={Boolean(selectedCard)} onClose={() => setSelectedCard(null)} />
    </>
  );
}
