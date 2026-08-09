const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const getBlockedUserIds = (user = {}) =>
  Array.from(
    new Set(
      [
        ...(Array.isArray(user?.blocks) ? user.blocks : []),
        // `blockedUsers` is read only as a compatibility bridge while startup
        // maintenance moves old records into the canonical `blocks` field.
        ...(Array.isArray(user?.blockedUsers) ? user.blockedUsers : []),
      ]
        .map((entry) => toIdString(entry))
        .filter(Boolean)
    )
  );

const hasBlockedUser = (user, targetId) => {
  const normalizedTargetId = toIdString(targetId);
  return Boolean(normalizedTargetId && getBlockedUserIds(user).includes(normalizedTargetId));
};

const isBlockedBetween = (firstUser, secondUser) => {
  const firstId = toIdString(firstUser?._id);
  const secondId = toIdString(secondUser?._id);
  if (!firstId || !secondId) return false;
  return hasBlockedUser(firstUser, secondId) || hasBlockedUser(secondUser, firstId);
};

const canSendDirectMessage = ({ sender, receiver }) => {
  if (!sender || !receiver) return false;
  const senderId = toIdString(sender._id);
  const receiverId = toIdString(receiver._id);
  if (!senderId || !receiverId || senderId === receiverId) return false;
  if (isBlockedBetween(sender, receiver)) return false;

  const permission = String(receiver?.privacy?.allowMessagesFrom || "everyone");
  if (permission === "no_one") return false;
  if (permission === "friends") {
    return (receiver.friends || []).some((id) => toIdString(id) === senderId);
  }
  return true;
};

module.exports = {
  canSendDirectMessage,
  getBlockedUserIds,
  hasBlockedUser,
  isBlockedBetween,
  toIdString,
};
