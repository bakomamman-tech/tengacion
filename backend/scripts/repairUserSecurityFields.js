const User = require("../models/User");

const ensureObject = (value, fallback = {}) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...fallback, ...value };
  }
  return { ...fallback };
};

async function repairUserSecurityFields({ logger = console } = {}) {
  const cursor = User.find(
    {},
    "_id privacy onboarding notificationPrefs sessions twoFactor trustedDevices interests blocks mutes restricts hiddenStoriesFrom"
  ).cursor();
  let touched = 0;
  for await (const user of cursor) {
    let dirty = false;

    user.privacy = ensureObject(user.privacy, {
      profileVisibility: "public",
      defaultPostAudience: "friends",
      allowMessagesFrom: "everyone",
    });
    user.notificationPrefs = ensureObject(user.notificationPrefs, {
      likes: true,
      comments: true,
      follows: true,
      mentions: true,
      messages: true,
      reports: true,
      system: true,
    });
    user.onboarding = ensureObject(user.onboarding, {
      completed: false,
      steps: { avatar: false, bio: false, interests: false, followSuggestions: false },
    });

    if (!Array.isArray(user.sessions)) {
      user.sessions = [];
      dirty = true;
    }
    if (!user.twoFactor || typeof user.twoFactor !== "object") {
      user.twoFactor = {
        enabled: false,
        method: "none",
        setupPending: false,
        enabledAt: null,
        lastVerifiedAt: null,
      };
      dirty = true;
    }
    if (!Array.isArray(user.trustedDevices)) {
      user.trustedDevices = [];
      dirty = true;
    }
    if (!Array.isArray(user.interests)) {
      user.interests = [];
      dirty = true;
    }
    if (!Array.isArray(user.blocks)) {
      user.blocks = [];
      dirty = true;
    }
    if (!Array.isArray(user.mutes)) {
      user.mutes = [];
      dirty = true;
    }
    if (!Array.isArray(user.restricts)) {
      user.restricts = [];
      dirty = true;
    }
    if (!Array.isArray(user.hiddenStoriesFrom)) {
      user.hiddenStoriesFrom = [];
      dirty = true;
    }

    if (dirty) {
      touched += 1;
      await user.save();
    }
  }

  if (touched > 0) {
    logger.info(`[repairUserSecurityFields] normalized ${touched} users`);
  }
  return { touched };
}

module.exports = { repairUserSecurityFields };
