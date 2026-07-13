import { useEffect, useState } from "react";
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

export default function PublicNav({ theme = "dark", className = "" }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const classes = ["public-nav", `public-nav--${theme}`, className].filter(Boolean).join(" ");

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      setMenuOpen(false);
    }
  };

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
    </nav>
  );
}
