import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Navbar from "../../../Navbar";
import Sidebar from "../../../Sidebar";
import RightQuickNav from "../../../components/RightQuickNav";
import NewsClusterCard from "../components/NewsClusterCard";
import NewsDetailDrawer from "../components/NewsDetailDrawer";
import NewsCardSkeleton from "../components/NewsCardSkeleton";
import NewsPublisherBadge from "../components/NewsPublisherBadge";
import NewsSourceChip from "../components/NewsSourceChip";
import NewsStoryCard from "../components/NewsStoryCard";
import { useNewsFeed } from "../hooks/useNewsFeed";
import { useNewsPreferences } from "../hooks/useNewsPreferences";

const renderCard = (card, handlers) =>
  card?.cardType === "cluster" ? (
    <NewsClusterCard
      key={card.id}
      card={card}
      saved={handlers.isSaved(card)}
      saving={handlers.isSaving(card)}
      {...handlers}
    />
  ) : (
    <NewsStoryCard
      key={card.id}
      card={card}
      saved={handlers.isSaved(card)}
      saving={handlers.isSaving(card)}
      {...handlers}
    />
  );

export default function NewsSourcePage({ user }) {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [selectedCard, setSelectedCard] = useState(null);
  const feed = useNewsFeed({ sourceSlug: slug, limit: 18 });
  const preferences = useNewsPreferences();
  const { savedArticleIds } = feed;
  const { syncSavedIds, savingIds } = preferences;

  useEffect(() => {
    syncSavedIds(savedArticleIds || []);
  }, [savedArticleIds, syncSavedIds]);

  const handlers = useMemo(
    () => ({
      activeTab: "for-you",
      onOpen: (card) => setSelectedCard(card),
      onHide: (payload) => preferences.hideItem(payload),
      onFollowSource: (sourceSlug) => preferences.followSource({ sourceSlug, follow: true }),
      onToggleSave: preferences.toggleSaved,
      onShare: preferences.shareItem,
      isSaved: (card) =>
        preferences.isSaved(
          String(card?.storyId || card?.representativeStory?.id || card?.id || "")
        ),
      isSaving: (card) =>
        savingIds.has(
          String(card?.storyId || card?.representativeStory?.id || card?.id || "")
        ),
      onTrack: preferences.track,
      onReport: async (payload) => {
        const reason = window.prompt("Tell us what looks wrong about this news item.", "Possible issue with this story");
        if (reason) {
          await preferences.reportIssue({ ...payload, reason });
        }
      },
    }),
    [preferences, savingIds]
  );

  const selectedStoryId = String(
    selectedCard?.storyId || selectedCard?.representativeStory?.id || selectedCard?.id || ""
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
          <section className="card news-hero-panel source">
            <div className="news-source-header">
              {feed.source ? <NewsSourceChip source={feed.source} /> : null}
              {feed.source ? <NewsPublisherBadge tier={feed.source.publisherTier} /> : null}
            </div>
            <h1>{feed.source?.displayName || String(slug || "source").replace(/-/g, " ")}</h1>
            <p>Browse Tengacion news coverage from this publisher with rights-aware previews and clear attribution.</p>
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
                <h3>Could not load this source</h3>
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
      <NewsDetailDrawer
        card={selectedCard}
        open={Boolean(selectedCard)}
        onClose={() => setSelectedCard(null)}
        onToggleSave={preferences.toggleSaved}
        onShare={preferences.shareItem}
        activeTab="for-you"
        saved={preferences.isSaved(selectedStoryId)}
        saving={savingIds.has(selectedStoryId)}
      />
    </>
  );
}
