import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, useLocation } from "react-router-dom";

import { CANONICAL_ROOT, PORTAL_NAV } from "./brightFutureData";
import useBrightFuture from "./useBrightFuture";

const readTheme = () => {
  try {
    return localStorage.getItem("brightFutureTheme") || "light";
  } catch {
    return "light";
  }
};

export function BrightFutureLogo({ compact = false }) {
  return (
    <span className={`bfa-logo ${compact ? "is-compact" : ""}`}>
      <span className="bfa-logo__mark" aria-hidden="true"><i>B</i><i>F</i><i>A</i></span>
      <span className="bfa-logo__copy"><strong>Bright Future</strong><small>Academy</small></span>
    </span>
  );
}

export function BrightFutureThemeButton({ theme, onToggle }) {
  return (
    <button className="bfa-icon-button" type="button" onClick={onToggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
      <span aria-hidden="true">{theme === "dark" ? "☀" : "◐"}</span>
    </button>
  );
}

export default function BrightFutureLayout({ children, portal = false, activeKey = "", fullBleed = false }) {
  const location = useLocation();
  const { candidate, signOutCandidate } = useBrightFuture();
  const [theme, setTheme] = useState(readTheme);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem("brightFutureTheme", theme); } catch { /* preference remains in memory */ }
  }, [theme]);
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const toggleTheme = () => setTheme((current) => current === "dark" ? "light" : "dark");

  return (
    <div className={`bfa-app bfa-theme-${theme} ${portal ? "bfa-is-portal" : ""}`}>
      <a className="bfa-skip-link" href="#bfa-main">Skip to content</a>
      <header className="bfa-header">
        <Link to={CANONICAL_ROOT} aria-label="Bright Future Academy home"><BrightFutureLogo /></Link>
        <button type="button" className="bfa-menu-button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-controls="bfa-primary-nav">Menu</button>
        <nav id="bfa-primary-nav" className={menuOpen ? "is-open" : ""} aria-label="Bright Future Academy navigation">
          <Link to={CANONICAL_ROOT}>Home</Link>
          <Link to={`${CANONICAL_ROOT}/subjects`}>Academics</Link>
          <Link to={`${CANONICAL_ROOT}/leaderboard`}>Leaderboard</Link>
          <Link to={`${CANONICAL_ROOT}/participants`}>Students</Link>
          <Link to={`${CANONICAL_ROOT}/announcements`}>News</Link>
        </nav>
        <div className="bfa-header__actions">
          <BrightFutureThemeButton theme={theme} onToggle={toggleTheme} />
          {candidate ? (
            <Link className="bfa-button bfa-button--small" to={`${CANONICAL_ROOT}/dashboard`}>My Dashboard</Link>
          ) : (
            <Link className="bfa-button bfa-button--small" to={`${CANONICAL_ROOT}/login`}>Student Login</Link>
          )}
        </div>
      </header>

      {portal ? (
        <div className="bfa-portal-frame">
          <aside className="bfa-portal-sidebar" aria-label="Student portal">
            <div className="bfa-student-chip">
              <span>{String(candidate?.firstName || "S").slice(0, 1)}</span>
              <div><strong>{candidate?.fullName || "Student"}</strong><small>{candidate?.candidateId}</small></div>
            </div>
            <nav>
              {PORTAL_NAV.map((item) => (
                <NavLink key={item.key} to={`${CANONICAL_ROOT}${item.path}`} className={activeKey === item.key ? "is-active" : ""}>
                  <span aria-hidden="true">{item.icon}</span>{item.label}
                </NavLink>
              ))}
            </nav>
            <button type="button" className="bfa-sidebar-signout" onClick={signOutCandidate}>Sign out of student portal</button>
          </aside>
          <main id="bfa-main" className={fullBleed ? "bfa-portal-main is-full" : "bfa-portal-main"}>{children}</main>
        </div>
      ) : (
        <main id="bfa-main" className={fullBleed ? "bfa-main is-full" : "bfa-main"}>{children}</main>
      )}

      {!portal ? (
        <footer className="bfa-footer">
          <div><BrightFutureLogo compact /><p>Learn. Compete. Excel.</p></div>
          <div><strong>Explore</strong><Link to={`${CANONICAL_ROOT}/register`}>Student registration</Link><Link to={`${CANONICAL_ROOT}/leaderboard`}>CBT leaderboard</Link></div>
          <div><strong>Student portal</strong><Link to={`${CANONICAL_ROOT}/login`}>Returning candidate</Link><Link to={`${CANONICAL_ROOT}/teachers`}>Teacher directory</Link></div>
          <p className="bfa-footer__legal">Bright Future Academy is a school portal and academic competition experience on Tengacion. Private student contact details are never shown publicly.</p>
        </footer>
      ) : null}
    </div>
  );
}

export function RequireBrightFutureCandidate({ children }) {
  const { candidate, sessionLoading } = useBrightFuture();
  const location = useLocation();
  if (sessionLoading) {return <div className="bfa-app bfa-theme-light"><div className="bfa-page-loader"><span /><p>Restoring your student portal…</p></div></div>;}
  if (!candidate) {return <Navigate to={`${CANONICAL_ROOT}/login`} replace state={{ from: location.pathname }} />;}
  return children;
}
