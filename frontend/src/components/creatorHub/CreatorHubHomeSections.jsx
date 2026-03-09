import styles from "./CreatorHub.module.css";
import ContinueListeningRow from "./ContinueListeningRow";
import { TopTracksList } from "./TopTracksList";
import TopTracksWidget from "./TopTracksWidget";
import LatestPodcastsWidget from "./LatestPodcastsWidget";
import ComedyRow from "./ComedyRow";
import EbooksRow from "./EbooksRow";
import { buttonStyles, cx } from "../ui/buttonStyles";

export default function CreatorHubHomeSections({
  sections,
  creator,
  currencyMode,
  onPlay,
  onViewTab,
  onCheckout,
  onDownload,
  onMenu,
}) {
  return (
    <div className={styles.mainGrid}>
      <div>
        <ContinueListeningRow
          items={sections.continueListening || []}
          onPlay={(item) => onPlay({
            id: item.itemId,
            title: item.title,
            coverUrl: item.coverUrl,
            creatorName: creator.displayName,
            type: item.type,
            streamUrl: item.streamUrl || "",
            durationSec: item.durationSec,
            creatorId: creator.id,
            lockedPreview: false,
          })}
        />

        <div className={styles.tracksGrid} style={{ marginTop: "1rem" }}>
          <TopTracksList
            tracks={sections.topTracks || []}
            currencyMode={currencyMode}
            creatorName={creator.displayName}
            onPlay={(track, queue) => onPlay({
              id: track.id,
              title: track.title,
              coverUrl: track.coverUrl,
              creatorName: creator.displayName,
              type: track.kind === "podcast" ? "podcast" : "song",
              streamUrl: track.streamUrl,
              durationSec: track.durationSec,
              creatorId: creator.id,
              lockedPreview: !track.isFree && !track.canDownload,
              previewLimitSec: 45,
            }, queue.map((entry) => ({
              id: entry.id,
              title: entry.title,
              coverUrl: entry.coverUrl,
              creatorName: creator.displayName,
              type: entry.kind === "podcast" ? "podcast" : "song",
              streamUrl: entry.streamUrl,
              durationSec: entry.durationSec,
              creatorId: creator.id,
              lockedPreview: !entry.isFree && !entry.canDownload,
              previewLimitSec: 45,
            })))}
            onViewAll={() => onViewTab("music")}
            onCheckout={onCheckout}
            onTrackMenu={onMenu}
          />
          <TopTracksWidget tracks={sections.topTracks || []} />
        </div>

        <div style={{ marginTop: "1rem" }}>
          <ComedyRow
            items={sections.latestComedy || []}
            currencyMode={currencyMode}
            onViewAll={() => onViewTab("comedy")}
            onPlay={(video, queue) => onPlay({
              id: video.id,
              title: video.title,
              coverUrl: video.coverUrl,
              creatorName: creator.displayName,
              type: "video",
              streamUrl: video.streamUrl,
              durationSec: video.durationSec,
              creatorId: creator.id,
              lockedPreview: !video.isFree,
              previewLimitSec: 45,
            }, queue.map((entry) => ({
              id: entry.id,
              title: entry.title,
              coverUrl: entry.coverUrl,
              creatorName: creator.displayName,
              type: "video",
              streamUrl: entry.streamUrl,
              durationSec: entry.durationSec,
              creatorId: creator.id,
              lockedPreview: !entry.isFree,
              previewLimitSec: 45,
            })))}
            onCheckout={onCheckout}
            onMenu={onMenu}
          />
        </div>

        <div style={{ marginTop: "1rem" }}>
          <EbooksRow
            books={sections.ebooks || []}
            currencyMode={currencyMode}
            onViewAll={() => onViewTab("books")}
            onCheckout={onCheckout}
            onDownload={onDownload}
            onMenu={onMenu}
          />
        </div>

        <div style={{ marginTop: "1rem" }} className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <h4>Albums</h4>
            <button type="button" className={cx(buttonStyles({ variant: "ghost", size: "sm" }), styles.viewAll)} onClick={() => onViewTab("albums")}>
              View all
            </button>
          </div>
          {(sections.latestAlbums || []).length ? (
            <div className={styles.rowScroller}>
              {(sections.latestAlbums || []).map((album) => (
                <article key={album.id} className={styles.itemCard}>
                  <img
                    src={album.coverUrl || "/avatar.png"}
                    alt={album.title}
                    className={styles.itemThumb}
                  />
                  <p className={styles.itemTitle}>{album.title}</p>
                  <p className={styles.itemMeta}>
                    {Number(album.totalTracks || 0)} songs {"\u2022"} {currencyMode === "GLOBAL" ? `$${Number(album.priceUSD || 0).toLocaleString()}` : `NGN ${Number(album.priceNGN || 0).toLocaleString()}`}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.mutedText}>No albums yet.</p>
          )}
        </div>
      </div>

      <div>
        <LatestPodcastsWidget
          podcasts={sections.latestPodcasts || []}
          currencyMode={currencyMode}
          onViewAll={() => onViewTab("podcasts")}
          onCheckout={onCheckout}
          onPlay={(podcast, queue) => onPlay({
            id: podcast.id,
            title: podcast.title,
            coverUrl: podcast.coverUrl,
            creatorName: creator.displayName,
            type: "podcast",
            streamUrl: podcast.streamUrl,
            durationSec: podcast.durationSec,
            creatorId: creator.id,
            lockedPreview: !podcast.isFree && !podcast.canDownload,
            previewLimitSec: 45,
          }, queue.map((entry) => ({
            id: entry.id,
            title: entry.title,
            coverUrl: entry.coverUrl,
            creatorName: creator.displayName,
            type: "podcast",
            streamUrl: entry.streamUrl,
            durationSec: entry.durationSec,
            creatorId: creator.id,
            lockedPreview: !entry.isFree && !entry.canDownload,
            previewLimitSec: 45,
          })))}
        />
      </div>
    </div>
  );
}
