import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import {
  followNewsSource,
  getNewsPreferences,
  hideNewsItem,
  reportNewsIssue,
  saveNewsArticle,
  trackNewsImpression,
  unsaveNewsArticle,
  updateNewsPreferences,
} from "../api/newsApi";

const addToSet = (current, value) => {
  const next = new Set(current);
  next.add(String(value || ""));
  return next;
};

const removeFromSet = (current, value) => {
  const next = new Set(current);
  next.delete(String(value || ""));
  return next;
};

export function useNewsPreferences() {
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const [savingIds, setSavingIds] = useState(new Set());

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const payload = await getNewsPreferences();
        if (!cancelled) {
          setPreferences(payload?.preferences || null);
        }
      } catch {
        if (!cancelled) {
          setPreferences(null);
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
  }, []);

  const withBusy = async (work) => {
    try {
      setBusy(true);
      return await work();
    } finally {
      setBusy(false);
    }
  };

  const syncSavedIds = useCallback((ids = []) => {
    setSavedIds(new Set((Array.isArray(ids) ? ids : []).map((entry) => String(entry || "")).filter(Boolean)));
  }, []);

  const hideItem = async (payload) =>
    withBusy(async () => {
      await hideNewsItem(payload);
      toast.success("This story will appear less often.");
    });

  const followSource = async ({ sourceSlug, follow = true } = {}) =>
    withBusy(async () => {
      const result = await followNewsSource({ sourceSlug, follow });
      setPreferences(result?.preferences || null);
      toast.success(follow ? "Trusted source followed." : "Source unfollowed.");
      return result;
    });

  const savePreferenceChanges = async (payload = {}) =>
    withBusy(async () => {
      const result = await updateNewsPreferences(payload);
      setPreferences(result?.preferences || null);
      toast.success("News preferences updated.");
      return result;
    });

  const toggleSaved = async ({ articleId, saved = false, feedTab = "for-you" } = {}) => {
    const key = String(articleId || "");
    if (!key) {
      return;
    }

    const nextSaved = !saved;
    setSavingIds((current) => addToSet(current, key));
    setSavedIds((current) => (nextSaved ? addToSet(current, key) : removeFromSet(current, key)));

    try {
      if (nextSaved) {
        await saveNewsArticle(key, { feedTab });
        toast.success("Saved to your news bookmarks.");
      } else {
        await unsaveNewsArticle(key);
        toast.success("Removed from bookmarks.");
      }
    } catch (error) {
      setSavedIds((current) => (saved ? addToSet(current, key) : removeFromSet(current, key)));
      toast.error(error?.message || "Could not update bookmark.");
    } finally {
      setSavingIds((current) => removeFromSet(current, key));
    }
  };

  const reportIssue = async (payload = {}) =>
    withBusy(async () => {
      await reportNewsIssue(payload);
      toast.success("Thanks. We will review this report.");
    });

  const shareItem = async ({ title = "Tengacion News", canonicalUrl = "" } = {}) => {
    const url = String(canonicalUrl || "").trim();
    if (!url) {
      toast.error("This story does not have an external link yet.");
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      toast.success("Story link ready to share.");
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error("Could not share this story.");
      }
    }
  };

  const track = async (payload = {}) => {
    try {
      await trackNewsImpression(payload);
    } catch {
      // Keep interaction lightweight for the feed.
    }
  };

  return {
    busy,
    loading,
    preferences,
    savedIds,
    savingIds,
    isSaved: (articleId) => savedIds.has(String(articleId || "")),
    syncSavedIds,
    hideItem,
    followSource,
    savePreferenceChanges,
    toggleSaved,
    reportIssue,
    shareItem,
    track,
  };
}
