const User = require("../models/User");

const MENTION_REGEX = /(^|\s)@([a-zA-Z0-9._]{3,30})/g;

const extractMentionUsernames = (text = "") => {
  const source = String(text || "");
  const matches = new Set();
  let entry = MENTION_REGEX.exec(source);
  while (entry) {
    const username = String(entry[2] || "").trim().toLowerCase();
    if (username) {
      matches.add(username);
    }
    entry = MENTION_REGEX.exec(source);
  }
  return [...matches];
};

const resolveMentionUserIds = async (text = "") => {
  const usernames = extractMentionUsernames(text);
  if (!usernames.length) {
    return [];
  }

  const users = await User.find({ username: { $in: usernames } }).select("_id").lean();
  return users.map((user) => user._id);
};

module.exports = {
  extractMentionUsernames,
  resolveMentionUserIds,
};
