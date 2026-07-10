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
  const classes = ["public-nav", `public-nav--${theme}`, className].filter(Boolean).join(" ");

  return (
    <nav className={classes} aria-label="Public Tengacion navigation">
      <Link className="public-nav__brand" to="/" aria-label="Tengacion home">
        <img src="/tengacion_logo_128.png" alt="" />
        <span>Tengacion</span>
      </Link>

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

      <Link className="public-nav__account" to="/login">
        Log in / Create account
      </Link>
    </nav>
  );
}
