const PRIORITY = [
  "close_connection",
  "friend_connection",
  "following_connection",
  "previous_purchase",
  "creator_affinity",
  "content_type_affinity",
  "topic_affinity",
  "recent_messages",
  "fresh_content",
  "popular_now",
  "exploration",
];

const LABELS = {
  close_connection: "From someone in your close circle",
  friend_connection: "From someone you know",
  following_connection: "From a creator you follow",
  previous_purchase: "Because you bought from this creator before",
  creator_affinity: "Because you engage with this creator",
  content_type_affinity: "Because you like this format",
  topic_affinity: "Because it matches your interests",
  recent_messages: "Because you recently interacted with them",
  fresh_content: "New and relevant right now",
  popular_now: "Popular on Tengacion right now",
  exploration: "A new recommendation picked for you",
};

const selectPrimaryReason = (signals = []) => {
  const positiveSignals = (Array.isArray(signals) ? signals : [])
    .filter((signal) => signal && !signal.penalty)
    .sort((a, b) => {
      const aIndex = PRIORITY.indexOf(a.key);
      const bIndex = PRIORITY.indexOf(b.key);
      if (aIndex !== bIndex) return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      return Number(b.score || 0) - Number(a.score || 0);
    });

  return positiveSignals[0] || { key: "popular_now", score: 0 };
};

const decorateRankedItems = ({ items = [] } = {}) =>
  (Array.isArray(items) ? items : []).map((item, index) => {
    const primaryReason = selectPrimaryReason(item?.reasonSignals);

    return {
      id: item.entityId,
      entityType: item.entityType,
      score: Number(item.score || 0),
      rank: index + 1,
      reason: primaryReason.key,
      reasonLabel: LABELS[primaryReason.key] || LABELS.popular_now,
      payload: item.payload,
    };
  });

module.exports = {
  decorateRankedItems,
};
