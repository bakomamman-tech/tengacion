import { useState } from "react";
import AppLauncher from "./AppLauncher";
import "./index.css";

export default function Navbar({ user, page, setPage }) {
  const [showApps, setShowApps] = useState(false);

  return (
    <div className="navbar">

      {/* LEFT */}
      <div className="nav-left">
        <img src="/favicon.png" className="nav-logo" />
        <input className="nav-search" placeholder="Search Tengacion" />
      </div>

      {/* CENTER */}
      <div className="nav-center">
        <button className={page==="home" ? "nav-active" : ""} onClick={()=>setPage("home")}>🏠</button>
        <button className={page==="watch" ? "nav-active" : ""} onClick={()=>setPage("watch")}>🎥</button>
        <button className={page==="groups" ? "nav-active" : ""} onClick={()=>setPage("groups")}>👥</button>
        <button className={page==="market" ? "nav-active" : ""} onClick={()=>setPage("market")}>🛒</button>
        <button className={page==="games" ? "nav-active" : ""} onClick={()=>setPage("games")}>🎮</button>
      </div>

      {/* RIGHT */}
      <div className="nav-right">
        <button className="nav-icon" onClick={()=>setShowApps(!showApps)}>⬛</button>
        <button className="nav-icon">💬</button>
        <button className="nav-icon">🔔</button>

        <img
          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`}
          className="nav-avatar"
        />
      </div>

      {showApps && <AppLauncher />}
    </div>
  );
}
