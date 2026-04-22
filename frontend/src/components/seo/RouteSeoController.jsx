import {
  buildCanonicalUrl,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  normalizePathname,
} from "../../lib/seo";
import {
  PRIVATE_CREATOR_ALIAS_SEGMENTS,
  normalizeCreatorUsername,
} from "../../lib/publicRoutes";
import SeoHead from "./SeoHead";
import { useLocation } from "react-router-dom";

const PUBLIC_STATIC_PATHS = new Set([
  "/creators",
  "/find-creators",
  "/music",
  "/books",
  "/podcasts",
  "/terms",
  "/privacy",
  "/community-guidelines",
  "/copyright-policy",
  "/developer-contact",
]);

const NOINDEX_RULES = [
  {
    patterns: ["/", "/login"],
    title: "Log In | Tengacion",
    description: "Log in to Tengacion to access your feed, creators, purchases, and messages.",
    canonicalPath: "/login",
  },
  {
    patterns: ["/register", "/signup", "/kaduna-got-talent/register"],
    title: "Create Account | Tengacion",
    description: "Create your Tengacion account to connect with creators, friends, and communities.",
  },
  {
    patterns: ["/forgot-password", "/reset-password", "/verify-email"],
    title: "Account Access | Tengacion",
    description: "Manage password recovery, email verification, and secure access for your Tengacion account.",
  },
  {
    patterns: ["/messages", "/messages/*", "/notifications", "/notifications/*"],
    title: "Private Page | Tengacion",
    description: "Private Tengacion page.",
  },
  {
    patterns: ["/settings", "/settings/*", "/dashboard", "/dashboard/*"],
    title: "Private Page | Tengacion",
    description: "Private Tengacion page.",
  },
  {
    patterns: ["/home", "/trending", "/news", "/news/*", "/live", "/live/*", "/gaming", "/reels"],
    title: "Tengacion App | Tengacion",
    description: "Private Tengacion app experience.",
  },
  {
    patterns: ["/search", "/profile/*", "/friends", "/find-friends", "/rooms", "/events", "/birthdays", "/saved", "/groups"],
    title: "Private Page | Tengacion",
    description: "Private Tengacion page.",
  },
  {
    patterns: ["/payment/verify", "/payments/*", "/purchases", "/purchases/*"],
    title: "Payments | Tengacion",
    description: "Private Tengacion payments and purchases page.",
  },
  {
    patterns: ["/onboarding", "/creator/register", "/creator/fan-page-view", "/creator/categories", "/creator/music", "/creator/music/*", "/creator/books", "/creator/books/*", "/creator/podcasts", "/creator/podcasts/*", "/creator/dashboard", "/creator/dashboard/*", "/creator/earnings", "/creator/payouts", "/creator/settings", "/creator/verification", "/creator/support"],
    title: "Creator Workspace | Tengacion",
    description: "Private Tengacion creator workspace.",
  },
  {
    patterns: ["/creators/*/subscribe", "/creator/*/subscribe"],
    title: "Subscribe | Tengacion",
    description: "Private Tengacion subscription flow.",
  },
  {
    patterns: ["/admin", "/admin/*", "/marketplace", "/marketplace/*"],
    title: "Private Page | Tengacion",
    description: "Private Tengacion page.",
  },
];

const matchesPathPattern = (pathname, pattern) => {
  const cleanPath = normalizePathname(pathname);
  const cleanPattern = normalizePathname(pattern);

  if (cleanPattern.endsWith("/*")) {
    const prefix = cleanPattern.slice(0, -2);
    return cleanPath === prefix || cleanPath.startsWith(`${prefix}/`);
  }

  if (cleanPattern.includes("*")) {
    const regexSource = cleanPattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\\\*/g, "[^/]+");
    return new RegExp(`^${regexSource}$`, "i").test(cleanPath);
  }

  return cleanPath === cleanPattern;
};

const isPublicCreatorRoute = (pathname) =>
  /^\/creators\/[^/]+(?:\/(?:music|albums|podcasts|books))?$/i.test(pathname);

const isPublicCreatorAliasRoute = (pathname) => {
  const match = pathname.match(/^\/creator\/([^/]+)(?:\/(music|albums|podcasts|books))?$/i);
  if (!match) {
    return false;
  }

  return !PRIVATE_CREATOR_ALIAS_SEGMENTS.has(normalizeCreatorUsername(match[1]));
};
const isPublicDetailRoute = (pathname) =>
  /^\/(tracks|books|albums)\/[^/]+$/i.test(pathname);

const isHandledPublicRoute = (pathname) =>
  PUBLIC_STATIC_PATHS.has(pathname)
  || isPublicCreatorRoute(pathname)
  || isPublicCreatorAliasRoute(pathname)
  || isPublicDetailRoute(pathname);

export default function RouteSeoController() {
  const location = useLocation();
  const pathname = normalizePathname(location.pathname);

  if (isHandledPublicRoute(pathname)) {
    return null;
  }

  const matchedRule =
    NOINDEX_RULES.find((rule) => rule.patterns.some((pattern) => matchesPathPattern(pathname, pattern)))
    || null;

  return (
    <SeoHead
      title={matchedRule?.title || DEFAULT_TITLE}
      description={matchedRule?.description || DEFAULT_DESCRIPTION}
      canonical={matchedRule?.canonicalPath || pathname}
      robots="noindex,nofollow"
      structuredData={[buildWebSiteJsonLd(), buildOrganizationJsonLd()]}
      ogUrl={buildCanonicalUrl(matchedRule?.canonicalPath || pathname)}
    />
  );
}
