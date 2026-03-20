import { useEffect, useState } from "react";

import {
  getLocalNews,
  getNewsFeed,
  getSourceNews,
  getTopicNews,
  getWorldNews,
} from "../api/newsApi";

const resolveRequest = ({ tab, topicSlug, sourceSlug, country, state, cursor, limit }) => {
  if (topicSlug) {
    return getTopicNews(topicSlug, { tab, cursor, limit });
  }
  if (sourceSlug) {
    return getSourceNews(sourceSlug, { tab, cursor, limit });
  }
  if (tab === "local") {
    return getLocalNews({ country, state, cursor, limit });
  }
  if (tab === "world") {
    return getWorldNews({ cursor, limit });
  }
  if (tab === "nigeria") {
    return getLocalNews({ country: "Nigeria", cursor, limit });
  }
  return getNewsFeed({ tab, cursor, limit });
};

export function useNewsFeed({
  tab = "for-you",
  topicSlug = "",
  sourceSlug = "",
  country = "",
  state = "",
  limit = 20,
  enabled = true,
} = {}) {
  const [payload, setPayload] = useState({
    cards: [],
    nextCursor: "",
    hasMore: false,
    tab,
  });
  const [loading, setLoading] = useState(Boolean(enabled));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const next = await resolveRequest({
          tab,
          topicSlug,
          sourceSlug,
          country,
          state,
          cursor: "",
          limit,
        });
        if (!cancelled) {
          setPayload(next || { cards: [], nextCursor: "", hasMore: false, tab });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to load news");
          setPayload({ cards: [], nextCursor: "", hasMore: false, tab });
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
  }, [country, enabled, limit, sourceSlug, state, tab, topicSlug]);

  const loadMore = async () => {
    if (!payload?.nextCursor || loadingMore) {
      return;
    }

    try {
      setLoadingMore(true);
      const next = await resolveRequest({
        tab,
        topicSlug,
        sourceSlug,
        country,
        state,
        cursor: payload.nextCursor,
        limit,
      });
      setPayload((current) => ({
        ...(next || {}),
        cards: [...(current?.cards || []), ...(next?.cards || [])],
      }));
    } catch (err) {
      setError(err?.message || "Failed to load more news");
    } finally {
      setLoadingMore(false);
    }
  };

  const refresh = async () => {
    const next = await resolveRequest({
      tab,
      topicSlug,
      sourceSlug,
      country,
      state,
      cursor: "",
      limit,
    });
    setPayload(next || { cards: [], nextCursor: "", hasMore: false, tab });
    setError("");
    return next;
  };

  return {
    ...payload,
    loading,
    loadingMore,
    error,
    loadMore,
    refresh,
  };
}
