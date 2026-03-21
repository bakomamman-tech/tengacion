import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";

import Navbar from "../../../Navbar";
import Sidebar from "../../../Sidebar";
import RightQuickNav from "../../../components/RightQuickNav";
import NewsClusterCard from "../components/NewsClusterCard";
import NewsDetailDrawer from "../components/NewsDetailDrawer";
import NewsFeedTabs from "../components/NewsFeedTabs";
import NewsCardSkeleton from "../components/NewsCardSkeleton";
import NewsHighlightsStrip from "../components/NewsHighlightsStrip";
import NewsStoryCard from "../components/NewsStoryCard";
import { useNewsFeed } from "../hooks/useNewsFeed";
import { useNewsPreferences } from "../hooks/useNewsPreferences";

const VALID_TABS = new Set(["for-you", "local", "nigeria", "world"]);

const renderCard = (card, handlers, savedState) =>
  card?.cardType === "cluster" ? (
    <NewsClusterCard
      key={card.id}
      card={card}
      saved={savedState.saved}
      saving={savedState.saving}
      {...handlers}
    />
  ) : (
    <NewsStoryCard
      key={card.id}
      card={card}
      saved={savedState.saved}
      saving={savedState.saving}
      {...handlers}
    />
  );

const getStoryId = (card) =>
  String(card?.storyId || card?.representativeStory?.id || card?.id || "");

export default function NewsHubPage({ user }) {
  const MotionSection = motion.section;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const activeTab = VALID_TABS.has(params.get("tab")) ? params.get("tab") : "for-you";
  const [selectedCard, setSelectedCard] = useState(null);
  const loadMoreRef = useRef(null);
  const feed = useNewsFeed({ tab: activeTab, limit: 12 });
  const preferences = useNewsPreferences();
  const {
    cards = [],
    error,
    hasMore,
    highlights,
    loading,
    loadingMore,
    loadMore,
    meta,
    refresh,
    savedArticleIds,
  } = feed;
  const { savingIds, syncSavedIds } = preferences;

  useEffect(() => {
    setSelectedCard(null);
  }, [activeTab]);

  useEffect(() => {
    if (!VALID_TABS.has(params.get("tab"))) {
      setParams({ tab: "for-you" }, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => {
    syncSavedIds(savedArticleIds || []);
  }, [savedArticleIds, syncSavedIds]);

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading || loadingMore) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      {
        rootMargin: "220px 0px",
      }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadMore]);

  const handlers = useMemo(
    () => ({
      activeTab,
      onOpen: (card) => setSelectedCard(card),
      onHide: (payload) => preferences.hideItem(payload),
      onFollowSource: (sourceSlug) => preferences.followSource({ sourceSlug, follow: true }),
      onToggleSave: preferences.toggleSaved,
      onShare: preferences.shareItem,
      onTrack: preferences.track,
      onReport: async (payload) => {
        const reason = window.prompt(
          "Tell us what looks wrong about this news item.",
          "Possible issue with this story"
        );
        if (reason) {
          await preferences.reportIssue({ ...payload, reason });
        }
      },
    }),
    [activeTab, preferences]
  );

  const handleTabChange = (nextTab) => {
    startTransition(() => {
      setParams({ tab: nextTab });
    });
  };

  const selectedStoryId = getStoryId(selectedCard);
  const selectedSaved = preferences.isSaved(selectedStoryId);
  const selectedSaving = savingIds.has(selectedStoryId);

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

        <main className="feed news-feed-shell">
          <section className="card news-hero-panel">
            <div className="news-hero-copy">
              <span className="news-eyebrow">Tengacion News</span>
              <h1>Trusted news for your social feed</h1>
              <p>
                Calm, rights-aware news with strong source attribution, balanced ranking, and
                quick access to the publisher&apos;s original reporting.
              </p>
            </div>

            <NewsFeedTabs activeTab={activeTab} onChange={handleTabChange} />

            <div className="news-hero-meta-row">
              <div>
                <strong>{meta?.title || "For You"}</strong>
                <p>{meta?.description || "Trusted stories shaped for you."}</p>
              </div>
              {isPending ? <span className="news-hero-status">Refreshing feed...</span> : null}
            </div>
          </section>

          <NewsHighlightsStrip highlights={highlights} meta={meta} />

          <MotionSection
            key={activeTab}
            id={`news-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`news-tab-${activeTab}`}
            className="news-feed-grid"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            {loading ? (
              <>
                <NewsCardSkeleton />
                <NewsCardSkeleton />
                <NewsCardSkeleton />
                <NewsCardSkeleton />
              </>
            ) : error ? (
              <article className="card news-empty-state">
                <h3>Could not load Tengacion News</h3>
                <p>{error}</p>
                <button
                  type="button"
                  className="news-action-button primary"
                  onClick={() => refresh()}
                >
                  Try again
                </button>
              </article>
            ) : Array.isArray(cards) && cards.length ? (
              cards.map((card) =>
                renderCard(card, handlers, {
                  saved: preferences.isSaved(getStoryId(card)),
                  saving: savingIds.has(getStoryId(card)),
                })
              )
            ) : (
              <article className="card news-empty-state">
                <h3>{meta?.emptyTitle || "No news yet"}</h3>
                <p>{meta?.emptyDescription || "Fresh stories will appear here soon."}</p>
                <button
                  type="button"
                  className="news-action-button"
                  onClick={() => refresh()}
                >
                  Refresh feed
                </button>
              </article>
            )}
          </MotionSection>

          {!loading && hasMore ? (
            <div className="news-load-more-row">
              <div ref={loadMoreRef} className="news-feed-sentinel" aria-hidden="true" />
              <button
                type="button"
                className="news-action-button"
                onClick={() => loadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : "Load more news"}
              </button>
            </div>
          ) : null}
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
        activeTab={activeTab}
        saved={selectedSaved}
        saving={selectedSaving}
      />
    </>
  );
}
