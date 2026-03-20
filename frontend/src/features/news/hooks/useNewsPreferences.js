import { useState } from "react";
import toast from "react-hot-toast";

import {
  followNewsSource,
  hideNewsItem,
  reportNewsIssue,
  trackNewsImpression,
} from "../api/newsApi";

export function useNewsPreferences() {
  const [busy, setBusy] = useState(false);

  const withBusy = async (work) => {
    try {
      setBusy(true);
      return await work();
    } finally {
      setBusy(false);
    }
  };

  const hideItem = async (payload) =>
    withBusy(async () => {
      await hideNewsItem(payload);
      toast.success("This news item will appear less often.");
    });

  const followSource = async ({ sourceSlug, follow = true } = {}) =>
    withBusy(async () => {
      const result = await followNewsSource({ sourceSlug, follow });
      toast.success(follow ? "Source followed." : "Source unfollowed.");
      return result;
    });

  const reportIssue = async (payload = {}) =>
    withBusy(async () => {
      await reportNewsIssue(payload);
      toast.success("Thanks. We will review this report.");
    });

  const track = async (payload = {}) => {
    try {
      await trackNewsImpression(payload);
    } catch {
      // Keep interaction lightweight for the feed.
    }
  };

  return {
    busy,
    hideItem,
    followSource,
    reportIssue,
    track,
  };
}
