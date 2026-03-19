import { matchPath, useLocation } from "react-router-dom";

import useAmbientWelcomeVoice from "../hooks/useAmbientWelcomeVoice";

const PROTECTED_ROUTE_PATTERNS = [
  "/home",
  "/trending",
  "/gaming",
  "/reels",
  "/live",
  "/live/go",
  "/live/watch/:roomName",
  "/posts/:postId",
  "/posts/:postId/share",
  "/dashboard",
  "/creator",
  "/creator/register",
  "/creator/fan-page-view",
  "/creator/dashboard",
  "/creator/dashboard/:section",
  "/creator/categories",
  "/creator/music",
  "/creator/music/upload",
  "/creator/books",
  "/creator/books/upload",
  "/creator/podcasts",
  "/creator/podcasts/upload",
  "/creator/earnings",
  "/creator/payouts",
  "/creator/settings",
  "/creator/verification",
  "/creator/support",
  "/notifications",
  "/profile/:username",
  "/search",
  "/friends",
  "/memories",
  "/saved",
  "/groups",
  "/settings",
  "/settings/security",
  "/settings/privacy",
  "/settings/notifications",
  "/settings/display",
  "/settings/sound",
  "/help-support",
  "/feedback",
  "/onboarding",
  "/rooms",
  "/events",
  "/birthdays",
  "/ads-manager",
  "/admin",
  "/admin/:section",
  "/admin/:section/:id",
  "/artist/:username",
];

const PUBLIC_ROUTE_PATTERNS = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/terms",
  "/copyright-policy",
  "/privacy",
  "/community-guidelines",
  "/creators/:creatorId",
  "/creators/:creatorId/songs",
  "/creators/:creatorId/music",
  "/creators/:creatorId/albums",
  "/creators/:creatorId/podcasts",
  "/creators/:creatorId/books",
  "/creators/:creatorId/comedy",
  "/creators/:creatorId/store",
  "/creator/:creatorId",
  "/tracks/:trackId",
  "/books/:bookId",
  "/albums/:albumId",
];

const matchesRoutePattern = (pathname, pattern) =>
  Boolean(matchPath({ path: pattern, end: true }, pathname));

const isAuthenticatedExperiencePath = (pathname = "") => {
  if (!pathname) {
    return false;
  }

  if (PROTECTED_ROUTE_PATTERNS.some((pattern) => matchesRoutePattern(pathname, pattern))) {
    return true;
  }

  if (PUBLIC_ROUTE_PATTERNS.some((pattern) => matchesRoutePattern(pathname, pattern))) {
    return false;
  }

  return pathname !== "/";
};

export default function WelcomeVoiceController({ user }) {
  const location = useLocation();
  const active = Boolean(user && isAuthenticatedExperiencePath(location.pathname));

  useAmbientWelcomeVoice({
    user,
    active,
  });

  return null;
}
