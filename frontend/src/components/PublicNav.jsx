import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import "./PublicNav.css";

const PUBLIC_NAV_LINKS = [
  { path: "/", label: "Home", exact: true },
  { path: "/creators", label: "Creators" },
  { path: "/music", label: "Music" },
  { path: "/marketplace", label: "Marketplace" },
  { path: "/leadership", label: "Leadership" },
  { path: "/contact", label: "Contact" },
];

const isActivePath = (pathname = "", link) => {
  if (link.exact) {
    return pathname === link.path;
  }
  return pathname === link.path || pathname.startsWith(`${link.path}/`);
};

const RailControlIcon = ({ direction }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    {direction === "previous" ? (
      <path d="M12 5 7 10l5 5" />
    ) : (
      <path d="m8 5 5 5-5 5" />
    )}
  </svg>
);

export default function PublicNav({ theme = "dark", className = "" }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [railOverflow, setRailOverflow] = useState({
    canScrollBack: false,
    canScrollForward: false,
    hasOverflow: false,
  });
  const navRailRef = useRef(null);
  const classes = ["public-nav", `public-nav--${theme}`, className].filter(Boolean).join(" ");

  const syncRailOverflow = useCallback(() => {
    const rail = navRailRef.current;

    if (!rail) {
      return;
    }

    const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const nextOverflow = {
      canScrollBack: rail.scrollLeft > 2,
      canScrollForward: rail.scrollLeft < maxScrollLeft - 2,
      hasOverflow: maxScrollLeft > 2,
    };

    setRailOverflow((current) => {
      if (
        current.canScrollBack === nextOverflow.canScrollBack &&
        current.canScrollForward === nextOverflow.canScrollForward &&
        current.hasOverflow === nextOverflow.hasOverflow
      ) {
        return current;
      }

      return nextOverflow;
    });
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const rail = navRailRef.current;

    if (!rail) {
      return undefined;
    }

    const syncAfterFrame = () => {
      window.requestAnimationFrame(syncRailOverflow);
    };

    syncAfterFrame();
    rail.addEventListener("scroll", syncRailOverflow, { passive: true });
    window.addEventListener("resize", syncAfterFrame);

    let resizeObserver;
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(syncRailOverflow);
      resizeObserver.observe(rail);
    }

    return () => {
      rail.removeEventListener("scroll", syncRailOverflow);
      window.removeEventListener("resize", syncAfterFrame);
      resizeObserver?.disconnect();
    };
  }, [menuOpen, syncRailOverflow]);

  useEffect(() => {
    const rail = navRailRef.current;

    if (!rail || !menuOpen) {
      return;
    }

    rail.scrollTo({ left: 0, behavior: "auto" });
    window.requestAnimationFrame(syncRailOverflow);
  }, [menuOpen, pathname, syncRailOverflow]);

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      setMenuOpen(false);
    }
  };

  const scrollNavigationRail = useCallback(
    (direction) => {
      const rail = navRailRef.current;

      if (!rail) {
        return;
      }

      const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      const distance = Math.max(160, rail.clientWidth * 0.72);

      rail.scrollBy({
        left: direction === "previous" ? -distance : distance,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });

      window.setTimeout(syncRailOverflow, 260);
    },
    [syncRailOverflow]
  );

  return (
    <nav className={classes} aria-label="Public Tengacion navigation" onKeyDown={handleKeyDown}>
      <Link className="public-nav__brand" to="/" aria-label="Tengacion home">
        <img src="/tengacion_logo_128.png" width="128" height="128" alt="" />
        <span>Tengacion</span>
      </Link>

      <button
        type="button"
        className="public-nav__toggle"
        aria-controls="public-navigation-menu"
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setMenuOpen((current) => !current)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      <div
        id="public-navigation-menu"
        className={`public-nav__menu${menuOpen ? " public-nav__menu--open" : ""}`}
      >
        <button
          type="button"
          className={`public-nav__rail-control public-nav__rail-control--previous${
            railOverflow.hasOverflow ? " is-visible" : ""
          }`}
          aria-label="Show previous navigation items"
          disabled={!railOverflow.canScrollBack}
          onClick={() => scrollNavigationRail("previous")}
        >
          <RailControlIcon direction="previous" />
        </button>

        <div className="public-nav__button-rail" ref={navRailRef}>
          <div className="public-nav__links">
            {PUBLIC_NAV_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                aria-current={isActivePath(pathname, link) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <Link className="public-nav__account" to="/login" aria-label="Log in / Create account">
            <span>Log in</span>
            <strong>Create account</strong>
          </Link>
        </div>

        <button
          type="button"
          className={`public-nav__rail-control public-nav__rail-control--next${
            railOverflow.hasOverflow ? " is-visible" : ""
          }`}
          aria-label="Show more navigation items"
          disabled={!railOverflow.canScrollForward}
          onClick={() => scrollNavigationRail("next")}
        >
          <RailControlIcon direction="next" />
        </button>
      </div>
    </nav>
  );
}
