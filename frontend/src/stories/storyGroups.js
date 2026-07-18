const getTimeValue = (value) => {
  const next = new Date(value || 0).getTime();
  return Number.isFinite(next) ? next : 0;
};

const getOwnerId = (story = {}) =>
  String(
    story?.userId?._id ||
      story?.userId ||
      story?.authorId?._id ||
      story?.authorId ||
      story?.username ||
      story?._id ||
      ""
  );

export const groupStoriesByOwner = (stories = [], viewerId = "") => {
  const normalizedViewerId = String(viewerId || "");
  const groups = new Map();

  (Array.isArray(stories) ? stories : []).forEach((entry) => {
    const ownerId = getOwnerId(entry);
    if (!ownerId) {
      return;
    }

    if (!groups.has(ownerId)) {
      groups.set(ownerId, {
        ownerId,
        username: entry?.username || "User",
        avatar: entry?.avatar || "",
        stories: [],
      });
    }

    groups.get(ownerId).stories.push(entry);
  });

  return [...groups.values()]
    .map((group) => {
      const ordered = [...group.stories].sort(
        (a, b) => getTimeValue(b?.time || b?.createdAt) - getTimeValue(a?.time || a?.createdAt)
      );

      const hasUnseen = ordered.some((entry) => {
        if (typeof entry?.viewerSeen === "boolean") {
          return !entry.viewerSeen;
        }
        const seenBy = Array.isArray(entry?.seenBy) ? entry.seenBy.map(String) : [];
        return normalizedViewerId ? !seenBy.includes(normalizedViewerId) : false;
      });

      return {
        ...group,
        latestStory: ordered[0] || null,
        stories: ordered,
        hasUnseen,
        isOwner: Boolean(normalizedViewerId && group.ownerId === normalizedViewerId),
        latestTime: getTimeValue(ordered[0]?.time || ordered[0]?.createdAt),
      };
    })
    .filter((group) => group.latestStory)
    .sort((a, b) => {
      if (a.isOwner !== b.isOwner) {
        return a.isOwner ? -1 : 1;
      }
      if (a.hasUnseen !== b.hasUnseen) {
        return a.hasUnseen ? -1 : 1;
      }
      return b.latestTime - a.latestTime;
    });
};

export const markStoriesSeen = (stories = [], storyIds = [], viewerId = "") => {
  if (!Array.isArray(stories)) {
    return [];
  }

  const normalizedViewerId = String(viewerId || "");
  const ids = new Set(
    (Array.isArray(storyIds) ? storyIds : [])
      .map((storyId) => String(storyId || ""))
      .filter(Boolean)
  );

  if (!normalizedViewerId || ids.size === 0) {
    return stories;
  }

  let changed = false;
  const nextStories = stories.map((entry) => {
    const storyId = String(entry?._id || entry?.id || "");
    if (!ids.has(storyId)) {
      return entry;
    }

    const seenBy = Array.isArray(entry?.seenBy) ? entry.seenBy.map(String) : [];
    const alreadySeen = seenBy.includes(normalizedViewerId);
    if (alreadySeen && entry?.viewerSeen === true) {
      return entry;
    }

    changed = true;
    return {
      ...entry,
      seenBy: alreadySeen ? seenBy : [...seenBy, normalizedViewerId],
      viewerSeen: true,
    };
  });

  return changed ? nextStories : stories;
};

