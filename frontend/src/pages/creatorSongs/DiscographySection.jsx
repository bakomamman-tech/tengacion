import { useMemo, useState } from "react";
import { resolveImage } from "../../api";

const releaseDate = (value) => {
  if (!value) {
    return "Unknown date";
  }
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const rankBySignal = (track) => {
  const playCount = Number(track.playCount || 0);
  const likes = Number(track.likesCount ?? track.likes ?? 0);
  const recency = new Date(track.createdAt || 0).getTime() || 0;
  return playCount * 10 + likes * 3 + recency / 100000;
};

export default function DiscographySection({ styles, tracks, onOpenTrack }) {
  const [tab, setTab] = useState("popular");

  const filteredTracks = useMemo(() => {
    if (tab === "popular") {
      return [...tracks].sort((a, b) => rankBySignal(b) - rankBySignal(a));
    }
    return [...tracks].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
  }, [tab, tracks]);

  return (
    <section className={styles.section}>
      <h2>Discography</h2>
      <div className={styles.discTabs}>
        <button
          type="button"
          className={tab === "popular" ? styles.active : ""}
          onClick={() => setTab("popular")}
        >
          Popular releases
        </button>
        <button
          type="button"
          className={tab === "singles" ? styles.active : ""}
          onClick={() => setTab("singles")}
        >
          Singles and EPs
        </button>
      </div>

      {!filteredTracks.length ? (
        <p className={styles.empty}>No releases available.</p>
      ) : (
        <div className={styles.discGrid}>
          {filteredTracks.map((track) => {
            const coverUrl =
              resolveImage(track.coverImageUrl || "") || "/tengacion_logo_128.png";
            return (
              <article key={track._id} className={styles.discCard}>
                <img src={coverUrl} alt={`${track.title} cover`} />
                <div>
                  <h3>{track.title}</h3>
                  <p>{releaseDate(track.createdAt)}</p>
                  <p className={styles.discType}>Single</p>
                </div>
                <button type="button" onClick={() => onOpenTrack(track)}>
                  Open
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
