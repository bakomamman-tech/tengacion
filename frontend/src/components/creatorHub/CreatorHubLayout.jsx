import { Link } from "react-router-dom";
import styles from "./CreatorHub.module.css";
import { buttonStyles, cx } from "../ui/buttonStyles";

const TABS = [
  { key: "home", label: "HOME", suffix: "" },
  { key: "music", label: "MUSIC", suffix: "/music" },
  { key: "albums", label: "ALBUMS", suffix: "/albums" },
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
              <Link
                to="/creator"
                className={cx(buttonStyles({ variant: "secondary" }), styles.ownerBtn)}
              >
                Upload / Manage
              </Link>
            ) : (
              <button
                type="button"
                onClick={onToggleFollow}
                className={cx(buttonStyles({ variant: "primary" }), styles.followBtn)}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            )}
            <button
              type="button"
              className={cx(buttonStyles({ variant: "icon", iconOnly: true }), styles.roundBtn)}
              aria-label="Search creator content"
            >
              &#128269;
            </button>
            <button
              type="button"
              className={cx(buttonStyles({ variant: "icon", iconOnly: true }), styles.roundBtn)}
              aria-label="Open library"
            >
              &#128218;
            </button>
          </div>
        </div>

        <div className={styles.tabsRow}>
          <div className={styles.tabs}>
            {TABS.map((tab) => (
              <Link
                key={tab.key}
                to={`/creators/${creatorId}${tab.suffix}`}
                className={cx(
                  buttonStyles({ variant: "tab", size: "sm" }),
                  styles.tabBtn,
                  activeTab === tab.key && "is-active",
                  activeTab === tab.key && styles.tabBtnActive
                )}
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
                className={cx(
                  buttonStyles({ variant: "tab", size: "xs" }),
                  styles.currencyBtn,
                  currencyMode === "NG" && "is-active",
                  currencyMode === "NG" && styles.currencyBtnActive
                )}
                onClick={() => onCurrencyMode("NG")}
              >
                NG
              </button>
              <button
                type="button"
                className={cx(
                  buttonStyles({ variant: "tab", size: "xs" }),
                  styles.currencyBtn,
                  currencyMode === "GLOBAL" && "is-active",
                  currencyMode === "GLOBAL" && styles.currencyBtnActive
                )}
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
