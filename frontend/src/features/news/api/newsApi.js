import { apiRequest, API_BASE } from "../../../api";

const withParams = (path, params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return `${API_BASE}${path}${query ? `?${query}` : ""}`;
};

export const getNewsFeed = ({ tab = "for-you", cursor = "", limit = 20 } = {}) =>
  apiRequest(withParams("/news/feed", { tab, cursor, limit }));

export const getLocalNews = ({ country = "", state = "", cursor = "", limit = 20 } = {}) =>
  apiRequest(withParams("/news/local", { country, state, cursor, limit }));

export const getWorldNews = ({ cursor = "", limit = 20 } = {}) =>
  apiRequest(withParams("/news/world", { cursor, limit }));

export const getTopicNews = (slug, { tab = "for-you", cursor = "", limit = 20 } = {}) =>
  apiRequest(withParams(`/news/topic/${encodeURIComponent(slug || "")}`, { tab, cursor, limit }));

export const getSourceNews = (slug, { tab = "for-you", cursor = "", limit = 20 } = {}) =>
  apiRequest(withParams(`/news/source/${encodeURIComponent(slug || "")}`, { tab, cursor, limit }));

export const getNewsCluster = (clusterId) =>
  apiRequest(`${API_BASE}/news/clusters/${encodeURIComponent(clusterId || "")}`);

export const getNewsStory = (storyId) =>
  apiRequest(`${API_BASE}/news/stories/${encodeURIComponent(storyId || "")}`);

export const trackNewsImpression = (payload = {}) =>
  apiRequest(`${API_BASE}/news/impressions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });

export const hideNewsItem = (payload = {}) =>
  apiRequest(`${API_BASE}/news/preferences/hide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });

export const followNewsSource = (payload = {}) =>
  apiRequest(`${API_BASE}/news/preferences/follow-source`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });

export const reportNewsIssue = (payload = {}) =>
  apiRequest(`${API_BASE}/news/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
