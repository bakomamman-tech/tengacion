import { Link } from "react-router-dom";
import styles from "./CreatorHub.module.css";

const TABS = [
  { key: "home", label: "HOME", suffix: "" },
  { key: "music", label: "MUSIC", suffix: "/music" },
  { key: "podcasts", label: "PODCASTS", suffix: "/podcasts" },
  { key: "books", label: "BOOKS", suffix: "/books" },
  { key: "comedy", label: "COMEDY", suffix: "/comedy" },
  { key: "store", label: "STORE", suffix: "/store" },
];

export default function CreatorHubLayout({
  creator,
  creatorId,
  activeTab,
  isOwner,
  isFollowing,
  onToggleFollow,
  currencyMode,
  onCurrencyMode,
  children,
}) {
  return (
    <div className={styles.hubPage}>
      <section className={styles.hubShell}>
        <div className={styles.banner}>
          <div className={styles.bannerIdentity}>
            <img className={styles.avatar} src={creator?.avatarUrl || "/avatar.png"} alt={creator?.displayName || "Creator"} />
            <div>
              <h1 className={styles.bannerTitle}>{creator?.displayName || "Creator"}</h1>
              <p className={styles.heroText}>Welcome to My Content Hub!</p>
              <p className={styles.bannerSub}>{creator?.tagline || creator?.bio || "Music, podcasts, books and comedy in one place."}</p>
            </div>
          </div>
          <div className={styles.bannerActions}>
            {isOwner ? (
              <Link to="/dashboard/creator" className={styles.ownerBtn}>Upload / Manage</Link>
            ) : (
              <button type="button" onClick={onToggleFollow} className={styles.followBtn}>
                {isFollowing ? "Following" : "Follow"}
              </button>
            )}
            <button type="button" className={styles.roundBtn} aria-label="Search creator content">&#128269;</button>
            <button type="button" className={styles.roundBtn} aria-label="Open library">&#128218;</button>
          </div>
        </div>

        <div className={styles.tabsRow}>
          <div className={styles.tabs}>
            {TABS.map((tab) => (
              <Link
                key={tab.key}
                to={`/creators/${creatorId}${tab.suffix}`}
                className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabBtnActive : ""}`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <div className={styles.bannerActions}>
            <span className={styles.mutedText} style={{ color: "rgba(255,255,255,0.9)" }}>Switch to Worldwide</span>
            <span className={styles.currencyBox}>
              <button
                type="button"
                className={`${styles.currencyBtn} ${currencyMode === "NG" ? styles.currencyBtnActive : ""}`}
                onClick={() => onCurrencyMode("NG")}
              >
                NG
              </button>
              <button
                type="button"
                className={`${styles.currencyBtn} ${currencyMode === "GLOBAL" ? styles.currencyBtnActive : ""}`}
                onClick={() => onCurrencyMode("GLOBAL")}
              >
                GLOBAL
              </button>
            </span>
          </div>
        </div>
      </section>
      {children}
    </div>
  );
}
