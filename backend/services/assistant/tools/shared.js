const mongoose = require("mongoose");

const User = require("../../../models/User");
const CreatorProfile = require("../../../models/CreatorProfile");
const { assistantCardSchema } = require("../schemas");

const safeText = (value, max = 160) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const escapeRegExp = (value = "") => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildAction = (target, state = {}, label = "") => ({
  type: "navigate",
  target,
  state,
  label,
});

const buildCard = (card) => assistantCardSchema.parse(card);

const creatorIsReady = (profile) =>
  Boolean(profile && (profile.onboardingComplete || profile.onboardingCompleted));

const getUserProfileRoute = async (userId) => {
  const user = await User.findById(userId).select("username").lean();
  const username = safeText(user?.username || "", 80);
  return username ? `/profile/${username}` : "/settings";
};

const getCreatorProfile = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  return CreatorProfile.findOne({ userId }).select("onboardingComplete onboardingCompleted creatorTypes").lean();
};

const getCreatorRouteForDashboard = async (userId) => {
  const profile = await getCreatorProfile(userId);
  return creatorIsReady(profile) ? "/creator/dashboard" : "/creator";
};

const getCreatorRouteForOnboarding = async (userId) => {
  const profile = await getCreatorProfile(userId);
  return creatorIsReady(profile) ? "/creator/dashboard" : "/creator/register";
};

const getUploadRoute = async (userId, type) => {
  const profile = await getCreatorProfile(userId);
  if (!creatorIsReady(profile)) {
    return "/creator";
  }

  if (type === "book") {
    return "/creator/books/upload";
  }

  if (type === "podcast") {
    return "/creator/podcasts/upload";
  }

  return "/creator/music/upload";
};

const buildNavigateResponse = ({ message, route, state = {}, label = "", cards = [] }) => ({
  message,
  actions: [buildAction(route, state, label)],
  cards,
  requiresConfirmation: false,
  pendingAction: null,
});

module.exports = {
  buildAction,
  buildCard,
  buildNavigateResponse,
  creatorIsReady,
  escapeRegExp,
  getCreatorProfile,
  getCreatorRouteForDashboard,
  getCreatorRouteForOnboarding,
  getUploadRoute,
  getUserProfileRoute,
  safeText,
};
